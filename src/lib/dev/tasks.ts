import { FLASH_SIZE, Mouse } from '../protocol/device';
import { hex } from '../protocol/packet';
import { mouseState } from '../state/mouse.svelte';
import { probe } from './probe';

type Task =
  | { type: 'restore'; backup: string; ranges?: [number, number][] }
  | { type: 'longRange'; enabled: boolean }
  | { type: 'snapshot'; label?: string }
  | { type: 'state' }
  | { type: 'probe' };

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
      case 'probe':
        await probe(mouse, log);
        break;
      case 'snapshot':
        log({ step: 'snapshot', label: task.label ?? '(task)', value: hex(await mouse.readFlash(0, FLASH_SIZE)) });
        break;
    }
  } catch (e) {
    log({ step: task.type, ok: false, error: String(e) });
  }
}
