// /shared/app.js
import { MODES } from "./config.js";

/* ---------- Mode resolution (robust) ---------- */
function resolveMode() {
  const dm = document.documentElement.dataset.mode;
  if (dm === "team" || dm === "peer") return dm;
  if (window.__MODE__ === "team" || window.__MODE__ === "peer") return window.__MODE__;
  const p = (location.pathname || "").toLowerCase();
  if (p.includes("/peer/")) return "peer";
  if (p.includes("/team/")) return "team";
  return "team";
}
const mode = resolveMode();
const cfg  = MODES[mode];

/* ---------- State ---------- */
const state = {
  emailSelf: "",
  emailTarget: "",
  q1: [],   // Part 1 questions (objects from JSON)
  q2: [],   // Part 2 questions
  answers: { q1: {}, q2: {} } // e.g. { q1: {1: 4, 2: 5}, q2: {...} }
};

/* ---------- Small helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const toInt = (v) => (v == null ? null : parseInt(v, 10));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ---------- Layout (containers) ---------- */
document.title = cfg.title;
document.body.innerHTML = `
  <header class="appHeader">
    <h1>${cfg.title}</h1>
    <p class="subheader" id="subheader">${cfg.subheaders.q1}</p>
    <div class="progressDots" id="progress">
      <span class="dot active"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </header>

  <main id="screen"></main>

  <footer id="footer" class="appFooter"></footer>
`;

/* ---------- Screens ---------- */
function renderWelcome() {
  const peerBlock = (mode === "peer")
    ? `
      <fieldset>
        <legend>Team member information</legend>
        <label>Person you review (email)
          <input id="emailTarget" type="email" list="staffEmails" required>
        </label>
      </fieldset>
      <datalist id="staffEmails"></datalist>
    `
    : ``;

  $("#subheader").textContent = cfg.subheaders.q1;
  setProgress(1);

  $("#screen").innerHTML = `
    <section class="card">
      <fieldset>
        <legend>${mode === "peer" ? "Peer reviewer information" : "Identification"}</legend>
        <label>Your email (unique)
          <input id="emailSelf" type="email" required>
        </label>
      </fieldset>
      ${peerBlock}
      <div class="actions">
        <button id="btnStart" class="primary">Start</button>
      </div>
    </section>
  `;

  // normalize emails to lowercase
  $("#emailSelf").addEventListener("change", e => e.target.value = e.target.value.trim().toLowerCase());
  if (mode === "peer") {
    $("#emailTarget").addEventListener("change", e => e.target.value = e.target.value.trim().toLowerCase());
    // Load staff directory for suggestions (optional)
    fetch("../data/staff.json").then(r => r.ok ? r.json() : []).then(list => {
      const dl = $("#staffEmails");
      if (!dl || !Array.isArray(list)) return;
      dl.innerHTML = list.map(x =>
        `<option value="${(x.email||"").toLowerCase()}">${x.name||""}</option>`
      ).join("");
    }).catch(()=>{});
  }

  $("#btnStart").onclick = () => {
    const eSelf = $("#emailSelf");
    const eTarget = $("#emailTarget");
    const okSelf = eSelf.checkValidity();
    const okTarget = mode === "peer" ? eTarget.checkValidity() : true;
    if (!okSelf || !okTarget) {
      alert("Please enter valid email(s).");
      return;
    }
    state.emailSelf = eSelf.value;
    if (mode === "peer") state.emailTarget = eTarget.value;
    renderPart(1);
  };
}

function renderPart(partNo) {
  const partKey = partNo === 1 ? "q1" : "q2";
  const sub = partNo === 1 ? cfg.subheaders.q1 : cfg.subheaders.q2;
  $("#subheader").textContent = sub;
  setProgress(partNo + 1);

  const qs = state[partKey];
  $("#screen").innerHTML = `
    <section class="card">
      ${qs.map(q => renderQuestion(partKey, q)).join("")}
      <div class="actions">
        ${partNo === 1 ? `<button id="btnNext" class="primary">Next</button>` :
                          `<button id="btnFinish" class="primary">Finish</button>`}
      </div>
    </section>
  `;

  // Hook up radios
  qs.forEach(q => {
    const name = `${partKey}_${q.no}`;
    $all(`input[name="${name}"]`).forEach(r => {
      r.addEventListener("change", (e) => {
        state.answers[partKey][q.no] = toInt(e.target.value);
      });
    });
  });

  if (partNo === 1) $("#btnNext").onclick = () => {
    if (!hasCompletedRequired("q1")) {
      const req = cfg.required.q1;
      const current = Object.keys(state.answers.q1).length;
      alert(`Please answer all required statements in Part One (${current}/${req}).`);
      return;
    }
    renderPart(2);
  };

  if (partNo === 2) $("#btnFinish").onclick = () => {
    if (!hasCompletedRequired("q2")) {
      const req = cfg.required.q2;
      const current = Object.keys(state.answers.q2).length;
      alert(`Please answer all required statements in Part Two (${current}/${req}).`);
      return;
    }
    renderFinish();
  };
}

function renderFinish() {
  $("#subheader").textContent = cfg.subheaders.done;
  setProgress(3);

  const total = computeTotals();
  const peerExtra = (mode === "peer" && cfg.peerLinkHtml) ? cfg.peerLinkHtml : "";

  $("#screen").innerHTML = `
    <section class="card">
      <h2>Summary</h2>
      <p><strong>Your email:</strong> ${state.emailSelf}</p>
      ${mode==="peer" ? `<p><strong>Team member email:</strong> ${state.emailTarget}</p>` : ``}
      <p><strong>Total (Part 1):</strong> ${total.p1} &nbsp;|&nbsp; <strong>Total (Part 2):</strong> ${total.p2}</p>

      <h3>Answers</h3>
      ${renderAnswersTable()}

      <div class="actions">
        <button id="btnSavePdf" class="primary">Save PDF</button>
        <button id="btnSubmit"  class="secondary">Submit to Sheet</button>
      </div>

      <div class="note">${cfg.finishText} ${peerExtra}</div>
    </section>
  `;

  $("#btnSavePdf").onclick = () => {
    // Hook: replace with your previous jsPDF/HTML2Canvas PDF generator
    // For now, a simple print as a placeholder:
    window.print();
  };

  $("#btnSubmit").onclick = () => {
    // Hook: send to Google Apps Script endpoint
    const payload = {
      timestamp: new Date().toISOString(),
      role: mode,
      myEmail: state.emailSelf,
      targetEmail: state.emailTarget || "",
      totals: computeTotals(),
      answers: state.answers
    };
    console.log("Submit payload:", payload);
    alert("Demo: would POST to Google Sheet here.\n(We’ll wire the endpoint next.)");
  };
}

/* ---------- Render helpers ---------- */
function renderQuestion(partKey, q) {
  const name = `${partKey}_${q.no}`;
  const current = state.answers[partKey][q.no] ?? "";
  return `
    <div class="q" data-no="${q.no}">
      <div class="stmt"><span class="no">${q.no}.</span> ${escapeHtml(q.statement||"")}</div>
      ${q.subtext ? `<div class="sub">${escapeHtml(q.subtext)}</div>` : ``}
      <div class="scale">
        ${[1,2,3,4,5].map(v => `
          <label><input type="radio" name="${name}" value="${v}" ${current===v ? "checked" : ""}>${v}</label>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAnswersTable() {
  const rows = [];
  ["q1","q2"].forEach(partKey => {
    const qs = state[partKey];
    qs.forEach(q => {
      rows.push(`
        <tr>
          <td>${q.no}</td>
          <td>${escapeHtml(q.group||"")}</td>
          <td>${escapeHtml(q.statement||"")}</td>
          <td>${state.answers[partKey][q.no] ?? "-"}</td>
          <td>${partKey.toUpperCase()}</td>
        </tr>
      `);
    });
  });
  return `
    <div class="tableWrap">
      <table class="summary">
        <thead><tr><th>No</th><th>Group</th><th>Statement</th><th>Score</th><th>Part</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Logic helpers ---------- */
function computeTotals() {
  const sum = (obj) => Object.values(obj).reduce((a,b)=>a+(toInt(b)||0),0);
  return { p1: sum(state.answers.q1), p2: sum(state.answers.q2) };
}

function hasCompletedRequired(partKey) {
  const needed = cfg.required[partKey];
  const answered = Object.keys(state.answers[partKey]).length;
  return answered >= needed;
}

function setProgress(step) {
  // steps: 1=welcome, 2=part1, 3=part2/done
  const dots = $all("#progress .dot");
  dots.forEach((d,i)=> d.classList.toggle("active", i < step));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[m]));
}

function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

/* ---------- Data load & boot ---------- */
async function boot() {
  // Load questions JSON
  const all = await fetch(cfg.questionsFile).then(r => r.json()).catch(()=>[]);
  // Split into Part 1 / Part 2 by simple rule:
  // If your JSON already has "part": 1|2, use that.
  // Otherwise split by counts in config (first N = q1, next M = q2).
  let q1 = [], q2 = [];
  if (all.length && all[0] && (all[0].part !== undefined)) {
    q1 = all.filter(x => x.part === 1);
    q2 = all.filter(x => x.part === 2);
  } else {
    q1 = all.slice(0, clamp(cfg.required.q1, 0, all.length));
    q2 = all.slice(clamp(cfg.required.q1, 0, all.length));
  }
  state.q1 = q1;
  state.q2 = q2;

  // TEMP badge so we can see mode (remove later)
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div id="modeBadge" style="position:fixed;top:8px;right:8px;padding:4px 8px;border:1px solid #ccc;border-radius:6px;background:#fff;font:12px/1.2 system-ui;z-index:9999;">Mode: ${mode}</div>`
  );

  renderWelcome();
}
boot();
