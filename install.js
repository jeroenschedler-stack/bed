let deferredPrompt;
const btn = document.getElementById('btnInstall');

// Show button when installable (Android/Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btn) btn.style.display = 'inline-block';
});

btn?.addEventListener('click', async () => {
  // Detect if already installed
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;

  if (isStandalone) {
    const msg = document.createElement('p');
    msg.textContent = 'BED 2.0 is already installed on your device.';
    msg.style.cssText =
      'font-size:13px; color:#d32f2f; text-align:left; margin-top:8px; line-height:1.4;';
    document.querySelector('#btnInstall')?.insertAdjacentElement('afterend', msg);
    return;
  }

  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (btn) btn.style.display = 'none';
});

// Hide button if app already installed
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone;
if (isStandalone && btn) btn.style.display = 'none';

// Register service worker (GitHub Pages path)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/bed/sw.js');
}

// Optional iOS fallback hint
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
  // show small text like “Share → Add to Home Screen”
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/bed/sw.js?v=2');
}
