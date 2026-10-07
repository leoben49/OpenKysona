import { describe, expect, it } from 'vitest';
import { decodeMacro, encodeMacro, macroAddress, stepForKey, type Macro } from './macro';

const bytes = (s: string) => s.split(' ').map((h) => parseInt(h, 16));

/** Builds a slot as the vendor app left it: erased flash with the given bytes at offsets. */
function slotWith(parts: [number, string][]): Uint8Array {
  const slot = new Uint8Array(384).fill(0xff);
  for (const [off, hex] of parts) slot.set(bytes(hex), off);
  return slot;
}

// Captured from the vendor app: macro "test" typing "a" on button slot 3.
const TYPE_A = slotWith([
  [0x00, '04 74 65 73 74'],
  [0x1f, '02 81 04 00 00 8C 41 04 00 00 00 FD'],
]);

// Same macro after adding a right click (11 ms delays).
const A_THEN_RIGHT_CLICK = slotWith([
  [0x00, '04 74 65 73 74'],
  [0x1f, '04 81 04 00 00 8C 41 04 00 00 00 84 02 00 00 0B 44 02 00 00 0B 19'],
]);

// "test2": Ctrl+C then a left click, on button slot 4.
const CTRL_C_CLICK = slotWith([
  [0x00, '05 74 65 73 74 32'],
  [0x1f, '06 80 01 00 01 3D 81 06 00 00 6B 41 06 00 00 55 40 01 00 00 00 84 01 00 00 0A 44 01 00 00 0A E3'],
]);

describe('macros', () => {
  it('stores modifiers as bitmask steps', () => {
    expect(macroAddress(4)).toBe(0x0900);
    const m = decodeMacro(CTRL_C_CLICK)!;
    expect(m.name).toBe('test2');
    expect(m.steps[0]).toEqual({ kind: 'modifier', code: 1, down: true, delayMs: 317 });
    expect(m.steps[3]).toEqual({ kind: 'modifier', code: 1, down: false, delayMs: 0 });
    expect(stepForKey(0xe0, true, 317)).toEqual(m.steps[0]);
    expect(stepForKey(0x06, true, 107)).toEqual(m.steps[1]);
    expect(stepForKey(0xe5, true).code).toBe(0x20); // right shift
  });

  it('lives where the vendor app put it', () => {
    expect(macroAddress(3)).toBe(0x0780);
  });

  it('decodes a captured key macro', () => {
    expect(decodeMacro(TYPE_A)).toEqual<Macro>({
      name: 'test',
      steps: [
        { kind: 'key', code: 0x04, down: true, delayMs: 140 },
        { kind: 'key', code: 0x04, down: false, delayMs: 0 },
      ],
    });
  });

  it('decodes mouse steps', () => {
    expect(decodeMacro(A_THEN_RIGHT_CLICK)?.steps.slice(2)).toEqual([
      { kind: 'mouse', code: 2, down: true, delayMs: 11 },
      { kind: 'mouse', code: 2, down: false, delayMs: 11 },
    ]);
  });

  it.each([
    ['key macro', TYPE_A],
    ['key + mouse macro', A_THEN_RIGHT_CLICK],
    ['modifier macro', CTRL_C_CLICK],
  ])('re-encodes the %s byte for byte', (_, slot) => {
    expect(encodeMacro(decodeMacro(slot)!, slot)).toEqual(slot);
    expect(encodeMacro(decodeMacro(slot)!)).toEqual(slot);
  });

  it('treats erased or corrupt slots as empty', () => {
    expect(decodeMacro(new Uint8Array(384).fill(0xff))).toBeNull();
    const bad = TYPE_A.slice();
    bad[0x2a] ^= 1;
    expect(decodeMacro(bad)).toBeNull();
  });
});
