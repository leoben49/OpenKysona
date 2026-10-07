import { parseBattery, type Battery } from './battery';
import { Command, encode, isValid, MAX_PAYLOAD, payloadOf, REPORT_ID } from './packet';

export const VENDOR_ID = 0x3554;
/** Mouse connected by cable. */
export const WIRED_PIDS = [0xf57d];
/** 2.4 GHz receivers. */
export const DONGLE_PIDS = [0xf57c, 0xf57e, 0xf512, 0xf5d5];
/**
 * Vendor-defined usage page carrying the config protocol (16-byte input/output
 * reports on ID 0x08). Redragon builds of the same firmware use 0xFF04.
 */
export const CONFIG_USAGE_PAGE = 0xff02;

export const FLASH_SIZE = 0x1b00;
const RESPONSE_TIMEOUT_MS = 600;

export const HID_FILTERS: HIDDeviceFilter[] = [...WIRED_PIDS, ...DONGLE_PIDS].map((productId) => ({
  vendorId: VENDOR_ID,
  productId,
  usagePage: CONFIG_USAGE_PAGE,
}));

const hasConfigCollection = (d: HIDDevice) =>
  d.vendorId === VENDOR_ID && d.collections.some((c) => c.usagePage === CONFIG_USAGE_PAGE);

export class TimeoutError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Mouse {
  readonly link: 'wired' | 'dongle';
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(readonly hid: HIDDevice) {
    this.link = WIRED_PIDS.includes(hid.productId) ? 'wired' : 'dongle';
  }

  /** Reconnects to a previously authorised device without prompting. */
  static async fromGranted(): Promise<Mouse | null> {
    const devices = (await navigator.hid.getDevices()).filter(hasConfigCollection);
    devices.sort((a, b) => Number(!WIRED_PIDS.includes(a.productId)) - Number(!WIRED_PIDS.includes(b.productId)));
    return devices[0] ? Mouse.open(devices[0]) : null;
  }

  /** Shows the browser's device picker. Must be called from a user gesture. */
  static async request(): Promise<Mouse | null> {
    const [device] = await navigator.hid.requestDevice({ filters: HID_FILTERS });
    return device ? Mouse.open(device) : null;
  }

  private static async open(hid: HIDDevice): Promise<Mouse> {
    if (!hid.opened) await hid.open();
    return new Mouse(hid);
  }

  async close() {
    await this.hid.close();
  }

  /**
   * Subscribes to unsolicited status reports (0x0A), sent when the mouse
   * changes something by itself. `flags` bits: 1 DPI, 2 polling rate,
   * 4 config, 64 battery. Returns an unsubscribe function.
   */
  onStatus(handler: (flags: number) => void): () => void {
    const listener = (e: HIDInputReportEvent) => {
      if (e.reportId === REPORT_ID && e.data.getUint8(0) === Command.StatusChanged) handler(e.data.getUint8(5));
    };
    this.hid.addEventListener('inputreport', listener);
    return () => this.hid.removeEventListener('inputreport', listener);
  }

  /** Sends a request and resolves with the 16-byte response echoing the same command. */
  request(cmd: Command, addr = 0, len = 0, payload: ArrayLike<number> = []): Promise<Uint8Array> {
    const run = () =>
      new Promise<Uint8Array>((resolve, reject) => {
        const onReport = (e: HIDInputReportEvent) => {
          if (e.reportId !== REPORT_ID) return;
          const p = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength).slice(0, 16);
          if (p[0] !== cmd) return;
          // Flash replies echo the address; ignore replies to another app's requests.
          if ((cmd === Command.ReadFlash || cmd === Command.WriteFlash) && ((p[2] << 8) | p[3]) !== addr) return;
          cleanup();
          isValid(p) ? resolve(p) : reject(new Error(`bad checksum on response to 0x${cmd.toString(16)}`));
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new TimeoutError(`no response to 0x${cmd.toString(16)}`));
        }, RESPONSE_TIMEOUT_MS);
        const cleanup = () => {
          clearTimeout(timer);
          this.hid.removeEventListener('inputreport', onReport);
        };
        this.hid.addEventListener('inputreport', onReport);
        this.hid.sendReport(REPORT_ID, encode(cmd, addr, len, payload)).catch((err) => {
          cleanup();
          reject(err);
        });
      });
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  /** Heartbeat telling the receiver a driver is present; wakes the RF link. */
  hello() {
    return this.request(Command.PcDriverStatus, 0, 1, [0x01]);
  }

  async online(): Promise<boolean> {
    return payloadOf(await this.request(Command.DeviceOnline, 0, 1, [0x01]))[0] !== 0;
  }

  async battery(): Promise<Battery> {
    return parseBattery(payloadOf(await this.request(Command.BatteryLevel)));
  }

  async currentProfile(): Promise<number> {
    return payloadOf(await this.requestRetry(Command.GetCurrentConfig))[0];
  }

  /** Makes the firmware re-apply settings from flash after writes. */
  async reload(profile: number) {
    await this.requestRetry(Command.SetCurrentConfig, 0, 1, [profile & 0x01]);
    await sleep(60);
  }

  async longRange(): Promise<boolean> {
    return payloadOf(await this.request(Command.GetLongRangeMode, 0, 1, [0x00]))[0] === 0x01;
  }

  async setLongRange(enabled: boolean) {
    await this.request(Command.SetLongRangeMode, 0, 1, [enabled ? 0x01 : 0x00]);
    await sleep(50);
  }

  /** Writes up to 10 bytes, then reads them back to confirm they stuck. */
  private async writeChunk(addr: number, bytes: Uint8Array) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await this.requestRetry(Command.WriteFlash, addr, bytes.length, bytes, 2);
        await sleep(15);
        const back = await this.readFlash(addr, bytes.length);
        if (back.every((b, i) => b === bytes[i])) return;
      } catch (e) {
        if (!(e instanceof TimeoutError)) throw e;
      }
    }
    throw new Error(`flash write rejected at 0x${addr.toString(16).padStart(4, '0')}`);
  }

  /**
   * Brings flash at `addr` in line with `target`, rewriting only the 2-byte
   * aligned regions that differ (to limit flash wear). Returns bytes written.
   */
  async writeFlashDiff(addr: number, target: Uint8Array, current?: Uint8Array): Promise<number> {
    current ??= await this.readFlash(addr, target.length);
    const differs = (from: number, to: number) => {
      for (let k = from; k < Math.min(to, target.length); k++) if (target[k] !== current[k]) return true;
      return false;
    };
    let written = 0;
    for (let start = 0; start < target.length; start += 2) {
      if (!differs(start, start + 2)) continue;
      // Grow the chunk while the next record also differs, up to 10 bytes.
      let end = start + 2;
      while (end - start < MAX_PAYLOAD && differs(end, end + 2)) end += 2;
      end = Math.min(end, target.length);
      await this.writeChunk(addr + start, target.slice(start, end));
      written += end - start;
      start = end - 2;
    }
    return written;
  }

  /**
   * Retries timeouts, which happen when a packet is lost over 2.4 GHz or the
   * mouse has gone to sleep; a heartbeat between attempts wakes the link.
   */
  async requestRetry(cmd: Command, addr = 0, len = 0, payload: ArrayLike<number> = [], attempts = 4) {
    for (let i = 1; ; i++) {
      try {
        return await this.request(cmd, addr, len, payload);
      } catch (e) {
        if (!(e instanceof TimeoutError) || i >= attempts) throw e;
        if (cmd !== Command.PcDriverStatus) await this.hello().catch(() => {});
      }
    }
  }

  async readFlash(addr: number, length: number): Promise<Uint8Array> {
    const out = new Uint8Array(length);
    for (let off = 0; off < length; off += MAX_PAYLOAD) {
      const n = Math.min(MAX_PAYLOAD, length - off);
      const a = addr + off;
      const r = await this.requestRetry(Command.ReadFlash, a, n).catch((e) => {
        throw new Error(`${e.message} at 0x${a.toString(16).padStart(4, '0')}`);
      });
      if (((r[2] << 8) | r[3]) !== a) throw new Error(`address mismatch at 0x${a.toString(16)}`);
      out.set(payloadOf(r).subarray(0, n), off);
    }
    return out;
  }
}
