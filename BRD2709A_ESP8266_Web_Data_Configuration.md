# BRD2709A → ESP8266 ESP-01 → Web
## Hướng dẫn cấu hình, cấu trúc dữ liệu và luồng hiển thị

**Project:** AIoT / CareBot – PEF AI Sensor  
**MCU:** Silicon Labs BRD2709A Rev A03 (EFR32MG26)  
**Wi-Fi/Web gateway:** ESP8266 ESP-01  
**UART:** 115200 baud, 8-N-1  
**Mục tiêu:** BRD2709A đọc cảm biến + PEF AI → gửi một packet UART hoàn chỉnh mỗi 1 giây → ESP8266 nhận, ghép packet, parse → cung cấp JSON API → Web cập nhật realtime không reload trang.

---

# 1. Kiến trúc tổng thể

```text
┌──────────────────────────────┐
│       BRD2709A / EFR32MG26   │
│                              │
│ PMS7003  ─┐                  │
│ ENS160   ─┤                  │
│ AHT20    ─┤→ Sensor Cache    │
│ MAX30102 ─┤                  │
│ PEF AI   ─┘                  │
│                              │
│ USART1 / IO Stream esp_uart  │
│ TX = PC02                   │
│ RX = PC01                   │
└──────────────┬───────────────┘
               │ UART 115200
               │
       PC02 TX → GPIO3 RX
       PC01 RX ← GPIO1 TX
               │
┌──────────────▼───────────────┐
│          ESP8266 ESP-01      │
│                              │
│ Serial.read()                │
│       ↓                      │
│ byte stream / line buffer    │
│       ↓                      │
│ detect '\n'                  │
│       ↓                      │
│ parse KEY=VALUE              │
│       ↓                      │
│ RAM sensor variables         │
│       ├────────→ /api JSON   │
│       └────────→ /raw log    │
│                              │
│ Wi-Fi + HTTP Server :80      │
└──────────────┬───────────────┘
               │ Wi-Fi
               ▼
       ┌──────────────────┐
       │ Browser / Web UI │
       │ fetch('/api')    │
       │ every ~300 ms    │
       │ fetch('/raw')    │
       │ every ~500 ms    │
       └──────────────────┘
```

## Nguyên tắc quan trọng

UART là **byte stream**, không phải mỗi lần `Serial.read()` sẽ nhận đúng một packet.

Vì vậy ESP8266 phải:

1. Nhận từng byte.
2. Ghép byte vào `lineBuffer`.
3. Chờ ký tự kết thúc packet `\n`.
4. Khi gặp `\n`, xác định đây là một packet hoàn chỉnh.
5. Parse packet.
6. Cập nhật biến dữ liệu.
7. Web đọc dữ liệu từ các biến thông qua `/api`.

Không được giả định:

```text
Serial.read() = 1 packet
```

Mà phải xử lý:

```text
Serial.read()
    ↓
byte stream
    ↓
lineBuffer
    ↓
\n
    ↓
complete packet
```

---

# 2. Cấu hình BRD2709A

## 2.1. IO Stream

Trong Simplicity Studio 5, cấu hình IO Stream USART instance:

```text
Instance:
    esp_uart

Baudrate:
    115200

Parity:
    None

Stop bits:
    1

Flow control:
    None

Peripheral:
    USART1

TX:
    PC02

RX:
    PC01
```

Cấu hình tương ứng:

```c
#define SL_IOSTREAM_USART_ESP_UART_BAUDRATE 115200
#define SL_IOSTREAM_USART_ESP_UART_PARITY usartNoParity
#define SL_IOSTREAM_USART_ESP_UART_STOP_BITS usartStopbits1
#define SL_IOSTREAM_USART_ESP_UART_FLOW_CONTROL_TYPE usartHwFlowControlNone

#define SL_IOSTREAM_USART_ESP_UART_PERIPHERAL USART1
#define SL_IOSTREAM_USART_ESP_UART_PERIPHERAL_NO 1

#define SL_IOSTREAM_USART_ESP_UART_TX_PORT SL_GPIO_PORT_C
#define SL_IOSTREAM_USART_ESP_UART_TX_PIN 2

#define SL_IOSTREAM_USART_ESP_UART_RX_PORT SL_GPIO_PORT_C
#define SL_IOSTREAM_USART_ESP_UART_RX_PIN 1
```

## 2.2. Handle UART

Trong code BRD, sử dụng handle được sinh tự động:

```c
extern sl_iostream_t *sl_iostream_esp_uart_handle;
```

Gửi data:

```c
sl_status_t status =
    sl_iostream_write(
        sl_iostream_esp_uart_handle,
        message,
        length
    );
```

Không thay bằng:

```c
sl_iostream_get_handle(...)
```

nếu project hiện tại đang dùng handle `sl_iostream_esp_uart_handle`.

---

# 3. Kết nối phần cứng

## BRD2709A ↔ ESP-01

| BRD2709A | ESP-01 | Chức năng |
|---|---|---|
| PC02 | GPIO3 / RX | BRD TX → ESP RX |
| PC01 | GPIO1 / TX | BRD RX ← ESP TX |
| GND | GND | Mass chung |
| 3.3 V | VCC | Nguồn ESP-01 |
| 3.3 V | EN/CH_PD | Enable |
| 3.3 V | GPIO0 | Normal boot |
| 3.3 V | GPIO2 | Normal boot |

### Quy tắc đấu chéo

```text
BRD TX  → ESP RX
BRD RX  ← ESP TX
GND     ↔ GND
```

Không nối:

```text
TX → TX
RX → RX
```

---

# 4. UART packet format

Mỗi 1 giây BRD tạo **một dòng dữ liệu hoàn chỉnh**.

Format:

```text
DATA,ID=101,PM1=14,PM25=18,PM10=19,AQI=1,TVOC=80,ECO2=404,TEMP=26.5,HUM=59.5,FINGER=1,HR=70.0,SPO2=98.7,RR=12.0,PEF=388.4\n
```

Khuyến nghị gửi:

```text
\r\n
```

hoặc:

```text
\n
```

Nhưng ESP8266 phải thống nhất cách parse.

---

# 5. Ý nghĩa từng field

| Field | Ý nghĩa | Ví dụ |
|---|---|---:|
| DATA | Header packet | DATA |
| ID | Số thứ tự packet | 101 |
| PM1 | PM1.0 | 14 |
| PM25 | PM2.5 | 18 |
| PM10 | PM10 | 19 |
| AQI | Air Quality Index | 1 |
| TVOC | Total VOC | 80 |
| ECO2 | Equivalent CO2 | 404 |
| TEMP | Nhiệt độ °C | 26.5 |
| HUM | Độ ẩm % | 59.5 |
| FINGER | Trạng thái phát hiện ngón tay | 1 |
| HR | Heart Rate BPM | 70.0 |
| SPO2 | SpO2 % | 98.7 |
| RR | Respiratory Rate BPM | 12.0 |
| PEF | Giá trị PEF từ AI | 388.4 |

---

# 6. Khi cảm biến chưa hợp lệ

Không gửi field rỗng:

```text
TEMP=
HR=
SPO2=
RR=
PEF=
```

Vì điều này gây khó khăn cho parser và Web.

Thay bằng:

```text
TEMP=0.0
HR=0.0
SPO2=0.0
RR=0.0
PEF=0.0
```

Ví dụ:

```text
DATA,ID=102,PM1=14,PM25=18,PM10=19,AQI=1,TVOC=80,ECO2=404,TEMP=26.5,HUM=59.5,FINGER=0,HR=0.0,SPO2=0.0,RR=0.0,PEF=0.0
```

## Lý do

`0` là một giá trị số mà ESP8266 có thể parse ổn định:

```cpp
float hr = 0.0;
```

thay vì phải xử lý:

```cpp
if (value == "")
```

---

# 7. Chu kỳ gửi dữ liệu

BRD gửi mỗi:

```text
1000 ms = 1 second
```

Packet ID tăng:

```text
101
102
103
104
...
```

Ví dụ:

```text
t = 1 s  → ID=101
t = 2 s  → ID=102
t = 3 s  → ID=103
t = 4 s  → ID=104
```

Packet phải được gửi **dù sensor có valid hay không**.

Điều này rất quan trọng.

Không nên:

```c
if (sensor_valid)
    send_packet();
```

Mà nên:

```c
send_packet_every_1_second();
```

và field chưa valid được gửi `0`.

---

# 8. Cấu trúc dữ liệu trong BRD

Các giá trị sensor được giữ trong sensor cache:

```text
g_cache
```

Các nhóm dữ liệu:

```text
g_cache.pms_pm1_0
g_cache.pms_pm2_5
g_cache.pms_pm10

g_cache.ens_aqi
g_cache.ens_tvoc
g_cache.ens_eco2

g_cache.aht_temp_c
g_cache.aht_humidity

g_cache.max_finger
g_cache.max_hr_bpm
g_cache.max_spo2
g_cache.max_rr_bpm

g_cache.pef_value
```

Các flag valid tương ứng:

```text
pms_valid
ens_valid
aht_valid
max_valid
max_hr_valid
max_spo2_valid
max_rr_valid
pef_valid
```

---

# 9. Cấu trúc packet ở BRD

Logic:

```text
Sensor Cache
      ↓
Check valid
      ↓
valid     → giá trị thật
invalid   → 0
      ↓
snprintf()
      ↓
message[]
      ↓
sl_iostream_write()
      ↓
UART
```

Ví dụ:

```c
char message[256];

int length = snprintf(
    message,
    sizeof(message),
    "DATA,ID=%lu,PM1=%d,PM25=%d,PM10=%d,AQI=%d,"
    "TVOC=%d,ECO2=%d,TEMP=%d.%d,HUM=%d.%d,"
    "FINGER=%d,HR=%d.%d,SPO2=%d.%d,RR=%d.%d,PEF=%d.%d\r\n",
    ...
);
```

Trong embedded project, nếu `printf` float chưa được enable thì không nên phụ thuộc vào:

```c
%f
```

Có thể tách số thành:

```text
integer.fraction
```

Ví dụ:

```text
26.5
```

thành:

```text
26 + "." + 5
```

---

# 10. RTT debug trên BRD

Để kiểm tra BRD thực sự gửi gì, RTT nên in **đúng packet UART**.

Format:

```text
================ ESP UART TX ================
[ESP TX #101] STATUS = OK | LEN = 132

EXACT PACKET SENT:
DATA,ID=101,PM1=14,PM25=18,PM10=19,AQI=1,TVOC=80,ECO2=404,TEMP=26.5,HUM=59.5,FINGER=1,HR=70.0,SPO2=98.7,RR=12.0,PEF=388.4

===============================================
```

Mục đích:

```text
BRD RTT packet
       ↕
ESP RAW UART packet
```

Hai bên phải giống nhau.

---

# 11. Cấu trúc nhận UART trên ESP8266

ESP8266 có:

```cpp
Serial
```

với:

```text
Baud = 115200
TX = GPIO1
RX = GPIO3
```

Hàm xử lý:

```cpp
processUART()
```

hoạt động theo pipeline:

```text
Serial.available()
      ↓
Serial.read()
      ↓
totalBytesReceived++
      ↓
rawLog
      ↓
lineBuffer
      ↓
gặp '\n'?
   │
   ├── NO → tiếp tục nhận
   │
   └── YES
        ↓
   packet hoàn chỉnh
        ↓
   parseUARTLine()
```

---

# 12. Tại sao phải có lineBuffer?

Giả sử BRD gửi:

```text
DATA,ID=101,PM1=14,...,PEF=388.4\n
```

ESP có thể nhận thành nhiều lần:

```text
DATA,ID=101,PM1=
```

sau đó:

```text
14,PM25=18,...,HR=
```

sau đó:

```text
70.0,...,PEF=388.4\n
```

Nếu parse ngay từng lần `Serial.read()` thì packet bị sai.

Do đó:

```text
RX chunk 1
RX chunk 2
RX chunk 3
     ↓
lineBuffer
     ↓
complete line
     ↓
parse
```

---

# 13. Cấu trúc parser

Hàm:

```cpp
parseUARTLine()
```

nhận:

```text
DATA,ID=101,PM1=14,PM25=18,...
```

Sau đó lấy từng key:

```text
ID
PM1
PM25
PM10
AQI
TVOC
ECO2
TEMP
HUM
FINGER
HR
SPO2
RR
PEF
```

Ví dụ:

```text
HR=70.0
```

được đưa vào:

```cpp
heartRate = 70.0;
```

Tương tự:

```text
PEF=388.4
```

→

```cpp
pef = 388.4;
```

---

# 14. Data model trong ESP8266

Sau khi parse, dữ liệu nằm trong RAM:

```text
dataID
pef
heartRate
spo2
respiratoryRate
temperature
humidity
pm1
pm25
pm10
aqi
tvoc
eco2
fingerStatus
```

Ngoài dữ liệu sensor còn có trạng thái UART:

```text
totalBytesReceived
totalLinesReceived
lastByteTime
bootTime
lastLine
```

Và:

```text
rawLog
```

để debug.

---

# 15. API Web

ESP8266 chạy:

```text
ESP8266WebServer server(80)
```

Các endpoint chính:

```text
/
 /api
 /raw
 /clear
```

---

# 16. Endpoint `/api`

Browser gọi:

```text
GET /api
```

ESP trả JSON.

Ví dụ:

```json
{
  "uart": {
    "connected": true,
    "bytes": 15240,
    "packets": 102,
    "lastByte": 123456,
    "uptime": 102340
  },
  "data": {
    "id": 102,
    "pm1": 14,
    "pm25": 18,
    "pm10": 19,
    "aqi": 1,
    "tvoc": 80,
    "eco2": 404,
    "temperature": 26.5,
    "humidity": 59.5,
    "finger": 1,
    "heartRate": 70.0,
    "spo2": 98.7,
    "respiratoryRate": 12.0,
    "pef": 388.4
  },
  "lastLine": "DATA,ID=102,..."
}
```

Đây là **cầu nối giữa C++ ESP8266 và JavaScript Web**.

---

# 17. Luồng dữ liệu `/api`

```text
BRD
 │
 │ UART
 ▼
ESP parser
 │
 ▼
RAM variables
 │
 ▼
/api
 │
 │ JSON
 ▼
JavaScript
 │
 ▼
HTML
```

Browser không đọc UART trực tiếp.

Browser chỉ đọc:

```text
HTTP → /api
```

---

# 18. Endpoint `/raw`

Endpoint:

```text
/raw
```

dùng cho debug.

Nó hiển thị raw UART log đã nhận.

Ví dụ:

```text
DATA,ID=101,PM1=14,...
DATA,ID=102,PM1=14,...
DATA,ID=103,PM1=15,...
```

Mục đích:

```text
BRD TX
   ↓
UART
   ↓
ESP RX
   ↓
RAW LOG
```

Có thể dùng để xác định lỗi nằm ở:

```text
BRD
UART
ESP parser
Web
```

---

# 19. Endpoint `/clear`

```text
/clear
```

dùng để xóa:

```text
rawLog
```

Nhưng không nhất thiết phải reset toàn bộ sensor data.

---

# 20. Web cập nhật realtime

Trang Web không cần reload.

JavaScript gọi:

```javascript
fetch('/api')
```

định kỳ.

Chu kỳ hiện tại:

```text
~300 ms
```

cho sensor/API.

Raw log:

```text
~500 ms
```

Do BRD chỉ gửi:

```text
1 packet / second
```

nên Web có thể đọc API nhanh hơn để giao diện phản hồi mượt.

---

# 21. Cấu trúc Web UI nên hiển thị

```text
┌─────────────────────────────────────────────┐
│              CAREBOT AI HEALTH              │
├─────────────────────────────────────────────┤
│ UART STATUS: ● CONNECTED                    │
│ PACKETS: 102      BYTES: 15240              │
│ LAST ID: 102                                  │
├─────────────────────────────────────────────┤
│                  PEF AI                     │
│                                             │
│                  388.4                      │
│                                             │
├───────────────────┬─────────────────────────┤
│ HEART RATE        │ SpO2                    │
│ 70.0 BPM          │ 98.7 %                  │
├───────────────────┼─────────────────────────┤
│ RESPIRATORY RATE  │ FINGER                  │
│ 12.0 BPM          │ DETECTED                │
├───────────────────┼─────────────────────────┤
│ TEMPERATURE       │ HUMIDITY                │
│ 26.5 °C           │ 59.5 %                  │
├───────────────────┴─────────────────────────┤
│              AIR QUALITY                    │
│ PM1    PM2.5    PM10    AQI    TVOC    eCO2│
│ 14      18       19      1      80      404 │
├─────────────────────────────────────────────┤
│ LAST COMPLETE UART PACKET                   │
│ DATA,ID=102,...                             │
├─────────────────────────────────────────────┤
│ LIVE RAW UART DEBUG LOG                     │
│ ...                                         │
└─────────────────────────────────────────────┘
```

---

# 22. Phân biệt `LAST COMPLETE PACKET` và `RAW LOG`

Đây là điểm rất quan trọng khi debug.

## LAST COMPLETE PACKET

Là packet sau khi ESP đã nhận đủ:

```text
DATA,...\n
```

Ví dụ:

```text
DATA,ID=102,PM1=14,...,PEF=388.4
```

Đây là dữ liệu nên dùng để kiểm tra parser.

## RAW LOG

Là dữ liệu nhận được từ UART.

Nếu log hiển thị:

```text
M-,FINGER=1,HR=...
```

không nhất thiết UART bị lỗi.

Nó có thể chỉ là phần cuối của stream đang được hiển thị.

Vì vậy khi debug cần ưu tiên:

```text
LAST COMPLETE UART PACKET
```

sau đó mới xem:

```text
RAW UART LOG
```

---

# 23. Cơ chế xác định UART DATA LOST

ESP có thể xác định packet có bị mất dựa trên:

```text
ID hiện tại
ID trước đó
```

Ví dụ:

```text
101
102
103
104
```

→ không mất packet.

Nếu:

```text
101
102
105
```

thì:

```text
103 và 104
```

có khả năng bị mất hoặc không được nhận hoàn chỉnh.

Có thể tính:

```text
missing = currentID - previousID - 1
```

Ví dụ:

```text
105 - 102 - 1 = 2
```

→ thiếu 2 packet.

---

# 24. Điều kiện xác định ESP đang nhận dữ liệu

Không nên chỉ dựa vào:

```text
Wi-Fi connected
```

Wi-Fi connected không có nghĩa UART đang hoạt động.

Nên theo dõi:

```text
totalBytesReceived
totalLinesReceived
lastByteTime
last complete packet ID
```

Logic:

```text
Wi-Fi OK + packet mới
    → SYSTEM OK

Wi-Fi OK + không có UART packet trong thời gian dài
    → UART DATA LOST

Wi-Fi mất
    → WEB/WIFI ERROR
```

---

# 25. Các tầng debug

Nên debug theo thứ tự:

## Layer 1 – BRD sensor

Kiểm tra:

```text
PMS
ENS160
AHT20
MAX30102
PEF
```

## Layer 2 – BRD UART TX

RTT phải thấy:

```text
EXACT PACKET SENT:
DATA,ID=...
```

## Layer 3 – ESP UART RX

Raw log phải nhận được packet.

## Layer 4 – ESP parser

Kiểm tra:

```text
LAST COMPLETE UART PACKET
PACKETS
ID
sensor values
```

## Layer 5 – API

Mở:

```text
http://ESP_IP/api
```

và kiểm tra JSON.

## Layer 6 – Web UI

Kiểm tra:

```text
PEF
HR
SpO2
RR
TEMP
HUM
PM
AQI
TVOC
eCO2
```

---

# 26. Trình tự test hoàn chỉnh

## Bước 1

Nạp firmware BRD2709A.

Kiểm tra RTT:

```text
UART: USART1
TX: PC02
RX: PC01
Baud: 115200
```

## Bước 2

Kiểm tra packet:

```text
DATA,ID=101,...
DATA,ID=102,...
DATA,ID=103,...
```

## Bước 3

Nối:

```text
PC02 → GPIO3
PC01 → GPIO1
GND → GND
```

## Bước 4

Nạp firmware ESP8266.

## Bước 5

Mở Serial Monitor ESP.

Chỉ cần thấy IP lúc boot, ví dụ:

```text
WiFi connected
IP address: 192.168.x.x
```

Không cần spam sensor data ra Serial vì GPIO1/GPIO3 chính là UART0.

## Bước 6

Truy cập:

```text
http://<ESP_IP>/
```

## Bước 7

Kiểm tra:

```text
UART STATUS
PACKETS
BYTES
LAST ID
```

## Bước 8

Kiểm tra:

```text
LAST COMPLETE UART PACKET
```

## Bước 9

Kiểm tra:

```text
LIVE RAW UART DEBUG LOG
```

## Bước 10

Mở:

```text
http://<ESP_IP>/api
```

để kiểm tra JSON.

---

# 27. Data flow cuối cùng

```text
                 SENSOR DATA
                     │
                     ▼
             ┌───────────────┐
             │ BRD2709A      │
             │ Sensor Cache  │
             └───────┬───────┘
                     │
                     ▼
              PEF AI inference
                     │
                     ▼
             Build UART packet
                     │
                     ▼
 DATA,ID=101,PM1=14,...,PEF=388.4
                     │
                     ▼
               USART1 / PC02
                     │
                     │ UART 115200
                     ▼
               ESP GPIO3 RX
                     │
                     ▼
              lineBuffer[512]
                     │
                     ▼
                 '\n' found
                     │
                     ▼
              parseUARTLine()
                     │
                     ▼
             ┌───────────────┐
             │ ESP RAM       │
             │ sensor values │
             └───────┬───────┘
                     │
             ┌───────┴────────┐
             ▼                ▼
          /api               /raw
             │                │
             ▼                ▼
          JSON API        Raw UART log
             │
             ▼
       JavaScript fetch()
             │
             ▼
          HTML/CSS
             │
             ▼
          WEB UI
```

---

# 28. Data contract giữa BRD và ESP

Để hệ thống ổn định, hai bên nên thống nhất:

```text
BAUD       = 115200
FORMAT     = ASCII CSV-like
TERMINATOR = \n
PACKET     = 1 line
PERIOD     = 1000 ms
```

Field order:

```text
DATA
ID
PM1
PM25
PM10
AQI
TVOC
ECO2
TEMP
HUM
FINGER
HR
SPO2
RR
PEF
```

Packet mẫu chuẩn:

```text
DATA,ID=101,PM1=14,PM25=18,PM10=19,AQI=1,TVOC=80,ECO2=404,TEMP=26.5,HUM=59.5,FINGER=1,HR=70.0,SPO2=98.7,RR=12.0,PEF=388.4
```

---

# 29. Checklist cấu hình

### BRD2709A

- [ ] USART1
- [ ] TX = PC02
- [ ] RX = PC01
- [ ] 115200
- [ ] 8-N-1
- [ ] No flow control
- [ ] `sl_iostream_esp_uart_handle`
- [ ] Gửi mỗi 1 giây
- [ ] Packet kết thúc `\n`
- [ ] Invalid value = `0`
- [ ] RTT in exact packet

### ESP8266

- [ ] UART = 115200
- [ ] GPIO3 = RX
- [ ] GPIO1 = TX
- [ ] GND chung
- [ ] Nguồn 3.3 V ổn định
- [ ] `lineBuffer`
- [ ] Chờ `\n`
- [ ] Parse packet hoàn chỉnh
- [ ] `/api`
- [ ] `/raw`
- [ ] `/clear`
- [ ] Web polling không reload

### Web

- [ ] UART status
- [ ] Packet count
- [ ] Byte count
- [ ] Packet ID
- [ ] PEF
- [ ] HR
- [ ] SpO2
- [ ] RR
- [ ] Temperature
- [ ] Humidity
- [ ] PM1
- [ ] PM2.5
- [ ] PM10
- [ ] AQI
- [ ] TVOC
- [ ] eCO2
- [ ] Last complete packet
- [ ] Raw UART log

---

# 30. Kết luận kiến trúc

Hệ thống được chia thành 4 tầng rõ ràng:

```text
TẦNG 1
BRD2709A
Sensor + AI
        ↓
TẦNG 2
UART
Packet protocol
        ↓
TẦNG 3
ESP8266
UART parser + HTTP API
        ↓
TẦNG 4
WEB
JSON + JavaScript realtime UI
```

Điểm quan trọng nhất là **BRD chỉ chịu trách nhiệm tạo packet dữ liệu chuẩn**, **ESP8266 chịu trách nhiệm gateway UART → Wi-Fi/HTTP**, còn **Web chỉ đọc JSON API và hiển thị**.

Cách phân tầng này giúp debug rất rõ: nếu RTT BRD đúng nhưng `/raw` sai thì kiểm tra UART; nếu `/raw` đúng nhưng `/api` sai thì kiểm tra parser; nếu `/api` đúng nhưng giao diện sai thì kiểm tra JavaScript/Web UI.
