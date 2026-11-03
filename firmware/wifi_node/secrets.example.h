/*
 * FloodGuard WiFi node SECRETS — copy this file to "secrets.h" and fill in
 * real values. secrets.h is git-ignored; never commit the populated copy.
 *
 *   cp secrets.example.h secrets.h
 */

// Your Wi-Fi network (2.4 GHz on ESP32).
#define WIFI_SSID "CHANGE_ME"
#define WIFI_PASS "CHANGE_ME"

// The device token issued when the node was registered via
// POST /api/v1/admin/devices (shown once). Sent as:
//   Authorization: Bearer <DEVICE_TOKEN>
// The backend stores only a peppered SHA-256 hash; the raw token is not recoverable.
#define DEVICE_TOKEN "CHANGE_ME"
