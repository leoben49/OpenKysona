import { describe, expect, it } from 'vitest';
import { decodeDpi, decodeSettings, encodeDpi, encodeSettings, SETTINGS_LEN } from './settings';
import { M600_SETTINGS as FIXTURE } from './fixtures';

const changedAddrs = (a: Uint8Array, b: Uint8Array) => [...a].flatMap((v, i) => (v === b[i] ? [] : [i]));

describe('decodeSettings', () => {
  const s = decodeSettings(FIXTURE);

  it('reads the real device settings', () => {
    expect(FIXTURE.length).toBe(SETTINGS_LEN);
    expect(s.pollingRate).toBe(1000);
    expect(s.stageCount).toBe(6);
    expect(s.activeStage).toBe(2);
    expect(s.dpiStages.slice(0, 6).map((d) => d.dpi)).toEqual([400, 1600, 800, 3200, 6400, 26000]);
    expect(s.dpiStages[0].color).toBe('#ff8000');
    expect(s.liftOffMm).toBe(1);
    expect(s.debounceMs).toBe(8);
    expect(s.motionSync).toBe(true);
    expect(s.angleSnapping).toBe(false);
    expect(s.rippleControl).toBe(false);
    expect(s.highPerformanceMode).toBe(false);
  });

  it('maps the M600 V2 buttons', () => {
    expect(s.buttons.slice(0, 6)).toEqual([
      { type: 'mouse', button: 'left' },
      { type: 'mouse', button: 'right' },
      { type: 'mouse', button: 'middle' },
      { type: 'mouse', button: 'back' },
      { type: 'mouse', button: 'forward' },
      { type: 'dpi', mode: 'cycle' },
    ]);
    expect(s.buttons[8]).toEqual({ type: 'pollingCycle' });
  });
});

describe('encodeSettings', () => {
  it('round-trips byte for byte', () => {
    expect(encodeSettings(decodeSettings(FIXTURE), FIXTURE)).toEqual(FIXTURE);
  });

  // Each case reproduces a change made in the vendor app and the bytes it wrote.
  it.each([
    ['polling 500 Hz', { pollingRate: 500 }, [[0x00, 0x02], [0x01, 0x53]]],
    ['motion sync off', { motionSync: false }, [[0xab, 0x00], [0xac, 0x55]]],
    ['ripple on', { rippleControl: true }, [[0xb1, 0x01], [0xb2, 0x54]]],
    ['angle snapping on', { angleSnapping: true }, [[0xaf, 0x01], [0xb0, 0x54]]],
    ['peak performance on', { peakPerformance: true }, [[0xb5, 0x01], [0xb6, 0x54]]],
    ['HP mode', { highPerformanceMode: true }, [[0xb9, 0x01], [0xba, 0x54]]],
    ['LOD 2 mm', { liftOffMm: 2 }, [[0x0a, 0x02], [0x0b, 0x53]]],
    ['active stage 1', { activeStage: 1 }, [[0x04, 0x01], [0x05, 0x54]]],
    ['debounce 7 ms', { debounceMs: 7 }, [[0xa9, 0x07], [0xaa, 0x4e]]],
  ] as const)('%s matches the vendor app', (_, patch, expected) => {
    const out = encodeSettings({ ...decodeSettings(FIXTURE), ...patch }, FIXTURE);
    expect(changedAddrs(FIXTURE, out).map((a) => [a, out[a]])).toEqual(expected);
  });

  it('remaps back to forward like the vendor app', () => {
    const s = decodeSettings(FIXTURE);
    s.buttons[3] = { type: 'mouse', button: 'forward' };
    const out = encodeSettings(s, FIXTURE);
    expect(changedAddrs(FIXTURE, out).map((a) => [a, out[a]])).toEqual([[0x6d, 0x10], [0x6f, 0x44]]);
  });
});

describe('DPI codec', () => {
  it.each([400, 800, 1600, 3200, 6400, 12800, 12850, 20000, 26000])('%i round-trips', (dpi) => {
    expect(decodeDpi(encodeDpi(dpi))).toBe(dpi);
  });

  it('matches the device encoding', () => {
    expect(encodeDpi(800)).toEqual([0x0f, 0x0f, 0x00]);
    expect(encodeDpi(26000)).toEqual([0x07, 0x07, 0x88]);
  });
});
