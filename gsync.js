/* === gsync.js — BED → Google Sheets (FINAL: dual-source + 1-decimal groups) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () =>
  location.pathname.toLowerCase().includes('/peer/') ||
  /PEER REVIEW FORM/i.test(document.body.innerText)
    ? 'peer'
    : 'team';

/* ---------- DOM utilities ---------- */
function qAll(root, sel) { return Array.from((root || document).querySelectorAll(sel)); }
function normTxt(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

/* ---------- PASS A: read “SCORE BY GROUP” block near its heading ---------- */
function extractGroupsFromHeading() {
  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };

  // find the SCORE BY GROUP anchor
  let anchor = null;
  for (const el of qAll(document, '*')) {
    const txt = el && el.textContent ? el.textContent : '';
    if (/SCORE\s*BY\s*GROUP/i.test(txt)) { anchor = el; break; }
  }
  if (!anchor) return out;

  // collect text of the next siblings (covers rows, divs, flex lines)
  let text = '';
  let n = anchor.nextElementSibling;
  for (let i = 0; i < 12 && n; i++, n = n.nextElementSibling) {
    text += ' ' + (n.textContent || '');
  }
  text = normTxt(text);

  // robust label patterns
  const label = {
    hosp: /hospitality\s*skills/i,
    bed: /bed[\s\S]{0,10}?competencies/i,
    own: /taking\s*ownership/i,
    coll: /collaboration/i
  };

  const tryMatch = (rx) => {
    const m = new RegExp(`${rx.source}.{0,80}?(\\d{1,3})\\s*%`, 'i').exec(text);
    return m ? Number(m[1]) : '';
  };

  const hosp = tryMatch(label.hosp);
  const bed  = tryMatch(label.bed);
  const own  = tryMatch(label.own);
  const coll = tryMatch(label.coll);

  if (hosp !== '') out['Hospitality skills'] = hosp;
  if (bed  !== '') out['BED competencies']   = bed;
  if (own  !== '') out['Taking ownership']   = own;
  if (coll !== '') out['Collaboration']      = coll;

  return out;
}

/* ---------- PASS B: compute from statements table if anything missing ---------- */
function extractGroupsFromStatements() {
  // return { key: {sum, count} } using rows under #pdfStatements / #pdfStatementRows
  const acc = {
    'Hospitality skills': { sum:0, count:0 },
    'BED competencies':   { sum:0, count:0 },
    'Taking ownership':   { sum:0, count:0 },
    'Collaboration':      { sum:0, count:0 }
  };

  const alias = [
    { key: 'Hospitality skills', rx: /hospitality\s*skills/i },
    { key: 'BED competencies',  rx: /bed[\s\S]{0,10}?competencies/i },
    { key: 'Taking ownership',  rx: /taking\s*ownership/i },
    { key: 'Collaboration',     rx: /collaboration/i }
  ];

  const rows = qAll(document, '#pdfStatements tbody tr, #pdfStatementRows tr');
  rows.forEach(tr => {
    const cells = tr.querySelectorAll('td,th');
    if (!cells || cells.length === 0) return;

    // Try to find a score in a cell with class "score" or use last numeric in the row
    let score = '';
    const scoreCell = tr.querySelector('.score');
    if (scoreCell) {
      score = N(scoreCell.textContent || '');
    } else if (cells.length >= 4) {
      score = N(cells[3].textContent || '');
    } else {
      const m = /(\d{1,2})\s*$/.exec(tr.textContent || '');
      if (m) score = Number(m[1]);
    }
    if (score === '' || isNaN(score)) return;

    // Decide which group this row belongs to by row text
    const rowTxt = normTxt(tr.textContent || '');
    for (const a of alias) {
      if (a.rx.test(rowTxt)) {
        acc[a.key].sum += score;
        acc[a.key].count += 1;
        break;
      }
    }
  });

  // Convert averages (1–5) to percentages (keep 1 decimal to match PDF rounding)
  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
  Object.keys(acc).forEach(k => {
    if (acc[k].count > 0) {
      out[k] = Number(((acc[k].sum / acc[k].count) / 5 * 100).toFixed(1));
    }
  });
  return out;
}

/* ---------- Combined extractor: Pass A then fill gaps with Pass B ---------- */
function extractGroupScores() {
  const a = extractGroupsFromHeading();
  const missing = Object.keys(a).filter(k => a[k] === '');
  if (missing.length === 0) return a;

  const b = extractGroupsFromStatements();
  missing.forEach(k => {
    if (b[k] !== '') a[k] = b[k];
  });
  return a;
}

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

  // groups (dual-source)
  const groups = extractGroupScores();

  // recommendation
  const recommendation = T(root.querySelector('#pdfBandText, .rec-text, #recText'));

  // Q1..Q35 (4th column in statements table)
  const answers = (() => {
    const arr = [];
    const rows = qAll(document, '#pdfStatements tbody tr, #pdfStatementRows tr');
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
