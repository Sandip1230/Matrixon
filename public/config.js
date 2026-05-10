/**
 * config.js — MATRIXON Global Configuration
 * Single source of truth. Include FIRST on every page.
 *
 * To deploy to production, either:
 *   a) Change PROD_URL below, OR
 *   b) Set  window.MATRIXON_ENV = 'production'  before loading this file
 */

(function () {
  // ── ENVIRONMENT DETECTION ────────────────────────────────────────────────────
  const host = window.location.hostname;
  const isProd = host !== 'localhost' && host !== '127.0.0.1' && host !== '';

  const DEV_URL  = 'http://localhost:3000';
  const PROD_URL = 'https://your-production-server.com'; // ← change once for prod

  window.MATRIXON_API = isProd ? PROD_URL : DEV_URL;
  window.MATRIXON_ENV = isProd ? 'production' : 'development';

  if (window.MATRIXON_ENV === 'development') {
    console.info('[MATRIXON] Dev mode → API:', window.MATRIXON_API);
  }

  // ── AUTH HELPERS ─────────────────────────────────────────────────────────────
  window.MatrixAuth = {
    getUser:    ()  => localStorage.getItem('matrixon_user'),
    setUser:    (u) => localStorage.setItem('matrixon_user', u),

    logout: () => {
      ['matrixon_user', 'matrixon_country_set', 'matrixon_country_code',
       'matrixon_country_flag', 'matrixon_country_name'].forEach(k => localStorage.removeItem(k));
      window.location.href = 'index.html';
    },

    /** Redirect to login if not authenticated */
    requireAuth: () => {
      if (!localStorage.getItem('matrixon_user')) {
        window.location.href = 'index.html';
      }
    }
  };

  // ── GLOBAL ERROR BOUNDARY ─────────────────────────────────────────────────────
  window.addEventListener('error', (e) => {
    console.error('[MATRIXON] Uncaught error:', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[MATRIXON] Unhandled promise rejection:', e.reason);
  });
})();