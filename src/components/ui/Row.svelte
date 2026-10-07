<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, hint, children }: { label: string; hint?: string; children: Snippet } = $props();
</script>

<div class="row">
  <div class="text">
    <div class="label">{label}</div>
    {#if hint}<div class="hint">{hint}</div>{/if}
  </div>
  <div class="control">{@render children()}</div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 14px 0;
    border-top: 1px solid var(--border);
  }
  .row:first-child {
    border-top: 0;
    padding-top: 0;
  }
  .row:last-child {
    padding-bottom: 0;
  }
  .text {
    min-width: 0;
  }
  .label {
    font-weight: 500;
  }
  .hint {
    color: var(--text-2);
    font-size: 13px;
    margin-top: 2px;
  }
  .control {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  @media (max-width: 560px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .control {
      justify-content: flex-start;
    }
  }
</style>
