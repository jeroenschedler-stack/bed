/* ---- BED → Google Sheets sync (TEAM & PEER) ---- */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycby-8gGzklaOLbkwtbf1s078QZbuYy6zyXZL2FFTqVc84I85yg17Xip9R_oKrC2M5btr6w/exec';

(function () {
  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const submitBtn = document.getElementById('submitAll');
    if (!submitBtn) return; // page without submitAll

    // Decide TEAM or PEER from URL path
    const isPeer = /\/peer\/?/i.test(location.pathname);
    const formType = isPeer ? 'peer' : 'team';

    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault?.();

      // Helper: first existing element value from a list of IDs
      const getVal = (ids) => {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el && typeof el.value !== 'undefined') return (el.value + '').trim();
        }
        return '';
      };

      // Build payload (without answers first)
      const payload = {
        formType, // 'team' or 'peer'
        // Team member (the person being reviewed)
        nameTeamMember:     getVal(['nameTeamMember','teamName','yourName','nick']),
        emailTeamMember:    getVal(['emailTeamMember','teamEmail','yourEmail','email']),
        locationTeamMember: getVal(['locationTeamMember','teamLocation','location']),
        // Peer reviewer (chosen peer on TEAM page; the reviewer on PEER page)
        namePeerReviewer:     getVal(['namePeerReviewer','peerName']),
        emailPeerReviewer:    getVal(['emailPeerReviewer','peerEmail']),
        locationPeerReviewer: getVal(['locationPeerReviewer','peerLocation'])
      };

      // Robust Q1..Q35 collector
      function getAnswer(n) {
        // 1) radios by common name patterns
        const nameCandidates = [`q${n}`, `Q${n}`, `r${n}`, `R${n}`, `question${n}`];
        for (const nm of nameCandidates) {
          const r = document.querySelector(`input[name="${nm}"]:checked`);
          if (r) return parseInt(r.value, 10) || 0;
        }
        // 2) direct inputs by id
        const idCandidates = [`q${n}`, `Q${n}`, `ans${n}`, `a${n}`, `score${n}`];
        for (const id of idCandidates) {
          const el = document.getElementById(id);
          if (el && el.value != null) return parseInt(el.value, 10) || 0;
        }
        // 3) hidden/data-backed widgets
        const dataEl = document.querySelector(
          `[data-q="${n}"][data-value], input[type="hidden"][data-q="${n}"]`
        );
        if (dataEl) return parseInt(dataEl.dataset.value || dataEl.value, 10) || 0;

        // 4) sliders (range)
        const slider = document.querySelector(
          `input[type="range"][name="q${n}"], input[type="range"]#q${n}`
        );
        if (slider) return parseInt(slider.value, 10) || 0;

        return 0;
      }

      const answers = Array.from({ length: 35 }, (_, i) => getAnswer(i + 1));
      payload.answers = answers; // attach to payload

      try {
        const res = await fetch(WEBAPP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' }, // avoid CORS preflight
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Save failed');
        alert(`Saved to ${data.tab}. Overall ${data.overallPct}%`);
      } catch (err) {
        console.error(err);
        alert('Error: ' + err.message);
      }
    });
  }
})();
