<script lang="ts">
  import { mouseState } from '../lib/state/mouse.svelte';

  const m = mouseState;
</script>

<div class="hero">
  <div class="pulse" aria-hidden="true"><span></span></div>
  <h1>Receiver connected, mouse not found</h1>
  <p class="muted">
    The mouse is off, asleep, or set to Bluetooth or wired mode. Move it or switch it to 2.4 GHz and this page
    will pick it up automatically.
  </p>
  <div class="alt">
    <span class="muted">Using the USB cable?</span>
    <button class="btn primary" onclick={() => m.connect()}>Connect via cable</button>
  </div>
  <p class="hint muted">Your browser asks once for permission to use the cable connection.</p>
  <p class="bt muted">
    <b>On Bluetooth?</b> The mouse doesn’t accept setting changes over Bluetooth, but everything you set here
    still applies. Windows shows its battery level in Settings → Bluetooth &amp; devices.
  </p>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 460px;
    margin: 12vh auto 0;
  }
  .pulse {
    position: relative;
    width: 56px;
    height: 56px;
    margin-bottom: 24px;
  }
  .pulse::before,
  .pulse span {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent);
    opacity: 0;
    animation: ping 2s var(--ease) infinite;
  }
  .pulse span {
    animation-delay: 1s;
  }
  @keyframes ping {
    0% {
      transform: scale(0.4);
      opacity: 0.9;
    }
    100% {
      transform: scale(1.2);
      opacity: 0;
    }
  }
  h1 {
    margin: 0 0 8px;
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
  }
  .alt {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 28px;
    padding: 12px 12px 12px 18px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .hint {
    margin-top: 12px;
    font-size: 12px;
  }
  .bt {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    font-size: 13px;
  }
  .bt b {
    color: var(--text);
    font-weight: 600;
  }
</style>
