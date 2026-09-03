/*
  PostureAI_Realtime_TFLM.ino

  Realtime ESP32 inference sketch using active_posture_model.h.

  Data path, synchronized with tflite_preprocess_params.json:
    1. Read 5 MPU6050 sensors through TCA9548A.
    2. Build 10 raw posture axes in this exact order:
       C7_pitch, C7_roll, LS_pitch, LS_roll, RS_pitch, RS_roll,
       T5_pitch, T5_roll, L3_pitch, L3_roll.
    3. Align live normal posture to the training normal reference:
       raw_aligned = raw_live - live_normal_baseline + train_normal_reference.
    4. Compute 8 engineered features.
    5. StandardScaler:
       x_scaled[i] = (feature[i] - mean[i]) / scale[i].
    6. Invoke TensorFlow Lite Micro and print 5 posture probabilities.

  Required Arduino libraries:
    - TensorFlowLite_ESP32 or an Arduino-compatible TensorFlow Lite Micro port.
    - Built-in Wire library.

  Inference still runs at 50 Hz, but Serial is slowed down for inspection:
    t_ms,C7_pitch,C7_roll,LS_pitch,LS_roll,RS_pitch,RS_roll,T5_pitch,T5_roll,L3_pitch,L3_roll,pred,label,confidence
*/

#include <Arduino.h>
#include <Wire.h>
#include <math.h>

#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "active_posture_model.h"

// ============================================================
// BLE Configuration
// ============================================================
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

// ============================================================
// Runtime config
// ============================================================

#define SERIAL_BAUD 115200
#define SDA_PIN 21
#define SCL_PIN 22
#define I2C_FREQ 400000
#define TCA_ADDR 0x70

// Model was requested to run at 50 Hz.
#define SAMPLE_INTERVAL_US 20000UL

// Slow Serial output so the 10 sensor angles are easy to observe.
#define SERIAL_PRINT_INTERVAL_MS 500UL

// Set to 1 if you want sensor diagnostics.
#define DEBUG_MODE 1

// Set to 1 while checking why a class is saturated.
// It prints one diagnostic line every DEBUG_AI_EVERY_N_FRAMES frames.
#define DEBUG_AI_INPUT 0
#define DEBUG_AI_EVERY_N_FRAMES 25

// Button hooks are prepared for the next hardware revision. Set to 1 after
// wiring the buttons to the pins below using INPUT_PULLUP.
#define ENABLE_BUTTONS 0
#define CALIB_BUTTON_PIN 32
#define TEST_BUTTON_PIN 33
#define BUTTON_DEBOUNCE_MS 60UL

// Complementary filter. Higher alpha trusts gyro more.
#define FILTER_ALPHA 0.96f

// Keep this tiny. Model was trained on continuous values; aggressive deadzone can distort input.
#define DEADZONE_DEG 0.0f

#define ZERO_TIME_MS 5000UL
#define GYRO_CALIB_SAMPLES 200
#define GYRO_CALIB_TIMEOUT_MS 3000UL
#define TEST_WINDOW_SAMPLES 250

// ============================================================
// MPU6050 registers
// ============================================================

#define MPU_PWR_MGMT_1    0x6B
#define MPU_SMPLRT_DIV    0x19
#define MPU_CONFIG        0x1A
#define MPU_GYRO_CONFIG   0x1B
#define MPU_ACCEL_CONFIG  0x1C
#define MPU_ACCEL_XOUT_H  0x3B

// ============================================================
// Active TFLite model
// ============================================================

// Model bytes and preprocessing constants are generated in active_posture_model.h.
// Switch models with tools/register_esp32_posture_model.py activate --model-id <id>.

// ============================================================
// Model preprocessing constants
// ============================================================

static constexpr int kRawCount = kPostureModelRawCount;
static constexpr int kFeatureCount = kPostureModelFeatureCount;
static constexpr int kClassCount = kPostureModelClassCount;

const char* const* const kClassNames = kPostureClassNames;

// Order:
// C7_pitch, C7_roll, LS_pitch, LS_roll, RS_pitch, RS_roll,
// T5_pitch, T5_roll, L3_pitch, L3_roll.
const float* const kTrainNormalReference = kPostureTrainNormalReference;

// Order follows feature_columns.json exactly.
const float* const kScalerMean = kPostureScalerMean;
const float* const kScalerScale = kPostureScalerScale;

// ============================================================
// IMU definition and mapping
// ============================================================

struct IMU {
  const char* name;
  uint8_t channel;
  uint8_t addr;
  bool ok;
  bool lastReadOK;
  float gxOffset;
  float gyOffset;
  float gzOffset;
  float pitch;
  float roll;
  float pitchBaseline;
  float rollBaseline;
  unsigned long lastTimeMs;
};

// Same mapping as Code_esp32_dataset.ino.
IMU imuC7 = {"C7", 2, 0x68, false, false, 0, 0, 0, 0, 0, 0, 0, 0};
IMU imuRS = {"RS", 4, 0x69, false, false, 0, 0, 0, 0, 0, 0, 0, 0};
IMU imuLS = {"LS", 3, 0x68, false, false, 0, 0, 0, 0, 0, 0, 0, 0};
IMU imuT5 = {"T5", 1, 0x69, false, false, 0, 0, 0, 0, 0, 0, 0, 0};
IMU imuL3 = {"L3", 0, 0x68, false, false, 0, 0, 0, 0, 0, 0, 0, 0};

// ============================================================
// TFLite Micro globals
// ============================================================

tflite::MicroErrorReporter microErrorReporter;
tflite::ErrorReporter* errorReporter = &microErrorReporter;
const tflite::Model* model = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
TfLiteTensor* inputTensor = nullptr;
// TfLiteTensor* outputTensor = nullptr;

// This model is small; 32 KB is a conservative starting arena for ESP32.
constexpr int kTensorArenaSize = 32 * 1024;
alignas(16) uint8_t tensorArena[kTensorArenaSize];

// Resolver is intentionally minimal: the model only uses FullyConnected and Softmax.
tflite::MicroMutableOpResolver<2> resolver;

float rawAligned[kRawCount];
float liveAngles[kRawCount];
float features[kFeatureCount];
float lastC7Pitch = 0.0f;
float lastT5Pitch = 0.0f;
float lastL3Pitch = 0.0f;
bool haveLastPitch = false;
unsigned long lastInferenceUs = 0;
unsigned long nextSampleUs = 0;
unsigned long lastPrintMs = 0;
uint32_t frameCounter = 0;
#if ENABLE_BUTTONS
bool lastCalibButtonPressed = false;
bool lastTestButtonPressed = false;
unsigned long lastCalibButtonMs = 0;
unsigned long lastTestButtonMs = 0;
#endif

// ============================================================
// TCA9548A and low-level I2C
// ============================================================

bool selectTCA(uint8_t channel) {
  if (channel > 7) return false;
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(1 << channel);
  bool ok = (Wire.endTransmission() == 0);
  delayMicroseconds(150);
  return ok;
}

bool writeByte(IMU& imu, uint8_t reg, uint8_t data) {
  if (!selectTCA(imu.channel)) return false;
  Wire.beginTransmission(imu.addr);
  Wire.write(reg);
  Wire.write(data);
  return Wire.endTransmission() == 0;
}

bool readBytesOnce(IMU& imu, uint8_t reg, uint8_t count, uint8_t* dest) {
  if (!selectTCA(imu.channel)) return false;

  Wire.beginTransmission(imu.addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    while (Wire.available()) Wire.read();
    return false;
  }

  int n = Wire.requestFrom((int)imu.addr, (int)count);
  if (n != count) {
    while (Wire.available()) Wire.read();
    return false;
  }

  for (int i = 0; i < count; i++) {
    dest[i] = Wire.read();
  }
  return true;
}

bool readBytes(IMU& imu, uint8_t reg, uint8_t count, uint8_t* dest) {
  for (int retry = 0; retry < 2; retry++) {
    if (readBytesOnce(imu, reg, count, dest)) return true;
    delayMicroseconds(300);
    yield();
  }
  return false;
}

bool checkMPU(IMU& imu) {
  if (!selectTCA(imu.channel)) return false;
  Wire.beginTransmission(imu.addr);
  return Wire.endTransmission() == 0;
}

void printIMUProbe(const IMU& imu) {
  bool tcaOk = selectTCA(imu.channel);
  bool ack = false;
  if (tcaOk) {
    Wire.beginTransmission(imu.addr);
    ack = (Wire.endTransmission() == 0);
  }

  Serial.print("# probe ");
  Serial.print(imu.name);
  Serial.print(" ch=");
  Serial.print(imu.channel);
  Serial.print(" addr=0x");
  Serial.print(imu.addr, HEX);
  Serial.print(" tca=");
  Serial.print(tcaOk);
  Serial.print(" ack=");
  Serial.println(ack);
}

void probeConfiguredIMUs() {
  Serial.println("# Probing configured IMUs...");
  printIMUProbe(imuC7);
  printIMUProbe(imuLS);
  printIMUProbe(imuRS);
  printIMUProbe(imuT5);
  printIMUProbe(imuL3);
}

// ============================================================
// MPU setup and sensor fusion
// ============================================================

bool initMPU(IMU& imu) {
  imu.ok = false;
  imu.lastReadOK = false;
  imu.gxOffset = 0.0f;
  imu.gyOffset = 0.0f;
  imu.gzOffset = 0.0f;
  imu.pitch = 0.0f;
  imu.roll = 0.0f;
  imu.pitchBaseline = 0.0f;
  imu.rollBaseline = 0.0f;
  imu.lastTimeMs = millis();

  if (!checkMPU(imu)) return false;
  delay(20);

  if (!writeByte(imu, MPU_PWR_MGMT_1, 0x00)) return false;
  delay(50);

  bool ok = true;
  ok &= writeByte(imu, MPU_SMPLRT_DIV, 4);       // 200 Hz internal sample rate.
  ok &= writeByte(imu, MPU_CONFIG, 0x03);        // DLPF about 44 Hz.
  ok &= writeByte(imu, MPU_GYRO_CONFIG, 0x00);   // +/-250 dps.
  ok &= writeByte(imu, MPU_ACCEL_CONFIG, 0x00);  // +/-2g.
  delay(20);

  imu.ok = ok;
  imu.lastReadOK = ok;
  return ok;
}

bool readRaw(IMU& imu,
             int16_t& ax, int16_t& ay, int16_t& az,
             int16_t& gx, int16_t& gy, int16_t& gz) {
  if (!imu.ok) {
    imu.lastReadOK = false;
    return false;
  }

  uint8_t buf[14];
  if (!readBytes(imu, MPU_ACCEL_XOUT_H, 14, buf)) {
    imu.lastReadOK = false;
    return false;
  }

  ax = ((int16_t)buf[0] << 8) | buf[1];
  ay = ((int16_t)buf[2] << 8) | buf[3];
  az = ((int16_t)buf[4] << 8) | buf[5];
  gx = ((int16_t)buf[8] << 8) | buf[9];
  gy = ((int16_t)buf[10] << 8) | buf[11];
  gz = ((int16_t)buf[12] << 8) | buf[13];

  imu.lastReadOK = true;
  return true;
}

void calibrateGyro(IMU& imu) {
  if (!imu.ok) return;

  long sumGX = 0;
  long sumGY = 0;
  long sumGZ = 0;
  int valid = 0;
  unsigned long startTime = millis();

  for (int i = 0; i < GYRO_CALIB_SAMPLES; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    if (readRaw(imu, ax, ay, az, gx, gy, gz)) {
      sumGX += gx;
      sumGY += gy;
      sumGZ += gz;
      valid++;
    }
    if (millis() - startTime > GYRO_CALIB_TIMEOUT_MS) break;
    delay(3);
    yield();
  }

  if (valid > 20) {
    imu.gxOffset = sumGX / (float)valid;
    imu.gyOffset = sumGY / (float)valid;
    imu.gzOffset = sumGZ / (float)valid;
  }
}

bool readAngle(IMU& imu) {
  if (!imu.ok) {
    imu.lastReadOK = false;
    return false;
  }

  int16_t axRaw, ayRaw, azRaw, gxRaw, gyRaw, gzRaw;
  if (!readRaw(imu, axRaw, ayRaw, azRaw, gxRaw, gyRaw, gzRaw)) {
    imu.lastReadOK = false;
    return false;
  }

  unsigned long now = millis();
  float dt = (now - imu.lastTimeMs) / 1000.0f;
  imu.lastTimeMs = now;
  if (dt <= 0.0f || dt > 1.0f) {
    dt = SAMPLE_INTERVAL_US / 1000000.0f;
  }

  float ax = axRaw / 16384.0f;
  float ay = ayRaw / 16384.0f;
  float az = azRaw / 16384.0f;
  float gx = (gxRaw - imu.gxOffset) / 131.0f;
  float gy = (gyRaw - imu.gyOffset) / 131.0f;

  float pitchAcc = atan2f(-ax, sqrtf(ay * ay + az * az)) * 180.0f / PI;
  float rollAcc = atan2f(ay, az) * 180.0f / PI;

  imu.pitch = FILTER_ALPHA * (imu.pitch + gy * dt) + (1.0f - FILTER_ALPHA) * pitchAcc;
  imu.roll = FILTER_ALPHA * (imu.roll + gx * dt) + (1.0f - FILTER_ALPHA) * rollAcc;
  imu.lastReadOK = true;
  return true;
}

float applyDeadzone(float value) {
  if (fabsf(value) < DEADZONE_DEG) return 0.0f;
  return value;
}

// ============================================================
// Live normal baseline and model feature engineering
// ============================================================

void captureNormalBaseline() {
  Serial.println("# Hold normal_idle posture. Capturing live baseline...");

  float sums[kRawCount] = {0};
  int count = 0;
  unsigned long start = millis();

  while (millis() - start < ZERO_TIME_MS) {
    bool okC7 = readAngle(imuC7);
    bool okLS = readAngle(imuLS);
    bool okRS = readAngle(imuRS);
    bool okT5 = readAngle(imuT5);
    bool okL3 = readAngle(imuL3);

    if (okC7 && okLS && okRS && okT5 && okL3) {
      sums[0] += imuC7.pitch;
      sums[1] += imuC7.roll;
      sums[2] += imuLS.pitch;
      sums[3] += imuLS.roll;
      sums[4] += imuRS.pitch;
      sums[5] += imuRS.roll;
      sums[6] += imuT5.pitch;
      sums[7] += imuT5.roll;
      sums[8] += imuL3.pitch;
      sums[9] += imuL3.roll;
      count++;
    }

    delay(5);
    yield();
  }

  if (count <= 0) {
    Serial.println("# ERROR: No valid baseline samples. Check sensors.");
    return;
  }

  imuC7.pitchBaseline = sums[0] / count;
  imuC7.rollBaseline = sums[1] / count;
  imuLS.pitchBaseline = sums[2] / count;
  imuLS.rollBaseline = sums[3] / count;
  imuRS.pitchBaseline = sums[4] / count;
  imuRS.rollBaseline = sums[5] / count;
  imuT5.pitchBaseline = sums[6] / count;
  imuT5.rollBaseline = sums[7] / count;
  imuL3.pitchBaseline = sums[8] / count;
  imuL3.rollBaseline = sums[9] / count;

  Serial.print("# Baseline samples=");
  Serial.println(count);
}

void buildRawAligned() {
  // raw_aligned = signed_live_angle - signed_live_baseline + train_normal_reference.
  liveAngles[0] = applyDeadzone(imuC7.pitch - imuC7.pitchBaseline);
  liveAngles[1] = applyDeadzone(imuC7.roll - imuC7.rollBaseline);
  liveAngles[2] = applyDeadzone(imuLS.pitch - imuLS.pitchBaseline);
  liveAngles[3] = applyDeadzone(imuLS.roll - imuLS.rollBaseline);
  liveAngles[4] = applyDeadzone(imuRS.pitch - imuRS.pitchBaseline);
  liveAngles[5] = applyDeadzone(imuRS.roll - imuRS.rollBaseline);
  liveAngles[6] = applyDeadzone(imuT5.pitch - imuT5.pitchBaseline);
  liveAngles[7] = applyDeadzone(imuT5.roll - imuT5.rollBaseline);
  liveAngles[8] = applyDeadzone(imuL3.pitch - imuL3.pitchBaseline);
  liveAngles[9] = applyDeadzone(imuL3.roll - imuL3.rollBaseline);

  for (int i = 0; i < kRawCount; i++) {
    rawAligned[i] = liveAngles[i] + kTrainNormalReference[i];
  }
}

void buildFeatures(float dtSec) {
  for (int i = 0; i < kRawCount; i++) {
    features[i] = rawAligned[i];
  }

  features[10] = rawAligned[1] - rawAligned[7];            // Kyphosis_1
  features[11] = rawAligned[7] - rawAligned[9];            // Kyphosis_2
  features[12] = rawAligned[1] - rawAligned[9];            // Kyphosis_3
  features[13] = (rawAligned[3] + rawAligned[5]) * 0.5f;   // Shoulder_roll_delta
  features[14] = rawAligned[2] - rawAligned[4];            // Shoulder_pitch_delta

  if (!haveLastPitch || dtSec <= 0.0001f) {
    features[15] = 0.0f;
    features[16] = 0.0f;
    features[17] = 0.0f;
    haveLastPitch = true;
  } else {
    features[15] = (rawAligned[0] - lastC7Pitch) / dtSec;
    features[16] = (rawAligned[6] - lastT5Pitch) / dtSec;
    features[17] = (rawAligned[8] - lastL3Pitch) / dtSec;
  }

  lastC7Pitch = rawAligned[0];
  lastT5Pitch = rawAligned[6];
  lastL3Pitch = rawAligned[8];
}

void scaleIntoModelInput() {
  for (int i = 0; i < kFeatureCount; i++) {
    inputTensor->data.f[i] = (features[i] - kScalerMean[i]) / kScalerScale[i];
  }
}

bool isNearLiveNormalBaseline() {
  float sumSq = 0.0f;
  float maxAbs = 0.0f;
  for (int i = 0; i < kRawCount; i++) {
    float absValue = fabsf(liveAngles[i]);
    if (absValue > maxAbs) maxAbs = absValue;
    sumSq += liveAngles[i] * liveAngles[i];
  }
  float rms = sqrtf(sumSq / kRawCount);
  return maxAbs <= kPostureNearNormalMaxAbsDeg && rms <= kPostureNearNormalRmsDeg;
}

int findBestClassExcept(const float* probabilities, int excludedIndex) {
  int bestIndex = -1;
  float bestValue = -1.0f;
  for (int i = 0; i < kClassCount; i++) {
    if (i == excludedIndex) continue;
    if (probabilities[i] > bestValue) {
      bestValue = probabilities[i];
      bestIndex = i;
    }
  }
  return bestIndex;
}

void applyDecisionPolicy(const float* probabilities,
                         int modelPred,
                         int& reportedPred,
                         float& reportedConfidence) {
  reportedPred = modelPred;
  reportedConfidence = probabilities[modelPred];

  if (kPostureNormalIdleIndex >= 0 && isNearLiveNormalBaseline()) {
    reportedPred = kPostureNormalIdleIndex;
    reportedConfidence = probabilities[kPostureNormalIdleIndex];
    return;
  }

  if (kPostureBadPostureIndex >= 0 &&
      modelPred == kPostureBadPostureIndex &&
      probabilities[modelPred] < kPostureBadPostureMinConfidence) {
    int alternative = findBestClassExcept(probabilities, kPostureBadPostureIndex);
    if (alternative >= 0) {
      reportedPred = alternative;
      reportedConfidence = probabilities[alternative];
    }
  }
}

// ============================================================
// TFLite Micro
// ============================================================

bool initModel() {
  model = tflite::GetModel(kPostureModelData);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("# ERROR: TFLite schema mismatch.");
    return false;
  }

  if (resolver.AddFullyConnected() != kTfLiteOk) {
    Serial.println("# ERROR: AddFullyConnected failed.");
    return false;
  }
  if (resolver.AddSoftmax() != kTfLiteOk) {
    Serial.println("# ERROR: AddSoftmax failed.");
    return false;
  }

  static tflite::MicroInterpreter staticInterpreter(
      model, resolver, tensorArena, kTensorArenaSize, errorReporter);
  interpreter = &staticInterpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("# ERROR: AllocateTensors failed. Increase kTensorArenaSize.");
    return false;
  }

  inputTensor = interpreter->input(0);
  outputTensor = interpreter->output(0);

  if (inputTensor->type != kTfLiteFloat32 || outputTensor->type != kTfLiteFloat32) {
    Serial.println("# ERROR: Model input/output must be float32.");
    return false;
  }

  if (inputTensor->dims->size != 2 || inputTensor->dims->data[1] != kFeatureCount) {
    Serial.println("# ERROR: Model input shape mismatch.");
    return false;
  }
  if (outputTensor->dims->size != 2 || outputTensor->dims->data[1] != kClassCount) {
    Serial.println("# ERROR: Model output shape mismatch.");
    return false;
  }

  Serial.println("# TFLM ready.");
  return true;
}

void printHeader() {
  Serial.println("t_ms,C7_pitch,C7_roll,LS_pitch,LS_roll,RS_pitch,RS_roll,T5_pitch,T5_roll,L3_pitch,L3_roll,pred,label,confidence");
}

void printPrediction(unsigned long nowMs, int predIndex, float confidence) {
  String csv = String(nowMs) + ",";
  for (int i = 0; i < kRawCount; i++) {
    if (i) csv += ",";
    csv += String(liveAngles[i], 3);
  }
  csv += "," + String(predIndex) + "," + String(kClassNames[predIndex]) + "," + String(confidence, 6);
  
  Serial.println(csv);

  if (deviceConnected && pCharacteristic != NULL) {
    pCharacteristic->setValue(csv.c_str());
    pCharacteristic->notify();
  }
}

void maybePrintPrediction(unsigned long nowMs, int predIndex, float confidence) {
  if (nowMs - lastPrintMs < SERIAL_PRINT_INTERVAL_MS) return;
  lastPrintMs = nowMs;
  printPrediction(nowMs, predIndex, confidence);
}

void printAiDebug(float dtSec, int predIndex, const float* probabilities, unsigned long processUs) {
#if DEBUG_AI_INPUT
  if ((frameCounter % DEBUG_AI_EVERY_N_FRAMES) != 0) return;

  float scaledMin = inputTensor->data.f[0];
  float scaledMax = inputTensor->data.f[0];
  for (int i = 1; i < kFeatureCount; i++) {
    float v = inputTensor->data.f[i];
    if (v < scaledMin) scaledMin = v;
    if (v > scaledMax) scaledMax = v;
  }

  Serial.print("#DBG,frame=");
  Serial.print(frameCounter);
  Serial.print(",dt=");
  Serial.print(dtSec, 5);
  Serial.print(",proc_us=");
  Serial.print(processUs);
  Serial.print(",pred=");
  Serial.print(predIndex);
  Serial.print(",");
  Serial.print(kClassNames[predIndex]);
  Serial.print(",p=[");
  for (int i = 0; i < kClassCount; i++) {
    if (i) Serial.print(" ");
    Serial.print(probabilities[i], 6);
  }
  Serial.print("],scaled_min=");
  Serial.print(scaledMin, 3);
  Serial.print(",scaled_max=");
  Serial.print(scaledMax, 3);

  Serial.print(",raw=[");
  for (int i = 0; i < kRawCount; i++) {
    if (i) Serial.print(" ");
    Serial.print(rawAligned[i], 2);
  }
  Serial.print("],eng=[");
  for (int i = kRawCount; i < kFeatureCount; i++) {
    if (i > kRawCount) Serial.print(" ");
    Serial.print(features[i], 2);
  }
  Serial.println("]");
#else
  (void)dtSec;
  (void)predIndex;
  (void)probabilities;
  (void)processUs;
#endif
}

void printReadFail(bool okC7, bool okLS, bool okRS, bool okT5, bool okL3) {
#if DEBUG_MODE
  static unsigned long lastReadFailPrintMs = 0;
  unsigned long nowMs = millis();
  if (nowMs - lastReadFailPrintMs < SERIAL_PRINT_INTERVAL_MS) return;
  lastReadFailPrintMs = nowMs;

  Serial.print("# READ_FAIL C7=");
  Serial.print(okC7);
  Serial.print(" LS=");
  Serial.print(okLS);
  Serial.print(" RS=");
  Serial.print(okRS);
  Serial.print(" T5=");
  Serial.print(okT5);
  Serial.print(" L3=");
  Serial.println(okL3);
#else
  (void)okC7;
  (void)okLS;
  (void)okRS;
  (void)okT5;
  (void)okL3;
#endif
}

void resetInferenceHistory() {
  bool s1 = readAngle(imuC7);
  bool s2 = readAngle(imuLS);
  bool s3 = readAngle(imuRS);
  bool s4 = readAngle(imuT5);
  bool s5 = readAngle(imuL3);
  (void)s1;
  (void)s2;
  (void)s3;
  (void)s4;
  (void)s5;

  buildRawAligned();
  lastC7Pitch = rawAligned[0];
  lastT5Pitch = rawAligned[6];
  lastL3Pitch = rawAligned[8];
  haveLastPitch = true;

  lastInferenceUs = micros();
  nextSampleUs = micros() + SAMPLE_INTERVAL_US;
}

void runWindowedSelfTest() {
  Serial.println("# TEST_WINDOW_START samples=250 rate_hz=50");

  int votes[kClassCount] = {0};
  float probabilitySums[kClassCount] = {0};
  unsigned long targetUs = micros();
  unsigned long previousUs = micros();

  for (int sample = 0; sample < TEST_WINDOW_SAMPLES; sample++) {
    while ((long)(micros() - targetUs) < 0) {
      delayMicroseconds(200);
      yield();
    }
    targetUs += SAMPLE_INTERVAL_US;

    bool okC7 = readAngle(imuC7);
    bool okLS = readAngle(imuLS);
    bool okRS = readAngle(imuRS);
    bool okT5 = readAngle(imuT5);
    bool okL3 = readAngle(imuL3);
    if (!(okC7 && okLS && okRS && okT5 && okL3)) {
      printReadFail(okC7, okLS, okRS, okT5, okL3);
    }

    unsigned long currentUs = micros();
    float dtSec = (currentUs - previousUs) / 1000000.0f;
    previousUs = currentUs;
    if (dtSec <= 0.0f || dtSec > 0.2f) {
      dtSec = SAMPLE_INTERVAL_US / 1000000.0f;
    }

    buildRawAligned();
    buildFeatures(dtSec);
    scaleIntoModelInput();

    if (interpreter->Invoke() != kTfLiteOk) {
      Serial.println("# ERROR: Invoke failed during test window.");
      resetInferenceHistory();
      return;
    }

    float probs[kClassCount];
    int pred = 0;
    float best = outputTensor->data.f[0];
    for (int i = 0; i < kClassCount; i++) {
      probs[i] = outputTensor->data.f[i];
      probabilitySums[i] += probs[i];
      if (probs[i] > best) {
        best = probs[i];
        pred = i;
      }
    }

    int reportedPred = pred;
    float reportedConfidence = probs[pred];
    applyDecisionPolicy(probs, pred, reportedPred, reportedConfidence);
    votes[reportedPred]++;
  }

  int voteWinner = 0;
  int bestVotes = votes[0];
  int avgWinner = 0;
  float bestAverage = probabilitySums[0] / TEST_WINDOW_SAMPLES;
  for (int i = 1; i < kClassCount; i++) {
    if (votes[i] > bestVotes) {
      bestVotes = votes[i];
      voteWinner = i;
    }
    float average = probabilitySums[i] / TEST_WINDOW_SAMPLES;
    if (average > bestAverage) {
      bestAverage = average;
      avgWinner = i;
    }
  }

  Serial.print("# TEST_WINDOW_RESULT vote_label=");
  Serial.print(kClassNames[voteWinner]);
  Serial.print(",vote_count=");
  Serial.print(bestVotes);
  Serial.print(",avg_label=");
  Serial.print(kClassNames[avgWinner]);
  Serial.print(",avg_confidence=");
  Serial.print(bestAverage, 6);
  Serial.print(",votes=[");
  for (int i = 0; i < kClassCount; i++) {
    if (i) Serial.print(" ");
    Serial.print(kClassNames[i]);
    Serial.print(":");
    Serial.print(votes[i]);
  }
  Serial.println("]");

  resetInferenceHistory();
}

#if ENABLE_BUTTONS
void handleButtons() {
  unsigned long nowMs = millis();
  bool calibPressed = (digitalRead(CALIB_BUTTON_PIN) == LOW);
  bool testPressed = (digitalRead(TEST_BUTTON_PIN) == LOW);

  if (calibPressed && !lastCalibButtonPressed && nowMs - lastCalibButtonMs > BUTTON_DEBOUNCE_MS) {
    lastCalibButtonMs = nowMs;
    Serial.println("# CALIB_BUTTON pressed");
    captureNormalBaseline();
    resetInferenceHistory();
  }

  if (testPressed && !lastTestButtonPressed && nowMs - lastTestButtonMs > BUTTON_DEBOUNCE_MS) {
    lastTestButtonMs = nowMs;
    Serial.println("# TEST_BUTTON pressed");
    runWindowedSelfTest();
  }

  lastCalibButtonPressed = calibPressed;
  lastTestButtonPressed = testPressed;
}
#endif

// ============================================================
// Arduino setup/loop
// ============================================================

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1500);

  Serial.println("# PostureAI realtime TFLM boot");
  Serial.print("# Active model id: ");
  Serial.println(kActivePostureModelId);
  Serial.print("# Active model file: ");
  Serial.println(kActivePostureModelTfliteFile);
  Serial.print("# Active model bytes: ");
  Serial.println(kPostureModelDataLen);
  Serial.println("# Inference 50 Hz, Serial output slowed for angle inspection.");
  printHeader();

#if ENABLE_BUTTONS
  pinMode(CALIB_BUTTON_PIN, INPUT_PULLUP);
  pinMode(TEST_BUTTON_PIN, INPUT_PULLUP);
#endif

  Wire.begin(SDA_PIN, SCL_PIN, I2C_FREQ);
  Wire.setTimeOut(20);
  delay(300);
  
  // Initialize BLE
  BLEDevice::init("CarePosture_ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0); 
  BLEDevice::startAdvertising();
  Serial.println("# BLE ready. Waiting for connections...");
  
  probeConfiguredIMUs();

  bool okC7 = initMPU(imuC7);
  bool okRS = initMPU(imuRS);
  bool okLS = initMPU(imuLS);
  bool okT5 = initMPU(imuT5);
  bool okL3 = initMPU(imuL3);

  Serial.print("# init C7=");
  Serial.print(okC7);
  Serial.print(" RS=");
  Serial.print(okRS);
  Serial.print(" LS=");
  Serial.print(okLS);
  Serial.print(" T5=");
  Serial.print(okT5);
  Serial.print(" L3=");
  Serial.println(okL3);

  if (!(okC7 && okRS && okLS && okT5 && okL3)) {
    Serial.println("# ERROR: At least one IMU failed. Inference will not be reliable.");
  }

  calibrateGyro(imuC7);
  calibrateGyro(imuRS);
  calibrateGyro(imuLS);
  calibrateGyro(imuT5);
  calibrateGyro(imuL3);

  captureNormalBaseline();

  if (!initModel()) {
    Serial.println("# ERROR: Model init failed. Stop.");
    while (true) {
      delay(1000);
    }
  }

  resetInferenceHistory();
}

void loop() {
#if ENABLE_BUTTONS
  handleButtons();
#endif

  unsigned long frameStartUs = micros();
  unsigned long nowUs = micros();
  if ((long)(nowUs - nextSampleUs) < 0) {
    return;
  }
  nextSampleUs += SAMPLE_INTERVAL_US;
  frameCounter++;

  bool okC7 = readAngle(imuC7);
  bool okLS = readAngle(imuLS);
  bool okRS = readAngle(imuRS);
  bool okT5 = readAngle(imuT5);
  bool okL3 = readAngle(imuL3);

  if (!(okC7 && okLS && okRS && okT5 && okL3)) {
    printReadFail(okC7, okLS, okRS, okT5, okL3);
  }

  unsigned long currentUs = micros();
  float dtSec = (currentUs - lastInferenceUs) / 1000000.0f;
  lastInferenceUs = currentUs;
  if (dtSec <= 0.0f || dtSec > 0.2f) {
    dtSec = SAMPLE_INTERVAL_US / 1000000.0f;
  }

  buildRawAligned();
  buildFeatures(dtSec);
  scaleIntoModelInput();

  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println("# ERROR: Invoke failed.");
    return;
  }

  float probs[kClassCount];
  int pred = 0;
  float best = outputTensor->data.f[0];
  for (int i = 0; i < kClassCount; i++) {
    probs[i] = outputTensor->data.f[i];
    if (probs[i] > best) {
      best = probs[i];
      pred = i;
    }
  }

  int reportedPred = pred;
  float reportedConfidence = probs[pred]; 
  applyDecisionPolicy(probs, pred, reportedPred, reportedConfidence);

  maybePrintPrediction(millis(), reportedPred, reportedConfidence);
  printAiDebug(dtSec, pred, probs, micros() - frameStartUs);

  // If processing overruns, resync to avoid a long burst of delayed samples.
  unsigned long afterUs = micros();
  if ((long)(afterUs - nextSampleUs) > (long)SAMPLE_INTERVAL_US) {
    nextSampleUs = afterUs + SAMPLE_INTERVAL_US;
  }

  // Handle BLE disconnects/reconnects
  if (!deviceConnected && oldDeviceConnected) {
      delay(500); // give the bluetooth stack the chance to get things ready
      pServer->startAdvertising(); // restart advertising
      Serial.println("# BLE disconnected. Restarting advertising...");
      oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
      Serial.println("# BLE connected!");
  }
}
