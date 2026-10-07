/**
 * Voltage curve (mV) for 0%, 5%, ... 100%, from the vendor driver's
 * BatteryParam table for the M600 V2.
 */
const CURVE_MV = [
  3050, 3420, 3480, 3540, 3600, 3660, 3720, 3760, 3800, 3840, 3880, 3920, 3940, 3960, 3980, 4000,
  4020, 4040, 4060, 4080, 4110,
];

export interface Battery {
  /** Percentage reported by the firmware. */
  level: number;
  charging: boolean;
  millivolts: number;
}

export function parseBattery(payload: Uint8Array): Battery {
  return {
    level: payload[0],
    charging: payload[1] !== 0,
    millivolts: (payload[2] << 8) | payload[3],
  };
}

export function percentFromMillivolts(mv: number): number {
  if (mv <= CURVE_MV[0]) return 0;
  for (let i = 1; i < CURVE_MV.length; i++) {
    const [lo, hi] = [CURVE_MV[i - 1], CURVE_MV[i]];
    if (mv <= hi) return (i - 1) * 5 + Math.floor(((mv - lo) * 5) / (hi - lo));
  }
  return 100;
}
