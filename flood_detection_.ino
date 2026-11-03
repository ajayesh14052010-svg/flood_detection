/*
  =====================================================
       FLOODGUARD - ESP32 #1
       WATER SENSOR + SX1278 LoRa TRANSMITTER
  =====================================================

  WATER SENSOR:
    VCC    -> VIN (only if sensor supports this voltage)
    GND    -> GND
    SIGNAL -> GPIO 34

  SX1278 LoRa:
    GND    -> GND
    NSS    -> GPIO 5
    MOSI   -> GPIO 23
    MISO   -> GPIO 19
    SCK    -> GPIO 18
    DIO0   -> GPIO 26
    3.3V   -> 3V3
    RST    -> GPIO 14

  Frequency: 433 MHz
  Transmission interval: 5 seconds
*/

// ---------------- LIBRARIES ----------------

#include <SPI.h>
#include <LoRa.h>

// ---------------- WATER SENSOR PINS ----------------

#define WATER_SENSOR_PIN 34

// ---------------- LORA PIN CONFIGURATION ----------------

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  26

// ---------------- SPI PIN CONFIGURATION ----------------

#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23

// ---------------- WATER LEVEL THRESHOLDS ----------------

// Calibrate these values using your actual sensor.

#define WARNING_LEVEL 1800
#define DANGER_LEVEL  2600

// ---------------- DEVICE INFORMATION ----------------

const char* DEVICE_ID = "FLOOD_NODE_01";

// ---------------- TIMING ----------------

String previousStatus = "";

unsigned long lastSendTime = 0;

const unsigned long SEND_INTERVAL = 5000;

// =====================================================
//                       SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("=================================");
  Serial.println("       FLOODGUARD SYSTEM");
  Serial.println("       ESP32 TRANSMITTER");
  Serial.println("=================================");

  // Water sensor configuration
  pinMode(WATER_SENSOR_PIN, INPUT);

  // ESP32 ADC configuration
  analogReadResolution(12);

  // Initialize SPI with custom ESP32 pins
  SPI.begin(
    LORA_SCK,
    LORA_MISO,
    LORA_MOSI,
    LORA_SS
  );

  // Configure LoRa pins
  LoRa.setPins(
    LORA_SS,
    LORA_RST,
    LORA_DIO0
  );

  Serial.println("Initializing LoRa...");

  // Initialize SX1278 at 433 MHz
  if (!LoRa.begin(433E6)) {

    Serial.println("ERROR: LoRa initialization failed!");

    Serial.println("Check:");
    Serial.println("1. Power supply");
    Serial.println("2. SPI connections");
    Serial.println("3. LoRa module wiring");

    while (true) {

      delay(1000);

    }

  }

  // LoRa communication settings
  LoRa.setSpreadingFactor(7);

  LoRa.setSignalBandwidth(125E3);

  LoRa.setCodingRate4(5);

  LoRa.setSyncWord(0x12);

  LoRa.enableCrc();

  Serial.println("LoRa initialized successfully!");

  Serial.println("---------------------------------");
  Serial.println("Water Sensor : GPIO 34");
  Serial.println("LoRa NSS     : GPIO 5");
  Serial.println("LoRa MOSI    : GPIO 23");
  Serial.println("LoRa MISO    : GPIO 19");
  Serial.println("LoRa SCK     : GPIO 18");
  Serial.println("LoRa DIO0    : GPIO 26");
  Serial.println("LoRa RST     : GPIO 14");
  Serial.println("Frequency    : 433 MHz");
  Serial.println("---------------------------------");

  Serial.println("FloodGuard monitoring started!");

}

// =====================================================
//                    MAIN LOOP
// =====================================================

void loop() {

  // Read water sensor
  int waterValue = analogRead(WATER_SENSOR_PIN);

  // Determine water status
  String status;

  if (waterValue >= DANGER_LEVEL) {

    status = "DANGER";

  }

  else if (waterValue >= WARNING_LEVEL) {

    status = "WARNING";

  }

  else {

    status = "NORMAL";

  }

  // Display readings in Serial Monitor
  Serial.print("Device ID: ");
  Serial.print(DEVICE_ID);

  Serial.print(" | Water Reading: ");
  Serial.print(waterValue);

  Serial.print(" | Status: ");
  Serial.println(status);

  unsigned long currentTime = millis();

  // Transmit immediately when status changes
  // Otherwise transmit every 5 seconds

  if (
    status != previousStatus ||
    currentTime - lastSendTime >= SEND_INTERVAL
  ) {

    // Construct LoRa message
    String message =
      String(DEVICE_ID) + "," +
      String(waterValue) + "," +
      status;

    Serial.println("---------------------------------");

    Serial.print("Transmitting: ");
    Serial.println(message);

    // Start LoRa packet
    LoRa.beginPacket();

    LoRa.print(message);

    // Send packet
    int result = LoRa.endPacket();

    if (result == 1) {

      Serial.println("LoRa transmission successful!");

    }

    else {

      Serial.println("LoRa transmission failed!");

    }

    Serial.println("---------------------------------");

    // Update previous status and time
    previousStatus = status;

    lastSendTime = currentTime;

  }

  // Sensor sampling delay
  delay(500);

}