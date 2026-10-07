<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, subtitle, actions, children }: { title?: string; subtitle?: string; actions?: Snippet; children: Snippet } =
    $props();
</script>

<section class="card">
  {#if title}
    <header>
      <div>
        <h2>{title}</h2>
        {#if subtitle}<p>{subtitle}</p>{/if}
      </div>
      {@render actions?.()}
    </header>
  {/if}
  {@render children()}
</section>

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  p {
    margin: 2px 0 0;
    color: var(--text-2);
    font-size: 13px;
  }
</style>
