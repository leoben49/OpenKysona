<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';
  import type { Settings } from '../lib/protocol/settings';
  import Card from './ui/Card.svelte';
  import Row from './ui/Row.svelte';
  import Segmented from './ui/Segmented.svelte';
  import Toggle from './ui/Toggle.svelte';

  const m = mouseState;
  const s = $derived(m.settings!);

  type Flag = 'motionSync' | 'rippleControl' | 'angleSnapping' | 'highPerformanceMode' | 'peakPerformance';
  const toggles: { key: Flag; label: string; hint: string }[] = [
    { key: 'motionSync', label: 'Motion sync', hint: 'Aligns sensor reads with USB polling for steadier tracking. Adds about half a millisecond of delay.' },
    { key: 'rippleControl', label: 'Ripple control', hint: 'Smooths jitter at very high DPI. Leave off unless you notice shaky movement.' },
    { key: 'angleSnapping', label: 'Angle snapping', hint: 'Straightens near-horizontal and vertical movements. Most players keep this off.' },
    { key: 'highPerformanceMode', label: 'High performance sensor mode', hint: 'Runs the sensor in HP mode for maximum tracking quality at a small battery cost.' },
    { key: 'peakPerformance', label: 'Peak performance', hint: 'Delays the sensor’s power-saving states for faster wake-up. Uses more battery.' },
  ];

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => m.update((x) => (x[key] = value));
</script>

<div class="stack">
  <Card title="Sensor" subtitle="PixArt PAW3395">
    <Row label="Lift-off distance" hint="How high you can lift the mouse before it stops tracking.">
      <Segmented
        label="Lift-off distance"
        options={[
          { value: 1, label: '1 mm' },
          { value: 2, label: '2 mm' },
        ]}
        value={s.liftOffMm}
        onchange={(v: number) => set('liftOffMm', v as 1 | 2)} />
    </Row>
    {#each toggles as t (t.key)}
      <Row label={t.label} hint={t.hint}>
        <Toggle label={t.label} checked={s[t.key]} onchange={(v) => set(t.key, v)} />
      </Row>
    {/each}
  </Card>

  <Card title="Buttons">
    <Row label="Debounce time" hint="Filters accidental double clicks from worn switches. Lower is more responsive.">
      <input
        class="debounce"
        type="range"
        min="0"
        max="20"
        value={s.debounceMs}
        style:--fill="{(s.debounceMs / 20) * 100}%"
        oninput={(e) => set('debounceMs', +e.currentTarget.value)}
        aria-label="Debounce time" />
      <output>{s.debounceMs} ms</output>
    </Row>
  </Card>
</div>

<style>
  .stack {
    display: grid;
    gap: 16px;
  }
  .debounce {
    width: 180px;
  }
  output {
    width: 48px;
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
