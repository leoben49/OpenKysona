import { describe, expect, it } from 'vitest';
import { Command, encode, hex, isValid } from './packet';
import { percentFromMillivolts } from './battery';

const bytes = (s: string) => Uint8Array.from(s.split(' ').map((h) => parseInt(h, 16)));

describe('packets', () => {
  it('encodes a battery request', () => {
    expect(hex(encode(Command.BatteryLevel))).toBe('04 00 00 00 00 00 00 00 00 00 00 00 00 00 00 49');
  });

  it('encodes a flash read with its address', () => {
    const p = encode(Command.ReadFlash, 0x0123, 10);
    expect([...p.slice(0, 5)]).toEqual([0x08, 0x00, 0x01, 0x23, 10]);
    expect(isValid(p)).toBe(true);
  });

  it('accepts real device responses', () => {
    expect(isValid(bytes('02 00 00 00 01 01 00 00 00 00 00 00 00 00 00 49'))).toBe(true);
    expect(isValid(bytes('0E 00 00 00 01 00 00 00 00 00 00 00 00 00 00 3E'))).toBe(true);
    expect(isValid(bytes('0E 00 00 00 01 00 00 00 00 00 00 00 00 00 00 3F'))).toBe(false);
  });
});

describe('battery curve', () => {
  it.each([
    [3000, 0],
    [3420, 5],
    [3880, 50],
    [3886, 50],
    [4110, 100],
    [4200, 100],
  ])('%i mV is %i%%', (mv, pct) => {
    expect(percentFromMillivolts(mv)).toBe(pct);
  });
});
