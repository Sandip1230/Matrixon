/**
 * push.js — MATRIXON Push Notification Manager
 * Include AFTER config.js on every page that should receive notifications.
 *
 * How it works:
 *  1. Registers the service worker (sw.js) on first load.
 *  2. On first login, calls MatrixPush.subscribe() to ask for permission
 *     and save the subscription to the server.
 *  3. Server can then POST to /push/send to broadcast notifications.
 *
 * Usage from any page:
 *   MatrixPush.subscribe();   // asks permission + registers
 *   MatrixPush.unsubscribe(); // removes subscription
 *   MatrixPush.isSubscribed() // returns Promise<boolean>
 */

(function () {
  // ── VAPID PUBLIC KEY ─────────────────────────────────────────────────────────
  // Replace this with your own VAPID public key from the server startup log.
  // Generate with:  node -e "require('web-push').generateVAPIDKeys().then(k=>console.log(k))"
  // Or run the server once — it prints the keys automatically.
  const VAPID_PUBLIC_KEY = window.MATRIXON_VAPID_PUBLIC_KEY || 'BJa3Zhg8lEU63DtJ33LlUr9Ur8YJCUf-WnsGJBQpHz3YADVmMR7p9vgN6mSS_rZHfDS3AdVMuAld9trQSw9H0_8';

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw      = atob(base64);
    const output   = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  function getSW() {
    return navigator.serviceWorker.ready;
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    // Register if not already
    try {
      return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {
      console.warn('[MATRIXON Push] SW registration failed:', e);
      return null;
    }
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────
  window.MatrixPush = {

    /** Returns true if push is supported in this browser */
    isSupported() {
      return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    },

    /** Returns current permission state: 'granted' | 'denied' | 'default' */
    permissionState() {
      return Notification.permission;
    },

    /** Returns Promise<boolean> — true if currently subscribed */
    async isSubscribed() {
      if (!this.isSupported()) return false;
      try {
        const reg = await getSW();
        const sub = await reg.pushManager.getSubscription();
        return !!sub;
      } catch (_) { return false; }
    },

    /**
     * Ask permission and subscribe. Saves subscription to server.
     * Returns 'subscribed' | 'denied' | 'unsupported' | 'error'
     */
    async subscribe() {
      if (!this.isSupported()) return 'unsupported';

      await getRegistration(); // ensure SW is registered

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return 'denied';

      try {
        const reg = await getSW();

        // Unsubscribe existing first (avoids duplicates)
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // Save to server
        const username = localStorage.getItem('matrixon_user') || '';
        await fetch(window.MATRIXON_API + '/push/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username, subscription }),
        });

        localStorage.setItem('matrixon_push_subscribed', '1');
        console.info('[MATRIXON Push] Subscribed ✓');
        return 'subscribed';
      } catch (err) {
        console.error('[MATRIXON Push] Subscribe error:', err);
        return 'error';
      }
    },

    /** Remove push subscription from browser and server */
    async unsubscribe() {
      if (!this.isSupported()) return;
      try {
        const reg = await getSW();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          const username = localStorage.getItem('matrixon_user') || '';
          await fetch(window.MATRIXON_API + '/push/unsubscribe', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username }),
          }).catch(() => {});
        }
        localStorage.removeItem('matrixon_push_subscribed');
        console.info('[MATRIXON Push] Unsubscribed');
      } catch (err) {
        console.error('[MATRIXON Push] Unsubscribe error:', err);
      }
    },

    /**
     * Auto-subscribe silently on login if user had previously said yes.
     * Call this once per page load after MatrixAuth.requireAuth().
     */
    async autoResubscribe() {
      if (!this.isSupported()) return;
      if (localStorage.getItem('matrixon_push_subscribed') !== '1') return;
      const already = await this.isSubscribed();
      if (!already) await this.subscribe();
    },

    /**
     * Show a LOCAL notification immediately (no server needed).
     * Useful for streak reminders, XP milestones triggered client-side.
     */
    async showLocal(title, body, url = 'learning.html') {
      if (Notification.permission !== 'granted') return;
      try {
        const reg = await getSW();
        reg.showNotification(title, {
          body,
          icon:    '/icons/icon-192.png',
          badge:   '/icons/badge-72.png',
          tag:     'matrixon-local',
          data:    { url },
          vibrate: [80, 40, 80],
        });
      } catch (_) {
        // Fallback — basic Notification API
        new Notification(title, { body });
      }
    },
  };

  // ── AUTO-BOOT ─────────────────────────────────────────────────────────────────
  // Register SW immediately (silently) so it's ready for future use.
  // Auto-resubscribe if previously subscribed.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      getRegistration();
      window.MatrixPush.autoResubscribe();
    });
  } else {
    getRegistration();
    window.MatrixPush.autoResubscribe();
  }

  console.info('[MATRIXON Push] Ready. Permission:', Notification.permission);
})();