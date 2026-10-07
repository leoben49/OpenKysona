<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';
  import { clampDpi, DPI_MAX, DPI_MIN, MAX_STAGES, POLLING_RATES, type PollingRate } from '../lib/protocol/settings';
  import Card from './ui/Card.svelte';
  import Segmented from './ui/Segmented.svelte';

  const m = mouseState;
  const s = $derived(m.settings!);

  // Edits the active stage by default; follows the mouse when its DPI button is pressed.
  let selected = $state<number | null>(null);
  const editing = $derived(Math.min(selected ?? s.activeStage, s.stageCount - 1));
  const stage = $derived(s.dpiStages[editing]);

  // Log-scaled slider so low DPI values get fine control.
  const SLIDER_MAX = 1000;
  const toSlider = (dpi: number) => Math.round((Math.log(dpi / DPI_MIN) / Math.log(DPI_MAX / DPI_MIN)) * SLIDER_MAX);
  const fromSlider = (v: number) => clampDpi(DPI_MIN * (DPI_MAX / DPI_MIN) ** (v / SLIDER_MAX));

  function choose(i: number) {
    selected = i;
    if (i !== s.activeStage) m.update((x) => (x.activeStage = i));
  }

  function setDpi(dpi: number) {
    m.update((x) => (x.dpiStages[editing].dpi = clampDpi(dpi)));
  }

  /** Stage colours used by the vendor app, reused for newly added stages. */
  const DEFAULT_COLORS = ['#ff8000', '#ff0000', '#00ff00', '#0000ff', '#00ffff', '#ff00ff', '#ffffff', '#ff557d'];

  function addStage() {
    m.update((x) => {
      const i = x.stageCount;
      x.dpiStages[i] = { dpi: clampDpi(Math.min(DPI_MAX, x.dpiStages[i - 1].dpi * 2)), color: DEFAULT_COLORS[i] };
      x.stageCount++;
    });
    selected = s.stageCount - 1;
    undo = null;
  }

  // Removing a stage can be undone for a few seconds.
  type Saved = { stages: typeof s.dpiStages; count: number; active: number; index: number };
  let undo = $state<Saved | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  function removeStage() {
    const i = editing;
    undo = { stages: $state.snapshot(s.dpiStages), count: s.stageCount, active: s.activeStage, index: i };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undo = null), 8000);
    m.update((x) => {
      // Shift later stages down and park the removed one at the end.
      const [removed] = x.dpiStages.splice(i, 1);
      x.dpiStages.push(removed);
      x.stageCount--;
      if (x.activeStage >= x.stageCount || x.activeStage > i) x.activeStage = Math.max(0, x.activeStage - 1);
    });
    selected = Math.min(i, s.stageCount - 1);
  }

  function undoRemove() {
    if (!undo) return;
    const u = undo;
    m.update((x) => {
      x.dpiStages = structuredClone(u.stages);
      x.stageCount = u.count;
      x.activeStage = u.active;
    });
    selected = u.index;
    undo = null;
  }

  const sorted = $derived(s.dpiStages.slice(0, s.stageCount).every((st, i, a) => i === 0 || a[i - 1].dpi <= st.dpi));

  function sortStages() {
    m.update((x) => {
      const stages = $state.snapshot(x.dpiStages);
      const order = stages
        .slice(0, x.stageCount)
        .map((_, i) => i)
        .sort((a, b) => stages[a].dpi - stages[b].dpi);
      x.activeStage = order.indexOf(x.activeStage);
      x.dpiStages = [...order.map((i) => stages[i]), ...stages.slice(x.stageCount)];
    });
    selected = null;
    undo = null;
  }

  const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<div class="stack">
  <Card title="DPI stages" subtitle="The DPI button on your mouse cycles through these, in this order. Click a stage to switch to it.">
    {#snippet actions()}
      <button class="btn" onclick={sortStages} disabled={sorted} title="Order stages from lowest to highest DPI">Sort</button>
    {/snippet}
    <div class="stages" style:--n={Math.min(MAX_STAGES, s.stageCount + (s.stageCount < MAX_STAGES ? 1 : 0))}>
      {#each s.dpiStages.slice(0, s.stageCount) as st, i (i)}
        <button class="stage" class:active={i === s.activeStage} class:editing={i === editing} onclick={() => choose(i)}>
          <span class="bar" style:background={st.color}></span>
          <span class="idx">{i + 1}</span>
          <span class="dpi">{fmt(st.dpi)}</span>
          {#if i === s.activeStage}<span class="tag">Active</span>{/if}
        </button>
      {/each}
      {#if s.stageCount < MAX_STAGES}
        <button class="stage add" onclick={addStage} aria-label="Add DPI stage">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      {/if}
    </div>

    <div class="editor">
      <div class="editor-head">
        <span class="muted">Stage {editing + 1}</span>
        <div class="value">
          <input
            type="number"
            min={DPI_MIN}
            max={DPI_MAX}
            step="50"
            value={stage.dpi}
            onchange={(e) => setDpi(+e.currentTarget.value)}
            aria-label="DPI value" />
          <span class="unit">DPI</span>
        </div>
        <label class="swatch" style:background={stage.color} title="Stage colour">
          <input
            type="color"
            value={stage.color}
            oninput={(e) => m.update((x) => (x.dpiStages[editing].color = e.currentTarget.value))}
            aria-label="Stage colour" />
        </label>
        <button class="btn ghost" onclick={removeStage} disabled={s.stageCount <= 1}>Remove</button>
      </div>
      <input
        type="range"
        min="0"
        max={SLIDER_MAX}
        value={toSlider(stage.dpi)}
        style:--fill="{(toSlider(stage.dpi) / SLIDER_MAX) * 100}%"
        oninput={(e) => setDpi(fromSlider(+e.currentTarget.value))}
        aria-label="DPI slider" />
      <div class="scale muted"><span>{fmt(DPI_MIN)}</span><span>{fmt(DPI_MAX)}</span></div>
    </div>

    {#if undo}
      <div class="undo" role="status">
        <span>Stage {undo.index + 1} ({fmt(undo.stages[undo.index].dpi)} DPI) removed</span>
        <button class="btn" onclick={undoRemove}>Undo</button>
      </div>
    {/if}
  </Card>

  <Card title="Polling rate" subtitle="How often the mouse reports its position. Higher is smoother but uses more battery.">
    <Segmented
      label="Polling rate"
      options={POLLING_RATES.map((hz) => ({ value: hz, label: `${hz} Hz` }))}
      value={s.pollingRate}
      onchange={(hz: PollingRate) => m.update((x) => (x.pollingRate = hz))} />
  </Card>
</div>

<style>
  .stack {
    display: grid;
    gap: 16px;
  }
  .stages {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 8px;
  }
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: 84px;
    padding: 14px 12px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    text-align: left;
    overflow: hidden;
    transition: border-color 0.15s, background 0.15s, transform 0.15s var(--ease);
  }
  .stage:hover {
    background: var(--surface-3);
  }
  .stage:active {
    transform: scale(0.98);
  }
  .stage.editing {
    border-color: var(--border-strong);
    background: var(--surface-3);
  }
  .stage.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .bar {
    position: absolute;
    inset: 0 0 auto;
    height: 3px;
  }
  .idx {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 500;
  }
  .dpi {
    font-size: 18px;
    font-weight: 650;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .tag {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
  }
  .stage.add {
    align-items: center;
    justify-content: center;
    border-style: dashed;
    background: none;
    color: var(--text-3);
  }
  .stage.add:hover {
    color: var(--text);
  }
  .editor {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }
  .editor-head {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }
  .value {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-right: auto;
  }
  .value input {
    width: 7ch;
    padding: 2px 6px;
    margin-left: -6px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    font-size: 28px;
    font-weight: 650;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .value input::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }
  .value input:hover,
  .value input:focus {
    border-color: var(--border-strong);
    background: var(--surface-2);
    outline: none;
  }
  .unit {
    color: var(--text-3);
    font-weight: 500;
  }
  .swatch {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border-strong), 0 0 0 4px var(--surface);
    cursor: pointer;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .btn.ghost {
    background: none;
    border-color: transparent;
    color: var(--text-2);
    padding: 0 10px;
  }
  .btn.ghost:hover:not(:disabled) {
    color: var(--bad);
    background: var(--surface-2);
  }
  .undo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
    padding: 8px 8px 8px 14px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-size: 13px;
    animation: rise 0.2s var(--ease);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .scale {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-top: 4px;
  }
  @media (max-width: 720px) {
    .stages {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
