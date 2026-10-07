import { mouseState } from '../state/mouse.svelte';
import { runTask } from './tasks';

const fake = new URLSearchParams(location.search).has('fake');

/** Dev server only: posts a JSON line to .devlog/log.jsonl. */
export function devlog(entry: object) {
  const line = { t: new Date().toISOString(), ...(fake ? { fake } : {}), ...entry };
  void fetch('/__devlog', { method: 'POST', body: JSON.stringify(line) }).catch(() => {});
}

/** Dev server only: runs tasks dropped into .devlog/task.json against the connected mouse. */
export function start() {
  devlog({ step: 'devtools', ok: true });
  window.addEventListener('error', (e) => devlog({ step: 'pageError', error: String(e.error?.stack ?? e.message) }));
  window.addEventListener('unhandledrejection', (e) => devlog({ step: 'pageError', error: String(e.reason?.stack ?? e.reason) }));
  if (fake) return; // tasks are meant for the real mouse
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
