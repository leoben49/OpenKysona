/**
 * Typed view of the M600 V2 settings block (flash 0x0000–0x00BF).
 * See docs/PROTOCOL.md for the layout. Encoding starts from the bytes read
 * off the mouse so unknown fields are always preserved.
 */

export const SETTINGS_LEN = 0xc0;

const ADDR = {
  pollingRate: 0x00,
  stageCount: 0x02,
  activeStage: 0x04,
  liftOff: 0x0a,
  dpiStages: 0x0c,
  dpiColors: 0x2c,
  buttons: 0x60,
  debounce: 0xa9,
  motionSync: 0xab,
  angleSnapping: 0xaf,
  rippleControl: 0xb1,
  peakPerformance: 0xb5,
  sensorMode: 0xb9,
} as const;

export const MAX_STAGES = 8;
export const BUTTON_SLOTS = 16;
export const DPI_MIN = 50;
export const DPI_MAX = 26000;
export const DPI_STEP = 50;

const RATE_CODES: Record<number, PollingRate> = { 1: 1000, 2: 500, 4: 250, 8: 125 };
export const POLLING_RATES = [125, 250, 500, 1000] as const;
export type PollingRate = (typeof POLLING_RATES)[number];

export interface DpiStage {
  dpi: number;
  /** #rrggbb */
  color: string;
}

export type MouseButton = 'left' | 'right' | 'middle' | 'back' | 'forward';
const MOUSE_MASKS: Record<MouseButton, number> = { left: 1, right: 2, middle: 4, back: 8, forward: 16 };

export type ButtonAction =
  | { type: 'disabled' }
  | { type: 'mouse'; button: MouseButton }
  | { type: 'dpi'; mode: 'cycle' | 'up' | 'down' }
  | { type: 'tilt'; dir: 'left' | 'right' }
  | { type: 'scroll'; dir: 'up' | 'down' }
  | { type: 'fire'; intervalMs: number; repeat: number }
  | { type: 'shortcut'; code: number }
  | { type: 'macro'; index: number; mode: number }
  | { type: 'pollingCycle' }
  | { type: 'profileCycle' }
  | { type: 'sniper'; dpi: number }
  | { type: 'raw'; bytes: [number, number, number] };

export interface Settings {
  pollingRate: PollingRate;
  /** Always MAX_STAGES entries; only the first `stageCount` are active. */
  dpiStages: DpiStage[];
  stageCount: number;
  activeStage: number;
  liftOffMm: 1 | 2;
  debounceMs: number;
  motionSync: boolean;
  angleSnapping: boolean;
  rippleControl: boolean;
  peakPerformance: boolean;
  highPerformanceMode: boolean;
  /** Always BUTTON_SLOTS entries. */
  buttons: ButtonAction[];
}

// ---- primitive records -------------------------------------------------------

const check = (bytes: number[]) => (0x55 - bytes.reduce((a, b) => a + b, 0)) & 0xff;

function readReg(b: Uint8Array, addr: number, fallback: number): number {
  return check([b[addr]]) === b[addr + 1] ? b[addr] : fallback;
}

function writeReg(b: Uint8Array, addr: number, value: number) {
  b[addr] = value & 0xff;
  b[addr + 1] = check([value & 0xff]);
}

function readRec(b: Uint8Array, addr: number): [number, number, number] {
  return [b[addr], b[addr + 1], b[addr + 2]];
}

function writeRec(b: Uint8Array, addr: number, rec: [number, number, number]) {
  b.set(rec, addr);
  b[addr + 3] = check(rec);
}

// ---- DPI ---------------------------------------------------------------------

export function clampDpi(dpi: number): number {
  return Math.min(DPI_MAX, Math.max(DPI_MIN, Math.round(dpi / DPI_STEP) * DPI_STEP));
}

export function encodeDpi(dpi: number): [number, number, number] {
  const raw = clampDpi(dpi) / DPI_STEP - 1;
  const hi = raw >> 8;
  return [raw & 0xff, raw & 0xff, hi ? (hi << 2) | (hi << 6) : 0];
}

export function decodeDpi([x, , ex]: [number, number, number]): number {
  const hi = Math.max(ex >> 6, (ex >> 2) & 0x03);
  return (((hi << 8) | x) + 1) * DPI_STEP;
}

const toHex = (n: number) => n.toString(16).padStart(2, '0');
const colorToRec = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
const recToColor = ([r, g, b]: [number, number, number]) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

// ---- buttons -----------------------------------------------------------------

export function decodeButton([cls, p1, p2]: [number, number, number]): ButtonAction {
  const mouse = (Object.keys(MOUSE_MASKS) as MouseButton[]).find((k) => MOUSE_MASKS[k] === p1);
  switch (cls) {
    case 0x00:
      return { type: 'disabled' };
    case 0x01:
      if (mouse) return { type: 'mouse', button: mouse };
      break;
    case 0x02:
      if (p1 >= 1 && p1 <= 3) return { type: 'dpi', mode: (['cycle', 'up', 'down'] as const)[p1 - 1] };
      break;
    case 0x03:
      if (p1 === 1 || p1 === 2) return { type: 'tilt', dir: p1 === 1 ? 'left' : 'right' };
      break;
    case 0x04:
      return { type: 'fire', intervalMs: p1, repeat: p2 };
    case 0x05:
      return { type: 'shortcut', code: p1 };
    case 0x06:
      return { type: 'macro', index: p1, mode: p2 };
    case 0x07:
      return { type: 'pollingCycle' };
    case 0x09:
      return { type: 'profileCycle' };
    case 0x0a:
      return { type: 'sniper', dpi: (p1 + 1) * DPI_STEP };
    case 0x0b:
      if (p1 === 1 || p1 === 2) return { type: 'scroll', dir: p1 === 1 ? 'up' : 'down' };
      break;
  }
  return { type: 'raw', bytes: [cls, p1, p2] };
}

export function encodeButton(a: ButtonAction): [number, number, number] {
  switch (a.type) {
    case 'disabled':
      return [0, 0, 0];
    case 'mouse':
      return [0x01, MOUSE_MASKS[a.button], 0];
    case 'dpi':
      return [0x02, ['cycle', 'up', 'down'].indexOf(a.mode) + 1, 0];
    case 'tilt':
      return [0x03, a.dir === 'left' ? 1 : 2, 0];
    case 'fire':
      return [0x04, a.intervalMs & 0xff, a.repeat & 0xff];
    case 'shortcut':
      return [0x05, a.code & 0xff, 0];
    case 'macro':
      return [0x06, a.index & 0xff, a.mode & 0xff];
    case 'pollingCycle':
      return [0x07, 0, 0];
    case 'profileCycle':
      return [0x09, 0, 0];
    case 'sniper':
      return [0x0a, (clampDpi(a.dpi) / DPI_STEP - 1) & 0xff, 0];
    case 'scroll':
      return [0x0b, a.dir === 'up' ? 1 : 2, 0];
    case 'raw':
      return a.bytes;
  }
}

// ---- whole block -------------------------------------------------------------

export function decodeSettings(b: Uint8Array): Settings {
  const bool = (addr: number) => readReg(b, addr, 0) === 1;
  const stageCount = Math.min(MAX_STAGES, Math.max(1, readReg(b, ADDR.stageCount, 6)));
  return {
    pollingRate: RATE_CODES[readReg(b, ADDR.pollingRate, 1)] ?? 1000,
    dpiStages: Array.from({ length: MAX_STAGES }, (_, i) => ({
      dpi: decodeDpi(readRec(b, ADDR.dpiStages + i * 4)),
      color: recToColor(readRec(b, ADDR.dpiColors + i * 4)),
    })),
    stageCount,
    activeStage: Math.min(stageCount - 1, readReg(b, ADDR.activeStage, 0)),
    liftOffMm: readReg(b, ADDR.liftOff, 1) === 2 ? 2 : 1,
    debounceMs: readReg(b, ADDR.debounce, 8),
    motionSync: bool(ADDR.motionSync),
    angleSnapping: bool(ADDR.angleSnapping),
    rippleControl: bool(ADDR.rippleControl),
    peakPerformance: bool(ADDR.peakPerformance),
    highPerformanceMode: bool(ADDR.sensorMode),
    buttons: Array.from({ length: BUTTON_SLOTS }, (_, i) => decodeButton(readRec(b, ADDR.buttons + i * 4))),
  };
}

/** Returns a copy of `base` with `s` applied. Bytes for unknown fields are kept. */
export function encodeSettings(s: Settings, base: Uint8Array): Uint8Array {
  const b = base.slice(0, SETTINGS_LEN);
  const rate = Number(Object.entries(RATE_CODES).find(([, hz]) => hz === s.pollingRate)?.[0] ?? 1);
  writeReg(b, ADDR.pollingRate, rate);
  writeReg(b, ADDR.stageCount, s.stageCount);
  writeReg(b, ADDR.activeStage, s.activeStage);
  writeReg(b, ADDR.liftOff, s.liftOffMm);
  s.dpiStages.forEach((st, i) => {
    writeRec(b, ADDR.dpiStages + i * 4, encodeDpi(st.dpi));
    writeRec(b, ADDR.dpiColors + i * 4, colorToRec(st.color));
  });
  writeReg(b, ADDR.debounce, s.debounceMs);
  writeReg(b, ADDR.motionSync, Number(s.motionSync));
  writeReg(b, ADDR.angleSnapping, Number(s.angleSnapping));
  writeReg(b, ADDR.rippleControl, Number(s.rippleControl));
  writeReg(b, ADDR.peakPerformance, Number(s.peakPerformance));
  writeReg(b, ADDR.sensorMode, Number(s.highPerformanceMode));
  s.buttons.forEach((a, i) => writeRec(b, ADDR.buttons + i * 4, encodeButton(a)));
  return b;
}
