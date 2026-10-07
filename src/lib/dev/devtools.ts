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
  // Live reload can start a second runner; only the newest one keeps going.
  const w = window as unknown as { __devGen?: number };
  const gen = (w.__devGen = (w.__devGen ?? 0) + 1);
  let lastState = '';
  const tick = async () => {
    if (w.__devGen !== gen) return;
    const mouse = mouseState.mouse;
    const state = JSON.stringify({ connected: !!mouse, hasSettings: !!mouseState.settings, sync: mouseState.sync, error: mouseState.error });
    if (state !== lastState) devlog({ step: 'connection', ...JSON.parse((lastState = state)) });
    if (mouse) {
      const res = await fetch('/__task').catch(() => null);
      if (res?.status === 200) {
        const task = await res.json();
        devlog({ step: 'taskReceived', task });
        await runTask(mouse, task, devlog);
      }
    }
    setTimeout(tick, 1000);
  };
  // Trace every packet so stalls are visible.
  const hid = () => mouseState.mouse?.hid;
  let traced: HIDDevice | undefined;
  const timer = setInterval(() => {
    if (w.__devGen !== gen) return clearInterval(timer);
    const d = hid() as (HIDDevice & { __traced?: boolean }) | undefined;
    if (!d || d === traced || d.__traced) return;
    d.__traced = true;
    traced = d;
    const send = d.sendReport.bind(d);
    d.sendReport = async (id, data) => {
      devlog({ step: 'tx', data: Array.from(new Uint8Array(data as ArrayBuffer).slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join(' ') });
      try {
        return await send(id, data);
      } catch (e) {
        devlog({ step: 'txError', error: String(e) });
        throw e;
      }
    };
    d.addEventListener('inputreport', (e) =>
      devlog({ step: 'rx', id: e.reportId, data: Array.from(new Uint8Array(e.data.buffer).slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join(' ') }),
    );
  }, 500);
  void tick();
}
