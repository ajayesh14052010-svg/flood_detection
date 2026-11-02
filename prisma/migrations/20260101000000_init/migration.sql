-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Gateway" (
    "id" SERIAL NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firmwareVersion" TEXT,
    "lastReportedIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsFix" BOOLEAN NOT NULL DEFAULT false,
    "batteryVoltage" DOUBLE PRECISION,
    "loraRssi" INTEGER,
    "loraSnr" DOUBLE PRECISION,
    "packetsReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "lastPacketSeq" INTEGER NOT NULL DEFAULT 0,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "hasLocation" BOOLEAN NOT NULL DEFAULT false,
    "locationSource" TEXT,
    "calibrationConfigured" BOOLEAN NOT NULL DEFAULT false,
    "calibrationSlope" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "calibrationIntercept" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gatewayId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "gatewayId" INTEGER,
    "rawSensorValue" INTEGER NOT NULL,
    "calibratedWaterLevelCm" DOUBLE PRECISION,
    "waterFlowLpm" DOUBLE PRECISION,
    "flowSource" TEXT,
    "floodStatus" TEXT NOT NULL,
    "dataQuality" TEXT NOT NULL DEFAULT 'OK',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "batteryVoltage" DOUBLE PRECISION,
    "loraRssi" INTEGER,
    "loraSnr" DOUBLE PRECISION,
    "packetSequence" INTEGER NOT NULL,
    "firmwareVersion" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "reportedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneSensor" (
    "id" SERIAL NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ZoneSensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER,
    "zoneRef" INTEGER,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "valueCm" DOUBLE PRECISION,
    "valueRaw" INTEGER,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThresholdConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThresholdConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_gatewayId_key" ON "Gateway"("gatewayId");

-- CreateIndex
CREATE INDEX "Gateway_status_idx" ON "Gateway"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_gatewayId_idx" ON "Device"("gatewayId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Reading_deviceId_receivedAt_idx" ON "Reading"("deviceId", "receivedAt");

-- CreateIndex
CREATE INDEX "Reading_floodStatus_idx" ON "Reading"("floodStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Reading_deviceId_packetSequence_key" ON "Reading"("deviceId", "packetSequence");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_zoneId_key" ON "Zone"("zoneId");

-- CreateIndex
CREATE INDEX "Zone_zoneId_idx" ON "Zone"("zoneId");

-- CreateIndex
CREATE INDEX "ZoneSensor_deviceId_idx" ON "ZoneSensor"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneSensor_zoneId_deviceId_key" ON "ZoneSensor"("zoneId", "deviceId");

-- CreateIndex
CREATE INDEX "Alert_acknowledged_idx" ON "Alert"("acknowledged");

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ThresholdConfig_key_key" ON "ThresholdConfig"("key");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneSensor" ADD CONSTRAINT "ZoneSensor_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneSensor" ADD CONSTRAINT "ZoneSensor_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

