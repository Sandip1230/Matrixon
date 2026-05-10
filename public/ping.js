/**
 * ping.js — MATRIXON Real-Time Ping Measurement
 * Reads server URL from window.MATRIXON_API (set in config.js).
 * Include config.js BEFORE this script.
 */

(function () {
  const INTERVAL_MS = 5000;

  function getServer() {
    return (window.MATRIXON_API || 'http://localhost:3000');
  }

  async function measurePing() {
    try {
      const url = getServer() + '/ping?_=' + Date.now();
      const t0 = performance.now();
      const resp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const t1 = performance.now();
      if (!resp.ok && resp.status !== 404) return null;
      return Math.round(t1 - t0);
    } catch {
      return null;
    }
  }

  function format(ms) { return ms === null ? '—' : ms + 'ms'; }

  function pingColor(ms) {
    if (ms === null) return '#ff4444';
    if (ms < 80)  return '#00ff88';
    if (ms < 200) return '#ffcc00';
    return '#ff6644';
  }

  function updateTargets(ms) {
    const text  = format(ms);
    const color = pingColor(ms);
    document.querySelectorAll('[data-ping]').forEach(el => {
      el.textContent = text;
      el.style.color = color;
    });
    ['hudPing', 'footerPing'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.style.color = color; }
    });
    window._matrixPingMs   = ms;
    window._matrixPingText = text;
  }

  async function loop() {
    const ms = await measurePing();
    updateTargets(ms);
    setTimeout(loop, INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loop);
  } else {
    loop();
  }
})();