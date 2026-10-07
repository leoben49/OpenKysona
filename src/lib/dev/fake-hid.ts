import { checksum, Command, PACKET_LEN, REPORT_ID } from '../protocol/packet';
import { FLASH_SIZE } from '../protocol/device';
import { M600_SETTINGS } from '../protocol/fixtures';

/**
 * Dev only: an in-memory HIDDevice that speaks the mouse protocol, so the UI
 * can be exercised without hardware (open the dev server with ?fake).
 */
export async function createFakeHid(): Promise<HIDDevice> {
  const flash = new Uint8Array(FLASH_SIZE).fill(0xff);
  flash.set(M600_SETTINGS);

  const target = new EventTarget();
  const reply = (p: Uint8Array) => {
    p[15] = checksum(p);
    const e = new Event('inputreport') as HIDInputReportEvent;
    Object.assign(e, { reportId: REPORT_ID, data: new DataView(p.buffer) });
    setTimeout(() => target.dispatchEvent(e), 2);
  };

  const device = {
    opened: true,
    vendorId: 0x3554,
    productId: 0xf5d5,
    productName: 'Simulated M600 V2',
    collections: [{ usagePage: 0xff02, usage: 2 }],
    open: async () => {},
    close: async () => {},
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    async sendReport(_id: number, data: BufferSource) {
      const req = new Uint8Array(data as ArrayBuffer);
      const p = new Uint8Array(PACKET_LEN);
      p.set(req.subarray(0, 5));
      const addr = (req[2] << 8) | req[3];
      const len = Math.min(10, req[4]);
      switch (req[0]) {
        case Command.ReadFlash:
          p.set(flash.subarray(addr, addr + len), 5);
          break;
        case Command.WriteFlash:
          flash.set(req.subarray(5, 5 + len), addr);
          break;
        case Command.BatteryLevel:
          p.set([72, 0, 0x0f, 0x80], 5);
          break;
        case Command.DeviceOnline:
        case Command.PcDriverStatus:
          p[5] = 1;
          break;
      }
      reply(p);
    },
  };
  return device as unknown as HIDDevice;
}
