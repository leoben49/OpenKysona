<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { mouseState } from '../lib/state/mouse.svelte';
  import { MACRO_MAX_STEPS, MACRO_NAME_MAX, REPEAT, stepForKey, type Macro, type MacroStep } from '../lib/protocol/macro';
  import { keyLabel, MOUSE_BUTTON_LABELS, MOUSE_MASK_FOR_BUTTON, usageForCode } from '../lib/protocol/hid-keys';
  import Card from './ui/Card.svelte';
  import Toggle from './ui/Toggle.svelte';

  let {
    button,
    buttonName,
    initial,
    initialRepeat,
    onclose,
  }: { button: number; buttonName: string; initial: Macro | null; initialRepeat: number; onclose: () => void } = $props();

  // The editor is re-created per button, so props only seed the draft.
  const seed = untrack(() => ({ macro: initial, name: buttonName, repeat: initialRepeat }));

  let name = $state(seed.macro?.name ?? `${seed.name} macro`);
  let steps = $state<MacroStep[]>(structuredClone(seed.macro?.steps ?? []));
  let recording = $state(false);
  let useRecordedDelays = $state(true);
  let fixedDelay = $state(20);
  let saving = $state(false);
  let error = $state<string | null>(null);

  type RepeatKind = 'times' | 'whileHeld' | 'untilAnyKey' | 'toggle';
  const REPEAT_KINDS: Record<number, RepeatKind> = { [REPEAT.whileHeld]: 'whileHeld', [REPEAT.untilAnyKey]: 'untilAnyKey', [REPEAT.toggle]: 'toggle' };
  let repeatKind = $state<RepeatKind>(REPEAT_KINDS[seed.repeat] ?? 'times');
  let times = $state(seed.repeat >= 1 && seed.repeat <= 250 ? seed.repeat : 1);
  const repeatValue = $derived(repeatKind === 'times' ? Math.max(1, Math.min(250, times)) : REPEAT[repeatKind]);

  // ---- recording ---------------------------------------------------------------

  let lastEvent = 0;
  const held = new Set<string>();

  function push(step: Omit<MacroStep, 'delayMs'>) {
    if (steps.length >= MACRO_MAX_STEPS) return stop();
    const now = performance.now();
    if (steps.length) steps[steps.length - 1].delayMs = useRecordedDelays ? Math.min(65535, Math.round(now - lastEvent)) : fixedDelay;
    lastEvent = now;
    steps.push({ ...step, delayMs: useRecordedDelays ? 0 : fixedDelay });
  }

  function onKey(e: KeyboardEvent) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    const usage = usageForCode(e.code);
    if (usage === undefined) return;
    const down = e.type === 'keydown';
    if (down ? held.has(e.code) : !held.has(e.code)) return;
    down ? held.add(e.code) : held.delete(e.code);
    push(stepForKey(usage, down));
  }

  function onPad(e: MouseEvent) {
    if (!recording) return;
    e.preventDefault();
    const code = MOUSE_MASK_FOR_BUTTON[e.button];
    if (code) push({ kind: 'mouse', code, down: e.type === 'mousedown' });
  }

  function start() {
    held.clear();
    lastEvent = performance.now();
    recording = true;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
  }

  function stop() {
    recording = false;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    if (steps.length && useRecordedDelays) steps[steps.length - 1].delayMs = 0;
  }

  onDestroy(stop);

  // ---- editing -----------------------------------------------------------------

  function addClick(code: number) {
    steps.push({ kind: 'mouse', code, down: true, delayMs: 20 }, { kind: 'mouse', code, down: false, delayMs: 20 });
  }

  function applyFixedDelay() {
    for (const s of steps) s.delayMs = fixedDelay;
  }

  function label(s: MacroStep): string {
    if (s.kind === 'mouse') return MOUSE_BUTTON_LABELS[s.code] ?? `Mouse ${s.code}`;
    if (s.kind === 'modifier') return keyLabel(0xe0 + Math.log2(s.code));
    return keyLabel(s.code);
  }

  /** Keys pressed but never released would stay stuck down on the computer. */
  const unbalanced = $derived.by(() => {
    const down = new Map<string, number>();
    for (const s of steps) {
      const k = `${s.kind}:${s.code}`;
      down.set(k, (down.get(k) ?? 0) + (s.down ? 1 : -1));
    }
    return [...down.values()].some((n) => n !== 0);
  });

  const totalMs = $derived(steps.reduce((a, s) => a + s.delayMs, 0));

  async function save() {
    stop();
    error = null;
    saving = true;
    try {
      await mouseState.saveMacro(button, { name: name.trim() || 'Macro', steps: $state.snapshot(steps) }, repeatValue);
      onclose();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }
</script>

<Card title="Macro for {buttonName}" subtitle="Stored on the mouse. Plays back on any computer, no software needed.">
  {#snippet actions()}
    <button class="btn ghost" onclick={onclose}>Cancel</button>
  {/snippet}

  <div class="top">
    <label class="field grow">
      <span>Name</span>
      <input bind:value={name} maxlength={MACRO_NAME_MAX} />
    </label>
    <label class="field">
      <span>Playback</span>
      <select bind:value={repeatKind}>
        <option value="times">Run</option>
        <option value="whileHeld">Repeat while held</option>
        <option value="toggle">Repeat until pressed again</option>
        <option value="untilAnyKey">Repeat until any key</option>
      </select>
    </label>
    {#if repeatKind === 'times'}
      <label class="field times">
        <span>Times</span>
        <input type="number" min="1" max="250" bind:value={times} />
      </label>
    {/if}
  </div>

  <div class="recorder" class:live={recording}>
    <div class="rec-controls">
      {#if recording}
        <button class="btn primary" onclick={stop}><span class="dot"></span>Stop recording</button>
        <span class="muted">Press keys anywhere, or click in the box below.</span>
      {:else}
        <button class="btn primary" onclick={start} disabled={steps.length >= MACRO_MAX_STEPS}><span class="dot idle"></span>Record</button>
        <button class="btn" onclick={() => (steps = [])} disabled={!steps.length}>Clear</button>
        <div class="spacer"></div>
        <span class="muted small">Recorded timing</span>
        <Toggle label="Use recorded timing" checked={useRecordedDelays} onchange={(v) => (useRecordedDelays = v)} />
      {/if}
    </div>
    {#if recording}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="pad" onmousedown={onPad} onmouseup={onPad} oncontextmenu={(e) => e.preventDefault()}>
        Click here with any mouse button to record clicks
      </div>
    {/if}
  </div>

  {#if steps.length}
    <ol class="steps">
      {#each steps as s, i (i)}
        <li>
          <span class="arrow" class:up={!s.down} title={s.down ? 'Press' : 'Release'}>{s.down ? '↓' : '↑'}</span>
          <span class="key">{label(s)}</span>
          <span class="muted small">{s.down ? 'press' : 'release'}</span>
          <span class="spacer"></span>
          <label class="delay" title="Wait after this step">
            <input type="number" min="0" max="65535" bind:value={s.delayMs} />
            <span class="muted">ms</span>
          </label>
          <button class="x" aria-label="Remove step" onclick={() => steps.splice(i, 1)}>×</button>
        </li>
      {/each}
    </ol>
  {:else if !recording}
    <p class="empty muted">No steps yet. Hit Record and type what the button should do.</p>
  {/if}

  <div class="tools">
    <span class="muted small">Add click:</span>
    {#each [1, 2, 4] as code (code)}
      <button class="btn small" onclick={() => addClick(code)} disabled={recording || steps.length > MACRO_MAX_STEPS - 2}>{MOUSE_BUTTON_LABELS[code]}</button>
    {/each}
    <div class="spacer"></div>
    <span class="muted small">Set all delays to</span>
    <input class="small-num" type="number" min="0" max="65535" bind:value={fixedDelay} />
    <button class="btn small" onclick={applyFixedDelay} disabled={!steps.length || recording}>Apply</button>
  </div>

  {#if unbalanced}<p class="warn">Some keys are pressed but never released. They’d stay held down after the macro runs.</p>{/if}
  {#if error}<p class="warn">{error}</p>{/if}

  <footer>
    <span class="muted small">{steps.length}/{MACRO_MAX_STEPS} steps · {(totalMs / 1000).toFixed(2)} s</span>
    <button class="btn primary" onclick={save} disabled={saving || steps.length < 2}>{saving ? 'Saving…' : 'Save to mouse'}</button>
  </footer>
</Card>

<style>
  .top {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .field {
    display: grid;
    gap: 6px;
    font-size: 13px;
    color: var(--text-2);
  }
  .grow {
    flex: 1;
    min-width: 200px;
  }
  .times input {
    width: 80px;
  }
  input:not([type='range']),
  select {
    height: 36px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: var(--surface-2);
    color: var(--text);
  }
  .recorder {
    margin-top: 16px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .recorder.live {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .rec-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    animation: pulse 1s infinite;
  }
  .dot.idle {
    animation: none;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  .pad {
    margin-top: 12px;
    display: grid;
    place-items: center;
    height: 72px;
    border-radius: 10px;
    border: 1px dashed var(--border-strong);
    color: var(--text-3);
    font-size: 13px;
    user-select: none;
    cursor: crosshair;
  }
  .steps {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    max-height: 340px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 8px 0 12px;
    border-top: 1px solid var(--border);
  }
  .steps li:first-child {
    border-top: 0;
  }
  .arrow {
    width: 20px;
    text-align: center;
    color: var(--accent);
    font-weight: 700;
  }
  .arrow.up {
    color: var(--text-3);
  }
  .key {
    font: 600 12px var(--mono);
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--surface-3);
    border: 1px solid var(--border-strong);
  }
  .delay {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .delay input {
    width: 84px;
    height: 30px;
    text-align: right;
  }
  .x {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--text-3);
    font-size: 18px;
  }
  .x:hover {
    background: var(--surface-3);
    color: var(--bad);
  }
  .empty {
    margin: 16px 0 0;
    font-size: 13px;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
  }
  .btn.small {
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
  }
  .small-num {
    width: 76px;
    height: 30px !important;
  }
  .small {
    font-size: 13px;
  }
  .spacer {
    flex: 1;
  }
  .warn {
    margin: 12px 0 0;
    color: var(--warn);
    font-size: 13px;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .btn.ghost {
    background: none;
    border-color: transparent;
    color: var(--text-2);
  }
</style>
