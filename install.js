/* install.js — BED PWA install + SW register (safe for subpaths) */

(function () {
  // ----- Service Worker (register once, safe relative paths) -----
  if ('serviceWorker' in navigator) {
    // If your app is served at https://domain/bed/, keep './sw.js' and './' scope.
    // If served at the domain root, you may switch to '/sw.js' and '/'.
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(err => console.warn('SW register failed:', err));
  }

  // ----- UI helpers (non-fatal if elements don’t exist) -----
  const $ = (sel) => document.querySelector(sel);
  const installBtn = $('#btn-install') || document.querySelector('[data-install]');
  const installBar = $('#install-bar') || document.querySelector('[data-install-bar]');

  function showInstallUI(show) {
    if (installBar) installBar.style.display = show ? '' : 'none';
    if (installBtn) installBtn.style.display = show ? '' : 'none';
  }

  // Hide install UI if already installed (standalone)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator.standalone === true); // iOS Safari

  if (isStandalone) showInstallUI(false);

  // ----- beforeinstallprompt flow (Android/Chromium) -----
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop the mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    // Show your own prompt
    if (!isStandalone) showInstallUI(true);
  });

  // Handle click on your install button
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      try {
        if (!deferredPrompt) {
          // Fallback hint for iOS (no beforeinstallprompt)
          if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
            alert('Add to Home Screen:\nShare • Add to Home Screen');
          }
          return;
        }
        showInstallUI(false);
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        // Optional: log outcome === 'accepted' or 'dismissed'
        deferredPrompt = null;
      } catch (err) {
        console.warn('Install prompt failed:', err);
      }
    });
  }

  // Hide UI when installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstallUI(false);
  });

  // ----- Optional: reveal a hint if no event fired after a delay (iOS) -----
  // If you have a custom hint element, you can reveal it here.
  // setTimeout(() => { if (!deferredPrompt && !isStandalone) showInstallUI(true); }, 2500);

})();
