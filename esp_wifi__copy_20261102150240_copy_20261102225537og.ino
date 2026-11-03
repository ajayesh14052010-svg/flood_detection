#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <LoRa.h>
#include <TinyGPSPlus.h>

// ==================================================
// WIFI SETTINGS
// ==================================================

const char* WIFI_SSID = "Airtel_Ajay";
const char* WIFI_PASSWORD = "Ajay@123";

// Replace with your computer's actual IPv4 address.
const char* SERVER_URL =
  "http://192.168.1.8:3000/api/v1/readings";

// Original device token generated during sensor registration.
const char* DEVICE_TOKEN = "";

// ==================================================
// DEVICE SETTINGS
// ==================================================

const char* GATEWAY_ID = "FG-GATEWAY-002";

// ==================================================
// GPS PINS
// ==================================================

#define GPS_RX 4
#define GPS_TX 5

// GPS TX -> ESP32 GPIO 4
// GPS RX -> ESP32 GPIO 5

#define GPS_BAUD_RATE 9600

HardwareSerial GPS_Serial(2);
TinyGPSPlus gps;

// ==================================================
// LORA PINS
// ==================================================

#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_SS    21
#define LORA_RST   14
#define LORA_DIO0  26

const long LORA_FREQUENCY = 433E6;

// ==================================================
// WIFI CONNECTION
// ==================================================

void connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println("Connecting to Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 30
  ) {

    delay(500);
    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi connected!");

    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());

  } else {

    Serial.println("Wi-Fi connection failed.");
  }
}

// ==================================================
// GPS INITIALIZATION
// ==================================================

void initializeGPS() {

  GPS_Serial.begin(
    GPS_BAUD_RATE,
    SERIAL_8N1,
    GPS_RX,
    GPS_TX
  );

  Serial.println("GPS serial initialized.");

  Serial.println("Waiting for GPS satellite data...");
}

// ==================================================
// READ GPS DATA
// ==================================================

void readGPS() {

  while (GPS_Serial.available() > 0) {

    char gpsData = GPS_Serial.read();

    gps.encode(gpsData);
  }
}

// ==================================================
// SEND SENSOR READING TO BACKEND
// ==================================================

void sendToServer(
  String sensorId,
  int rawValue,
  String floodStatus
) {

  // Check Wi-Fi connection.

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("Wi-Fi disconnected.");

    connectWiFi();
  }

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      "Cannot send reading: Wi-Fi unavailable."
    );

    return;
  }

  HTTPClient http;

  http.setTimeout(10000);

  // Initialize HTTP connection.

  if (!http.begin(SERVER_URL)) {

    Serial.println("Failed to initialize HTTP.");

    return;
  }

  // ------------------------------------------------
  // HTTP HEADERS
  // ------------------------------------------------

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  // Device authentication.

  http.addHeader(
    "Authorization",
    String("Bearer ") + DEVICE_TOKEN
  );

  // ------------------------------------------------
  // READ GPS DATA
  // ------------------------------------------------

  readGPS();

  // ------------------------------------------------
  // CREATE JSON PAYLOAD
  // ------------------------------------------------

  String json = "{";

  json += "\"device_id\":\"" + sensorId + "\",";

  json += "\"gateway_id\":\"" +
          String(GATEWAY_ID) + "\",";

  json += "\"raw_sensor_value\":" +
          String(rawValue) + ",";

  // Include GPS coordinates only if valid.

  if (gps.location.isValid()) {

    json += "\"latitude\":" +
            String(gps.location.lat(), 6) + ",";

    json += "\"longitude\":" +
            String(gps.location.lng(), 6) + ",";

  } else {

    json += "\"latitude\":null,";
    json += "\"longitude\":null,";
  }

  // No calibrated water level is assumed.

  json += "\"water_level_cm\":null,";

  json += "\"flood_status\":\"" +
          floodStatus + "\"";

  json += "}";

  // ------------------------------------------------
  // SEND HTTP POST REQUEST
  // ------------------------------------------------

  Serial.println();

  Serial.println("==============================");
  Serial.println("SENDING READING TO BACKEND");
  Serial.println("==============================");

  Serial.print("Server URL: ");
  Serial.println(SERVER_URL);

  Serial.println("JSON payload:");
  Serial.println(json);

  int responseCode = http.POST(json);

  // ------------------------------------------------
  // PROCESS SERVER RESPONSE
  // ------------------------------------------------

  Serial.print("HTTP response code: ");
  Serial.println(responseCode);

  if (responseCode > 0) {

    String response = http.getString();

    Serial.println("Server response:");
    Serial.println(response);

    if (
      responseCode >= 200 &&
      responseCode < 300
    ) {

      Serial.println(
        "Reading successfully uploaded!"
      );

    } else {

      Serial.println(
        "Backend rejected the reading."
      );
    }

  } else {

    Serial.print("HTTP request failed: ");

    Serial.println(
      http.errorToString(responseCode)
    );
  }

  http.end();

  Serial.println("==============================");
}

// ==================================================
// SETUP
// ==================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();

  Serial.println("==============================");
  Serial.println("FLOODGUARD GPS + LORA GATEWAY");
  Serial.println("==============================");

  // Initialize GPS.

  initializeGPS();

  // Connect Wi-Fi.

  connectWiFi();

  // Initialize LoRa SPI.

  SPI.begin(
    LORA_SCK,
    LORA_MISO,
    LORA_MOSI,
    LORA_SS
  );

  // Configure LoRa pins.

  LoRa.setPins(
    LORA_SS,
    LORA_RST,
    LORA_DIO0
  );

  // Start LoRa communication.

  if (!LoRa.begin(LORA_FREQUENCY)) {

    Serial.println("LoRa initialization failed!");

    while (true) {

      delay(1000);
    }
  }

  Serial.println("LoRa initialized successfully.");

  Serial.print("LoRa frequency: ");
  Serial.println(LORA_FREQUENCY);

  Serial.println();

  Serial.println(
    "Waiting for sensor readings..."
  );
}

// ==================================================
// MAIN LOOP
// ==================================================

void loop() {

  // Continuously read GPS serial data.

  readGPS();

  // Display GPS coordinates when updated.

  if (gps.location.isUpdated()) {

    Serial.println();

    Serial.println("GPS LOCATION UPDATED");

    Serial.print("Latitude: ");
    Serial.println(gps.location.lat(), 6);

    Serial.print("Longitude: ");
    Serial.println(gps.location.lng(), 6);
  }

  // Check for incoming LoRa packets.

  int packetSize = LoRa.parsePacket();

  if (packetSize > 0) {

    String packet = "";

    while (LoRa.available()) {

      packet += (char)LoRa.read();
    }

    Serial.println();

    Serial.println("==============================");
    Serial.println("LORA PACKET RECEIVED");
    Serial.println("==============================");

    Serial.println(packet);

    // Expected packet format:
    //
    // FG-SENSOR-001,620,UNCLASSIFIED

    int firstComma = packet.indexOf(',');

    int secondComma = packet.indexOf(
      ',',
      firstComma + 1
    );

    if (
      firstComma > 0 &&
      secondComma > firstComma
    ) {

      // Extract sensor ID.

      String sensorId = packet.substring(
        0,
        firstComma
      );

      // Extract raw sensor value.

      String rawText = packet.substring(
        firstComma + 1,
        secondComma
      );

      // Extract flood status.

      String floodStatus = packet.substring(
        secondComma + 1
      );

      sensorId.trim();
      rawText.trim();
      floodStatus.trim();

      // Validate raw sensor value.

      bool validNumber = rawText.length() > 0;

      for (
        int i = 0;
        i < rawText.length();
        i++
      ) {

        if (
          rawText[i] < '0' ||
          rawText[i] > '9'
        ) {

          validNumber = false;

          break;
        }
      }

      // Validate packet fields.

      if (
        validNumber &&
        sensorId.length() > 0 &&
        floodStatus.length() > 0
      ) {

        int rawValue = rawText.toInt();

        Serial.print("Sensor ID: ");
        Serial.println(sensorId);

        Serial.print("Raw sensor value: ");
        Serial.println(rawValue);

        Serial.print("Flood status: ");
        Serial.println(floodStatus);

        // Send sensor reading to backend.

        sendToServer(
          sensorId,
          rawValue,
          floodStatus
        );

      } else {

        Serial.println(
          "Invalid sensor reading or packet fields."
        );
      }

    } else {

      Serial.println(
        "Invalid LoRa packet format."
      );
    }
  }
}