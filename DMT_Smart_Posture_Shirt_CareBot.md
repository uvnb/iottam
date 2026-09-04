# DMT Smart Posture Shirt

## AIoT Wearable System for Real-Time Posture Detection

The **DMT Smart Posture Shirt** is an intelligent wearable system
developed as part of the **CareBot AIoT project**. The shirt uses **5
MPU6050 motion sensors** positioned across key areas of the upper body
and spine to continuously capture body movement and posture data.

## 5 Sensor Positions

-   **C7** -- Neck
-   **Left Shoulder**
-   **Right Shoulder**
-   **T5** -- Mid Back
-   **L3** -- Lower Back

The five sensors are connected through a **TCA9548 I²C multiplexer**,
allowing multiple MPU6050 sensors to operate within the same wearable
sensing system.

## AI Posture Recognition

Sensor data is collected and processed into **18 input features**, which
are transmitted from the wearable system via **UART** to the embedded AI
platform.

An **AI/TinyML model** performs real-time posture classification with
**6 output classes**:

-   **Normal Idle**
-   **Bending**
-   **Lifting Correct**
-   **Lifting Wrong Back**
-   **Bad Posture**
-   **Shoulder Asymmetry**

## Embedded AIoT Architecture

**5 MPU6050 Sensors → TCA9548 → ESP32 → UART → Embedded AI → BLE →
Raspberry Pi 4 / CareBot System**

The embedded AI platform receives the **18 input features** and performs
posture inference locally. The posture result is then transmitted
through **Bluetooth Low Energy (BLE)** to the **Raspberry Pi 4**, where
it can be displayed and integrated with the CareBot monitoring system.

## Key Features

### 5-Point Body Motion Sensing

Continuous monitoring of the neck, shoulders, mid-back, and lower back.

### 18-Feature AI Input

Motion data from multiple body locations is provided to the AI model for
posture classification.

### 6 Posture Classes

Detects normal posture, bending, incorrect posture, lifting posture, and
shoulder asymmetry.

### Embedded TinyML

AI inference runs directly on the embedded hardware for fast local
posture recognition.

### BLE Connectivity

Posture results are transmitted wirelessly to the CareBot system.

### CareBot Integration

Designed to become part of a larger **AIoT healthcare and intelligent
care ecosystem**.

## Project Vision

> **DMT Smart Posture Shirt transforms body movement data into real-time
> AI insights, enabling intelligent posture monitoring as part of the
> CareBot AIoT ecosystem.**

**DMT Technology --- Smarter Health, Better Life.**
