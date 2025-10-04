/* gsync.js — posts the already-rendered report values to Google Sheets */
const WEB_APP_URL = 'YOUR_WEB_APP_URL_HERE';

/* ===== Selector map (edit only if your IDs differ) ===== */
const SEL = {
  // page visibility
  finish: '#finish',

  // identity fields (nickname/email/location) as used in the forms
  nick: '#nick',
  email: '#email',
  location: '#location, #loc, select[name="location"]',

  // summary fields already rendered on the PDF/summary page
  overall: '#scorePercent',             // e.g., "OVERALL SCORE 83%"
  rec: '#recText',                      // recommendation text
  g1: '#group1Percent, #g1Pct, [data-g1]',
  g2: '#group2Percent, #g2Pct, [data-g2]',
  g3: '#group3Percent, #g3Pct, [data-g3]',
  g4: '#group4Percent, #g4Pct, [data-g4]',

  // questions (radio/inputs) already chosen in the form
  q: (i) => `input[name="q${i}"]:checked, [data-q="${i}"][aria-checked="true"]`
};

/* ===== Helpers ===== */
const pick = (sel) => {
  if (!sel) return '';
  if (Array.isArray(sel)) {
    for (const s of sel) { const el = document.querySelector(s); if (el) return el; }
    return null;
  }
  return document.querySelector(sel);
};
const txt = (sel) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  return el ? (('value' in el && el.value !== undefined) ? String(el.value).trim() : String(el.textContent).trim()) : '';
};
const pct = (sel) => {
  const t = txt(sel);
  const m = t.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : (t ? Number(String(t).replace(/[^\d.]/g,'')) : '');
};
const getFormType = () => (location.pathname.toLowerCase().includes('/peer') ? 'peer' : 'team');

/* ===== Collect exactly what is shown on screen ===== */
function collectRow() {
  const ts = new Date().toISOString();

  // Who reviews whom (both tabs use same header set)
  const reviewerNick = txt(SEL.nick);
  const reviewerEmail = txt(SEL.email).toLowerCase();
  const reviewerLoc = txt(SEL.location);

  // If your form renders both names on the summary, map them here if available.
  // Fallback: use reviewer as both, which keeps sheet consistent without breaking.
  const nameTeamMember = reviewerNick;
  const emailTeamMember = reviewerEmail;
  const locTeamMember = reviewerLoc;

  const namePeerReviewer = reviewerNick;
  const emailPeerReviewer = reviewerEmail;
  const locPeerReviewer = reviewerLoc;

  // Q1–Q35 (exact selections the user made)
  const answers = [];
  for (let i = 1; i <= 35; i++) {
    const el = pick(SEL.q(i));
    answers.push(el ? (el.value ?? el.textContent ?? '').toString().trim() : '');
  }

  // Group % and Overall % (as shown)
  const g1 = pct(SEL.g1);
  const g2 = pct(SEL.g2);
  const g3 = pct(SEL.g3);
  const g4 = pct(SEL.g4);
  const overall = pct(SEL.overall);
  const recommendation = txt(SEL.rec);

  // Build row in EXACT header order
  return [
    ts,
    nameTeamMember,
    emailTeamMember,
    locTeamMember,
    namePeerReviewer,
    emailPeerReviewer,
    locPeerReviewer,
    ...answers,      // Q1..Q35
    g1, g2, g3, g4,  // GROUP 1..4 %
    overall,         // OVERALL %
    recommendation   // RECOMMENDATION
  ];
}

/* ===== Post once the PDF/summary section is visible ===== */
let posted = false;
async function postRow() {
  if (posted) return;
  posted = true;
  const type = getFormType();
  const row = collectRow();
  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ type, row })
    });
    // Optional: check status in console
    console.log('gsync →', await res.text());
  } catch (err) {
    console.error('gsync error:', err);
  }
}

/* Detect when #finish (summary/PDF section) becomes visible, then send */
(function observeFinish() {
  const finish = pick(SEL.finish);
  if (!finish) return; // page may not have it until later
  const isVisible = () => finish && (finish.style.display !== 'none');

  // if already visible, send immediately
  if (isVisible()) { postRow(); return; }

  const mo = new MutationObserver(() => { if (isVisible()) { mo.disconnect(); postRow(); } });
  mo.observe(finish, { attributes: true, attributeFilter: ['style', 'class'] });
})();
