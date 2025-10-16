let deferredPrompt;
const btn = document.getElementById('btnInstall');

// Always show the button
btn.style.display = 'block';

// Handle installable prompt when available
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

btn?.addEventListener('click', async () => {
  // Detect if already installed
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;

  // If already installed → show message
  if (isStandalone) {
    const note = document.querySelector('.install-note');
    // Remove any old message first
    document.getElementById('installedMsg')?.remove();

    const msg = document.createElement('p');
    msg.id = 'installedMsg';
    msg.innerHTML =
      '<span style="color:#1E90FF;">&#10003;</span> ' +
      '<span style="color:#d32f2f;">BED 2.0 is already installed on your device.</span>';
    msg.style.cssText =
      'font-size:13px; text-align:left; margin-top:8px; line-height:1.4;';
    (note || btn)?.insertAdjacentElement('afterend', msg);
    return;
  }

  // Otherwise, proceed with install prompt
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

// Register service worker (GitHub Pages path)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/bed/sw.js');
}

// Optional iOS fallback hint
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
  // show small text like “Share → Add to Home Screen”
}
