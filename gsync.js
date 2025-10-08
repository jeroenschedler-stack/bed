/* === gsync.js — BED → Google Sheets (FINAL, table-first groups, decimals preserved) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyY_cImcU9Vq8fVEOP2qCrCzH6l4www99IcZo3oUyWyTPl53fhQ-ygQjJqIjoXnRxm7/exec';

/* ---------- helpers ---------- */
const T = el => el ? (el.textContent || '').trim() : '';
const N = s => { const m = (s || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
const MODE = () =>
  location.pathname.toLowerCase().includes('/peer/') ||
  /PEER REVIEW FORM/i.test(document.body.innerText) ? 'peer' : 'team';
const qAll = (root, sel) => Array.from((root || document).querySelectorAll(sel));
const normTxt = s => (s || '').replace(/\s+/g, ' ').trim();

/* ===== extractGroupsFromTable ===== */
function extractGroupsFromTable() {
  const out = { 'Hospitality skills':'', 'BED competencies':'', 'Taking ownership':'', 'Collaboration':'' };
  const alias = [
    { key:'Hospitality skills', rx:/hospitality\s*skills/i },
    { key:'BED competencies',  rx:/bed[\s\S]{0,10}?competencies/i },
    { key:'Taking ownership',  rx:/taking\s*ownership/i },
    { key:'Collaboration',     rx:/collaboration/i }
  ];

  const rows = qAll(document, '#pdfGroupRows tr, #pdfReport #pdfGroupRows tr');
  rows.forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td,th'));
    const pctCell = cells[cells.length - 1] || tr;
    const pct = N(T(pctCell));
    const rowTxt = normTxt(tr.textContent || '');
    if (pct !== '' && !isNaN(pct)) {
      for (const a of alias) { if (a.rx.test(rowTxt)) { out[a.key] = pct; break; } }
    }
  });

  if (Object.values(out).some(v => v === '')) {
    qAll(document, '#pdfReport tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td,th'));
      const pctCell = cells[cells.length - 1] || tr;
      const pct = N(T(pctCell));
      const rowTxt = normTxt(tr.textContent || '');
      if (pct !== '' && !isNaN(pct)) {
        for (const a of alias) {
          if (out[a.key] === '' && a.rx.test(rowTxt)) { out[a.key] = pct; break; }
        }
      }
    });
  }
  return out;
}

/* ---------- fallback readers ---------- */
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
  const rx = {
    hosp: /(hospitality\s*skills)[^0-9%]*(-?\d+(?:\.\d+)?)\s*%/i,
    bed:  /(bed[\s\S]{0,10}?competencies)[^0-9%]*(-?\d+(?:\.\d+)?)\s*%/i,
    own:  /(taking\s*ownership)[^0-9%]*(-?\d+(?:\.\d+)?)\s*%/i,
    coll: /(collaboration)[^0-9%]*(-?\d+(?:\.\d+)?)\s*%/i
  };
  const pick = r => { const m = text.match(r); return m ? Number(m[2]) : ''; };
  out['Hospitality skills'] = pick(rx.hosp);
  out['BED competencies']   = pick(rx.bed);
  out['Taking ownership']   = pick(rx.own);
  out['Collaboration']      = pick(rx.coll);
  return out;
}

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
  qAll(document, '#pdfStatements tbody tr, #pdfStatementRows tr, #statementsTable tr').forEach(tr=>{
    const cells = Array.from(tr.querySelectorAll('td,th'));
    if (cells.length<3) return;
    const score = N(T(cells[cells.length-1]));
    if (score===''||isNaN(score)) return;
    const txt = normTxt(tr.textContent||'');
    for(const a of alias){ if(a.rx.test(txt)){acc[a.key].sum+=score; acc[a.key].count++; break;} }
  });
  const out={};
  for(const k in acc){
    out[k]= acc[k].count>0 ? Number(((acc[k].sum/acc[k].count)/5*100).toFixed(1)):'';
  }
  return out;
}

/* ---------- choose best group source ---------- */
function extractGroupScores() {
  const t = extractGroupsFromTable();
  if (Object.values(t).every(v => v !== '')) return t;
  const a = extractGroupsFromHeading();
  if (Object.values(a).some(v => v !== '')) {
    const out = {...t};
    for (const k in a) if (out[k]===''&&a[k]!=='') out[k]=a[k];
    if (Object.values(out).every(v=>v!=='')) return out;
  }
  return extractGroupsFromStatements();
}

/* ---------- read PDF ---------- */
function readPDF(){
  const root=document.querySelector('#pdfReport')||document;
  const teamMemberName  = T(root.querySelector('#pdfEmpName, #infoTeamName'));
  const teamMemberEmail = T(root.querySelector('#pdfEmpEmail, #infoTeamEmail'));
  const teamMemberLoc   = T(root.querySelector('#pdfEmpHotel, #infoTeamLoc'));
  const peerName        = T(root.querySelector('#pdfPeerName, #infoPeerName'));
  const peerEmail       = T(root.querySelector('#pdfPeerEmail, #infoPeerEmail'));
  const peerLoc         = T(root.querySelector('#pdfPeerHotel, #infoPeerLoc'));
  const overallPct = N(T(root.querySelector('#pdfTotalPct, #pdfScorePct, #pdfOverallPct, #scorePercent')));
  let groups=extractGroupScores();

  const answers=[];
  qAll(document,'#pdfStatements tbody tr, #pdfStatementRows tr, #statementsTable tr').forEach(tr=>{
    const c=Array.from(tr.querySelectorAll('td,th'));
    if(c.length>=4){
      const v=N(T(c[3]));
      if(v!==''&&!isNaN(v))answers.push(v);
    }
  });
  while(answers.length<35)answers.push('');
  const nonEmpty=answers.filter(v=>v!=='');
  const allSame=nonEmpty.length>0&&nonEmpty.every(v=>v===nonEmpty[0]);
  if(allSame&&!isNaN(overallPct)){
    const g={}; Object.keys(groups).forEach(k=>g[k]=overallPct); groups=g;
  }
  const recommendation=T(root.querySelector('#pdfBandText, .rec-text, #recText'));
  return{teamMemberName,teamMemberEmail,teamMemberLocation:teamMemberLoc,
         peerName,peerEmail,peerLocation:peerLoc,
         overallPct,groups,recommendation,answers};
}

/* ---------- payload + post ---------- */
function buildPayload(){
  let d={};
  try{ d=readPDF(); }catch(e){
    console.error('[BED] readPDF() failed:',e);
    d={teamMemberName:'',teamMemberEmail:'',teamMemberLocation:'',
       peerName:'',peerEmail:'',peerLocation:'',
       overallPct:'',groups:{'Hospitality skills':'','BED competencies':'','Taking ownership':'','Collaboration':''},
       recommendation:'',answers:[]};
  }

  // TEMP LOGS for verification
  console.log('[BED] VERIFY overallPct:', d.overallPct);
  console.log('[BED] VERIFY groups:', d.groups);

  return{
    mode:MODE(),
    timestamp:new Date().toISOString(),
    teamMemberName:d.teamMemberName,
    teamMemberEmail:d.teamMemberEmail,
    teamMemberLocation:d.teamMemberLocation,
    peerName:d.peerName,
    peerEmail:d.peerEmail,
    peerLocation:d.peerLocation,
    overallPct:d.overallPct,
    groups:d.groups,
    recommendation:d.recommendation,
    answers:d.answers
  };
}

async function postToSheet(payload){
  try{
    console.log('[BED] posting to',WEBAPP_URL);
    const res=await fetch(WEBAPP_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      redirect:'follow',cache:'no-cache'
    });
    const text=await res.text().catch(()=>'(no text)');
    console.log('[BED] response status:',res.status,'body:',text);
    if(!res.ok)throw new Error(`HTTP ${res.status} → ${text}`);
    return true;
  }catch(e){
    console.error('[BED] postToSheet() error:',e);
    return false;
  }
}

/* ---------- orchestration ---------- */
async function markSaving(flag){window.__bedSaving=!!flag;}
async function syncToSheet(){
  if(window.__bedSaved||window.__bedSaving)return;
  await markSaving(true);
  try{
    const payload=buildPayload();
    const ok=await postToSheet(payload);
    window.__bedSaved=!!ok;
  }finally{await markSaving(false);}
}

function waitForPDFReady(ms=8000){
  const start=Date.now();
  return new Promise(res=>{
    (function loop(){
      const ready=document.querySelector('#pdfStatementRows tr,#pdfStatements tbody tr,#statementsTable tr');
      if(ready)return res(true);
      if(Date.now()-start>ms)return res(false);
      setTimeout(loop,120);
    })();
  });
}
function triggerWhenPdfReady(){
  if(window.__bedSaved||window.__bedSaving)return true;
  const f=document.querySelector('#pdfStatementRows tr,#pdfStatements tbody tr,#statementsTable tr');
  if(f){console.log('[BED] PDF detected → syncing…');window.syncToSheet();return true;}
  return false;
}

document.addEventListener('bed:pdf-ready',async()=>{
  console.log('[BED] event bed:pdf-ready received');
  const ok=await waitForPDFReady(8000);
  setTimeout(()=>triggerWhenPdfReady(),ok?200:800);
},{once:true});

let __bedMo;
__bedMo=new MutationObserver(()=>{if(triggerWhenPdfReady()){try{__bedMo.disconnect();}catch(_){}}});
__bedMo.observe(document.body,{childList:true,subtree:true});
setTimeout(()=>{if(!window.__bedSaved&&!window.__bedSaving){console.warn('[BED] timeout fallback → trying sync once');triggerWhenPdfReady();}},9000);
window.syncToSheet=syncToSheet;
