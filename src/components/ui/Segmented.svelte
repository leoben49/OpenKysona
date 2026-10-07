<script lang="ts" generics="T extends string | number">
  let {
    options,
    value,
    onchange,
    label,
  }: { options: { value: T; label: string }[]; value: T; onchange: (v: T) => void; label: string } = $props();

  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--n={options.length} style:--i={index}>
  <span class="thumb" aria-hidden="true"></span>
  {#each options as o (o.value)}
    <button
      role="radio"
      aria-checked={o.value === value}
      class:on={o.value === value}
      onclick={() => o.value !== value && onchange(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border: 1px solid var(--border);
    min-width: 0;
  }
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--n));
    transform: translateX(calc(var(--i) * 100%));
    border-radius: 6px;
    background: var(--surface-3);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    transition: transform 0.25s var(--ease);
  }
  button {
    position: relative;
    height: 30px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--text-2);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transition: color 0.15s;
  }
  button.on {
    color: var(--text);
  }
</style>
