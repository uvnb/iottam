/*******************************************************
 * CareBot AI Health Monitor
 *
 * ESP-01 / ESP8266
 *
 * BRD2709A UART ---> ESP8266 ---> WiFi Web Server
 *
 * DEBUG MODE:
 * - Hiển thị TOÀN BỘ dữ liệu ESP nhận từ UART lên Web
 * - Hiển thị raw bytes
 * - Hiển thị packet / line cuối cùng
 * - Đếm tổng byte nhận được
 * - Đếm tổng packet nhận được
 * - Không reload trang
 *******************************************************/

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

/*******************************************************
 * WIFI CONFIG
 *******************************************************/
const char* WIFI_SSID = "tam";
const char* WIFI_PASSWORD = "11111111";

/*******************************************************
 * WEB SERVER
 *******************************************************/
ESP8266WebServer server(80);

/*******************************************************
 * UART CONFIG
 *
 * ESP-01 hardware UART:
 *
 * GPIO1 = TX
 * GPIO3 = RX
 *
 * BRD2709A:
 * PC02 TX ---> GPIO3 RX
 * PC01 RX <--- GPIO1 TX
 * GND -------- GND
 *******************************************************/
#define UART_BAUD 115200

/*******************************************************
 * UART DEBUG BUFFERS
 *******************************************************/

// Buffer lưu RAW UART log gần nhất
const size_t RAW_LOG_SIZE = 8000;

char rawLog[RAW_LOG_SIZE];
size_t rawLogLength = 0;

// Buffer ghép từng dòng UART
const size_t LINE_BUFFER_SIZE = 512;

char lineBuffer[LINE_BUFFER_SIZE];
size_t lineLength = 0;

// Dòng hoàn chỉnh cuối cùng
String lastLine = "";

/*******************************************************
 * UART STATISTICS
 *******************************************************/
unsigned long totalBytesReceived = 0;
unsigned long totalLinesReceived = 0;

unsigned long lastByteTime = 0;
unsigned long bootTime = 0;

/*******************************************************
 * DATA VALUES
 *******************************************************/
unsigned long dataID = 0;

float pef = 0.0;

float heartRate = 0.0;
float spo2 = 0.0;
float respiratoryRate = 0.0;

float temperature = 0.0;
float humidity = 0.0;

int pm1 = 0;
int pm25 = 0;
int pm10 = 0;

int aqi = 0;
int tvoc = 0;
int eco2 = 0;

String fingerStatus = "NO DATA";

/*******************************************************
 * RAW LOG APPEND
 *
 * Lưu MỌI BYTE UART nhận được.
 *
 * Khi đầy buffer:
 * bỏ dữ liệu cũ nhất để tiếp tục ghi dữ liệu mới.
 *******************************************************/
void appendRawChar(char c)
{
  if (rawLogLength < RAW_LOG_SIZE - 1)
  {
    rawLog[rawLogLength++] = c;
    rawLog[rawLogLength] = '\0';
  }
  else
  {
    // Buffer đầy:
    // dịch dữ liệu sang trái để bỏ phần cũ
    memmove(
      rawLog,
      rawLog + 1,
      RAW_LOG_SIZE - 2
    );

    rawLog[RAW_LOG_SIZE - 2] = c;
    rawLog[RAW_LOG_SIZE - 1] = '\0';

    rawLogLength = RAW_LOG_SIZE - 1;
  }
}

/*******************************************************
 * HTML ESCAPE
 *
 * Tránh ký tự UART làm lỗi HTML.
 *******************************************************/
String htmlEscape(const char* input)
{
  String output = "";

  while (*input)
  {
    char c = *input;

    switch (c)
    {
      case '&':
        output += "&amp;";
        break;

      case '<':
        output += "&lt;";
        break;

      case '>':
        output += "&gt;";
        break;

      case '"':
        output += "&quot;";
        break;

      case '\'':
        output += "&#39;";
        break;

      case '\r':
        break;

      case '\n':
        output += "\n";
        break;

      default:
        output += c;
        break;
    }

    input++;
  }

  return output;
}

/*******************************************************
 * GET VALUE
 *
 * Tìm giá trị dạng:
 *
 * KEY=VALUE
 *
 * Ví dụ:
 *
 * PM1=14
 * PEF=388.4
 * TEMP=32.6
 *******************************************************/
String getValue(String data, String key)
{
  String searchKey = key + "=";

  int start = data.indexOf(searchKey);

  if (start < 0)
  {
    return "";
  }

  start += searchKey.length();

  int end = data.indexOf(",", start);

  if (end < 0)
  {
    end = data.length();
  }

  String value = data.substring(start, end);

  value.trim();

  return value;
}

/*******************************************************
 * PARSE UART LINE
 *
 * ESP vẫn lưu RAW LOG dù dữ liệu có sai.
 *
 * Hàm này chỉ cố gắng tách dữ liệu nếu đúng format.
 *******************************************************/
void parseUARTLine(String data)
{
  data.trim();

  if (data.length() == 0)
  {
    return;
  }

  lastLine = data;

  // DATA_ID
  String value;

  value = getValue(data, "ID");

  if (value.length() > 0)
  {
    dataID = value.toInt();
  }

  // PM1
  value = getValue(data, "PM1");

  if (value.length() > 0)
  {
    pm1 = value.toInt();
  }

  // PM25
  value = getValue(data, "PM25");

  if (value.length() > 0)
  {
    pm25 = value.toInt();
  }

  // PM10
  value = getValue(data, "PM10");

  if (value.length() > 0)
  {
    pm10 = value.toInt();
  }

  // AQI
  value = getValue(data, "AQI");

  if (value.length() > 0)
  {
    aqi = value.toInt();
  }

  // TVOC
  value = getValue(data, "TVOC");

  if (value.length() > 0)
  {
    tvoc = value.toInt();
  }

  // ECO2
  value = getValue(data, "ECO2");

  if (value.length() > 0)
  {
    eco2 = value.toInt();
  }

  // TEMP
  value = getValue(data, "TEMP");

  if (value.length() > 0)
  {
    temperature = value.toFloat();
  }

  // HUM
  value = getValue(data, "HUM");

  if (value.length() > 0)
  {
    humidity = value.toFloat();
  }

  // FINGER
  value = getValue(data, "FINGER");

  if (value.length() > 0)
  {
    fingerStatus = value;
  }

  // HR
  value = getValue(data, "HR");

  if (value.length() > 0)
  {
    heartRate = value.toFloat();
  }

  // SPO2
  value = getValue(data, "SPO2");

  if (value.length() > 0)
  {
    spo2 = value.toFloat();
  }

  // RR
  value = getValue(data, "RR");

  if (value.length() > 0)
  {
    respiratoryRate = value.toFloat();
  }

  // PEF
  value = getValue(data, "PEF");

  if (value.length() > 0)
  {
    pef = value.toFloat();
  }
}

/*******************************************************
 * UART RECEIVE
 *
 * ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT.
 *
 * Đọc TẤT CẢ byte từ BRD2709A.
 *
 * Mỗi byte:
 * 1. Đưa vào RAW LOG
 * 2. Đếm total bytes
 * 3. Ghép thành line
 *
 * Khi nhận '\n':
 * -> hoàn thành 1 packet
 * -> parse dữ liệu
 *******************************************************/
void processUART()
{
  while (Serial.available() > 0)
  {
    char c = (char)Serial.read();

    /***************************************************
     * Đã nhận được 1 byte từ UART
     ***************************************************/
    totalBytesReceived++;

    lastByteTime = millis();

    /***************************************************
     * Lưu RAW LOG
     ***************************************************/
    appendRawChar(c);

    /***************************************************
     * Nếu gặp newline
     ***************************************************/
    if (c == '\n')
    {
      lineBuffer[lineLength] = '\0';

      String receivedLine = String(lineBuffer);

      receivedLine.trim();

      if (receivedLine.length() > 0)
      {
        totalLinesReceived++;

        parseUARTLine(receivedLine);
      }

      // Reset line buffer
      lineLength = 0;

      memset(
        lineBuffer,
        0,
        sizeof(lineBuffer)
      );
    }

    /***************************************************
     * Không lưu \r vào line buffer
     ***************************************************/
    else if (c != '\r')
    {
      if (lineLength < LINE_BUFFER_SIZE - 1)
      {
        lineBuffer[lineLength++] = c;
      }
      else
      {
        // Buffer line đầy
        // Reset để tránh lỗi tràn
        lineLength = 0;

        memset(
          lineBuffer,
          0,
          sizeof(lineBuffer)
        );
      }
    }
  }
}

/*******************************************************
 * UART STATUS
 *******************************************************/
String getUARTStatus()
{
  // Chưa nhận byte nào từ lúc bật nguồn
  if (totalBytesReceived == 0)
  {
    return "WAITING FOR UART";
  }

  unsigned long now = millis();

  // Nếu quá 3 giây không nhận được byte
  if ((now - lastByteTime) > 3000)
  {
    return "UART DATA LOST";
  }

  return "UART RECEIVING";
}

/*******************************************************
 * API JSON
 *
 * Web JavaScript gọi /api mỗi 500ms.
 *
 * Không reload toàn bộ trang.
 *******************************************************/
void handleAPI()
{
  String json = "{";

  json += "\"status\":\"";
  json += getUARTStatus();
  json += "\",";

  json += "\"dataID\":";
  json += String(dataID);
  json += ",";

  json += "\"totalBytes\":";
  json += String(totalBytesReceived);
  json += ",";

  json += "\"totalLines\":";
  json += String(totalLinesReceived);
  json += ",";

  json += "\"lastByteAgo\":";
  
  if (totalBytesReceived == 0)
  {
    json += "-1";
  }
  else
  {
    json += String(millis() - lastByteTime);
  }

  json += ",";

  json += "\"pef\":";
  json += String(pef, 1);
  json += ",";

  json += "\"hr\":";
  json += String(heartRate, 1);
  json += ",";

  json += "\"spo2\":";
  json += String(spo2, 1);
  json += ",";

  json += "\"rr\":";
  json += String(respiratoryRate, 1);
  json += ",";

  json += "\"temp\":";
  json += String(temperature, 1);
  json += ",";

  json += "\"hum\":";
  json += String(humidity, 1);
  json += ",";

  json += "\"pm1\":";
  json += String(pm1);
  json += ",";

  json += "\"pm25\":";
  json += String(pm25);
  json += ",";

  json += "\"pm10\":";
  json += String(pm10);
  json += ",";

  json += "\"aqi\":";
  json += String(aqi);
  json += ",";

  json += "\"tvoc\":";
  json += String(tvoc);
  json += ",";

  json += "\"eco2\":";
  json += String(eco2);
  json += ",";

  json += "\"finger\":\"";
  json += fingerStatus;
  json += "\",";

  json += "\"lastLine\":\"";
  json += lastLine;
  json += "\",";

  json += "\"uptime\":";
  json += String((millis() - bootTime) / 1000);

  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(
    200,
    "application/json",
    json
  );
}

/*******************************************************
 * RAW UART API
 *
 * Trả về TOÀN BỘ LOG UART.
 *******************************************************/
void handleRawUART()
{
  String output = htmlEscape(rawLog);

  server.send(
    200,
    "text/plain; charset=utf-8",
    output
  );
}

/*******************************************************
 * CLEAR LOG
 *******************************************************/
void handleClearLog()
{
  rawLogLength = 0;

  memset(
    rawLog,
    0,
    sizeof(rawLog)
  );

  lineLength = 0;

  memset(
    lineBuffer,
    0,
    sizeof(lineBuffer)
  );

  totalBytesReceived = 0;
  totalLinesReceived = 0;

  lastLine = "";

  dataID = 0;

  server.send(
    200,
    "text/plain",
    "UART LOG CLEARED"
  );
}

/*******************************************************
 * MAIN WEB PAGE
 *******************************************************/
void handleRoot()
{
  String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>CareBot UART Debug</title>

<style>

body
{
  margin: 0;
  padding: 20px;

  font-family: Arial, sans-serif;

  background: #f1f3f6;

  color: #222;
}

.container
{
  max-width: 1100px;
  margin: auto;
}

h1
{
  text-align: center;
}

.subtitle
{
  text-align: center;
  color: #666;
  margin-bottom: 20px;
}

.status
{
  width: fit-content;

  margin: 15px auto;

  padding: 10px 25px;

  border-radius: 30px;

  font-weight: bold;
}

.receiving
{
  background: #d7f5df;
  color: #126b2c;
}

.lost
{
  background: #ffdada;
  color: #9b2020;
}

.waiting
{
  background: #fff0c9;
  color: #9a6700;
}

.cards
{
  display: grid;

  grid-template-columns:
  repeat(auto-fit, minmax(150px, 1fr));

  gap: 12px;
}

.card
{
  background: white;

  border-radius: 12px;

  padding: 15px;

  text-align: center;

  box-shadow:
  0 2px 10px rgba(0,0,0,0.08);
}

.label
{
  font-size: 13px;

  color: #666;
}

.value
{
  font-size: 25px;

  font-weight: bold;

  margin-top: 7px;

  color: #244e78;
}

.bigcard
{
  background: white;

  border-radius: 12px;

  padding: 20px;

  margin: 20px 0;

  text-align: center;

  box-shadow:
  0 2px 10px rgba(0,0,0,0.08);
}

.pef
{
  font-size: 45px;

  font-weight: bold;

  color: #126b4b;
}

.debug
{
  background: #151515;

  color: #00ff88;

  padding: 15px;

  border-radius: 12px;

  margin-top: 20px;

  box-shadow:
  0 2px 10px rgba(0,0,0,0.15);
}

.debugHeader
{
  display: flex;

  justify-content: space-between;

  align-items: center;

  margin-bottom: 10px;

  color: white;
}

button
{
  border: none;

  padding: 9px 15px;

  border-radius: 7px;

  cursor: pointer;

  font-weight: bold;
}

.clearButton
{
  background: #d84b4b;

  color: white;
}

#rawLog
{
  margin: 0;

  height: 350px;

  overflow-y: auto;

  white-space: pre-wrap;

  word-break: break-all;

  font-family: Consolas, monospace;

  font-size: 14px;
}

.lastPacket
{
  background: white;

  padding: 15px;

  border-radius: 12px;

  margin-top: 20px;

  word-break: break-all;
}

#lastLine
{
  font-family: Consolas, monospace;

  color: #075b7a;
}

.info
{
  text-align: center;

  margin-top: 15px;

  color: #666;

  font-size: 13px;
}

</style>

</head>

<body>

<div class="container">

<h1>CareBot AI Health Monitor</h1>

<div class="subtitle">
BRD2709A → ESP-01 → WiFi Web Server
</div>

<div id="status"
class="status waiting">
WAITING FOR UART
</div>


<div class="bigcard">

<div class="label">
PEF AI PREDICTION
</div>

<div id="pef"
class="pef">
0.0
</div>

<div>
L/min
</div>

</div>


<div class="cards">

<div class="card">
<div class="label">HEART RATE</div>
<div id="hr" class="value">0</div>
</div>

<div class="card">
<div class="label">SpO2</div>
<div id="spo2" class="value">0</div>
</div>

<div class="card">
<div class="label">RESPIRATORY RATE</div>
<div id="rr" class="value">0</div>
</div>

<div class="card">
<div class="label">TEMPERATURE</div>
<div id="temp" class="value">0</div>
</div>

<div class="card">
<div class="label">HUMIDITY</div>
<div id="hum" class="value">0</div>
</div>

<div class="card">
<div class="label">PM1.0</div>
<div id="pm1" class="value">0</div>
</div>

<div class="card">
<div class="label">PM2.5</div>
<div id="pm25" class="value">0</div>
</div>

<div class="card">
<div class="label">PM10</div>
<div id="pm10" class="value">0</div>
</div>

<div class="card">
<div class="label">AQI</div>
<div id="aqi" class="value">0</div>
</div>

<div class="card">
<div class="label">TVOC</div>
<div id="tvoc" class="value">0</div>
</div>

<div class="card">
<div class="label">eCO2</div>
<div id="eco2" class="value">0</div>
</div>

<div class="card">
<div class="label">FINGER STATUS</div>
<div id="finger" class="value">NO DATA</div>
</div>

</div>


<div class="lastPacket">

<b>LAST COMPLETE UART PACKET:</b>

<br><br>

<span id="lastLine">
No packet received
</span>

</div>


<div class="bigcard">

<b>UART STATISTICS</b>

<br><br>

DATA ID:
<span id="dataID">0</span>

&nbsp;&nbsp; | &nbsp;&nbsp;

TOTAL BYTES:
<span id="totalBytes">0</span>

&nbsp;&nbsp; | &nbsp;&nbsp;

TOTAL PACKETS:
<span id="totalLines">0</span>

<br><br>

LAST BYTE:
<span id="lastByteAgo">---</span> ms ago

</div>


<div class="debug">

<div class="debugHeader">

<div>
<b>LIVE RAW UART DEBUG LOG</b>
</div>

<button
class="clearButton"
onclick="clearLog()">
CLEAR LOG
</button>

</div>

<pre id="rawLog">
Waiting for UART data...
</pre>

</div>


<div class="info">

Web updates every 300 ms — No page reload

</div>

</div>


<script>

let autoScroll = true;


/****************************************************
 * UPDATE SENSOR DATA
 ****************************************************/
async function updateData()
{
  try
  {
    const response =
      await fetch('/api?t=' + Date.now());

    const data =
      await response.json();


    document.getElementById('status')
      .innerText =
      data.status;


    let statusElement =
      document.getElementById('status');


    statusElement.className =
      'status';


    if (data.status === 'UART RECEIVING')
    {
      statusElement.classList.add('receiving');
    }
    else if (data.status === 'UART DATA LOST')
    {
      statusElement.classList.add('lost');
    }
    else
    {
      statusElement.classList.add('waiting');
    }


    document.getElementById('pef')
      .innerText =
      data.pef;

    document.getElementById('hr')
      .innerText =
      data.hr;

    document.getElementById('spo2')
      .innerText =
      data.spo2;

    document.getElementById('rr')
      .innerText =
      data.rr;

    document.getElementById('temp')
      .innerText =
      data.temp;

    document.getElementById('hum')
      .innerText =
      data.hum;

    document.getElementById('pm1')
      .innerText =
      data.pm1;

    document.getElementById('pm25')
      .innerText =
      data.pm25;

    document.getElementById('pm10')
      .innerText =
      data.pm10;

    document.getElementById('aqi')
      .innerText =
      data.aqi;

    document.getElementById('tvoc')
      .innerText =
      data.tvoc;

    document.getElementById('eco2')
      .innerText =
      data.eco2;

    document.getElementById('finger')
      .innerText =
      data.finger;

    document.getElementById('dataID')
      .innerText =
      data.dataID;

    document.getElementById('totalBytes')
      .innerText =
      data.totalBytes;

    document.getElementById('totalLines')
      .innerText =
      data.totalLines;

    document.getElementById('lastByteAgo')
      .innerText =
      data.lastByteAgo;

    document.getElementById('lastLine')
      .innerText =
      data.lastLine;

  }
  catch (error)
  {
    document.getElementById('status')
      .innerText =
      'WEB API ERROR';
  }
}


/****************************************************
 * UPDATE RAW UART LOG
 ****************************************************/
async function updateRawLog()
{
  try
  {
    const response =
      await fetch('/raw?t=' + Date.now());

    const text =
      await response.text();


    let log =
      document.getElementById('rawLog');


    let isNearBottom =
      log.scrollHeight -
      log.scrollTop -
      log.clientHeight
      < 50;


    log.textContent =
      text;


    if (isNearBottom)
    {
      log.scrollTop =
        log.scrollHeight;
    }

  }
  catch (error)
  {
  }
}


/****************************************************
 * CLEAR UART LOG
 ****************************************************/
async function clearLog()
{
  await fetch('/clear');

  document.getElementById('rawLog')
    .textContent =
    'UART LOG CLEARED';
}


/****************************************************
 * AUTO UPDATE
 ****************************************************/
setInterval(
  updateData,
  300
);

setInterval(
  updateRawLog,
  500
);


/****************************************************
 * FIRST UPDATE
 ****************************************************/
updateData();
updateRawLog();

</script>

</body>
</html>
)rawliteral";

  server.send(
    200,
    "text/html",
    html
  );
}

/*******************************************************
 * WIFI CONNECT
 *******************************************************/
void connectWiFi()
{
  WiFi.mode(WIFI_STA);

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
  }
}

/*******************************************************
 * SETUP
 *******************************************************/
void setup()
{
  bootTime = millis();

  /*****************************************************
   * UART BRD2709A
   *
   * Không Serial.println() liên tục.
   *
   * UART này được dành để nhận BRD.
   *****************************************************/
  Serial.begin(UART_BAUD);

  delay(200);

  /*****************************************************
   * CONNECT WIFI
   *****************************************************/
  connectWiFi();

  /*****************************************************
   * Có thể in IP đúng 1 lần lúc khởi động.
   *
   * Sau đó tuyệt đối không dùng Serial.print
   * để tránh lẫn vào UART debug.
   *****************************************************/
  Serial.println();
  Serial.println();
  Serial.println("================================");
  Serial.println("CAREBOT ESP8266 STARTED");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("UART DEBUG: WEB ONLY");
  Serial.println("================================");

  /*****************************************************
   * WEB ROUTES
   *****************************************************/
  server.on(
    "/",
    handleRoot
  );

  server.on(
    "/api",
    handleAPI
  );

  server.on(
    "/raw",
    handleRawUART
  );

  server.on(
    "/clear",
    handleClearLog
  );

  server.begin();
}

/*******************************************************
 * LOOP
 *******************************************************/
void loop()
{
  /*****************************************************
   * Ưu tiên đọc UART liên tục
   *****************************************************/
  processUART();

  /*****************************************************
   * Xử lý Web Server
   *****************************************************/
  server.handleClient();

  yield();
}