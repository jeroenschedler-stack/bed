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
