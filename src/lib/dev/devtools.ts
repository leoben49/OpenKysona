import { mouseState } from '../state/mouse.svelte';
import { runTask } from './tasks';

/** Dev server only: posts a JSON line to .devlog/log.jsonl. */
export function devlog(entry: object) {
  void fetch('/__devlog', { method: 'POST', body: JSON.stringify({ t: new Date().toISOString(), ...entry }) }).catch(() => {});
}

/** Dev server only: runs tasks dropped into .devlog/task.json against the connected mouse. */
export function start() {
  devlog({ step: 'devtools', ok: true });
  const tick = async () => {
    const mouse = mouseState.mouse;
    if (mouse) {
      const res = await fetch('/__task').catch(() => null);
      if (res?.status === 200) await runTask(mouse, await res.json(), devlog);
    }
    setTimeout(tick, 1000);
  };
  void tick();
}
