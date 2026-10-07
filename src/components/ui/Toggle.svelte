<script lang="ts">
  let { checked, onchange, label }: { checked: boolean; onchange: (v: boolean) => void; label: string } = $props();
</script>

<button role="switch" aria-checked={checked} aria-label={label} class:on={checked} onclick={() => onchange(!checked)}>
  <span></span>
</button>

<style>
  button {
    flex: none;
    width: 40px;
    height: 24px;
    padding: 2px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-3);
    transition: background 0.2s var(--ease);
  }
  button.on {
    background: var(--accent);
  }
  span {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    transition: transform 0.2s var(--ease);
  }
  .on span {
    transform: translateX(16px);
  }
</style>
