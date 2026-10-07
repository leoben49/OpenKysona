import { FLASH_SIZE, Mouse } from '../protocol/device';
import { hex } from '../protocol/packet';

type Task =
  | { type: 'restore'; backup: string }
  | { type: 'longRange'; enabled: boolean }
  | { type: 'snapshot'; label?: string };

/** Dev-only: runs one-shot tasks queued by the developer via .devlog/task.json. */
export async function runTask(mouse: Mouse, task: Task, log: (entry: object) => void) {
  log({ step: 'task', task });
  try {
    switch (task.type) {
      case 'restore': {
        const res = await fetch(task.backup);
        if (!res.ok) throw new Error(`backup not found: ${task.backup}`);
        const backup = new Uint8Array(await res.arrayBuffer());
        if (backup.length !== FLASH_SIZE) throw new Error(`backup has ${backup.length} bytes`);
        const profile = await mouse.currentProfile();
        const written = await mouse.writeFlashDiff(0, backup);
        await mouse.reload(profile);
        const after = await mouse.readFlash(0, FLASH_SIZE);
        const mismatches = after.reduce((n, b, i) => n + Number(b !== backup[i]), 0);
        log({ step: 'restore', ok: mismatches === 0, written, mismatches, profile });
        break;
      }
      case 'longRange': {
        const before = await mouse.longRange();
        await mouse.setLongRange(task.enabled);
        log({ step: 'longRange', ok: true, before, after: await mouse.longRange() });
        break;
      }
      case 'snapshot':
        log({ step: 'snapshot', label: task.label ?? '(task)', value: hex(await mouse.readFlash(0, FLASH_SIZE)) });
        break;
    }
  } catch (e) {
    log({ step: task.type, ok: false, error: String(e) });
  }
}
