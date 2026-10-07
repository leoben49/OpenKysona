import { FLASH_SIZE, Mouse } from '../protocol/device';
import { Command, hex } from '../protocol/packet';
import { decodeMacro, encodeMacro, MACRO_SLOT_SIZE, macroAddress, stepForKey, usedLength, type Macro } from '../protocol/macro';
import { mouseState } from '../state/mouse.svelte';
import { probe } from './probe';

type Task =
  | { type: 'restore'; backup: string; ranges?: [number, number][] }
  | { type: 'longRange'; enabled: boolean }
  | { type: 'snapshot'; label?: string }
  | { type: 'state' }
  | { type: 'probe' }
  | { type: 'read'; addr: number; len: number }
  | { type: 'write'; addr: number; hex: string }
  | { type: 'reload' }
  | { type: 'macroSlotTest'; slot: number; full: boolean };

/** Dev-only: runs one-shot tasks queued by the developer via .devlog/task.json. */
export async function runTask(mouse: Mouse, task: Task, log: (entry: object) => void) {
  log({ step: 'task', task });
  try {
    switch (task.type) {
      case 'restore': {
        const res = await fetch(task.backup);
        if (!res.ok) throw new Error(`backup not found: ${task.backup}`);
        let target: Uint8Array = new Uint8Array(await res.arrayBuffer());
        if (target.length !== FLASH_SIZE) throw new Error(`backup has ${target.length} bytes`);
        if (task.ranges) {
          // Only take the listed [from, to) byte ranges from the backup.
          const merged = await mouse.readFlash(0, FLASH_SIZE);
          for (const [from, to] of task.ranges) merged.set(target.subarray(from, to), from);
          target = merged;
        }
        const profile = await mouse.currentProfile();
        const written = await mouse.writeFlashDiff(0, target);
        await mouse.reload(profile);
        const after = await mouse.readFlash(0, FLASH_SIZE);
        const mismatches = after.reduce((n, b, i) => n + Number(b !== target[i]), 0);
        log({ step: 'restore', ok: mismatches === 0, written, mismatches, profile });
        await mouseState.refreshSettings();
        break;
      }
      case 'longRange': {
        const before = await mouse.longRange();
        await mouse.setLongRange(task.enabled);
        log({ step: 'longRange', ok: true, before, after: await mouse.longRange() });
        break;
      }
      case 'state':
        log({ step: 'state', ok: true, settings: mouseState.settings, battery: mouseState.battery, sync: mouseState.sync, error: mouseState.error });
        break;
      case 'read': {
        const hang = (ms: number) => new Promise((_, rej) => setTimeout(() => rej(new Error(`hung > ${ms}ms`)), ms));
        log({ step: 'read', phase: 'single request' });
        const one = await Promise.race([mouse.request(Command.ReadFlash, task.addr, 10), hang(3000)]);
        log({ step: 'read', phase: 'single ok', value: hex(one as Uint8Array) });
        log({ step: 'read', ok: true, addr: task.addr, value: hex(await mouse.readFlash(task.addr, task.len)) });
        break;
      }
      case 'write': {
        // Single raw write, then read back at increasing delays to see when (if) it sticks.
        const bytes = task.hex.split(' ').map((h) => parseInt(h, 16));
        const ack = await mouse.request(Command.WriteFlash, task.addr, bytes.length, bytes);
        const reads: Record<string, string> = {};
        let waited = 0;
        for (const ms of [0, 15, 100, 500]) {
          await new Promise((r) => setTimeout(r, ms - waited));
          waited = ms;
          reads[`${ms}ms`] = hex(await mouse.readFlash(task.addr, bytes.length));
        }
        log({ step: 'write', ok: true, addr: task.addr, wrote: task.hex, ack: hex(ack), reads });
        break;
      }
      case 'reload': {
        const profile = await mouse.currentProfile();
        await mouse.reload(profile);
        log({ step: 'reload', ok: true, profile });
        break;
      }
      case 'macroSlotTest': {
        // Writes a valid "probe" macro (types "a") into a slot, sequentially in 10-byte
        // chunks from the slot start, without per-chunk verification; then reads it back.
        const addr = macroAddress(task.slot);
        const macro: Macro = { name: 'probe', steps: [stepForKey(0x04, true, 20), stepForKey(0x04, false, 0)] };
        const bytes = encodeMacro(macro);
        const len = task.full ? MACRO_SLOT_SIZE : usedLength(macro);
        const acks: string[] = [];
        for (let off = 0; off < len; off += 10) {
          const chunk = bytes.subarray(off, Math.min(len, off + 10));
          const ack = await mouse.request(Command.WriteFlash, addr + off, chunk.length, chunk);
          if (off === 0 || off + 10 >= len) acks.push(hex(ack));
        }
        await new Promise((r) => setTimeout(r, 100));
        const back = await mouse.readFlash(addr, 48);
        log({ step: 'macroSlotTest', ok: true, full: task.full, len, acks, back: hex(back), decoded: decodeMacro(await mouse.readFlash(addr, MACRO_SLOT_SIZE)) });
        break;
      }
      case 'probe':
        await probe(mouse, log);
        break;
      case 'snapshot':
        log({ step: 'snapshot', label: task.label ?? '(task)', value: hex(await mouse.readFlash(0, FLASH_SIZE)) });
        break;
      default:
        log({ step: 'task', ok: false, error: `unknown task type (stale page code?)` });
    }
  } catch (e) {
    log({ step: task.type, ok: false, error: String(e) });
  }
}
