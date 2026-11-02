-- FloodGuard — PostgreSQL production schema (migration 0001_init).
--
-- This is the production DDL. The development/demo Prisma schema targets
-- SQLite for zero-install local runs, but the logical model is identical.
-- Status columns use TEXT + CHECK constraints (portable with the Prisma
-- client, which inserts strings) instead of native Postgres enums.
--
-- Apply with your tool of choice, e.g.:
--   psql "$DATABASE_URL" -f db/postgres/0001_init.sql
-- or convert to a Prisma migration after switching the datasource provider
-- to "postgresql" (see prisma/README.md).

BEGIN;

-- Extensions for useful indexes -------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS gateways (
  id                SERIAL PRIMARY KEY,
  gateway_id        TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  firmware_version  TEXT,
  last_reported_ip  TEXT,
  status            TEXT NOT NULL DEFAULT 'UNKNOWN'
                      CHECK (status IN ('ONLINE','OFFLINE','UNKNOWN')),
  is_online         BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at      TIMESTAMPTZ,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  gps_fix           BOOLEAN NOT NULL DEFAULT FALSE,
  battery_voltage   DOUBLE PRECISION,
  lora_rssi         INTEGER,
  lora_snr          DOUBLE PRECISION,
  packets_received  INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gateways_status ON gateways(status);

CREATE TABLE IF NOT EXISTS devices (
  id                     SERIAL PRIMARY KEY,
  device_id              TEXT UNIQUE NOT NULL,
  name                   TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'UNKNOWN',
  is_online              BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at           TIMESTAMPTZ,
  last_packet_seq        INTEGER NOT NULL DEFAULT 0,
  -- Device credentials: only the SHA-256 hash of the token is stored.
  token_hash             TEXT NOT NULL,
  token_prefix           TEXT NOT NULL,
  -- Location (may be unverified)
  latitude               DOUBLE PRECISION,
  longitude              DOUBLE PRECISION,
  has_location           BOOLEAN NOT NULL DEFAULT FALSE,
  location_source        TEXT CHECK (location_source IN ('GPS','MANUAL')),
  -- Calibration (cm = slope * raw + intercept)
  calibration_configured BOOLEAN NOT NULL DEFAULT FALSE,
  calibration_slope      DOUBLE PRECISION NOT NULL DEFAULT 1,
  calibration_intercept  DOUBLE PRECISION NOT NULL DEFAULT 0,
  gateway_id             INTEGER REFERENCES gateways(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_gateway ON devices(gateway_id);
CREATE INDEX IF NOT EXISTS idx_devices_status  ON devices(status);
-- Prevent duplicate token hashes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_token_hash ON devices(token_hash);

CREATE TABLE IF NOT EXISTS readings (
  id                        BIGSERIAL PRIMARY KEY,
  device_id                 INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  gateway_id                INTEGER REFERENCES gateways(id) ON DELETE SET NULL,
  raw_sensor_value          INTEGER NOT NULL,
  calibrated_water_level_cm DOUBLE PRECISION,
  water_flow_lpm            DOUBLE PRECISION,
  flow_source               TEXT CHECK (flow_source IN ('MEASURED','ESTIMATED')),
  flood_status              TEXT NOT NULL
                              CHECK (flood_status IN
                                ('NORMAL','WATCH','WARNING','CRITICAL',
                                 'SENSOR_OFFLINE','DATA_STALE','CALIBRATION_REQUIRED','UNKNOWN')),
  data_quality              TEXT NOT NULL DEFAULT 'OK',
  latitude                  DOUBLE PRECISION,
  longitude                 DOUBLE PRECISION,
  battery_voltage           DOUBLE PRECISION,
  lora_rssi                 INTEGER,
  lora_snr                  DOUBLE PRECISION,
  packet_sequence           INTEGER NOT NULL,
  firmware_version          TEXT,
  simulated                 BOOLEAN NOT NULL DEFAULT FALSE,
  reported_at               TIMESTAMPTZ,
  received_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Duplicate-packet protection: one row per device+sequence.
  UNIQUE (device_id, packet_sequence)
);
CREATE INDEX IF NOT EXISTS idx_readings_device_time ON readings(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_status      ON readings(flood_status);
CREATE INDEX IF NOT EXISTS idx_readings_received    ON readings(received_at DESC);

CREATE TABLE IF NOT EXISTS zones (
  id            SERIAL PRIMARY KEY,
  zone_id       TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  center_lat    DOUBLE PRECISION NOT NULL,
  center_lng    DOUBLE PRECISION NOT NULL,
  -- Monitoring zone radius; FloodGuard configures these as 50 m circles.
  radius_meters INTEGER NOT NULL DEFAULT 50 CHECK (radius_meters > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zone_sensors (
  id              SERIAL PRIMARY KEY,
  zone_id         INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  device_id       INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  distance_meters DOUBLE PRECISION NOT NULL,
  UNIQUE (zone_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_zone_sensors_device ON zone_sensors(device_id);

CREATE TABLE IF NOT EXISTS alerts (
  id              BIGSERIAL PRIMARY KEY,
  device_id       INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  zone_ref        INTEGER,
  type            TEXT NOT NULL
                    CHECK (type IN ('WARNING','CRITICAL','SENSOR_OFFLINE','DATA_STALE')),
  severity        TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  message         TEXT NOT NULL,
  value_cm        DOUBLE PRECISION,
  value_raw       INTEGER,
  acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_ack       ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_type      ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_created   ON alerts(created_at DESC);

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS threshold_config (
  id         SERIAL PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
