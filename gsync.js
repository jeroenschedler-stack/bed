/* === gsync.js — PDF-only export to Google Sheets === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw9H2ym5NFEZfhO3AU0fUdphhorYv3KuxbS6z4qjAqrdVtDuGWLo0_qLmD-0WPf5uMK/exec';

function t(el){ return el ? (el.textContent || '').trim() : ''; }
function n(s){ const m=(s||'').match(/-?\d+(\.\d+)?/); return m?Number(m[0]):''; }
function mode(){ return location.pathname.toLowerCase().includes('/peer/') ? 'peer' : 'team'; }

/* ---- PDF readers (only inside #pdfReport) ---- */
function readInfoPDF(root){
  return {
    teamMemberName:  t(root.querySelector('#pdfEmpName')),
    teamMemberEmail: t(root.querySelector('#pdfEmpEmail')),
    teamMemberLocation: t(root.querySelector('#pdfEmpHotel')),
    peerName:        t(root.querySelector('#pdfPeerName')),
    peerEmail:       t(root.querySelector('#pdfPeerEmail')),
    peerLocation:    t(root.querySelector('#pdfPeerHotel'))
  };
}

function readOverallPDF(root){
  return n(t(root.querySelector('#pdfOverallPct, #pdfScorePct, .pdf-overall .pct')));
}

function readGroupsPDF(root){
  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
  root.querySelectorAll('#pdfGroupRows tr').forEach(tr=>{
    const c = tr.querySelectorAll('td,th');
    if (c.length>=2){
      const label = t(c[0]);
      const val = n(t(c[1]));
      if (label in out) out[label] = val;
    }
  });
  return out;
}

function readRecommendationPDF(root){
  return t(root.querySelector('#pdfRecText'));
}

function readAnswersPDF(root){
  const arr = [];
  const rows = root.querySelectorAll('#pdfStatements tbody tr');
  rows.forEach(tr=>{
    const c = tr.querySelectorAll('td,th');
    if (c.length>=4) arr.push(n(t(c[3])));
  });
  // ensure Q1..Q35 length
  while (arr.length < 35) arr.push('');
  return arr.slice(0,35);
}

function buildPayloadPDF(){
  const root = document.querySelector('#pdfReport');
  const info = readInfoPDF(root);
  return {
    mode: mode(),
    timestamp: new Date().toISOString(),
    teamMemberName: info.teamMemberName,
    teamMemberEmail: info.teamMemberEmail,
    teamMemberLocation: info.teamMemberLocation,
    peerName: info.peerName,
    peerEmail: info.peerEmail,
    peerLocation: info.peerLocation,
    overallPct: readOverallPDF(root),
    groups: readGroupsPDF(root),
    recommendation: readRecommendationPDF(root),
    answers: readAnswersPDF(root)
  };
}

async function postToSheet(payload){
  await fetch(WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
}

/* manual + auto */
window.syncToSheet = async function(){
  try { await postToSheet(buildPayloadPDF()); alert('Saved to Google Sheet'); }
  catch(e){ alert('Sync failed'); console.error(e); }
};

document.addEventListener('DOMContentLoaded', ()=>{
  const pdf = document.querySelector('#pdfReport');
  if (!pdf) return;

  const visible = () => getComputedStyle(pdf).display !== 'none';
  const trySync = () => setTimeout(()=>window.syncToSheet(), 400); // let PDF DOM settle

  // run when PDF becomes visible
  const mo = new MutationObserver(()=>{ if (visible()) trySync(); });
  mo.observe(pdf, { attributes:true, attributeFilter:['style','class'] });

  // if already visible
  if (visible()) trySync();
});
