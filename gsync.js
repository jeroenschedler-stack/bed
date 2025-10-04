/* === BED → Google Sheets sync (no recompute) === */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw9H2ym5NFEZfhO3AU0fUdphhorYv3KuxbS6z4qjAqrdVtDuGWLo0_qLmD-0WPf5uMK/exec'; // <-- replace

const GROUP_LABELS = [
  'Hospitality skills',
  'BED competencies',
  'Taking ownership',
  'Collaboration'
];

function text(el) { return el ? (el.textContent || '').trim() : ''; }
function numFrom(str) { const m = (str||'').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : ''; }

/* mode: infer from path */
function getMode() {
  const p = location.pathname.toLowerCase();
  return p.includes('/peer/') ? 'peer' : 'team';
}

/* --- INFO: read from the PDF section (already rendered values) --- */
function readInfo() {
  // Personal (team member)
  const teamMemberName     = text(document.querySelector('#pdfEmpName, #pdfTMName, #pdfTeamName'));
  const teamMemberEmail    = text(document.querySelector('#pdfEmpEmail, #pdfTMEmail, #pdfTeamEmail'));
  const teamMemberLocation = text(document.querySelector('#pdfEmpHotel, #pdfTMHotel, #pdfTeamHotel, #pdfEmpLocation'));

  // Peer
  const peerName     = text(document.querySelector('#pdfPeerName, #pdfPRName, #pdfReviewerName'));
  const peerEmail    = text(document.querySelector('#pdfPeerEmail, #pdfPREmail, #pdfReviewerEmail'));
  const peerLocation = text(document.querySelector('#pdfPeerHotel, #pdfPRHotel, #pdfReviewerLocation'));

  return { teamMemberName, teamMemberEmail, teamMemberLocation, peerName, peerEmail, peerLocation };
}

/* --- OVERALL % --- */
function readOverall() {
  // try live screen
  let v = numFrom(text(document.querySelector('#scorePercent, .score-box .pct, .overall .pct')));
  if (v === '') {
    // try PDF printed node
    v = numFrom(text(document.querySelector('#pdfOverallPct, #pdfScorePct, .pdf-overall .pct')));
  }
  return v;
}

/* --- GROUP % (by label) --- */
function readGroups() {
  const out = {};
  // 1) PDF table rows (preferred)
  const pdfRows = document.querySelectorAll('#pdfGroupRows tr');
  if (pdfRows.length) {
    pdfRows.forEach(tr => {
      const cells = tr.querySelectorAll('td,th');
      if (cells.length >= 2) {
        const label = text(cells[0]);
        const pct   = numFrom(text(cells[1]));
        if (label) out[label] = pct;
      }
    });
  }

  // 2) Fallback: scan visible “group-line” blocks like “Hospitality skills — 78%”
  if (!GROUP_LABELS.every(l => out[l] !== undefined)) {
    document.querySelectorAll('.group-line').forEach(el => {
      const t = text(el);
      const label = GROUP_LABELS.find(L => t.toLowerCase().includes(L.toLowerCase()));
      if (label && out[label] === undefined) out[label] = numFrom(t);
    });
  }

  // return only the four required keys
  const cleaned = {};
  GROUP_LABELS.forEach(L => cleaned[L] = (out[L] ?? ''));
  return cleaned;
}

/* --- RECOMMENDATION --- */
function readRecommendation() {
  // screen id
  let t = text(document.querySelector('#recText, .recommendation, #pdfRecText'));
  return t;
}

/* --- ANSWERS Q1..Q35 (from PDF statements table) --- */
function readAnswers() {
  const answers = [];
  // Preferred: PDF statements table, 4th column is score
  const rows = document.querySelectorAll('#pdfStatements tbody tr');
  if (rows.length) {
    rows.forEach(tr => {
      const td = tr.querySelectorAll('td');
      if (td.length >= 4) answers.push(numFrom(text(td[3])));
    });
  }

  // Fallback: any element carrying data-q / selected pill value (keep order)
  if (answers.length < 35) {
    for (let i = 1; i <= 35; i++) {
      let v = '';
      const sel = document.querySelector(`[data-q="${i}"].selected, .q[data-q="${i}"] .pill.selected`);
      if (sel) v = numFrom(sel.getAttribute('data-val') || sel.getAttribute('data-value') || text(sel));
      answers.push(v);
    }
  }

  return answers.slice(0, 35);
}

/* --- Build payload --- */
function buildPayload() {
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

/* --- POST --- */
async function postToSheet(payload) {
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',            // Apps Script accepts without CORS preflight
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  // no-cors: cannot read response; assume success
}

/* Public manual trigger (optional) */
window.syncToSheet = async function() {
  try {
    await postToSheet(buildPayload());
    alert('Saved to Google Sheet'); // simple confirmation popup
  } catch (e) {
    alert('Sync failed. Please try again.');
    console.error('BED sync failed', e);
  }
};


/* Auto-trigger when the Finish/Report section becomes visible (minimal intrusion) */
document.addEventListener('DOMContentLoaded', () => {
  const finish = document.getElementById('finish') || document.querySelector('#pdfReport');
  if (!finish) return;

  // If already visible (e.g., after scoring)
  const isShown = () => finish.style.display !== 'none';

  // Observe visibility changes
  const mo = new MutationObserver(() => {
    if (isShown()) {
      // small debounce to ensure DOM has final values
      setTimeout(() => window.syncToSheet(), 200);
    }
  });
  mo.observe(finish, { attributes: true, attributeFilter: ['style', 'class'] });

  // Also try once after a delay (safety)
  setTimeout(() => { if (isShown()) window.syncToSheet(); }, 600);
});
