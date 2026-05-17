/**
 * navbar.js — MATRIXON Common Navigation Bar
 * Drop-in nav for every page. Include config.js FIRST.
 *
 * Usage (add to every page <body>, right after config.js):
 *   <script src="config.js"></script>
 *   <script src="navbar.js"></script>
 *
 * Auto-detects current page to highlight the active link.
 * Set  data-nav-page="pagename"  on <body> to override detection.
 */

(function () {
  // ── NAV ITEMS ────────────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'learning',      label: '⚡ LEARN',        href: 'learning.html'      },
    { id: 'courses',       label: '📚 COURSES',      href: 'courses.html'       },
    { id: 'leaderboard',   label: '🏆 RANKS',        href: 'Leaderboard.html'   },
    { id: 'achievements',  label: '🎖 ACHIEVEMENTS', href: 'achievements.html'  },
    { id: 'community',     label: '🌐 COMMUNITY',    href: 'community.html'     },
    { id: 'profile',       label: '👤 PROFILE',      href: 'profile.html'       },
    { id: 'settings',      label: '⚙ SETTINGS',     href: 'Settings.html'      },
    { id: 'help',          label: '❓ HELP',          href: 'help.html'          },
    { id: 'contact',       label: '📨 SUPPORT',       href: 'contact.html'       },
  ];

  // ── DETECT CURRENT PAGE ───────────────────────────────────────────────────────
  function detectPage() {
    const override = document.body && document.body.dataset.navPage;
    if (override) return override.toLowerCase();
    const file = window.location.pathname.split('/').pop().replace('.html','').toLowerCase();
    if (file === 'leaderboard') return 'leaderboard';
    return file;
  }

  // ── INJECT CSS ────────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('matrixNavCSS')) return;
    const st = document.createElement('style');
    st.id = 'matrixNavCSS';
    st.textContent = `
      /* ── MATRIXON COMMON NAVBAR ── */
      #matrixNav {
        position: fixed;
        top: 0; left: 0; right: 0;
        height: 54px;
        z-index: 9500;
        display: flex;
        align-items: center;
        padding: 0 18px;
        gap: 6px;
        background: rgba(0, 8, 2, 0.96);
        border-bottom: 1px solid rgba(0,255,136,0.18);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 2px 24px rgba(0,255,136,0.07);
        font-family: 'Share Tech Mono', 'Courier New', monospace;
      }

      /* Brand */
      #matrixNavBrand {
        font-family: 'Orbitron', 'Share Tech Mono', monospace;
        font-weight: 900;
        font-size: 15px;
        letter-spacing: 5px;
        color: #00ff88;
        text-shadow: 0 0 12px rgba(0,255,136,0.7);
        white-space: nowrap;
        margin-right: 8px;
        text-decoration: none;
        flex-shrink: 0;
      }
      #matrixNavBrand span { color: #00d4ff; }

      /* Divider */
      .mnav-div {
        width: 1px;
        height: 28px;
        background: rgba(0,255,136,0.15);
        flex-shrink: 0;
        margin: 0 4px;
      }

      /* Nav links */
      .mnav-links {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: 1;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .mnav-links::-webkit-scrollbar { display: none; }

      .mnav-link {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
        letter-spacing: 1.2px;
        color: rgba(0,255,136,0.5);
        text-decoration: none;
        white-space: nowrap;
        border: 1px solid transparent;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .mnav-link:hover {
        color: #00ff88;
        background: rgba(0,255,136,0.07);
        border-color: rgba(0,255,136,0.25);
      }
      .mnav-link.active {
        color: #00ff88;
        background: rgba(0,255,136,0.1);
        border-color: rgba(0,255,136,0.4);
        text-shadow: 0 0 8px rgba(0,255,136,0.5);
      }
      .mnav-link.active::before {
        content: '';
        display: inline-block;
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #00ff88;
        box-shadow: 0 0 6px #00ff88;
        margin-right: 7px;
        flex-shrink: 0;
        animation: mnavDot 1.8s ease-in-out infinite;
      }
      @keyframes mnavDot {
        0%,100% { opacity:1; } 50% { opacity:0.3; }
      }

      /* Right side */
      .mnav-right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        margin-left: 6px;
      }

      /* Ping */
      #mnavPing {
        font-size: 10px;
        letter-spacing: 1px;
        color: rgba(0,255,136,0.45);
        white-space: nowrap;
      }

      /* User pill */
      #mnavUser {
        font-size: 11px;
        color: rgba(0,212,255,0.7);
        letter-spacing: 1px;
        background: rgba(0,212,255,0.06);
        border: 1px solid rgba(0,212,255,0.2);
        border-radius: 20px;
        padding: 4px 12px;
        white-space: nowrap;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Logout */
      #mnavLogout {
        padding: 5px 12px;
        background: transparent;
        border: 1px solid rgba(255,50,50,0.35);
        border-radius: 6px;
        color: rgba(255,80,80,0.7);
        font-family: 'Share Tech Mono', monospace;
        font-size: 10px;
        letter-spacing: 1px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
      }
      #mnavLogout:hover {
        background: rgba(255,50,50,0.1);
        border-color: rgba(255,80,80,0.6);
        color: #ff5555;
      }

      /* Push page content down below nav */
      body.matrixNavActive {
        padding-top: 54px !important;
      }

      /* Hamburger (mobile) */
      #mnavHamburger {
        display: none;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
        padding: 6px;
        flex-shrink: 0;
      }
      #mnavHamburger span {
        display: block;
        width: 20px; height: 2px;
        background: rgba(0,255,136,0.7);
        border-radius: 2px;
        transition: 0.3s;
      }

      @media (max-width: 700px) {
        #mnavHamburger { display: flex; }
        .mnav-links {
          display: none;
          position: absolute;
          top: 54px; left: 0; right: 0;
          flex-direction: column;
          background: rgba(0,8,2,0.98);
          border-bottom: 1px solid rgba(0,255,136,0.2);
          padding: 10px 16px 16px;
          gap: 6px;
          z-index: 9499;
        }
        .mnav-links.open { display: flex; }
        .mnav-link { width: 100%; padding: 10px 14px; font-size: 13px; }
        #mnavUser { max-width: 80px; font-size: 10px; }
        #mnavPing { display: none; }
        #matrixNavBrand { font-size: 13px; letter-spacing: 3px; }
      }
    `;
    document.head.appendChild(st);
  }

  // ── BUILD HTML ────────────────────────────────────────────────────────────────
  function buildNav() {
    const currentPage = detectPage();
    const username = (window.MatrixAuth && window.MatrixAuth.getUser()) || '';

    const linksHTML = NAV_ITEMS.map(item => {
      const isActive = currentPage === item.id;
      return `<a class="mnav-link${isActive ? ' active' : ''}" href="${item.href}">${item.label}</a>`;
    }).join('');

    const nav = document.createElement('nav');
    nav.id = 'matrixNav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'MATRIXON main navigation');
    nav.innerHTML = `
      <a id="matrixNavBrand" href="learning.html">MATRIX<span>ON</span></a>
      <div class="mnav-div"></div>
      <div id="mnavHamburger" role="button" aria-label="Toggle menu" tabindex="0">
        <span></span><span></span><span></span>
      </div>
      <div class="mnav-links" id="mnavLinks">${linksHTML}</div>
      <div class="mnav-right">
        <span id="mnavPing" data-ping>—</span>
        ${username ? `<span id="mnavUser">▸ ${username}</span>` : ''}
        <button id="mnavLogout" title="Sign out">⏻ EXIT</button>
      </div>
    `;

    document.body.prepend(nav);
    document.body.classList.add('matrixNavActive');

    // Hamburger toggle
    const ham = document.getElementById('mnavHamburger');
    const links = document.getElementById('mnavLinks');
    ham.addEventListener('click', () => links.classList.toggle('open'));
    ham.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') links.classList.toggle('open'); });

    // Logout
    document.getElementById('mnavLogout').addEventListener('click', () => {
      if (confirm('Exit MATRIXON?')) {
        if (window.MatrixAuth) window.MatrixAuth.logout();
        else { localStorage.clear(); window.location.href = 'index.html'; }
      }
    });
  }

  // ── INIT ──────────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    buildNav();
  }

  if (document.body) { init(); }
  else { document.addEventListener('DOMContentLoaded', init); }
})();