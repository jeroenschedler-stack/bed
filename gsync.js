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
        // Collect Q1..Q35 (supports radio name="qX" or input id="qX")
        answers: Array.from({length:35}, (_, i) => {
          const n = i + 1;
          const r = document.querySelector(`[name="q${n}"]:checked`);
          const el = r || document.getElementById(`q${n}`);
          return Number(el?.value || 0);
        })
      };

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
