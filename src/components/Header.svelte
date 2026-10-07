<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';
  import BatteryBadge from './BatteryBadge.svelte';

  const m = mouseState;
  const linkLabel = $derived(m.mouse?.link === 'wired' ? 'Wired' : '2.4 GHz');
</script>

<header>
  <div class="brand">
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="7" fill="none" stroke="var(--accent)" stroke-width="2" />
      <path d="M12 2v7" stroke="var(--accent)" stroke-width="2" />
    </svg>
    <span>Open<b>Kysona</b></span>
  </div>

  {#if m.mouse}
    <div class="status">
      <span class="sync {m.sync}" aria-live="polite">
        {#if m.sync === 'saving'}Saving…{:else if m.sync === 'saved'}Saved{:else if m.sync === 'error'}Not saved{/if}
      </span>
      <span class="link"><i></i>{linkLabel}</span>
      <BatteryBadge battery={m.battery} />
    </div>
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 64px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 650;
    font-size: 16px;
    letter-spacing: -0.01em;
  }
  .brand b {
    font-weight: inherit;
    color: var(--accent);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-2);
    font-weight: 500;
  }
  .link i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 0 3px rgb(52 199 89 / 0.18);
  }
  .sync {
    font-size: 13px;
    color: var(--text-3);
    transition: opacity 0.3s;
  }
  .sync.saved {
    animation: fade 2.5s forwards;
  }
  .sync.error {
    color: var(--bad);
  }
  @keyframes fade {
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  @media (max-width: 560px) {
    .brand span,
    .sync {
      display: none;
    }
  }
</style>
