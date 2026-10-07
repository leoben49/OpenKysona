/**
 * On-board macros: 16 slots of 384 bytes from flash 0x0300.
 *
 * Slot layout: [nameLen, name[30], stepCount, steps[stepCount * 5], checksum].
 * Step: [event | kind, code lo, code hi, delay hi, delay lo], where event is
 * 0x80 down / 0x40 up, kind is 0x00 modifier (HID modifier bitmask), 0x01
 * keyboard (HID usage) or 0x04 mouse (button mask), and the delay (ms) is
 * waited after the event.
 * Checksum: 0x55 - (stepCount + sum of step bytes).
 */

export const MACRO_BASE = 0x0300;
export const MACRO_SLOT_SIZE = 384;
export const MACRO_SLOTS = 16;
export const MACRO_NAME_MAX = 30;
export const MACRO_MAX_STEPS = 70;
const HEADER = 32;
const COUNT_OFFSET = 31;

const DOWN = 0x80;
const UP = 0x40;
const KINDS = { modifier: 0x00, key: 0x01, mouse: 0x04 } as const;
type Kind = keyof typeof KINDS;
const KIND_BY_BYTE = new Map<number, Kind>(Object.entries(KINDS).map(([k, v]) => [v, k as Kind]));

export interface MacroStep {
  kind: Kind;
  /**
   * modifier: HID modifier bitmask (1 LCtrl, 2 LShift, 4 LAlt, 8 LWin, ×16 for right-hand);
   * key: HID keyboard usage; mouse: button mask (1 left, 2 right, 4 middle, 8 back, 16 forward).
   */
  code: number;
  down: boolean;
  /** Milliseconds to wait after this event. */
  delayMs: number;
}

export interface Macro {
  name: string;
  steps: MacroStep[];
}

/** Repeat modes stored in the button binding (class 0x06, param 2). */
export const REPEAT = {
  /** 1–250 run that many times. */
  whileHeld: 0xfe,
  untilAnyKey: 0xff,
  toggle: 0xfd,
} as const;

export const macroAddress = (slot: number) => MACRO_BASE + slot * MACRO_SLOT_SIZE;

export function decodeMacro(slot: Uint8Array): Macro | null {
  const nameLen = slot[0];
  const count = slot[COUNT_OFFSET];
  if (nameLen === 0 || nameLen > MACRO_NAME_MAX || count === 0 || count > MACRO_MAX_STEPS) return null;
  let sum = count;
  for (let i = HEADER; i < HEADER + count * 5; i++) sum += slot[i];
  if (slot[HEADER + count * 5] !== ((0x55 - sum) & 0xff)) return null;

  const steps: MacroStep[] = [];
  for (let s = 0; s < count; s++) {
    const b = HEADER + s * 5;
    const kind = KIND_BY_BYTE.get(slot[b] & 0x0f);
    if (!kind) continue; // unknown step types are skipped
    steps.push({
      kind,
      code: slot[b + 1] | (slot[b + 2] << 8),
      down: (slot[b] & 0xc0) === DOWN,
      delayMs: (slot[b + 3] << 8) | slot[b + 4],
    });
  }
  return { name: String.fromCharCode(...slot.subarray(1, 1 + nameLen)), steps };
}

/**
 * Encodes a macro into a full slot. Bytes past the checksum are left as in
 * `base` (erased flash reads 0xFF), so only the used part needs writing.
 */
export function encodeMacro(m: Macro, base: Uint8Array = new Uint8Array(MACRO_SLOT_SIZE).fill(0xff)): Uint8Array {
  const slot = base.slice(0, MACRO_SLOT_SIZE);
  const name = m.name.replace(/[^\x20-\x7e]/g, '').slice(0, MACRO_NAME_MAX) || 'Macro';
  const steps = m.steps.slice(0, MACRO_MAX_STEPS);
  slot[0] = name.length;
  for (let i = 0; i < MACRO_NAME_MAX; i++) slot[1 + i] = i < name.length ? name.charCodeAt(i) : base[1 + i];
  slot[COUNT_OFFSET] = steps.length;
  let sum = steps.length;
  steps.forEach((st, s) => {
    const b = HEADER + s * 5;
    const delay = Math.max(0, Math.min(0xffff, Math.round(st.delayMs)));
    const bytes = [(st.down ? DOWN : UP) | KINDS[st.kind], st.code & 0xff, (st.code >> 8) & 0xff, delay >> 8, delay & 0xff];
    slot.set(bytes, b);
    sum += bytes.reduce((a, x) => a + x, 0);
  });
  slot[HEADER + steps.length * 5] = (0x55 - sum) & 0xff;
  return slot;
}

/** HID usages 0xE0–0xE7 (Ctrl, Shift, Alt, Win; left then right) are stored as modifier bits. */
export function stepForKey(usage: number, down: boolean, delayMs = 0): MacroStep {
  return usage >= 0xe0 && usage <= 0xe7
    ? { kind: 'modifier', code: 1 << (usage - 0xe0), down, delayMs }
    : { kind: 'key', code: usage, down, delayMs };
}

/** Bytes of a slot that carry data (header + steps + checksum); the rest is ignored by the firmware. */
export const usedLength = (m: Macro) => HEADER + Math.min(m.steps.length, MACRO_MAX_STEPS) * 5 + 1;
