<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { FLASH_SIZE, Mouse } from './lib/protocol/device';
  import { hex } from './lib/protocol/packet';
  import { probe } from './lib/dev/probe';
  import { runTask } from './lib/dev/tasks';

  let mouse = $state<Mouse | null>(null);
  let lines = $state<string[]>([]);
  const supported = 'hid' in navigator;

  function log(entry: object) {
    const line = JSON.stringify({ t: new Date().toISOString(), ...entry });
    lines.push(line.length > 300 ? line.slice(0, 300) + '…' : line);
    if (import.meta.env.DEV) fetch('/__devlog', { method: 'POST', body: line });
  }

  async function run(m: Mouse) {
    mouse = m;
    await probe(m, log);
    if (import.meta.env.DEV) pollTasks(m);
  }

  async function pollTasks(m: Mouse) {
    while (alive && mouse === m) {
      const res = await fetch('/__task').catch(() => null);
      if (res?.status === 200) {
        busy = true;
        await runTask(m, await res.json(), log);
        busy = false;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  let label = $state('');
  let busy = $state(false);

  async function snapshot() {
    if (!mouse || busy) return;
    busy = true;
    try {
      const flash = await mouse.readFlash(0, FLASH_SIZE);
      log({ step: 'snapshot', label, value: hex(flash) });
      label = '';
    } catch (e) {
      log({ step: 'snapshot', label, error: String(e) });
    } finally {
      busy = false;
    }
  }

  async function connect() {
    const m = await Mouse.request().catch((e) => (log({ step: 'request', error: String(e) }), null));
    if (m) await run(m);
  }

  let alive = true;
  onDestroy(() => (alive = false));

  onMount(async () => {
    if (!supported) return;
    const m = await Mouse.fromGranted();
    if (m) await run(m);
  });
</script>

<main>
  <h1>M600 probe</h1>
  {#if !supported}
    <p>This browser does not support WebHID. Use Edge, Chrome or Brave.</p>
  {:else if !mouse}
    <button onclick={connect}>Connect mouse</button>
  {:else}
    <p>Connected: {mouse.hid.productName} ({mouse.link})</p>
    <form onsubmit={(e) => (e.preventDefault(), snapshot())}>
      <input bind:value={label} placeholder="What did you just change?" size="40" />
      <button disabled={busy}>{busy ? 'Reading…' : 'Snapshot'}</button>
    </form>
  {/if}
  <pre>{lines.join('\n')}</pre>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #111;
    color: #ddd;
    font: 14px/1.5 system-ui, sans-serif;
  }
  main {
    padding: 24px;
  }
  button {
    font: inherit;
    padding: 8px 16px;
    border-radius: 8px;
    border: 0;
    background: #ff4d00;
    color: white;
    cursor: pointer;
  }
  input {
    font: inherit;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #444;
    background: #1c1c1c;
    color: inherit;
  }
  button:disabled {
    opacity: 0.6;
  }
  pre {
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
  }
</style>
