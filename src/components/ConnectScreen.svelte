<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';

  const m = mouseState;
</script>

<div class="hero">
  <svg class="glyph" width="72" height="72" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="2.5" width="12" height="19" rx="6" fill="none" stroke="currentColor" stroke-width="1.2" />
    <path d="M12 2.5V9" stroke="currentColor" stroke-width="1.2" />
    <rect x="11.2" y="5" width="1.6" height="3" rx="0.8" fill="var(--accent)" />
  </svg>

  {#if !m.supported}
    <h1>This browser can’t talk to USB devices</h1>
    <p class="muted">M600 Control uses WebHID, available in Chrome, Edge, Brave and other Chromium browsers on desktop.</p>
  {:else}
    <h1>Connect your M600</h1>
    <p class="muted">
      Plug in the 2.4 GHz receiver or the USB cable, then pick the device in your browser’s prompt.
      You only need to do this once.
    </p>
    <button class="btn primary big" onclick={() => m.connect()}>Connect mouse</button>
    {#if m.error}<p class="error">{m.error}</p>{/if}
    <ul class="facts muted">
      <li>Nothing to install</li>
      <li>Works offline</li>
      <li>Settings live on the mouse</li>
    </ul>
  {/if}
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 440px;
    margin: 12vh auto 0;
  }
  .glyph {
    color: var(--text-3);
    margin-bottom: 20px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0 0 24px;
  }
  .big {
    height: 44px;
    padding: 0 24px;
    font-size: 15px;
  }
  .error {
    margin: 16px 0 0;
    color: var(--bad);
    font-size: 13px;
  }
  .facts {
    display: flex;
    gap: 18px;
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
  }
  .facts li::before {
    content: '✓ ';
    color: var(--good);
  }
</style>
