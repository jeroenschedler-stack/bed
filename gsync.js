/* === gsync.js — BED → Google Sheets (FINAL BULLETPROOF BUILD) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () =>
  location.pathname.toLowerCase().includes('/peer/') ||
  /PEER REVIEW FORM/i.test(document.body.innerText)
    ? 'peer'
    : 'team';

/* ---------- ultra-robust group extraction ---------- */
/* Strategy:
   1) Start at the “SCORE BY GROUP” heading if present; expand context.
   2) For each target group, scan nearby DOM for the first NN% (handles spans/divs/split text).
   3) Fallback: full-page scan for each group alias.
*/
function extractGroupScores() {
  const targets = [
    { key: 'Hospitality skills', rx: /hospitality\s*skills/i },
    { key: 'BED competencies',  rx: /bed[\s\-]*competencies/i },
    { key: 'Taking ownership',  rx: /taking\s*ownership/i },
    { key: 'Collaboration',     rx: /collaboration/i }
  ];

  // 1) Find SCORE BY GROUP anchor (if any)
  let anchor = null;
  const allEls = document.querySelectorAll('*');
  for (const el of allEls) {
    if (el.firstChild && el.firstChild.nodeType === 3) {
      if (/SCORE\s*BY\s*GROUP/i.test(el.firstChild.textContent || '')) { anchor = el; break; }
    }
    if (/SCORE\s*BY\s*GROUP/i.test(el.textContent || '')) { anchor = el; break; }
  }

  // Utility: collect text from element + next siblings (limited)
  function collectNeighborhoodText(startEl, blocks = 12) {
    let text = (startEl?.textContent || '');
    let n = startEl?.nextElementSibling || null;
    let count = 0;
    while (n && count < blocks) { text += ' \n ' + (n.textContent || ''); n = n.nextElementSibling; count++; }
    return text.replace(/\s+/g, ' ');
  }

  // Utility: TreeWalker to find nearest percentage around a node index window
  function findPercentNear(el, winNodes = 40) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (tw.nextNode()) nodes.push(tw.currentNode);
    // scan forward first number% within a small window
    const rePct = /(\d{1,3})\s*%/;
    for (let i = 0; i < Math.min(nodes.length, winNodes); i++) {
      const m = rePct.exec(nodes[i].textContent || '');
      if (m) return Number(m[1]);
    }
    // fallback scan entire el
    const m2 = rePct.exec(el.textContent || '');
    return m2 ? Number(m2[1]) : '';
  }

  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };

  // 2) Preferred: scan the neighborhood around the SCORE BY GROUP anchor
  if (anchor) {
    // Try to match line pairs “<group> … NN%”
    const neighText = collectNeighborhoodText(anchor, 12);
    targets.forEach(t => {
      const rx = new RegExp(`(${t.rx.source}).{0,80}?(\\d{1,3})\\s*%`, 'i'); // up to 80 chars between name and %
      const m = rx.exec(neighText);
      if (m) out[t.key] = Number(m[2]);
    });

    // For any still empty, do DOM-near scan: find element whose text matches the label, then look nearby nodes for NN%
    targets.forEach(t => {
      if (out[t.key] !== '') return;
      // find best candidate element near anchor whose text matches the label
      let labelEl = null;
      const searchScope = anchor.parentElement || document.body;
      const scopeEls = searchScope.querySelectorAll('*');
      for (const el of scopeEls) {
        const txt = (el.textContent || '').replace(/\s+/g, ' ');
        if (t.rx.test(txt)) { labelEl = el; break; }
      }
      if (labelEl) {
        // look inside label container first
        let pct = findPercentNear(labelEl, 25);
        if (pct === '' && labelEl.parentElement) pct = findPercentNear(labelEl.parentElement, 40);
        if (pct === '' && labelEl.nextElementSibling) pct = findPercentNear(labelEl.nextElementSibling, 25);
        if (pct !== '') out[t.key] = pct;
      }
    });
  }

  // 3) Final fallback: full-page tolerant scan for each group separately
  const page = (document.body.innerText || '').replace(/\s+/g, ' ');
  targets.forEach(t => {
    if (out[t.key] !== '') return;
    const rx = new RegExp(`${t.rx.source}\\s*:?\\s*[–\\-•:]?\\s*(\\d{1,3})\\s*%`, 'i');
    const m = rx.exec(page);
    if (m) out[t.key] = Number(m[1]);
  });

  return out;
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

  // groups
  const groups = extractGroupScores();

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
