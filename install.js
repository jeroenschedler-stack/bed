let deferredPrompt;
const btn = document.getElementById('btnInstall');

// Detect install availability
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btn.style.display = 'inline-block';
});

// Handle click
btn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  btn.style.display = 'none';
  deferredPrompt = null;
});

// Hide if already installed
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (standalone && btn) btn.style.display = 'none';

// iOS hint (optional)
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
  btn.textContent = 'Add via Share → Add to Home Screen';
  btn.style.display = 'inline-block';
}

// Register service worker
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
