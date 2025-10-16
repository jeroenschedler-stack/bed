let deferredPrompt;
const btn = document.getElementById('btnInstall');

// Always show the button only on pages that have it (landing page)
if (btn) btn.style.display = 'block';

// Handle installable prompt when available (guard every reference to btn)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Only try to show the button if it exists on this page
  if (btn) btn.style.display = 'block';
});

// Click to install (works only on landing; harmless elsewhere)
btn?.addEventListener('click', async () => {
  // Detect if already installed
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;

  if (isStandalone) {
    const note = document.querySelector('.install-note');
    // Remove any old message first
    document.getElementById('installedMsg')?.remove();

    const msg = document.createElement('p');
    msg.id = 'installedMsg';
    // Red warning text, no checkmark
    msg.innerHTML = '<span style="color:#d32f2f;">BED 2.0 is already installed on your device.</span>';
    msg.style.cssText = 'font-size:13px; text-align:left; margin-top:8px; line-height:1.4;';
    (note || btn)?.insertAdjacentElement('afterend', msg);
    return;
  }

  // Otherwise, proceed with install prompt (only if we received it)
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (btn) btn.style.display = 'none';
});

// Register service worker (GitHub Pages path) – harmless to call from any page
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/bed/sw.js');
}

// Optional iOS fallback hint
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
  // show small text like “Share → Add to Home Screen”
}
