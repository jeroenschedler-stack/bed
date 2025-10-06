/* === gsync.js — BED → Google Sheets (PDF-driven sync, TEMP with payload log) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () => {
  if (location.pathname.toLowerCase().includes('/peer/')) return 'peer';
  return /PEER REVIEW FORM/i.test(document.body.innerText) ? 'peer' : 'team';
};

/* ---------- read the rendered PDF content ---------- */
function readPDF() {
  const root = document.querySelector('#pdfReport') || document;

  // person fields (use PDF ids, fall back to info panel ids if present)
  const teamMemberName  = T(root.querySelector('#pdfEmpName, #infoTeamName'));
  const teamMemberEmail = T(root.querySelector('#pdfEmpEmail, #infoTeamEmail'));
  const teamMemberLoc   = T(root.querySelector('#pdfEmpHotel, #infoTeamLoc'));
  const peerName        = T(root.querySelector('#pdfPeerName, #infoPeerName'));
  const peerEmail       = T(root.querySelector('#pdfPeerEmail, #infoPeerEmail'));
  const peerLoc         = T(root.querySelector('#pdfPeerHotel, #infoPeerLoc'));

  // overall %
  const overallPct = N(T(root.querySelector('#pdfTotalPct, #pdfScorePct, #pdfOverallPct, #scorePercent')));

  // groups (supports "Score X" labels; robust % cell index)
  const groups = (() => {
    const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
    root.querySelectorAll('#pdfGroupRows tr, .group-scores tr').forEach(tr => {
      const td = tr.querySelectorAll('td,th');
      if (td.length >= 2) {
        const labelRaw = T(td[0]);                           // e.g., "Score BED competencies"
        const label = labelRaw.replace(/^Score\s+/i, '').trim();
        const idx = td.length >= 3 ? 2 : 1;                  // prefer 3rd cell if present
        const pct = N(T(td[idx]));
        if (label in out) out[label] = pct;
      }
    });
    return out;
  })();

  // recommendation
  const recommendation = T(root.querySelector('#pdfBandText, .rec-text, #recText'));

  // Q1..Q35 (4th column in statements table)
  const answers = (() => {
    const arr = [];
    const rows = root.querySelectorAll('#pdfStatements tbody tr, #pdfStatementRows tr');
    rows.forEach(tr => {
      const c = tr.querySelectorAll('td,th');
      if (c.length >= 4) arr.push(N(T(c[3])));
    });
    while (arr.length < 35) arr.push('');
    return arr.slice(0, 35);
  })();

  return {
    teamMemberName, teamMemberEmail, teamMemberLocation: teamMemberLoc,
    peerName, peerEmail, peerLocation: peerLoc,
    overallPct, groups, recommendation, answers
  };
}

/* ---------- payload + post ---------- */
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
  try {
    const res = await fetch(WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',                // TEMP bypass for CORS
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('[BED] POST sent (no-cors mode)', res.status || 'OK');
  } catch (e) {
    console.error('BED sync failed', e);
  }
}


/* prefer repo-native builders, else our PDF reader */
function getPayload() {
  if (typeof window.buildPayloadPDF === 'function') return window.buildPayloadPDF();
  if (typeof window.buildPayloadFromPdf === 'function') return window.buildPayloadFromPdf();
  return buildPayload();
}

/* ---------- single-run sync orchestration ---------- */
window.__bedSaved = false;

window.syncToSheet = async function () {
  if (window.__bedSaved) return;
  try {
    const payload = getPayload();
    if (!window.__bedSaved) console.log('[BED] payload', payload); // TEMP: log once for verification
    await postToSheet(payload);
    window.__bedSaved = true;
    if (window.onBedSaved) { try { window.onBedSaved(); } catch (_) {} }
  } catch (e) {
    console.error('BED sync failed', e);
  }
};

/* ---------- triggers: event + DOM watch + timeout ---------- */
function waitForPDFReady(timeoutMs = 8000) {
  return new Promise(resolve => {
    const start = Date.now();
    (function tick() {
      const ready = document.querySelector('#pdfStatementRows tr, #pdfStatements tbody tr');
      if (ready) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 120);
    })();
  });
}

function triggerWhenPdfReady() {
  const found = document.querySelector('#pdfStatementRows tr, #pdfStatements tbody tr, #statementsTable tr');
  if (found) {
    console.log('[BED] PDF detected → syncing…');
    window.syncToSheet();
    return true;
  }
  return false;
}

/* fire when your code dispatches the event */
document.addEventListener('bed:pdf-ready', async () => {
  console.log('[BED] event bed:pdf-ready received');
  const ok = await waitForPDFReady(8000);
  setTimeout(() => triggerWhenPdfReady(), ok ? 200 : 800);
}, { once: true });

/* universal fallback: watch for PDF rows appearing */
const __bedMo = new MutationObserver(() => {
  if (triggerWhenPdfReady()) __bedMo.disconnect();
});
__bedMo.observe(document.body, { childList: true, subtree: true });

/* last-resort timeout (no duplicate due to __bedSaved) */
setTimeout(() => {
  if (!window.__bedSaved) {
    console.warn('[BED] timeout fallback → trying sync once');
    triggerWhenPdfReady();
  }
}, 9000);
