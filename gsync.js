/* === gsync.js — BED → Google Sheets (no recompute) === */
/* Replace with your deployed Apps Script Web App URL */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw9H2ym5NFEZfhO3AU0fUdphhorYv3KuxbS6z4qjAqrdVtDuGWLo0_qLmD-0WPf5uMK/exec';

/* Fixed group labels (exact spelling) */
const GROUP_LABELS = [
  'Hospitality skills',
  'BED competencies',
  'Taking ownership',
  'Collaboration'
];

/* ---------- helpers ---------- */
function text(el){ return el ? (el.textContent || '').trim() : ''; }
function numFrom(str){ const m = (str||'').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; }
function getMode(){ return location.pathname.toLowerCase().includes('/peer/') ? 'peer' : 'team'; }

/* ---------- read info already shown in the report (no recompute) ---------- */
function readInfo(){
  // Team member (employee)
  const teamMemberName     = text(document.querySelector('#pdfEmpName, #pdfTMName, #pdfTeamName, [data-k="team.name"]'));
  const teamMemberEmail    = text(document.querySelector('#pdfEmpEmail, #pdfTMEmail, #pdfTeamEmail, [data-k="team.email"]'));
  const teamMemberLocation = text(document.querySelector('#pdfEmpHotel, #pdfTMHotel, #pdfTeamHotel, #pdfEmpLocation, [data-k="team.location"]'));

  // Peer / Reviewer
  const peerName     = text(document.querySelector('#pdfPeerName, #pdfPRName, #pdfReviewerName, [data-k="peer.name"]'));
  const peerEmail    = text(document.querySelector('#pdfPeerEmail, #pdfPREmail, #pdfReviewerEmail, [data-k="peer.email"]'));
  const peerLocation = text(document.querySelector('#pdfPeerHotel, #pdfPRHotel, #pdfReviewerLocation, [data-k="peer.location"]'));

  return { teamMemberName, teamMemberEmail, teamMemberLocation, peerName, peerEmail, peerLocation };
}

function readOverall(){
  // live screen
  let v = numFrom(text(document.querySelector('#scorePercent, .score-box .pct, .overall .pct')));
  if (v === '') {
    // pdf nodes
    v = numFrom(text(document.querySelector('#pdfOverallPct, #pdfScorePct, .pdf-overall .pct, [data-k="overall.pct"]')));
  }
  return v;
}

function readGroups(){
  const out = {};

  // A) PDF table rows: first cell label, second cell %
  document.querySelectorAll('#pdfGroupRows tr').forEach(tr => {
    const td = tr.querySelectorAll('td,th');
    if (td.length >= 2) {
      const label = text(td[0]);
      const pct   = numFrom(text(td[1]));
      if (label) out[label] = pct;
    }
  });

  // B) Inline group lines like “Hospitality skills — 78%”
  document.querySelectorAll('.group-line').forEach(el => {
    const t = text(el);
    GROUP_LABELS.forEach(L => {
      if (t.toLowerCase().includes(L.toLowerCase()) && out[L] === undefined) {
        out[L] = numFrom(t);
      }
    });
  });

  // C) Any element tagged with data-group containing a %
  document.querySelectorAll('[data-group]').forEach(el => {
    const L = el.getAttribute('data-group');
    if (L && out[L] === undefined) out[L] = numFrom(text(el));
  });

  // Only return the required four keys
  const cleaned = {};
  GROUP_LABELS.forEach(L => cleaned[L] = (out[L] ?? ''));
  return cleaned;
}

function readRecommendation(){
  return text(document.querySelector('#recText, .recommendation, #pdfRecText, [data-k="recommendation"]'));
}

/* Answers Q1..Q35 in order */
function readAnswers(){
  const out = [];

  // 1) Preferred: PDF statements table (4th column)
  const pdfRows = document.querySelectorAll('#pdfStatements tbody tr');
  if (pdfRows.length) {
    pdfRows.forEach(tr => {
      const cells = tr.querySelectorAll('td,th');
      if (cells.length >= 4) out.push(numFrom((cells[3].textContent || '').trim()));
    });
  }

  // 2) Fallbacks per question
  for (let i = 1; i <= 35; i++) {
    if (out[i-1] !== undefined) continue;
    let v = '';

    // a) radios: <input type="radio" name="q1" value="...">
    let r = document.querySelector(`input[type="radio"][name="q${i}"]:checked, input[type="radio"][name="Q${i}"]:checked`);
    if (r) v = numFrom(r.value);

    // b) pill buttons with data-q and .selected/.active
    if (v === '') {
      const sel = document.querySelector(
        `[data-q="${i}"].selected, [data-q="${i}"].active,
         .q[data-q="${i}"] .pill.selected, .q[data-q="${i}"] .pill.active,
         .q-item[data-q="${i}"] .pill.selected, .q-item[data-q="${i}"] .pill.active`
      );
      if (sel) v = numFrom(sel.getAttribute('data-val') || sel.getAttribute('data-value') || sel.textContent);
    }

    // c) aria-pressed
    if (v === '') {
      const pressed = document.querySelector(
        `[data-q="${i}"][aria-pressed="true"], .q[data-q="${i}"] [aria-pressed="true"]`
      );
      if (pressed) v = numFrom(pressed.getAttribute('data-val') || pressed.textContent);
    }

    out[i-1] = (v === '' ? '' : v);
  }

  return out.slice(0, 35);
}

/* ---------- payload ---------- */
function buildPayload(){
  const info = readInfo();
  return {
    mode: getMode(),
    timestamp: new Date().toISOString(),
    teamMemberName: info.teamMemberName,
    teamMemberEmail: info.teamMemberEmail,
    teamMemberLocation: info.teamMemberLocation,
    peerName: info.peerName,
    peerEmail: info.peerEmail,
    peerLocation: info.peerLocation,
    overallPct: readOverall(),
    groups: readGroups(),
    recommendation: readRecommendation(),
    answers: readAnswers()
  };
}

/* ---------- send ---------- */
async function postToSheet(payload){
  // no-cors: we can’t read the response; Apps Script will accept the POST
  await fetch(WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/* Public manual trigger */
window.syncToSheet = async function(){
  try {
    await postToSheet(buildPayload());
    alert('Saved to Google Sheet');
  } catch (e) {
    alert('Sync failed. Please try again.');
    console.error('BED sync failed', e);
  }
};

/* ---------- auto-trigger on final screen ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const finish = document.getElementById('finish') || document.querySelector('#pdfReport');
  if (!finish) return;

  const isShown = () => {
    // visible if style is not display:none or element has a visible layout
    if (finish.style && finish.style.display === 'none') return false;
    return finish.offsetParent !== null || getComputedStyle(finish).display !== 'none';
  };

  const trigger = () => setTimeout(() => window.syncToSheet(), 800); // small delay to ensure DOM is final

  // Observe visibility changes
  const mo = new MutationObserver(() => { if (isShown()) trigger(); });
  mo.observe(finish, { attributes: true, attributeFilter: ['style', 'class'] });

  // Safety: also try once after a short delay
  setTimeout(() => { if (isShown()) trigger(); }, 1200);
});
