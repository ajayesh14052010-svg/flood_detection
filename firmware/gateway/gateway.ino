/*
 * FloodGuard ESP32-2 gateway (EXAMPLE — verify your hardware before use)
 * ---------------------------------------------------------------------------
 * Receives LoRa packets from sensor nodes, adds link metrics (RSSI/SNR),
 * gateway identity and its own GPS fix, then forwards the enriched payload to
 * the authenticated backend:
 *     POST /api/v1/devices/readings   Authorization: Bearer <device_token>
 *
 * IMPORTANT: the gateway is identified by a UNIQUE GATEWAY ID, not its IP.
 * Mobile-network IPs change and are often not publicly reachable.
 *
 * SIM800L is 2G GSM/GPRS. Do NOT assume HTTPS/TLS works on every module or
 * network. See gateway/README.md for the three transport options. This sketch
 * ships a transport stub — choose and verify one for your deployment.
 *
 * Libraries: ESP32 core, LoRa, ArduinoJson, TinyGPSPlus, and a GSM library
 * (e.g. TinyGSM) or raw AT over SoftwareSerial for the SIM800L.
 */

#include <LoRa.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// --- CONFIGURE: LoRa pins (match the sensor node) ------------------------
#define RADIO_SS 5
#define RADIO_RST 14
#define RADIO_DIO0 2
#define LORA_FREQ 433E6

const char* GATEWAY_ID = "FG-GATEWAY-002";   // unique id — the login identity
const char* BACKEND_URL = "https://your-host.example/api/v1/devices/readings";

// NEO-6M GPS on ESP32 hardware serial 2
HardwareSerial GPSSerial(2);
TinyGPSPlus gps;

void onReceive(int packetSize) {
  if (packetSize == 0) return;

  StaticJsonDocument<256> node;
  DeserializationError err = deserializeJson(node, LoRa);
  if (err) { Serial.println("RX JSON parse failed"); return; }

  int rssi = LoRa.packetRssi();
  float snr = LoRa.packetSnr();

  // Build the exact backend schema. Node cannot know cm / flow / status.
  StaticJsonDocument<512> payload;
  payload["device_id"] = node["d"].as<const char*>();
  payload["gateway_id"] = GATEWAY_ID;
  payload["raw_sensor_value"] = node["raw"].as<int>();
  payload["calibrated_water_level_cm"] = nullptr;   // backend + admin calibration
  payload["water_flow_lpm"] = nullptr;              // never invented
  payload["flood_status"] = "CALIBRATION_REQUIRED"; // advisory only
  payload["latitude"] = nullptr;                    // sensor location unknown here
  payload["longitude"] = nullptr;
  payload["battery_voltage"] = node.containsKey("bat") ? (float)node["bat"] : (float)0.0;
  payload["lora_rssi"] = rssi;                       // measured at the gateway
  payload["lora_snr"] = snr;
  payload["packet_sequence"] = node["seq"].as<uint32_t>();
  payload["firmware_version"] = "1.0.0";
  payload["simulated"] = false;

  char body[512];
  size_t n = serializeJson(payload, body);
  Serial.printf("RX seq=%u rssi=%d — forwarding %u bytes\n",
                (unsigned)node["seq"], rssi, (unsigned)n);
  transmitBackend(body, n);
}

// --- Transport stub: SELECT ONE after verifying your SIM800L/network -----
void transmitBackend(const char* body, size_t len) {
  // Option A: HTTPS via SIM7000/SIM7600-class module with TLS.
  // Option B: HTTP over GPRS with the token sent over a trusted private
  //           network / APN, or behind an SMS-provisioned IP allow-list.
  // Option C: gateway posts to a LAN bridge that terminates TLS and forwards.
  //
  // Do not hardcode the device token in source. Load it from NVS/secure
  // element at runtime. The server verifies only a peppered SHA-256 hash.
  //
  // Pseudocode for a SIM800L raw-AT path (needs a GPRS + TCP client):
  //   gprsConnect(); tcpOpen(host, port);
  //   send("POST " + path + " HTTP/1.1\r\nHost: ...\r\n"
  //        "Authorization: Bearer <token-from-secure-storage>\r\n"
  //        "Content-Type: application/json\r\nContent-Length: " + len + "\r\n\r\n");
  //   send(body);
  //   read response; if 4xx/5xx, retry with backoff and de-dup on reconnect.
  (void)body; (void)len;
}

void loop() {
  while (GPSSerial.available()) gps.encode(GPSSerial.read());
  delay(100);
}

void setup() {
  Serial.begin(115200);
  GPSSerial.begin(9600, SERIAL_8N1, /*rx*/16, /*tx*/17); // CONFIGURE pins

  LoRa.setPins(RADIO_SS, RADIO_RST, RADIO_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init FAILED"); while (true) delay(1000);
  }
  LoRa.onReceive(onReceive);
  LoRa.receive();
  Serial.println("LoRa gateway ready, listening");
}
