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
      <span
