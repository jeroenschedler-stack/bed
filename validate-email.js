// validate-email.js
(function () {
  function normalize(v) { return (v || "").trim().toLowerCase(); }
  function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function guard(e, emailEl) {
    const email = normalize(emailEl?.value || "");
    if (!isValidEmail(email)) {
      e.preventDefault();
      e.stopPropagation();
      alert("Please enter a valid email address.");
      emailEl?.focus();
      return false;
    }
    return true;
  }

  function wireUp() {
    const emailEl = document.getElementById("email");
    if (!emailEl) return;

    // Ensure HTML attributes are present
    emailEl.setAttribute("type", "email");
    emailEl.setAttribute("required", "true");
    emailEl.setAttribute("autocomplete", "email");
    emailEl.setAttribute("inputmode", "email");

    // If form exists, validate on submit
    const form = emailEl.closest("form");
    if (form && !form.__emailGuardBound) {
      form.addEventListener("submit", (e) => guard(e, emailEl));
      form.__emailGuardBound = true;
    }

    // Also catch "start/next" button clicks (if no <form>)
    const welcome = document.getElementById("welcome") || document.body;
    if (!welcome.__emailGuardClicksBound) {
      welcome.addEventListener("click", (e) => {
        const t = e.target;
        const isAdvancer =
          t.matches('button, [type="submit"], a[href], [data-next], [data-action="start"], #start, #startBtn, #startButton');
        if (isAdvancer) guard(e, emailEl);
      }, true);
      welcome.__emailGuardClicksBound = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp);
  } else {
    wireUp();
  }
})();
