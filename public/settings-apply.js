/**
 * settings-apply.js — MATRIXON shared settings loader
 * Reads server URL from window.MATRIXON_API (set in config.js).
 * Include config.js BEFORE this script on every page.
 *
 * Changes from original:
 *  - Shows a visible offline banner (not just a console.warn) when sync fails
 *  - Banner auto-dismisses after 6 s and is dismissible by click
 *  - Injects its own minimal CSS so it has no external dependencies
 */

(function () {
  const DEFAULT_SETTINGS = {
    pushNotif: false, emailSummary: false, dailyReminder: true, streakWarn: true,
    language: 'en', timezone: 'Asia/Kolkata',
    soundFX: true, bgMusic: false, volume: 70, videoAutoplay: true, captions: false,
    publicProfile: true, showLeaderboard: true, analytics: true,
    wifiOnly: true, offlineMode: false,
    aiPersona: 'socratic', spaced: 5, contentWeight: 70,
    zenMode: false, hideGamify: false, graceDays: 3, graceToday: false, commuteMode: false,
    dyslexia: false, noFlash: false, noConfetti: false, reduceRain: false,
    noSuddenSound: false, highContrast: false,
    tts: false, ttsSpeed: 100, ttsVoice: 'female-young', ttsAccent: 'en-IN',
    fontSize: 16, cursorBlink: 'normal',
  };

  // ── LOAD CACHED SETTINGS ──────────────────────────────────────────────────────
  let saved = {};
  try {
    const raw = localStorage.getItem('matrixon_settings');
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}

  const s = Object.assign({}, DEFAULT_SETTINGS, saved);
  window.matrixonSettings = s;

  // ── APPLY SETTINGS TO DOM ─────────────────────────────────────────────────────
  function apply() {
    if (s.fontSize && s.fontSize !== 16) {
      document.documentElement.style.setProperty('font-size', s.fontSize + 'px');
    }
    if (s.highContrast) {
      document.body.style.filter = 'contrast(1.3) brightness(1.1)';
    }
    if (s.dyslexia) {
      const style = document.createElement('style');
      style.id = 'dyslexiaGlobal';
      style.textContent = `body,p,span,div,button,input,select,label,td,li{font-family:'OpenDyslexic',Arial,sans-serif!important;line-height:2.1!important;letter-spacing:.05em!important;text-align:left!important;}`;
      document.head.appendChild(style);
    }
    if (s.noConfetti || s.noFlash) {
      const style = document.createElement('style');
      style.id = 'noAnimGlobal';
      style.textContent = `.particle,.confetti-piece{display:none!important;}*{animation-duration:.001s!important;transition-duration:.001s!important;}`;
      document.head.appendChild(style);
    }
    window._matrixRainIntensity = s.reduceRain ? 0.3 : 1;
    if (s.commuteMode) {
      const badge = document.getElementById('commuteBadge');
      if (badge) badge.style.display = 'inline-flex';
    }
    if (s.hideGamify) {
      const style = document.createElement('style');
      style.id = 'noGamifyGlobal';
      style.textContent = `.xp-bar,.streak-display,.badge-row,#leaderboardBtn,[class*="streak"],[class*="xp-"],[id*="streak"],[id*="xp"],.level-badge,.rank-pill{display:none!important;}`;
      document.head.appendChild(style);
    }
    if (s.zenMode) {
      const style = document.createElement('style');
      style.id = 'zenGlobal';
      style.textContent = `#sidebar,.sidebar,#progressBar,.progress-bar,#topNav .nav-extras,.side-panel{display:none!important;}`;
      document.head.appendChild(style);
    }
    window._matrixSoundEnabled = !!s.soundFX;
    window._matrixVolume       = (s.volume || 70) / 100;
    window._matrixTTSEnabled   = !!s.tts;
    window._matrixTTSSpeed     = (s.ttsSpeed || 100) / 100;
  }

  if (document.body) { apply(); }
  else { document.addEventListener('DOMContentLoaded', apply); }

  // ── OFFLINE BANNER ────────────────────────────────────────────────────────────
  /**
   * Shows a small banner at the top of the page when server sync fails.
   * Injects keyframe CSS once, then dismisses after 6 s or on click.
   */
  function showOfflineBanner() {
    if (document.getElementById('matrixOfflineBanner')) return; // already shown

    // Inject animation once
    if (!document.getElementById('offlineBannerCSS')) {
      const st = document.createElement('style');
      st.id = 'offlineBannerCSS';
      st.textContent = `
        @keyframes _mxSlideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes _mxSlideUp{from{transform:translateY(0);opacity:1}to{transform:translateY(-100%);opacity:0}}
        #matrixOfflineBanner{
          position:fixed;top:0;left:0;right:0;z-index:999999;
          background:rgba(20,10,0,0.97);border-bottom:1px solid #ffcc0088;
          color:#ffeeaa;font-family:'Courier New',monospace;font-size:12px;
          padding:8px 16px;display:flex;align-items:center;justify-content:space-between;
          gap:12px;letter-spacing:.5px;
          animation:_mxSlideDown .35s cubic-bezier(.22,1,.36,1) forwards;
          box-shadow:0 2px 18px rgba(255,200,0,0.15);
        }
        #matrixOfflineBanner.hide{animation:_mxSlideUp .3s ease forwards;}
        #matrixOfflineBanner .ob-left{display:flex;align-items:center;gap:8px;}
        #matrixOfflineBanner .ob-dot{width:8px;height:8px;border-radius:50%;background:#ffcc00;animation:_mxDotBlink 1.2s infinite;}
        @keyframes _mxDotBlink{0%,100%{opacity:1}50%{opacity:.2}}
        #matrixOfflineBanner .ob-close{cursor:pointer;color:#ffaa44;font-size:16px;line-height:1;padding:2px 6px;border-radius:4px;transition:color .2s;}
        #matrixOfflineBanner .ob-close:hover{color:#fff;}
      `;
      document.head.appendChild(st);
    }

    const banner = document.createElement('div');
    banner.id = 'matrixOfflineBanner';
    banner.innerHTML = `
      <div class="ob-left">
        <span class="ob-dot"></span>
        <span>⚠&nbsp; Server offline — using cached settings. Some features may be unavailable.</span>
      </div>
      <span class="ob-close" title="Dismiss" onclick="this.parentElement.classList.add('hide');setTimeout(()=>this.parentElement?.remove(),320)">✕</span>
    `;
    document.body.prepend(banner);

    // Auto-dismiss after 6 s
    setTimeout(() => {
      banner.classList.add('hide');
      setTimeout(() => banner.remove(), 320);
    }, 6000);
  }

  // ── BACKGROUND SERVER SYNC ───────────────────────────────────────────────────
  const username = localStorage.getItem('matrixon_user');
  if (username) {
    const api = window.MATRIXON_API || 'http://localhost:3000';
    fetch(api + '/settings/' + encodeURIComponent(username), { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        if (data && data.settings) {
          const merged = Object.assign({}, DEFAULT_SETTINGS, data.settings);
          localStorage.setItem('matrixon_settings', JSON.stringify(merged));
          window.matrixonSettings = merged;
          // Re-apply if something critical changed
          // (only runs if page allows it — avoids double-init on most pages)
          if (window._matrixSettingsReady) apply();
        }
      })
      .catch(() => {
        console.warn('[MATRIXON] Settings sync failed — using cached settings');
        // Show banner only after DOM is ready
        if (document.body) { showOfflineBanner(); }
        else { document.addEventListener('DOMContentLoaded', showOfflineBanner); }
      });
  }

  window._matrixSettingsReady = true;
})();