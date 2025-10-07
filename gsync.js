/* === gsync.js — BED → Google Sheets (FINAL: reconcile groups to overall when uniform) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () =>
  location.pathname.toLowerCase().includes('/peer/') ||
  /PEER REVIEW FORM/i.test(document.body.innerText) ? 'peer' : 'team';
const qAll = (root, sel) => Array.from((root || document).querySelectorAll(sel));
const normTxt = s => (s || '').replace(/\s+/g, ' ').trim();

/* ---------- PASS A: read “SCORE BY GROUP” block ---------- */
function extractGroupsFromHeading() {
  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };

  let anchor = null;
  for (const el of qAll(document, '*')) {
    if (/SCORE\s*BY\s*GROUP/i.test(el.textContent || '')) { anchor = el; break; }
  }
  if (!anchor) return out;

  let text = '';
  let n = anchor.nextElementSibling;
  for (let i = 0; i < 12 && n; i++, n = n.nextElementSibling) text += ' ' + (n.textContent || '');
  text = normTxt(text);

  const label = {
    hosp: /hospitality\s*skills/i,
    bed: /bed[\s\S]{0,10}?competencies/i,
    own: /taking\s*ownership/i,
    coll: /collaboration/i
  };
  const tryMatch = rx => {
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

/* ---------- PASS B: compute averages from statement scores (1 decimal) ---------- */
function extractGroupsFromStatements() {
  const acc = {
    'Hospitality skills': { sum:0, count:0 },
    'BED competencies':   { sum:0, count:0 },
    'Taking ownership':   { sum:0, count:0 },
    'Collaboration':      { sum:0, count:0 }
  };
  const alias = [
    { key:'Hospitality skills', rx:/hospitality\s*skills/i },
    { key:'BED competencies',  rx:/bed[\s\S]{0,10}?competencies/i },
    { key:'Taking ownership',  rx:/taking\s*ownership/i },
    { key:'Collaboration',     rx:/collaboration/i }
  ];

  const rows = qAll(document, '#pdfStatements tbody tr, #pdfStatementRows tr');
  rows.forEach(tr => {
    const cells = tr.querySelectorAll('td,th');
    if (!cells.length) return;

    let score = '';
    const scoreCell = tr.querySelector('.score');
    if (scoreCell) score = N(scoreCell.textContent);
    else if (cells.length >= 4) score = N(cells[3].textContent);
    else {
      const m = /(\d{1,2})\s*$/.exec(tr.textContent || '');
      if (m) score = Number(m[1]);
    }
    if (score === '' || isNaN(score)) return;

    const rowTxt = normTxt(tr.textContent || '');
    for (const a of alias) {
      if (a.rx.test(rowTxt)) { acc[a.key].sum += score; acc[a.key].count++; break; }
    }
  });

  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
  Object.keys(acc).forEach(k => {
    if (acc[k].count > 0) {
      out[k] = Number(((acc[k].sum / acc[k].count) / 5 * 100).toFixed(1)); // 1 decimal
    }
  });
  return out;
}

/* ---------- Combined extractor: prefer Pass B, fill gaps from Pass A ---------- */
function extractGroupScores() {
  const b = extractGroupsFromStatements();
  if (Object.values(b).every(v => v !== '')) return b;
  const a = extractGroupsFromHeading();
  const out = { ...b };
  for (const k in a) if (out[k] === '' && a[k] !== '') out[k] = a[k];
  return out;
}

/* ---------- read rendered PDF ---------- */
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

  // groups (prefer B, fill with A)
  let groups = extractGroupScores();

  // answers (for uniform-detection)
  const answers = (() => {
    const arr = [];
    qAll(document, '#pdfStatements tbody tr, #pdfStatementRows tr').forEach(tr => {
      const c = tr.querySelectorAll('td,th');
      if (c.length >= 4) {
        const v = N(T(c[3]));
        if (v !== '' && !isNaN(v)) arr.push(v);
      }
    });
    while (arr.length < 35) arr.push('');
    return arr.slice(0, 35);
  })();

  // --- Reconcile: if all non-empty answers are identical, align groups to overallPct ---
  const nonEmpty = answers.filter(v => v !== '');
  const allSame = nonEmpty.length > 0 && nonEmpty.every(v => v === nonEmpty[0]);
  if (allSame && typeof overallPct === 'number' && !isNaN(overallPct) && overallPct !== '') {
    const g = {};
    Object.keys(groups).forEach(k => g[k] = Number(overallPct)); // set each group to overall
    groups = g;
  }

  // recommendation
  const recommendation = T(root.querySelector('#pdfBandText, .rec-text, #recText'));

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
  const res = await fetch(WEBAPP_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(()=>null);
  console.log('[BED] POST result', res.status, json);
}

function getPayload() {
  if (typeof window.buildPayloadPDF === 'function') return window.buildPayloadPDF();
  if (typeof window.buildPayloadFromPdf === 'function') return window.buildPayloadFromPdf();
  return buildPayload();
}

/* ---------- orchestration ---------- */
window.__bedSaved = false;
window.__bedSaving = false;
let __bedMo;
function markSaving(){ window.__bedSaving = true; try{ __bedMo && __bedMo.disconnect && __bedMo.disconnect(); }catch(_){} }
window.syncToSheet = async function(){
  if (window.__bedSaved || window.__bedSaving) return;
  markSaving();
  try { const payload = getPayload(); await postToSheet(payload); window.__bedSaved = true; }
  catch(e){ console.error('BED sync failed', e); window.__bedSaving = false; }
};

function waitForPDFReady(ms=8000){
  return new Promise(res=>{
    const start=Date.now();
    (function tick(){
      const ready=document.querySelector('#pdfStatementRows tr, #pdfStatements tbody tr');
      if(ready) return res(true);
      if(Date.now()-start>ms) return res(false);
      setTimeout(tick,120);
    })();
  });
}
function triggerWhenPdfReady(){
  if(window.__bedSaved||window.__bedSaving) return true;
  const f=document.querySelector('#pdfStatementRows tr, #pdfStatements tbody tr, #statementsTable tr');
  if(f){ console.log('[BED] PDF detected → syncing…'); window.syncToSheet(); return true; }
  return false;
}

document.addEventListener('bed:pdf-ready', async ()=>{
  console.log('[BED] event bed:pdf-ready received');
  const ok = await waitForPDFReady(8000);
  setTimeout(()=>triggerWhenPdfReady(), ok?200:800);
}, { once:true });

__bedMo = new MutationObserver(()=>{
  if (triggerWhenPdfReady()) { try{ __bedMo.disconnect(); }catch(_){} }
});
__bedMo.observe(document.body, { childList:true, subtree:true });

setTimeout(()=>{
  if (!window.__bedSaved && !window.__bedSaving) {
    console.warn('[BED] timeout fallback → trying sync once');
    triggerWhenPdfReady();
  }
}, 9000);
