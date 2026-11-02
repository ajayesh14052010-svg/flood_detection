// Calibration: convert a raw sensor value to centimetres.
//
// A raw ADC/sensor value is NOT a water level in cm. It becomes cm only after
// an administrator configures a linear calibration (cm = slope * raw + offset)
// validated against a known reference. Without calibration we must not claim
// centimetres.

export interface CalibrationParams {
  configured: boolean;
  slope: number;
  intercept: number;
}

export const UNCALIBRATED: CalibrationParams = {
  configured: false,
  slope: 1,
  intercept: 0,
};

/**
 * Return calibrated centimetres, or null when calibration is not configured.
 * Never returns a value derived from an uncalibrated raw reading.
 */
export function calibrateToCm(
  rawSensorValue: number,
  calibration: CalibrationParams
): number | null {
  if (!calibration.configured) return null;
  if (!Number.isFinite(rawSensorValue)) return null;
  const cm = calibration.slope * rawSensorValue + calibration.intercept;
  if (!Number.isFinite(cm)) return null;
  // A negative water level is not physically meaningful; clamp small negatives
  // from calibration noise to 0 rather than surfacing nonsense.
  return Math.max(0, cm);
}

/**
 * Whether a calibration is valid enough to trust centimetre output.
 */
export function isCalibrationUsable(calibration: CalibrationParams): boolean {
  return (
    calibration.configured &&
    Number.isFinite(calibration.slope) &&
    Number.isFinite(calibration.intercept) &&
    calibration.slope > 0
  );
}
