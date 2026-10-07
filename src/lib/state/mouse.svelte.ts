import type { Battery } from '../protocol/battery';
import { Mouse } from '../protocol/device';
import { decodeMacro, encodeMacro, MACRO_SLOT_SIZE, macroAddress, usedLength, type Macro } from '../protocol/macro';
import { decodeSettings, encodeSettings, SETTINGS_LEN, type Settings } from '../protocol/settings';

export type SyncState = 'idle' | 'saving' | 'saved' | 'error';

const BATTERY_POLL_MS = 60_000;
const ONLINE_POLL_MS = 3_000;
const SAVE_DEBOUNCE_MS = 250;

/** App-wide connection, battery and settings state, kept in sync with the mouse. */
class MouseState {
  mouse = $state<Mouse | null>(null);
  /** False when connected to the receiver but the mouse isn't reachable through it. */
  online = $state(false);
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
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fake')) {
      const { createFakeHid } = await import('../dev/fake-hid');
      return this.attach(createFakeHid().then((hid) => Mouse.open(hid)));
    }
    if (!this.supported) return;
    navigator.hid.addEventListener('disconnect', (e) => {
      if (e.device !== this.mouse?.hid) return;
      this.detach();
      void this.attach(Mouse.fromGranted()); // e.g. cable unplugged: fall back to the receiver
    });
    navigator.hid.addEventListener('connect', () => {
      // Prefer a cable over the receiver as soon as one is plugged in.
      if (!this.mouse || this.mouse.link === 'dongle') void this.switchTo(Mouse.fromGranted());
    });
    await this.attach(Mouse.fromGranted());
  }

  /** Must be called from a click handler (opens the browser's device picker). */
  async connect() {
    await this.switchTo(Mouse.request());
  }

  private async switchTo(pending: Promise<Mouse | null>) {
    const m = await pending.catch(() => null);
    if (!m || m.hid === this.mouse?.hid) return;
    this.detach();
    await this.attach(Promise.resolve(m));
  }

  private async attach(pending: Promise<Mouse | null>) {
    try {
      const m = await pending;
      if (!m) return;
      this.mouse = m;
      this.error = null;
      await m.hello().catch(() => {});
      const poll = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        // While the receiver can't see the mouse, check often so it reconnects quickly.
        if (!this.online) void this.checkOnline();
        else if (Date.now() - this.lastBattery > BATTERY_POLL_MS) void this.refreshBattery();
      }, ONLINE_POLL_MS);
      const unsubscribe = m.onStatus((flags) => {
        if (flags & 0x40) void this.refreshBattery();
        if (flags & 0x07 && !this.saving) void this.refreshSettings();
      });
      const onVisible = () => document.visibilityState === 'visible' && this.refreshBattery();
      document.addEventListener('visibilitychange', onVisible);
      this.teardown = [() => clearInterval(poll), unsubscribe, () => document.removeEventListener('visibilitychange', onVisible)];
      await this.checkOnline();
    } catch (e) {
      this.fail(e);
    }
  }

  /** Over the receiver, the mouse may be off, asleep or on another connection mode. */
  private async checkOnline() {
    const m = this.mouse;
    if (!m) return;
    const online = m.link === 'wired' || (await m.online().catch(() => false));
    if (m !== this.mouse) return;
    const cameOnline = online && !this.online;
    this.online = online;
    if (cameOnline || (online && !this.settings)) await Promise.all([this.refreshSettings(), this.refreshBattery()]);
  }

  private detach() {
    this.teardown.forEach((f) => f());
    this.teardown = [];
    clearTimeout(this.saveTimer);
    this.mouse = null;
    this.online = false;
    this.battery = null;
    this.settings = null;
    this.raw = null;
    this.sync = 'idle';
  }

  private lastBattery = 0;

  async refreshBattery() {
    if (!this.mouse) return;
    this.lastBattery = Date.now();
    try {
      this.battery = await this.mouse.battery();
    } catch {
      // Asleep, out of range, or switched to another mode: find out which.
      const m = this.mouse;
      if (m?.link === 'dongle' && !(await m.online().catch(() => false)) && m === this.mouse) this.online = false;
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
      const encoded = encodeMacro(macro);
      await this.mouse.writeMacroSlot(macroAddress(button), encoded.subarray(0, usedLength(macro)));
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
