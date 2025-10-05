/* === gsync.js — PDF-only export for your current HTML === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw9H2ym5NFEZfhO3AU0fUdphhorYv3KuxbS6z4qjAqrdVtDuGWLo0_qLmD-0WPf5uMK/exec';

/* helpers */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s||'').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () => location.pathname.toLowerCase().includes('/peer/') ? 'peer' : 'team';

/* read strictly from #pdfReport */
function readPDF() {
  const root = document.querySelector('#pdfReport');
  return {
    // info
    teamMemberName:  T(root.querySelector('#pdfEmpName')),
    teamMemberEmail: T(root.querySelector('#pdfEmpEmail')),
    teamMemberLocation: T(root.querySelector('#pdfEmpHotel')),
    peerName:        T(root.querySelector('#pdfPeerName')),
    peerEmail:       T(root.querySelector('#pdfPeerEmail')),
    peerLocation:    T(root.querySelector('#pdfPeerHotel')),
    // overall %
    overallPct: N(T(root.querySelector('#pdfTotalPct, #pdfScorePct, #pdfOverallPct'))),
    // groups table: first cell is label text “Score X”, second cell is %
    groups: (() => {
      const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
      root.querySelectorAll('#pdfGroupRows tr').forEach(tr => {
        const td = tr.querySelectorAll('td,th');
        if (td.length >= 2) {
          const labelRaw = T(td[0]);           // e.g., "Score Hospitality skills"
          const label = labelRaw.replace(/^Score\s+/i,'').trim();
          const pct = N(T(td[1]));
          if (label in out) out[label] = pct;
        }
      });
      return out;
    })(),
    // recommendation: band text block under SCORE SUMMARY
    recommendation: T(root.querySelector('#pdfBandText')),
    // Q1..Q35 from statements table (4th column = score)
    answers: (() => {
      const arr = [];
      const rows = root.querySelectorAll('#pdfStatements tbody tr, #pdfStatementRows tr');
      rows.forEach(tr => {
        const c = tr.querySelectorAll('td,th');
        if (c.length >= 4) arr.push(N(T(c[3])));
      });
      while (arr.length < 35) arr.push('');
      return arr.slice(0,35);
    })()
  };
}

function buildPayload() {
  const d = readPDF();
  return {
    mode: MODE(),
    timestamp: new Date().toISOString(),
    teamMemberName: d.teamMemberName,
    teamMemberEmail: d.teamMemberEmail,
    teamMemberLocation: d.teamMemberLocation,
    peerName: d.peerName,
    peerEmail: d.peerEmail,
    peerLocation: d.peerLocation,
    overallPct: d.overallPct,
    groups: d.groups,
    recommendation: d.recommendation,
    answers: d.answers
  };
}

async function postToSheet(payload) {
  await fetch(WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/* === FINAL: no alerts, save-once, notify page === */
window.__bedSaved = false;

window.syncToSheet = async function(){
  if (window.__bedSaved) return;          // prevent duplicates
  try {
    await postToSheet(buildPayloadPDF()); // your existing send
    window.__bedSaved = true;
    if (window.onBedSaved) {              // triggers "Your assessment is recorded."
      try { window.onBedSaved(); } catch(_) {}
    }
  } catch (e) {
    console.error('BED sync failed', e);  // no alerts
  }
};

/* wait until PDF statements rows exist (built by buildPdfReport) */
function waitForPDFReady(timeoutMs = 8000) {
  return new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      const ready = document.querySelector('#pdfStatementRows tr, #pdfStatements tbody tr');
      if (ready) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 120);
    };
    tick();
  });
}

/* === FINAL trigger (once) — no duplicates === */
document.addEventListener('bed:pdf-ready', async () => {
  const ok = await waitForPDFReady(8000);
  setTimeout(() => window.syncToSheet(), ok ? 200 : 800);
}, { once: true });
