/* === gsync.js (final, no recompute; posts exactly what PDF shows) === */
(function () {
  // Paste your deployed "Web app" URL from Apps Script here:
  const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxjfi90ddtP7iee7Jyc5iAPYzpuxnr0x7a_FPV28OUGxm2kXCYVn4ZMP5JPIImfrwEL/exec';

  // Convert visible text like "OVERALL SCORE 78%" -> "78"
  function extractPercent(txt) {
    if (!txt) return '';
    const m = String(txt).match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? m[1] : '';
  }

  // Grab info page fields (same IDs across Team & Peer)
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

  // Read Q1–Q35 exactly as chosen
  function collectAnswers() {
    const out = {};
    for (let i = 1; i <= 35; i++) {
      const els = document.querySelectorAll(`[name="q${i}"]:checked, [data-q="${i}"][aria-checked="true"]`);
      if (els && els[0]) {
        const v = els[0].value ?? els[0].getAttribute('data-value') ?? '';
        out[`Q${i}`] = v;
      } else {
        out[`Q${i}`] = window.currentAnswers?.[i] ?? '';
      }
    }
    return out;
  }

  // Pull already-rendered PDF UI results (canonical groups)
  function collectResultsFromPdfUi() {
    const overallTxt = document.getElementById('scorePercent')?.textContent || '';
    const overallPercent = extractPercent(overallTxt);

    const groups = ['Hospitality skills','BED competencies','Taking ownership','Collaboration'];
    const groupScores = {};
    groups.forEach(g => {
      const row = [...document.querySelectorAll('#pdfGroupTable tr')].find(tr => {
        const td = tr.querySelector('td');
        return td && td.textContent.trim() === g;
      });
      if (row) {
        const valTd = row.querySelectorAll('td')[1];
        groupScores[g] = extractPercent(valTd?.textContent || '');
      } else {
        groupScores[g] = window.groupResults?.[g] ?? '';
      }
    });

    const recommendations = document.getElementById('recText')?.textContent?.trim() || '';

    return { overallPercent, groupScores, recommendations };
  }

  async function sendToSheet(payload) {
    try {
      // Use no-cors to avoid preflight/CORS blocks; we don't need to read the response
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

      sendToSheet(payload);
      return r;
    };

    // Manual hook if you want to trigger without PDF:
    window.__gsyncFlushToSheet = function () {
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
      sendToSheet(payload);
    };
  }
})();
