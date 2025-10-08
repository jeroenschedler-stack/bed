/* === gsync.js (robust capture: Q1–Q35 + group scores, no recompute) === */
(function () {
  // Paste your deployed Apps Script "Web app" URL here:
  const WEBAPP_URL = 'PASTE_WEBAPP_URL_HERE';

  /* ---------- utils ---------- */
  function extractPercent(txt) {
    if (!txt) return '';
    const m = String(txt).match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? m[1] : '';
  }

  function textEq(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  /* ---------- people fields ---------- */
  function collectPeople(isPeerForm) {
    const teamName   = document.getElementById('nick')?.value?.trim() || '';
    const teamEmail  = document.getElementById('email')?.value?.trim() || '';
    const teamLocSel = document.getElementById('hotel');
    const teamLocation = teamLocSel ? (teamLocSel.value || teamLocSel.options[teamLocSel.selectedIndex]?.text || '') : '';

    const peerName   = document.getElementById('peerName')?.value?.trim() || '';
    const peerEmail  = document.getElementById('peerEmail')?.value?.trim() || '';
    const peerLocSel = document.getElementById('peerHotel');
    const peerLocation = peerLocSel ? (peerLocSel.value || peerLocSel.options[peerLocSel.selectedIndex]?.text || '') : '';

    return { teamName, teamEmail, teamLocation, peerName, peerEmail, peerLocation,
             formType: isPeerForm ? 'peer' : 'team' };
  }

  /* ---------- answers Q1–Q35 ----------
     We try multiple strategies in order:
     1) Checked radio inputs: input[type=radio][name="qN"]
     2) Pressed buttons/spans using data attributes: [data-q="N"][aria-checked="true"]
     3) Generic "selected" flag: [data-q="N"].selected or .is-selected
     4) Global state objects some builds use, e.g., window.currentAnswers or window.answers
  ------------------------------------- */
  function getAnswerFromDom(n) {
    // radios
    const r = document.querySelector(`input[type="radio"][name="q${n}"]:checked`);
    if (r) return r.value ?? '';

    // aria-checked custom widgets
    const aria = document.querySelector(`[data-q="${n}"][aria-checked="true"]`);
    if (aria) return aria.getAttribute('data-value') || aria.getAttribute('value') || '';

    // "selected" class or attribute
    const sel = document.querySelector(`[data-q="${n}"].selected, [data-q="${n}"].is-selected, [data-q="${n}"][data-selected="true"]`);
    if (sel) return sel.getAttribute('data-value') || sel.getAttribute('value') || '';

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

  /* ---------- results from PDF UI ----------
     Strategy:
     - Read overall from #scorePercent text
     - For groups, look across ANY tables rendered in the results section.
       We find rows where the first cell equals one of the canonical names.
  ------------------------------------------ */
  function collectResultsFromPdfUi() {
    const overallTxt = document.getElementById('scorePercent')?.textContent || '';
    const overallPercent = extractPercent(overallTxt);

    const wanted = ['Hospitality skills','BED competencies','Taking ownership','Collaboration'];
    const groupScores = Object.create(null);

    function tryTable(table) {
      const rows = table.querySelectorAll('tr');
      rows.forEach(tr => {
        const tds = tr.querySelectorAll('td,th');
        if (tds.length >= 2) {
          const name = tds[0].textContent || '';
          const val  = tds[1].textContent || '';
          const hit = wanted.find(w => textEq(name, w));
          if (hit) {
            groupScores[hit] = extractPercent(val) || groupScores[hit] || '';
          }
        }
      });
    }

    // Prefer explicit id if present
    const explicit = document.getElementById('pdfGroupTable');
    if (explicit) tryTable(explicit);

    // Fallback: scan tables inside any "finish"/results/PDF section
    const finish = document.getElementById('finish') || document.getElementById('pdf') || document;
    finish.querySelectorAll('table').forEach(tryTable);

    // Final fallback to globals
    wanted.forEach(w => {
      if (!groupScores[w]) {
        groupScores[w] = (window.groupResults && window.groupResults[w]) || '';
      }
    });

    const recommendations = document.getElementById('recText')?.textContent?.trim() || '';

    return { overallPercent, groupScores, recommendations };
  }

  async function sendToSheet(payload) {
    try {
      await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors' // we don't need to read the response
      });
    } catch (e) {
      console.warn('Sheet post failed', e);
    }
  }

  /* ---------- hook ---------- */
  if (!window.__gsyncWrapped) {
    window.__gsyncWrapped = true;
    const isPeerForm = (document.querySelector('.subheader')?.textContent || '').toLowerCase().includes('peer');

    const origBuild = window.buildPdfReport;
    window.buildPdfReport = function (...args) {
      const r = origBuild ? origBuild.apply(this, args) : undefined;

      const people   = collectPeople(isPeerForm);
      const answers  = collectAnswers();
      const results  = collectResultsFromPdfUi();

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
        groupScores: results.groupScores,
        recommendations: results.recommendations
      };

      // Uncomment to debug in console:
      // console.table(payload);

      sendToSheet(payload);
      return r;
    };

    // Manual escape hatch
    window.__gsyncFlushToSheet = function () {
      const people   = collectPeople(isPeerForm);
      const answers  = collectAnswers();
      const results  = collectResultsFromPdfUi();
      sendToSheet({
        formType: people.formType,
        teamName: people.teamName,
        teamEmail: people.teamEmail,
        teamLocation: people.teamLocation,
        peerName: people.peerName,
        peerEmail: people.peerEmail,
        peerLocation: people.peerLocation,
        ...answers,
        overallPercent: results.overallPercent,
        groupScores: results.groupScores,
        recommendations: results.recommendations
      });
    };
  }
})();
