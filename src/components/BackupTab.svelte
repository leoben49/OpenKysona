<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';
  import { hex } from '../lib/protocol/packet';
  import { SETTINGS_LEN } from '../lib/protocol/settings';
  import Card from './ui/Card.svelte';
  import Row from './ui/Row.svelte';

  const m = mouseState;
  let message = $state<{ ok: boolean; text: string } | null>(null);

  function exportBackup() {
    const bytes = m.snapshot();
    if (!bytes) return;
    const data = { format: 'openkysona-backup', version: 1, device: 'Kysona M600 V2', created: new Date().toISOString(), settings: hex(bytes) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `openkysona-m600-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
    message = { ok: true, text: 'Backup downloaded.' };
  }

  /** Accepts our JSON backups and raw flash dumps (.bin). */
  async function parseBackup(file: File): Promise<Uint8Array> {
    if (file.name.endsWith('.bin')) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length < SETTINGS_LEN) throw new Error('File is too small to be a flash dump.');
      return bytes.slice(0, SETTINGS_LEN);
    }
    const data = JSON.parse(await file.text());
    if (data?.format !== 'openkysona-backup' || typeof data.settings !== 'string') throw new Error('Not an OpenKysona backup.');
    const bytes = Uint8Array.from(data.settings.split(' ').map((h: string) => parseInt(h, 16)));
    if (bytes.length !== SETTINGS_LEN || bytes.some(Number.isNaN)) throw new Error('Backup is damaged.');
    return bytes;
  }

  async function importBackup(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      await m.writeRaw(await parseBackup(file));
      message = m.sync === 'error' ? { ok: false, text: m.error ?? 'Restore failed.' } : { ok: true, text: 'Settings restored.' };
    } catch (err) {
      message = { ok: false, text: err instanceof Error ? err.message : String(err) };
    }
  }

  const pid = $derived(m.mouse?.hid.productId.toString(16).toUpperCase().padStart(4, '0'));
</script>

<div class="stack">
  <Card title="Backup & restore" subtitle="Save your settings to a file, or load them back onto the mouse.">
    <div class="buttons">
      <button class="btn primary" onclick={exportBackup}>Download backup</button>
      <label class="btn">
        Restore from file…
        <input type="file" accept=".json,.bin" onchange={importBackup} hidden />
      </label>
    </div>
    {#if message}<p class="msg" class:bad={!message.ok}>{message.text}</p>{/if}
  </Card>

  <Card title="Device">
    <Row label="Connection"><span class="muted">{m.mouse?.link === 'wired' ? 'USB cable' : '2.4 GHz receiver'} · 3554:{pid}</span></Row>
    <Row label="Battery">
      <span class="muted">
        {#if m.battery}{m.battery.level}% · {(m.battery.millivolts / 1000).toFixed(2)} V{m.battery.charging ? ' · charging' : ''}{:else}—{/if}
      </span>
    </Row>
    <Row label="Privacy"><span class="muted">Runs entirely in your browser. No network requests.</span></Row>
  </Card>
</div>

<style>
  .stack {
    display: grid;
    gap: 16px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .msg {
    margin: 14px 0 0;
    color: var(--good);
    font-size: 13px;
  }
  .msg.bad {
    color: var(--bad);
  }
</style>
