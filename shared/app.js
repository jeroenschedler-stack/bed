import { MODES } from "./config.js";

function resolveMode() {
  // 1) Preferred: data-mode on <html>
  const dm = document.documentElement.dataset.mode;
  if (dm === "team" || dm === "peer") return dm;

  // 2) Legacy global (if ever used)
  if (window.__MODE__ === "team" || window.__MODE__ === "peer") return window.__MODE__;

  // 3) URL fallback (works on GitHub Pages)
  const p = (location.pathname || "").toLowerCase();
  if (p.includes("/peer/")) return "peer";
  if (p.includes("/team/")) return "team";

  return "team";
}

const mode = resolveMode();
const cfg  = MODES[mode];
console.log("Mode resolved as:", mode);
// Set page title
document.title = cfg.title;

// Basic layout (you can replace later with your real UI)
document.body.innerHTML = `
  <header>
    <h1>${cfg.title}</h1>
    <p class="subheader">${cfg.subheaders.q1}</p>
  </header>

  <section id="ident">
    <label>Your email (unique)
      <input id="myEmail" type="email" required>
    </label>
    ${mode==="peer" ? `
    <label>Person you review (email)
      <input id="targetEmail" type="email" list="staffEmails" required>
    </label>` : ``}
    <datalist id="staffEmails"></datalist>
  </section>

  <section id="questions"></section>

  <section id="actions">
    <button id="btnFinish" type="button">Finish</button>
  </section>

  <section id="finish" style="display:none;">
    <p>${cfg.finishText} ${mode==="peer" ? (cfg.peerLinkHtml||"") : ""}</p>
    <button id="btnSavePdf" type="button">Save PDF</button>
  </section>
`;

// Normalize emails to lowercase on change
const myEmail = document.getElementById("myEmail");
myEmail.addEventListener("change", e => e.target.value = e.target.value.trim().toLowerCase());
const tEmail = document.getElementById("targetEmail");
if (tEmail) tEmail.addEventListener("change", e => e.target.value = e.target.value.trim().toLowerCase());

// Load staff directory for suggestions (optional)
fetch("../data/staff.json")
  .then(r => r.ok ? r.json() : [])
  .then(list => {
    const dl = document.getElementById("staffEmails");
    if (!dl || !Array.isArray(list)) return;
    dl.innerHTML = list.map(x =>
      `<option value="${(x.email||"").toLowerCase()}">${x.name||""}</option>`
    ).join("");
  })
  .catch(()=>{});

// Load questions JSON and render a minimal placeholder
fetch(cfg.questionsFile)
  .then(r => r.json())
  .then(qs => {
    const box = document.getElementById("questions");
    if (!Array.isArray(qs) || qs.length===0) {
      box.innerHTML = `<p>No questions found. Fill ${cfg.questionsFile}.</p>`;
      return;
    }
    // Minimal renderer: list statements with 1–5 radio
    box.innerHTML = qs.map(q => `
      <div class="q" data-no="${q.no||""}">
        <div class="stmt"><span class="no">${q.no||""}.</span> ${q.statement||""}</div>
        ${q.subtext ? `<div class="sub">${q.subtext}</div>` : ``}
        <div class="scale">
          ${[1,2,3,4,5].map(v => `
            <label><input type="radio" name="q${q.no}" value="${v}">${v}</label>
          `).join("")}
        </div>
      </div>
    `).join("");
  });

// Minimal finish handler (no PDF yet; wire later)
document.getElementById("btnFinish").addEventListener("click", () => {
  const okMy = myEmail.checkValidity();
  const okTarget = tEmail ? tEmail.checkValidity() : true;
  if (!okMy || !okTarget) {
    alert("Please enter valid email(s).");
    return;
  }
  document.getElementById("finish").style.display = "block";
});
