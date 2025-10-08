/* === gsync.js (final production)
   - Works for TEAM and PEER forms (mirrored)
   - Captures: person fields, Q1–Q35, overall %, 4 group %, recommendation
   - Sends flattened group fields for clean write into Google Sheet
   ------------------------------------------------------------------- */

(function () {
  // ⚙️ Deployed Apps Script Web App URL (must end with /exec)
  const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwr_xjFQQX-SJj1eBShD_r0fE3mPxkfDWOVOyNoVvDekBYFXADYTr_KRgfR69_DdaHgag/exec';

  /* ---------- Utility helpers ---------- */
  function extractPercent(txt) {
    if (!txt) return '';
    const m = String(txt).match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? m[1] : '';
  }
  function textEq(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  /* ---------- Person info ---------- */
  function collectPeople(isPeerForm) {
    const teamName   = document.getElementById('nick')?.value?.trim() || '';
    const teamEmail  = document.getElementById('email')?.value?.trim() || '';
    const teamLocSel = document.getElementById('hotel');
    const teamLocation = teamLocSel ? (teamLocSel.value || teamLocSel.options[teamLocSel.selectedIndex]?.text || '') : '';

    const peerName   = document.getElementById('peerName')?.value?.trim() || '';
    const peerEmail  = document.getElementById('peerEmail')?.value?.trim() || '';
    const peerLocSel = document.getElementById('peerHotel');
    const peerLocation = peerLocSel ? (peerLocSel.value || peerLocSel.options[peerLocSel.selectedIndex]?.text || '') : '';

    return {
      teamName, teamEmail, teamLocation,
      peerName, peerEmail, peerLocation,
      formType: isPeerForm ? 'peer' : 'team'
    };
  }

  /* ---------- Collect answers Q1–Q35 ---------- */
  function getAnswerFromDom(n) {
    let el = document.querySelector(`.q-item[data-qid="${n}"] .pill.selected`);
    if (el) return el.getAttribute('data-val') || el.getAttribute('value') || el.textContent.trim() || '';

    el = document.querySelector(`[data-qid="${n}"] .pill.selected`);
    if (el) return el.getAttribute('data-val') || el.getAttribute('value') || el.textContent.trim() || '';

    el = document.querySelector(`#list-q${n} .pill.selected`);
    if (el) return el.getAttribute('data-val') || el.getAttribute('value') || el.textContent.trim() || '';

    el = document.querySelector(`input[type="radio"][name="q${n}"]:checked`);
    if (el) return el.value ?? '';

    el = document.querySelector(`[data-q="${n}"][aria-checked="true"], #list-q${n} [aria-checked="true"]`);
    if (el) return el.getAttribute('data-value') || el.getAttribute('value') || '';

    el = document.querySelector(`[data-q="${n}"].selected, #list-q${n} .selected`);
    if (el) return el.getAttribute('data-value') || el.getAttribute('value') || '';

    return '';
  }

  function collectAnswers() {
    const out = {};
    for (let i = 1; i <= 35; i++) {
      let v = getAnswerFromDom(i);
      if (!v && window.currentAnswers && (i in window.currentAnswers)) v = window.currentAnswers[i];
      if (!v && window.answers && (i in window.answers)) v = window.answers[i];
      out[`Q${i}`] = v ?? '';
    }
    return out;
  }

  /* ---------- Collect results from PDF UI ---------- */
  function collectResultsFromPdfUi() {
  const overallTxt = document.getElementById('scorePercent')?.textContent || '';
  const overallPercent = extractPercent(overallTxt);

  const wanted = ['Hospitality skills','BED competencies','Taking ownership','Collaboration'];
  const groupScores = Object.create(null);
  wanted.forEach(w => (groupScores[w] = ''));

    // Target your structure: <div id="groupResults"> ... <div class="group-row"><div>LABEL XX%</div>...</div>
  const root =
    document.getElementById('groupResults') ||
    document.querySelector('.groupResults') ||
    document.getElementById('finish') ||
    document.body;

  // Read the first child div inside each group-row (holds "Label 63%")
  root.querySelectorAll('.group-row').forEach(row => {
    const nameDiv =
      row.querySelector('div:first-child') || row;
    const txt = (nameDiv?.textContent || '').trim();
    wanted.forEach(w => {
      if (txt.toLowerCase().includes(w.toLowerCase())) {
        const m = txt.match(/(\d{1,3})\s*%/);
        if (m) groupScores[w] = m[1];
      }
    });
  });

  // Fallback: scan any element containing the label text
  if (Object.values(groupScores).some(v => !v)) {
    document.querySelectorAll('*').forEach(el => {
      const t = (el.textContent || '').trim();
      wanted.forEach(w => {
        if (!groupScores[w] && t.toLowerCase().includes(w.toLowerCase())) {
          const m = t.match(/(\d{1,3})\s*%/);
          if (m) groupScores[w] = m[1];
        }
      });
    });
  }

  const recommendations = document.getElementById('recText')?.textContent?.trim() || '';
  console.log('📊 FINAL groups →', groupScores);
  return { overallPercent, groupScores, recommendations };
}

  /* ---------- Send to Google Sheet ---------- */
  async function sendToSheet(payload) {
    try {
      await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
    } catch (e) {
      console.warn('Sheet post failed', e);
    }
  }

  /* ---------- Hook into PDF builder ---------- */
  if (!window.__gsyncWrapped) {
    window.__gsyncWrapped = true;
    const isPeerForm = (document.querySelector('.subheader')?.textContent || '').toLowerCase().includes('peer');

    const origBuild = window.buildPdfReport;
    window.buildPdfReport = function (...args) {
      const r = origBuild ? origBuild.apply(this, args) : undefined;

      const people   = collectPeople(isPeerForm);
      const answers  = collectAnswers();
      const results  = collectResultsFromPdfUi();

      const gs = results.groupScores || {};
      const payload = {
        formType: people.formType,
        teamName: people.teamName,
        teamEmail: people.teamEmail,
        teamLocation: people.teamLocation,
        peerName: people.peerName,
        peerEmail: people.peerEmail,
        peerLocation: people.peerLocation,
        ...answers,
        overallPercent: results.overallPercent,
        groupHospitalitySkills: gs['Hospitality skills'] || '',
        groupBedCompetencies: gs['BED competencies'] || '',
        groupTakingOwnership: gs['Taking ownership'] || '',
        groupCollaboration: gs['Collaboration'] || '',
        recommendations: results.recommendations
      };

      console.log('📤 Sending payload:', payload);
      sendToSheet(payload);
      return r;
    };

    /* ---------- Manual flush (DEV) ---------- */
    window.__gsyncFlushToSheet = function () {
      const isPeer = (document.querySelector('.subheader')?.textContent || '').toLowerCase().includes('peer');
      const people   = collectPeople(isPeer);
      const answers  = collectAnswers();
      const results  = collectResultsFromPdfUi();

      const gs = results.groupScores || {};
      const payload = {
        formType: people.formType,
        teamName: people.teamName,
        teamEmail: people.teamEmail,
        teamLocation: people.teamLocation,
        peerName: people.peerName,
        peerEmail: people.peerEmail,
        peerLocation: people.peerLocation,
        ...answers,
        overallPercent: results.overallPercent,
        groupHospitalitySkills: gs['Hospitality skills'] || '',
        groupBedCompetencies: gs['BED competencies'] || '',
        groupTakingOwnership: gs['Taking ownership'] || '',
        groupCollaboration: gs['Collaboration'] || '',
        recommendations: results.recommendations
      };

      console.log('📤 Manual flush payload:', payload);
      sendToSheet(payload);
    };
  } // end wrapper
})(); // end IIFE
