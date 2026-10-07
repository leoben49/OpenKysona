<script lang="ts">
  import type { Battery } from '../lib/protocol/battery';

  let { battery }: { battery: Battery | null } = $props();

  const level = $derived(battery ? Math.max(0, Math.min(100, battery.level)) : 0);
  const tone = $derived(!battery ? 'unknown' : battery.charging ? 'charging' : level <= 15 ? 'low' : level <= 30 ? 'mid' : 'ok');
  const title = $derived(
    battery ? `${level}%${battery.charging ? ', charging' : ''} · ${(battery.millivolts / 1000).toFixed(2)} V` : 'Battery unknown',
  );
</script>

<div class="badge {tone}" {title} aria-label={title}>
  <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
    <rect x="0.75" y="0.75" width="21.5" height="12.5" rx="3.5" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5" />
    <rect x="23.5" y="4.5" width="2" height="5" rx="1" fill="currentColor" fill-opacity="0.45" />
    <rect class="fill" x="3" y="3" height="8" rx="1.5" width={(17 * level) / 100} />
    {#if battery?.charging}
      <path d="M12.6 1.8 8.4 7.6h3l-1 4.6 4.2-5.8h-3z" fill="var(--text)" stroke="var(--surface)" stroke-width="0.8" />
    {/if}
  </svg>
  <span>{battery ? `${level}%` : '—'}</span>
</div>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }
  .fill {
    fill: var(--good);
    transition: width 0.4s var(--ease);
  }
  .mid .fill {
    fill: var(--warn);
  }
  .low .fill {
    fill: var(--bad);
  }
  .low span {
    color: var(--bad);
  }
  .charging .fill {
    fill: var(--good);
  }
</style>
