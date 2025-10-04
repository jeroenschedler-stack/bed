/* ---- BED → Google Sheets sync (no edits to index.html) ---- */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycby-8gGzklaOLbkwtbf1s078QZbuYy6zyXZL2FFTqVc84I85yg17Xip9R_oKrC2M5btr6w/exec';

(function () {
  // run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const submitBtn = document.getElementById('submitAll');
    if (!submitBtn) return; // page without submitAll (safe no-op)

    // Decide TEAM or PEER from URL path
    const isPeer = /\/peer\/?/i.test(location.pathname);
    const formType = isPeer ? 'peer' : 'team';

    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault?.();

      const getVal = (ids) => {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el && typeof el.value !== 'undefined') return (el.value + '').trim();
        }
        return '';
      };

      // IDs we’ve used across your repos (covers your variations)
      const payload = {
        formType,
        // Team member (the person being reviewed)
        nameTeamMember:     getVal(['nameTeamMember','teamName','yourName','nick']),
        emailTeamMember:    getVal(['emailTeamMember','teamEmail','yourEmail','email']),
        locationTeamMember: getVal(['locationTeamMember','teamLocation','location']),
        // Peer reviewer (chosen peer on TEAM page; the reviewer on PEER page)
        namePeerReviewer:     getVal(['namePeerReviewer','peerName']),
        emailPeerReviewer:    getVal(['emailPeerReviewer','peerEmail']),
        locationPeerReviewer: getVal(['locationPeerReviewer','peerLocation']),
  // Collect Q1..Q35 (robust: supports radios by name, inputs by id, hidden/data attrs, sliders)
const getAnswer = (n) => {
  const nameCandidates = [`q${n}`, `Q${n}`, `r${n}`, `R${n}`, `question${n}`];
  for (const nm of nameCandidates) {
    const r = document.querySelector(`input[name="${nm}"]:checked`);
    if (r) return parseInt(r.value, 10) || 0;
  }
  const idCandidates = [`q${n}`, `Q${n}`, `ans${n}`, `a${n}`, `score${n}`];
  for (const id of idCandidates) {
    const el = document.getElementById(id);
    if (el && el.value != null) return parseInt(el.value, 10) || 0;
  }
  const dataEl = document.querySelector(
    `[data-q="${n}"][data-value], input[type="hidden"][data-q="${n}"]`
  );
  if (dataEl) return parseInt(dataEl.dataset.value || dataEl.value, 10) || 0;

  const slider = document.querySelector(
    `input[type="range"][name="q${n}"], input[type="range"]#q${n}`
  );
  if (slider) return parseInt(slider.value, 10) || 0;

  return 0;
};

const answers = Array.from({ length: 35 }, (_, i) => getAnswer(i + 1));
payload.answers = answers; // <— attach to payload

      try {
        const res = await fetch(WEBAPP_URL, {
          method: 'POST',
          headers: {'Content-Type': 'text/plain'},
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
