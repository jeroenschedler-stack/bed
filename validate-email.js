// validate-email.js
(function () {
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
  }

  function guardAll(e) {
    const emailEls = document.querySelectorAll("input[type=email]");
    for (const el of emailEls) {
      if (!isValidEmail(el.value)) {
        e.preventDefault();
        alert("Please enter a valid email address.");
        el.focus();
        return false;
      }
    }
    return true;
  }

  function wireUp() {
    // Validate on any form submit
    document.querySelectorAll("form").forEach(form => {
      if (!form.__emailGuardBound) {
        form.addEventListener("submit", guardAll);
        form.__emailGuardBound = true;
      }
    });

    // Also catch clicks on "start/next" buttons if not using <form>
    document.body.addEventListener("click", (e) => {
      const t = e.target;
      const isAdvancer = t.matches(
        'button, [type="submit"], a[href], [data-next], [data-action="start"], #start, #startBtn, #startButton'
      );
      if (isAdvancer) guardAll(e);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp);
  } else {
    wireUp();
  }
})();
