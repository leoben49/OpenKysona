<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';
  import type { ButtonAction } from '../lib/protocol/settings';
  import type { Macro } from '../lib/protocol/macro';
  import Card from './ui/Card.svelte';
  import MacroEditor from './MacroEditor.svelte';

  const m = mouseState;
  const s = $derived(m.settings!);

  /** Physical buttons on the M600 V2 and their binding slots. */
  const BUTTONS = [
    { slot: 0, name: 'Left button', part: 'left' },
    { slot: 1, name: 'Right button', part: 'right' },
    { slot: 2, name: 'Wheel click', part: 'wheel' },
    { slot: 4, name: 'Side button (front)', part: 'side-front' },
    { slot: 3, name: 'Side button (rear)', part: 'side-rear' },
    { slot: 5, name: 'DPI button', part: 'dpi' },
  ] as const;

  const ACTIONS: { group: string; items: { key: string; label: string; action: ButtonAction }[] }[] = [
    {
      group: 'Mouse',
      items: [
        { key: 'left', label: 'Left click', action: { type: 'mouse', button: 'left' } },
        { key: 'right', label: 'Right click', action: { type: 'mouse', button: 'right' } },
        { key: 'middle', label: 'Middle click', action: { type: 'mouse', button: 'middle' } },
        { key: 'back', label: 'Back', action: { type: 'mouse', button: 'back' } },
        { key: 'forward', label: 'Forward', action: { type: 'mouse', button: 'forward' } },
      ],
    },
    {
      group: 'DPI',
      items: [
        { key: 'dpi-cycle', label: 'Cycle DPI', action: { type: 'dpi', mode: 'cycle' } },
        { key: 'dpi-up', label: 'DPI up', action: { type: 'dpi', mode: 'up' } },
        { key: 'dpi-down', label: 'DPI down', action: { type: 'dpi', mode: 'down' } },
      ],
    },
    {
      group: 'Scroll',
      items: [
        { key: 'scroll-up', label: 'Scroll up', action: { type: 'scroll', dir: 'up' } },
        { key: 'scroll-down', label: 'Scroll down', action: { type: 'scroll', dir: 'down' } },
        { key: 'tilt-left', label: 'Scroll left', action: { type: 'tilt', dir: 'left' } },
        { key: 'tilt-right', label: 'Scroll right', action: { type: 'tilt', dir: 'right' } },
      ],
    },
    {
      group: 'Other',
      items: [
        { key: 'polling', label: 'Cycle polling rate', action: { type: 'pollingCycle' } },
        { key: 'disabled', label: 'Disabled', action: { type: 'disabled' } },
      ],
    },
  ];
  const ALL = ACTIONS.flatMap((g) => g.items);

  function keyOf(a: ButtonAction): string {
    if (a.type === 'macro') return 'macro';
    return ALL.find((i) => JSON.stringify(i.action) === JSON.stringify(a))?.key ?? 'custom';
  }

  function describeCustom(a: ButtonAction): string {
    if (a.type === 'fire') return 'Rapid fire';
    if (a.type === 'shortcut') return 'Keyboard shortcut';
    return 'Custom';
  }

  let hovered = $state<string | null>(null);

  // ---- macros ----------------------------------------------------------------

  /** Names of macros currently bound to buttons, keyed by macro slot. */
  let macroNames = $state<Record<number, string>>({});
  let editor = $state<{ button: number; name: string; macro: Macro | null; repeat: number } | null>(null);

  $effect(() => {
    for (const b of BUTTONS) {
      const a = s.buttons[b.slot];
      if (a.type === 'macro' && !(a.index in macroNames)) {
        macroNames[a.index] = '…';
        m.loadMacro(a.index).then((mac) => (macroNames[a.index] = mac?.name ?? 'Empty macro'));
      }
    }
  });

  async function openEditor(button: number, name: string) {
    const a = s.buttons[button];
    const macro = a.type === 'macro' ? await m.loadMacro(a.index) : null;
    editor = { button, name, macro, repeat: a.type === 'macro' ? a.mode : 1 };
  }

  function closeEditor() {
    if (editor) delete macroNames[editor.button];
    editor = null;
  }

  function assign(slot: number, select: HTMLSelectElement) {
    const restoreSelect = () => (select.value = keyOf(s.buttons[slot]) === 'macro' ? 'macro-current' : keyOf(s.buttons[slot]));
    if (select.value === 'macro') {
      restoreSelect();
      void openEditor(slot, BUTTONS.find((b) => b.slot === slot)!.name);
      return;
    }
    const action = ALL.find((i) => i.key === select.value)?.action;
    if (!action) return;
    const after = s.buttons.map((b, i) => (i === slot ? action : b));
    const hasLeft = BUTTONS.some((b) => keyOf(after[b.slot]) === 'left');
    if (!hasLeft && !confirm('No button will left-click after this change. Continue?')) {
      restoreSelect();
      return;
    }
    m.update((x) => (x.buttons[slot] = structuredClone(action)));
  }

  function resetDefaults() {
    const defaults: ButtonAction[] = [
      { type: 'mouse', button: 'left' },
      { type: 'mouse', button: 'right' },
      { type: 'mouse', button: 'middle' },
      { type: 'mouse', button: 'back' },
      { type: 'mouse', button: 'forward' },
      { type: 'dpi', mode: 'cycle' },
    ];
    m.update((x) => defaults.forEach((a, i) => (x.buttons[i] = a)));
  }
</script>

<Card title="Button mapping" subtitle="Changes are stored on the mouse and work everywhere, even without this page.">
  {#snippet actions()}
    <button class="btn" onclick={resetDefaults}>Reset to defaults</button>
  {/snippet}
  <div class="layout">
    <svg class="mouse" viewBox="0 0 160 260" aria-hidden="true">
      <path class="body" d="M80 8C38 8 22 44 22 96v74c0 48 26 82 58 82s58-34 58-82V96c0-52-16-88-58-88Z" />
      <path class="part" class:hot={hovered === 'left'} d="M78 10C42 12 26 44 25 92h53Z" />
      <path class="part" class:hot={hovered === 'right'} d="M82 10c36 2 52 34 53 82H82Z" />
      <rect class="part" class:hot={hovered === 'wheel'} x="72" y="30" width="16" height="34" rx="8" />
      <rect class="part" class:hot={hovered === 'dpi'} x="74" y="72" width="12" height="14" rx="4" />
      <rect class="part" class:hot={hovered === 'side-front'} x="14" y="104" width="10" height="30" rx="4" />
      <rect class="part" class:hot={hovered === 'side-rear'} x="14" y="138" width="10" height="30" rx="4" />
    </svg>

    <ul>
      {#each BUTTONS as b (b.slot)}
        {@const current = s.buttons[b.slot]}
        {@const key = keyOf(current)}
        <li onmouseenter={() => (hovered = b.part)} onmouseleave={() => (hovered = null)}>
          <label for="btn-{b.slot}">{b.name}</label>
          <span class="spacer"></span>
          {#if current.type === 'macro'}
            <button class="btn small" onclick={() => openEditor(b.slot, b.name)}>Edit</button>
          {/if}
          <select
            id="btn-{b.slot}"
            value={key === 'macro' ? 'macro-current' : key}
            onfocus={() => (hovered = b.part)}
            onblur={() => (hovered = null)}
            onchange={(e) => assign(b.slot, e.currentTarget)}>
            {#if key === 'custom'}<option value="custom" disabled>{describeCustom(current)}</option>{/if}
            {#each ACTIONS as g (g.group)}
              <optgroup label={g.group}>
                {#each g.items as i (i.key)}<option value={i.key}>{i.label}</option>{/each}
              </optgroup>
            {/each}
            <optgroup label="Macro">
              {#if current.type === 'macro'}
                <option value="macro-current" hidden>Macro: {macroNames[current.index] ?? '…'}</option>
              {/if}
              <option value="macro">{current.type === 'macro' ? 'Edit macro…' : 'Record a macro…'}</option>
            </optgroup>
          </select>
        </li>
      {/each}
    </ul>
  </div>
</Card>

{#if editor}
  {#key editor.button}
    <div class="editor">
      <MacroEditor
        button={editor.button}
        buttonName={editor.name}
        initial={editor.macro}
        initialRepeat={editor.repeat}
        onclose={closeEditor} />
    </div>
  {/key}
{/if}

<style>
  .layout {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 32px;
    align-items: center;
  }
  .mouse {
    width: 100%;
  }
  .body {
    fill: var(--surface-2);
    stroke: var(--border-strong);
    stroke-width: 1.5;
  }
  .part {
    fill: var(--surface-3);
    stroke: var(--border-strong);
    stroke-width: 1;
    transition: fill 0.15s;
  }
  .part.hot {
    fill: var(--accent);
    stroke: var(--accent);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .spacer {
    flex: 1;
  }
  .btn.small {
    height: 30px;
    padding: 0 12px;
    font-size: 13px;
  }
  .editor {
    margin-top: 16px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  li:first-child {
    border-top: 0;
  }
  label {
    font-weight: 500;
  }
  select {
    width: 200px;
    height: 36px;
    padding: 0 32px 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: var(--surface-2)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
      no-repeat right 12px center;
    appearance: none;
    cursor: pointer;
  }
  select:hover {
    border-color: var(--text-3);
  }
  @media (max-width: 640px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .mouse {
      display: none;
    }
    select {
      width: 170px;
    }
  }
</style>
