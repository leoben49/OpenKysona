/**
 * 16-byte command packets exchanged on HID report ID 0x08.
 *
 * Layout: [cmd, 0, addrHi, addrLo, len, payload[10], checksum].
 * The checksum makes the report ID plus all 16 bytes sum to 0x55 (mod 256),
 * for host requests and device responses alike.
 */

export const REPORT_ID = 0x08;
export const PACKET_LEN = 16;
export const MAX_PAYLOAD = 10;

export const Command = {
  PcDriverStatus: 0x02,
  DeviceOnline: 0x03,
  BatteryLevel: 0x04,
  WriteFlash: 0x07,
  ReadFlash: 0x08,
  StatusChanged: 0x0a,
  GetCurrentConfig: 0x0e,
  SetCurrentConfig: 0x0f,
  ReadCidMid: 0x10,
  ReadVersion: 0x12,
  SetLongRangeMode: 0x16,
  GetLongRangeMode: 0x17,
} as const;
export type Command = (typeof Command)[keyof typeof Command];

export function checksum(bytes: Uint8Array): number {
  let sum = REPORT_ID;
  for (let i = 0; i < 15; i++) sum += bytes[i];
  return (0x55 - sum) & 0xff;
}

export function encode(
  cmd: Command,
  addr = 0,
  len = 0,
  payload: ArrayLike<number> = [],
): Uint8Array<ArrayBuffer> {
  if (payload.length > MAX_PAYLOAD) throw new RangeError('payload too long');
  const p = new Uint8Array(PACKET_LEN);
  p[0] = cmd;
  p[2] = (addr >> 8) & 0xff;
  p[3] = addr & 0xff;
  p[4] = len;
  p.set(payload, 5);
  p[15] = checksum(p);
  return p;
}

export const isValid = (p: Uint8Array) => p.length === PACKET_LEN && checksum(p) === p[15];

/** The 10 payload bytes of a response. */
export const payloadOf = (p: Uint8Array) => p.subarray(5, 15);

export const hex = (bytes: ArrayLike<number>) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
