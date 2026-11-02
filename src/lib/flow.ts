// Water-flow decisioning.
//
// A water-LEVEL sensor does not measure flow (L/min). We only ever surface a
// flow value when a real flow sensor or a documented, validated model produced
// one. Otherwise the UI shows the "unavailable" message and never invents data.

import { FLOW_UNAVAILABLE_MESSAGE, type FlowSource } from "./types";

export interface FlowValue {
  waterFlowLpm: number | null;
  flowSource: FlowSource | null;
}

export interface FlowDecision {
  available: boolean;
  valueLpm: number | null;
  source: FlowSource | null;
  /** Present when unavailable — the exact message required by the brief. */
  message?: string;
  /** True when the value is a model estimate rather than a direct measurement. */
  estimated: boolean;
}

export function resolveFlow(input: FlowValue): FlowDecision {
  const value = input.waterFlowLpm;
  if (value == null || !Number.isFinite(value)) {
    return {
      available: false,
      valueLpm: null,
      source: null,
      estimated: false,
      message: FLOW_UNAVAILABLE_MESSAGE,
    };
  }
  return {
    available: true,
    valueLpm: value,
    source: input.flowSource ?? "MEASURED",
    estimated: input.flowSource === "ESTIMATED",
  };
}

/** Aggregate helpers for a set of flow samples (ignores nulls). */
export function flowStats(samples: Array<number | null | undefined>): {
  count: number;
  max: number | null;
  avg: number | null;
} {
  const values = samples.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (values.length === 0) return { count: 0, max: null, avg: null };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, max: Math.max(...values), avg: sum / values.length };
}
