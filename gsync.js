/* === gsync.js — BED → Google Sheets (FINAL, FULL-PAGE, ULTRA-ROBUST BUILD) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () =>
  location.pathname.toLowerCase().includes('/peer/') ||
  /PEER REVIEW FORM/i.test(document.body.innerText)
    ? 'peer'
    : 'team';

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

  // groups — ultra-robust parser for SCORE BY GROUP block
  const groups = (() => {
    const out = {
      'Hospitality skills': '',
      'BED competencies': '',
      'Taking ownership': '',
      'Collaboration': ''
    };

    // scan full-page text (handles all line breaks, hidden chars)
    let text = document.body.innerText || '';
    text = text.replace(/\s+/g, ' '); // normalize whitespace

    // match "BED competencies" with any hidden chars between words
    const regex = /(Hospitality skills|BED[\s\S]{0,10}?competencies|Taking ownership|Collaboration)\s*:?[\s\-]*?(\d+)\s*%/gi;

    let match;
    while ((match = regex.exec(text))) {
      let name = match[1]
        .replace(/BED[\s\S]{0,10}?competencies/i, 'BED competencies')
        .replace(/\s+/g, ' ')
        .trim();
      const pct = Number(match[2]);
      if (name in out) out[name] = pct;
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

// --- POST (permanent, CORS-safe, expect 200 + JSON)
async function postToSheet(payload) {
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids preflight
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  console.log('[BED] POST result', res.status, json);
}

/* ---------- choose builder ---------- */
function getPayload() {
  if (typeof window.buildPayloadPDF === 'function') return window.buildPayloadPDF();
  if (typeof window.buildPayloadFromPdf === 'function') return window.buildPayloadFromPdf();
  return buildPayload();
}

/* ---------- single-run sync orchestration (de-dupe) ---------- */
window.__bedSaved = false;
window.__bedSaving = false;
let __bedMo;

function markSaving() {
  window.__bedSaving = true;
  try { __bedMo && __bedMo.disconnect && __bedMo.disconnect(); } catch (_) {}
}

window.syncToSheet = async function () {
  if (window.__bedSaved || window.__bedSaving) return;
  markSaving();
  try {
    const payload = getPayload();
    await postToSheet(payload);
    window.__bedSaved = true;
  } catch (e) {
    console.error('BED sync failed', e);
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

/* fired when PDF generation finishes */
document.addEventListener('bed:pdf-ready', async () => {
  console.log('[BED] event bed:pdf-ready received');
  const ok = await waitForPDFReady(8000);
  setTimeout(() => triggerWhenPdfReady(), ok ? 200 : 800);
}, { once: true });

/* fallback: watch DOM for PDF rows */
__bedMo = new MutationObserver(() => {
  if (triggerWhenPdfReady()) { try { __bedMo.disconnect(); } catch (_) {} }
});
__bedMo.observe(document.body, { childList: true, subtree: true });

/* last-resort timeout */
setTimeout(() => {
  if (!window.__bedSaved && !window.__bedSaving) {
    console.warn('[BED] timeout fallback → trying sync once');
    triggerWhenPdfReady();
  }
}, 9000);
