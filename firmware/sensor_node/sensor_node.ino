/*
 * FloodGuard ESP32-1 sensor node (EXAMPLE — must be configured before use)
 * ---------------------------------------------------------------------------
 * Reads a water-level sensor, transmits a compact JSON packet over SX1278
 * LoRa (433 MHz) to the gateway. It does NOT compute centimetres, flood status,
 * or location — the gateway and backend own those.
 *
 * This is an illustrative starting point, NOT a validated production sketch.
 * You must edit every "CONFIGURE" value to match your actual hardware. We do
 * not assume the water-sensor model, pinout, or units.
 *
 * Libraries: ESP32 Arduino core, LoRa (sx1278), ArduinoJson.
 * Store DEVICE_TOKEN in NVS via the Provisioner tab — never commit it.
 */

#include <LoRa.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// --- CONFIGURE: LoRa pins for your exact SX1278 breakout ------------------
#define RADIO_SS   5
#define RADIO_RST  14
#define RADIO_DIO0 2
#define LORA_FREQ  433E6
#define LORA_SF    9
#define LORA_BW    125
#define LORA_CR    7

// --- CONFIGURE: identity --------------------------------------------------
const char* DEVICE_ID = "FG-SENSOR-001";   // unique sensor id
const int   READ_INTERVAL_MS = 60000;      // sample every 60 s

// --- CONFIGURE: water-level sensor ---------------------------------------
// Placeholder: a generic analog water-level / float sensor on an ADC pin.
// Replace with your sensor's actual read method (analog, pulse-count, I2C…).
#define WATER_SENSOR_PIN 34

Preferences prefs;
uint32_t packetSeq = 0;

void readSensorAndBuild(JsonDocument& doc) {
  int raw = analogRead(WATER_SENSOR_PIN);   // RAW value — not centimetres
  doc["d"]   = DEVICE_ID;
  doc["seq"] = ++packetSeq;
  doc["raw"] = raw;
  doc["bat"] = 0; // CONFIGURE: measure battery via divider; 0 = not reported
}

void setup() {
  Serial.begin(115200);
  prefs.begin("fg", false);
  packetSeq = prefs.getULong("seq", 0);

  LoRa.setPins(RADIO_SS, RADIO_RST, RADIO_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init FAILED — check SX1278 pins/power");
    while (true) { delay(1000); }
  }
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW * 1000);
  LoRa.setCodingRate4(LORA_CR);
  Serial.println("LoRa transmitter ready");
}

void loop() {
  StaticJsonDocument<160> doc;
  readSensorAndBuild(doc);

  char buf[160];
  size_t n = serializeJson(doc, buf);

  LoRa.beginPacket();
  LoRa.write(reinterpret_cast<const uint8_t*>(buf), n);
  bool sent = LoRa.endPacket() == true;
  Serial.printf("TX %s: %s\n", sent ? "ok" : "FAIL", buf);

  prefs.putULong("seq", packetSeq); // persist sequence so duplicates are detectable
  delay(READ_INTERVAL_MS);
}
