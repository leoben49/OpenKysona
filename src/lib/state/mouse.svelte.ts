import type { Battery } from '../protocol/battery';
import { Mouse } from '../protocol/device';
import { decodeMacro, encodeMacro, MACRO_SLOT_SIZE, macroAddress, usedLength, type Macro } from '../protocol/macro';
import { decodeSettings, encodeSettings, SETTINGS_LEN, type Settings } from '../protocol/settings';

export type SyncState = 'idle' | 'saving' | 'saved' | 'error';

const BATTERY_POLL_MS = 60_000;
const SAVE_DEBOUNCE_MS = 250;

/** App-wide connection, battery and settings state, kept in sync with the mouse. */
class MouseState {
  mouse = $state<Mouse | null>(null);
  battery = $state<Battery | null>(null);
  settings = $state<Settings | null>(null);
  sync = $state<SyncState>('idle');
  error = $state<string | null>(null);
  readonly supported = typeof navigator !== 'undefined' && 'hid' in navigator;

  /** Bytes currently on the device (what `settings` was decoded from / last written). */
  private raw: Uint8Array | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private dirty = false;
  private teardown: (() => void)[] = [];

  async restore() {
    if (!this.supported) return;
    navigator.hid.addEventListener('disconnect', (e) => {
      if (e.device === this.mouse?.hid) this.disconnected();
    });
    navigator.hid.addEventListener('connect', () => {
      if (!this.mouse) void this.attach(Mouse.fromGranted());
    });
    await this.attach(Mouse.fromGranted());
  }

  /** Must be called from a click handler (opens the browser's device picker). */
  async connect() {
    await this.attach(Mouse.request());
  }

  private async attach(pending: Promise<Mouse | null>) {
    try {
      const m = await pending;
      if (!m) return;
      this.mouse = m;
      this.error = null;
      await m.hello().catch(() => {});
      await Promise.all([this.refreshSettings(), this.refreshBattery()]);
      const poll = setInterval(() => document.visibilityState === 'visible' && this.refreshBattery(), BATTERY_POLL_MS);
      const unsubscribe = m.onStatus((flags) => {
        if (flags & 0x40) void this.refreshBattery();
        if (flags & 0x07 && !this.saving) void this.refreshSettings();
      });
      const onVisible = () => document.visibilityState === 'visible' && this.refreshBattery();
      document.addEventListener('visibilitychange', onVisible);
      this.teardown = [() => clearInterval(poll), unsubscribe, () => document.removeEventListener('visibilitychange', onVisible)];
    } catch (e) {
      this.fail(e);
    }
  }

  private disconnected() {
    this.teardown.forEach((f) => f());
    this.teardown = [];
    clearTimeout(this.saveTimer);
    this.mouse = null;
    this.battery = null;
    this.settings = null;
    this.raw = null;
    this.sync = 'idle';
  }

  async refreshBattery() {
    if (!this.mouse) return;
    try {
      this.battery = await this.mouse.battery();
    } catch {
      // Mouse asleep or out of range; keep the last known value.
    }
  }

  async refreshSettings() {
    if (!this.mouse) return;
    try {
      this.raw = await this.mouse.readFlash(0, SETTINGS_LEN);
      this.settings = decodeSettings(this.raw);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Applies a change locally and schedules a write to the mouse. */
  update(change: (s: Settings) => void) {
    if (!this.settings) return;
    change(this.settings);
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
  }

  private async flush() {
    if (this.saving) return; // the running save loops until clean
    this.saving = (async () => {
      this.sync = 'saving';
      try {
        while (this.dirty && this.mouse && this.raw && this.settings) {
          this.dirty = false;
          const target = encodeSettings($state.snapshot(this.settings) as Settings, this.raw);
          const profile = await this.mouse.currentProfile();
          await this.mouse.writeFlashDiff(0, target, this.raw);
          await this.mouse.reload(profile);
          this.raw = target;
        }
        this.sync = 'saved';
      } catch (e) {
        this.fail(e);
        await this.refreshSettings();
      } finally {
        this.saving = null;
      }
    })();
    await this.saving;
  }

  /** Writes a full settings block (e.g. from a backup file). */
  async writeRaw(bytes: Uint8Array) {
    if (!this.mouse || !this.raw || bytes.length < SETTINGS_LEN) return;
    this.sync = 'saving';
    try {
      const target = bytes.slice(0, SETTINGS_LEN);
      const profile = await this.mouse.currentProfile();
      await this.mouse.writeFlashDiff(0, target, this.raw);
      await this.mouse.reload(profile);
      this.raw = target;
      this.settings = decodeSettings(target);
      this.sync = 'saved';
    } catch (e) {
      this.fail(e);
    }
  }

  /** Reads the macro stored in `slot` (null if empty). */
  async loadMacro(slot: number): Promise<Macro | null> {
    if (!this.mouse) return null;
    return decodeMacro(await this.mouse.readFlash(macroAddress(slot), MACRO_SLOT_SIZE));
  }

  /**
   * Stores `macro` in the macro slot matching the button (as the vendor app
   * does) and binds the button to it with the given repeat mode.
   */
  async saveMacro(button: number, macro: Macro, repeat: number) {
    if (!this.mouse || !this.settings) return;
    this.sync = 'saving';
    try {
      const addr = macroAddress(button);
      const current = await this.mouse.readFlash(addr, MACRO_SLOT_SIZE);
      const used = usedLength(macro);
      await this.mouse.writeFlashDiff(addr, encodeMacro(macro, current).subarray(0, used), current.subarray(0, used));
      this.sync = 'saved';
    } catch (e) {
      this.fail(e);
      throw e;
    }
    this.update((s) => (s.buttons[button] = { type: 'macro', index: button, mode: repeat }));
  }

  /** Current on-device settings bytes, for backups. */
  snapshot(): Uint8Array | null {
    return this.raw?.slice() ?? null;
  }

  private fail(e: unknown) {
    this.sync = 'error';
    this.error = e instanceof Error ? e.message : String(e);
  }
}

export const mouseState = new MouseState();
