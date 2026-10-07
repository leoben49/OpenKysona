<script lang="ts">
  import { onMount } from 'svelte';
  import { mouseState } from './lib/state/mouse.svelte';
  import Header from './components/Header.svelte';
  import ConnectScreen from './components/ConnectScreen.svelte';
  import PerformanceTab from './components/PerformanceTab.svelte';
  import SensorTab from './components/SensorTab.svelte';
  import ButtonsTab from './components/ButtonsTab.svelte';
  import BackupTab from './components/BackupTab.svelte';

  const m = mouseState;
  const TABS = [
    { id: 'performance', label: 'Performance', component: PerformanceTab },
    { id: 'sensor', label: 'Sensor', component: SensorTab },
    { id: 'buttons', label: 'Buttons', component: ButtonsTab },
    { id: 'backup', label: 'Backup', component: BackupTab },
  ] as const;
  type TabId = (typeof TABS)[number]['id'];

  const TAB_KEY = 'openkysona.tab';
  let tab = $state<TabId>('performance');
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.id === saved)) tab = saved as TabId;
  } catch {}

  function select(id: TabId) {
    tab = id;
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {}
  }

  const Current = $derived(TABS.find((t) => t.id === tab)!.component);

  onMount(() => {
    void m.restore();
    if (import.meta.env.DEV) void import('./lib/dev/devtools').then((d) => d.start());
  });
</script>

<div class="shell">
  <Header />

  {#if !m.mouse}
    <ConnectScreen />
  {:else if !m.settings}
    <p class="loading muted">Reading settings…</p>
  {:else}
    <div class="tabs" role="tablist" aria-label="Sections">
      {#each TABS as t (t.id)}
        <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => select(t.id)}>{t.label}</button>
      {/each}
    </div>
    {#if m.error && m.sync === 'error'}
      <div class="banner" role="alert">Couldn’t save to the mouse: {m.error}. Settings were re-read from the device.</div>
    {/if}
    <main>
      <Current />
    </main>
  {/if}
</div>

<style>
  .shell {
    max-width: 880px;
    margin: 0 auto;
    padding: 0 24px 64px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin: 8px 0 20px;
    box-shadow: inset 0 -1px var(--border);
  }
  .tabs button {
    position: relative;
    height: 40px;
    padding: 0 14px;
    border: 0;
    background: none;
    color: var(--text-2);
    font-weight: 500;
    white-space: nowrap;
    transition: color 0.15s;
  }
  .tabs button:hover,
  .tabs button.on {
    color: var(--text);
  }
  .tabs button.on::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 0;
    height: 2px;
    border-radius: 1px;
    background: var(--accent);
  }
  .loading {
    text-align: center;
    margin-top: 20vh;
  }
  .banner {
    margin-bottom: 16px;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    background: rgb(255 69 58 / 0.1);
    border: 1px solid rgb(255 69 58 / 0.3);
    color: var(--bad);
    font-size: 13px;
  }
  @media (max-width: 560px) {
    .shell {
      padding: 0 16px 48px;
    }
  }
</style>
