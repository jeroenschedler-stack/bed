let deferredPrompt;
const btn = document.getElementById('btnInstall');

// Show button when installable (Android/Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btn.style.display = 'inline-block';
});

btn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btn.style.display = 'none';
});

// Detect if running as standalone (already installed)
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone;

if (isStandalone) {
  if (btn) btn.style.display = 'none';

  const msg = document.createElement('p');
  msg.textContent = '✅ BED 2.0 is already installed on your device.';
  msg.style.cssText =
    'font-size:13px; color:#666; text-align:center; margin-top:12px; line-height:1.4;';
  document.querySelector('#btnInstall')?.insertAdjacentElement('afterend', msg);
}

// Register service worker (GitHub Pages path)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/bed/sw.js');
}

// Optional iOS fallback hint
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
  // show small text like “Share → Add to Home Screen”
}
