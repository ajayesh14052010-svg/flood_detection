/*
 * FloodGuard WiFi sensor node (ESP32) — posts readings directly to the backend.
 * ---------------------------------------------------------------------------
 * This sketch is for an ESP32 that connects to Wi-Fi and POSTs its own reading
 * to:  POST <SERVER_URL>   (e.g. http://192.168.1.20:3000/api/v1/readings)
 * It does NOT use the LoRa gateway path; both ingestion endpoints feed the same
 * database, so the dashboard and alerts behave identically.
 *
 * NON-SECRET CONFIG lives at the top of this file.
 * SECRETS (Wi-Fi password + device token) live in "secrets.h", which is git
 * ignored. Copy secrets.example.h -> secrets.h and fill in real values. NEVER
 * commit secrets.h.
 *
 * Libraries: ESP32 Arduino core (WiFi, HTTPClient), ArduinoJson.
 *
 * DO NOT use localhost / 127.0.0.1: the ESP32 must reach your machine/server by
 * its LAN IP (or a public domain in production). The IP is YOUR machine's Wi-Fi
 * address, not a fixed value here.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "secrets.h"   // provides: WIFI_SSID, WIFI_PASS, DEVICE_TOKEN

// --- CONFIGURE: identity -------------------------------------------------
// Each physical node gets its own id + its own monotonic sequence, so the
// backend stores a separate history per device.
const char* DEVICE_ID = "FLOOD_ESP32_01";   // change per node (e.g. FLOOD_ESP32_02)

// --- CONFIGURE: backend --------------------------------------------------
// Local dev: your machine's Wi-Fi IP + the Next dev port. Example:
//   http://192.168.1.20:3000/api/v1/readings
// Production: your deployed domain. Example:
//   https://floodguard.example.com/api/v1/readings
const char* SERVER_URL = "http://192.168.1.20:3000/api/v1/readings";

// --- CONFIGURE: sampling -------------------------------------------------
const unsigned long SEND_INTERVAL_MS = 30000;  // send every 30 s
const int SENSOR_PIN = 34;                      // ADC pin — CONFIGURE to your wiring

// --- CONFIGURE: optional fixed installation coordinates ------------------
// If your node has no GPS, set these to the deployment location (else leave 0
// and the backend marks the reading as UNVERIFIED_LOCATION).
const bool   HAS_LOCATION = false;
const double NODE_LAT = 0.0;
const double NODE_LNG = 0.0;

unsigned long lastSendAt = 0;
unsigned long packetSeq = 0;
bool provisioned = false;
Preferences fg_prefs;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("WiFi connecting");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP=");
    Serial.println(WiFi.localIP());   // IP is fine to log; never log the password
  } else {
    Serial.println("WiFi connect FAILED — will retry next cycle");
  }
}

// Build the JSON the backend expects. The tolerant /api/v1/readings endpoint
// accepts these keys and maps them onto the canonical reading schema.
static String buildBody(uint32_t raw, double batteryV) {
  StaticJsonDocument<320> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["raw_sensor_value"] = raw;          // RAW sensor value (not centimetres)
  doc["packet_sequence"] = packetSeq;     // monotonic per device -> dedup
  doc["battery_voltage"] = batteryV;
  doc["firmware_version"] = "wifi-1.0.0";
  doc["timestamp"] = (unsigned long long)millis();
  if (HAS_LOCATION) {
    doc["latitude"] = NODE_LAT;
    doc["longitude"] = NODE_LNG;
  }
  String body;
  serializeJson(doc, body);
  return body;
}

// One POST attempt. Returns the HTTP status (0 = transport error).
int postReading(const String& body) {
  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(8000);
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  int code = http.POST((uint8_t*)body.c_str(), body.length());
  http.end();
  return code;
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT);

  if (String(WIFI_SSID) == "CHANGE_ME" || String(DEVICE_TOKEN) == "CHANGE_ME") {
    Serial.println("ERROR: copy secrets.example.h to secrets.h and set real values.");
    // Do not proceed with placeholder credentials.
    provisioned = false;
    return;
  }
  provisioned = true;

  connectWiFi();
  // Restore the last sequence from NVS so restarts never re-send old seq values.
  prefs_init();
  packetSeq = prefs_get_seq();
}

void loop() {
  if (!provisioned) { delay(5000); return; }

  if (millis() - lastSendAt < SEND_INTERVAL_MS) {
    delay(200);                 // non-blocking-ish cadence control
    return;
  }
  lastSendAt = millis();

  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  uint32_t raw = (uint32_t)analogRead(SENSOR_PIN);   // CONFIGURE your sensor read
  double batteryV = 0.0;                              // 0 = not reported
  packetSeq += 1;

  String body = buildBody(raw, batteryV);

  int code = postReading(body);
  if (code == 200 || code == 201) {
    prefs_put_seq(packetSeq);   // only persist the sequence once the server accepted it
    Serial.printf("Posted seq=%lu -> HTTP %d\n", packetSeq, code);
  } else if (code == 401 || code == 403) {
    Serial.println("Rejected by server (check DEVICE_TOKEN / device registration)");
    packetSeq -= 1;             // roll back so the retry reuses the same seq
  } else if (code == 422 || code == 400) {
    Serial.println("Server rejected payload format");
    packetSeq -= 1;
  } else {
    // 0 = transport failure, 5xx = backend/DB issue: retry next interval.
    Serial.printf("Post failed (HTTP %d) — will retry\n", code);
    packetSeq -= 1;
  }
}

// --- Tiny NVS helpers (persist sequence across reboots) ------------------
void prefs_init()   { fg_prefs.begin("fg", false); }
unsigned long prefs_get_seq()  { return fg_prefs.getULong("seq", 0); }
void prefs_put_seq(unsigned long s) { fg_prefs.putULong("seq", s); }
