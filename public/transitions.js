/**
 * transitions.js — MATRIXON Page Transition System
 * Include AFTER config.js and navbar.js on every page.
 *
 * Adds a smooth fade-out on navigation + fade-in on load.
 * Works with all <a> tags pointing to internal .html pages.
 */

(function () {
  const DURATION = 280; // ms

  // ── INJECT CSS ──────────────────────────────────────────────────────────────
  const st = document.createElement('style');
  st.textContent = `
    @keyframes _mxFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes _mxFadeOut {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-6px); }
    }
    body._mx-entering {
      animation: _mxFadeIn ${DURATION}ms cubic-bezier(.22,1,.36,1) both;
    }
    body._mx-leaving {
      animation: _mxFadeOut ${DURATION}ms ease forwards;
      pointer-events: none;
    }
    /* Subtle page-load progress bar */
    #_mxProgress {
      position: fixed; top: 0; left: 0; height: 2px; width: 0%;
      background: linear-gradient(to right, #00ff88, #00d4ff);
      box-shadow: 0 0 8px #00ff88;
      z-index: 99999; transition: width ${DURATION}ms ease;
      pointer-events: none;
    }
  `;
  document.head.appendChild(st);

  // ── PROGRESS BAR ─────────────────────────────────────────────────────────────
  function createProgressBar() {
    const bar = document.createElement('div');
    bar.id = '_mxProgress';
    document.body.appendChild(bar);
    return bar;
  }

  // ── FADE-IN ON ARRIVAL ────────────────────────────────────────────────────────
  function fadeIn() {
    document.body.classList.add('_mx-entering');
    const bar = createProgressBar();
    requestAnimationFrame(() => { bar.style.width = '100%'; });
    setTimeout(() => {
      document.body.classList.remove('_mx-entering');
      bar.style.opacity = '0';
      setTimeout(() => bar.remove(), 300);
    }, DURATION + 80);
  }

  // ── INTERCEPT LINK CLICKS ─────────────────────────────────────────────────────
  function handleLinks() {
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      // Only intercept relative .html links (not external, not anchors, not js:)
      if (!href || href.startsWith('http') || href.startsWith('#') ||
          href.startsWith('javascript') || href.startsWith('mailto')) return;
      e.preventDefault();
      document.body.classList.add('_mx-leaving');
      setTimeout(() => { window.location.href = href; }, DURATION);
    });
  }

  function init() {
    fadeIn();
    handleLinks();
  }

  if (document.body) { init(); }
  else { document.addEventListener('DOMContentLoaded', init); }
})();