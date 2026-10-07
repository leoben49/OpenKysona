<script lang="ts">
  import { mouseState } from '../state/mouse.svelte';
  import { FLASH_SIZE } from '../protocol/device';
  import { hex } from '../protocol/packet';
  import { devlog } from './devtools';

  let label = $state('');
  let busy = $state(false);
  let last = $state('');

  async function snapshot(e: SubmitEvent) {
    e.preventDefault();
    const mouse = mouseState.mouse;
    if (!mouse || busy) return;
    busy = true;
    try {
      devlog({ step: 'snapshot', label, value: hex(await mouse.readFlash(0, FLASH_SIZE)) });
      last = `Saved “${label}”`;
      label = '';
      await mouseState.refreshSettings();
    } catch (err) {
      last = String(err);
    } finally {
      busy = false;
    }
  }
</script>

<form class="dev" onsubmit={snapshot}>
  <span class="tag">DEV</span>
  <input bind:value={label} placeholder="What did you just change?" />
  <button class="btn" disabled={busy || !mouseState.mouse}>{busy ? 'Reading…' : 'Snapshot'}</button>
  {#if last}<span class="last">{last}</span>{/if}
</form>

<style>
  .dev {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px dashed var(--accent);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.4);
    z-index: 10;
  }
  .tag {
    font: 600 11px var(--mono);
    color: var(--accent);
    padding: 0 6px;
  }
  input {
    width: 260px;
    height: 36px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: var(--surface-2);
  }
  .last {
    font-size: 12px;
    color: var(--text-2);
    padding-right: 6px;
  }
</style>
