/* === gsync.js — BED → Google Sheets (TEMP: no-CORS + de-dupe + robust groups) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () => location.pathname.toLowerCase().includes('/peer/') ||
                    /PEER REVIEW FORM/i.test(document.body.innerText) ? 'peer' : 'team';

/* ---------- read the rendered PDF content ---------- */
function readPDF() {
  const root = document.querySelector('#pdfReport') || document;

  // person fields
  const teamMemberName  = T(root.querySelector('#pdfEmpName, #infoTeamName'));
  const teamMemberEmail = T(root.querySelector('#pdfEmpEmail, #infoTeamEmail'));
  const teamMemberLoc   = T(root.querySelector('#pdfEmpHotel, #infoTeamLoc'));
  const peerName        = T(root.querySelector('#pdfPeerName, #infoPeerName'));
  const peerEmail       = T(root.querySelector('#pdfPeerEmail, #infoPeerEmail'));
  const peerLoc         = T(root.querySelector('#pdfPeerHotel, #infoPeerLoc'));

  // overall %
  const overallPct = N(T(root.querySelector('#pdfTotalPct, #pdfScorePct, #pdfOverallPct, #scorePercent')));

  // groups — robust: scan known tables first, then any row where col1 matches a group name
  const groups = (() => {
    const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
    const tableScopes = [
      '#pdfGroupRows tr', '.group-scores tr', '#scoreByGroup tr', '#pdfGroups tr',
      '#pdfReport table tr'
    ];
    for (const sel of tableScopes) {
      const rows = root.querySelectorAll(sel);
      rows.forEach(tr => {
        const td = tr.querySelectorAll('td,th');
        if (td.length < 2) return;
        const labelRaw = T(td[0]); // e.g., "Score BED competencies"
        const label = labelRaw.replace(/^Score\s+/i,'').trim();
        const name = normalizeGroup(label);
        if (!name) return;
        // % might be in 2nd or 3rd cell, sometimes with a trailing '%'
        const idx = td.length >= 3 ? 2 : 1;
        const pct = N(T(td[idx]));
        if (!Number.isNaN(pct) && pct !== '') out[name] = pct;
      });
      // if all four are filled, stop scanning
      if (Object.values(out).every(v => v !== '')) break;
    }
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

function normalizeGroup(label) {
  const n = (label || '').toLowerCase();
  if (n.includes('hospitality skills')) return 'Hospitality skills';
  if (n.includes('bed competencies') || n.includes('hospitality competencies')) return 'BED competencies';
  if (n.includes('taking ownership')) return 'Taking ownership';
  if (n.includes('collaboration')) return 'Collaboration';
  return null;
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
  // TEMP: use no-cors to bypass preflight; response is opaque
  try {
    const res = await fetch(WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('[BED] POST sent (no-cors)', res.status || 'OK');
  } catch (e) {
    console.error('BED POST failed', e);
  }
}

/* prefer repo-native builders, else our PDF reader */
function getPayload() {
  if (typeof window.buildPayloadPDF === 'function') return window.buildPayloadPDF();
  if (typeof window.buildPayloadFromPdf === 'function') return window.buildPayloadFromPdf();
  return buildPayload();
}

/* ---------- single-run sync orchestration (de-dupe) ---------- */
window.__bedSaved = false;
window.__bedSaving = false;

function markSaving() {
  window.__bedSaving = true;
  try { __bedMo && __bedMo.disconnect && __bedMo.disconnect(); } catch(_) {}
}

window.syncToSheet = async function () {
  if (window.__bedSaved || window.__bedSaving) return;
  markSaving(); // set immediately to avoid double fire
  try {
    const payload = getPayload();
    console.log('[BED] payload', payload); // TEMP
    await postToSheet(payload);
    window.__bedSaved = true;
  } catch (e) {
    console.error('BED sync failed', e);
    // allow retry once if needed
    window.__bedSaving = false;
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
  if (window.__bedSaved || window.__bedSaving) return true;
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
let __bedMo = new MutationObserver(() => {
  if (triggerWhenPdfReady()) { try { __bedMo.disconnect(); } catch(_) {} }
});
__bedMo.observe(document.body, { childList: true, subtree: true });

/* last-resort timeout */
setTimeout(() => {
  if (!window.__bedSaved && !window.__bedSaving) {
    console.warn('[BED] timeout fallback → trying sync once');
    triggerWhenPdfReady();
  }
}, 9000);
