import { Mouse } from '../protocol/device';
import { Command, hex } from '../protocol/packet';
import { percentFromMillivolts } from '../protocol/battery';

/** Read-only diagnostics used while reverse engineering. Never writes to the mouse. */
export async function probe(mouse: Mouse, log: (entry: object) => void) {
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      const value = await fn();
      log({ step: name, ok: true, value: value instanceof Uint8Array ? hex(value) : value });
    } catch (e) {
      log({ step: name, ok: false, error: String(e) });
    }
  };

  log({ step: 'device', value: { product: mouse.hid.productName, pid: mouse.hid.productId.toString(16), link: mouse.link } });
  await step('hello', () => mouse.hello());
  await step('online', () => mouse.online());
  await step('battery', async () => {
    const b = await mouse.battery();
    return { ...b, curvePercent: percentFromMillivolts(b.millivolts) };
  });
  await step('version', () => mouse.request(Command.ReadVersion, 0, 1, [0x01]));
  await step('cidmid', () => mouse.request(Command.ReadCidMid, 0, 1, [0x01]));
  await step('profile', () => mouse.request(Command.GetCurrentConfig));
  await step('longRange', () => mouse.longRange());
  log({ step: 'done' });
}
