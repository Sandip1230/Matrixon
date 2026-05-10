/**
 * script.js — MATRIXON Legacy Login Script
 * ─────────────────────────────────────────
 * ⚠️  DEPRECATED — DO NOT LOAD IN index.html
 *
 * All login and register logic has been moved inline into index.html's
 * own <script> block. Loading this file alongside index.html would
 * attach duplicate event listeners to #accessBtn and #registerBtn,
 * causing double-submit bugs and conflicts.
 *
 * This file is retained only as a historical reference.
 * If you need to restore the standalone script pattern, copy the logic
 * from index.html's inline <script> here and remove the inline block.
 *
 * Files that ARE safely shareable across pages:
 *   - config.js          (MATRIXON_API, MatrixAuth helpers)
 *   - ping.js            (live ping measurement, reads window.MATRIXON_API)
 *   - settings-apply.js  (applies saved settings, shows offline banner)
 */

// No code intentionally — see note above.