/* ===== CONFIG ===== */
var GS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbytTVOr2w_I5szx8-64rdeQ7en8SW3FbGP_1Fyjhyv1rbWJYDtSliAbCqwboB9xTKMz/exec';
var TOKEN = ''; // optional shared secret; keep '' to disable
/* ================== */

(function () {
  // --- Small toast (green OK / red error)
  function toast(msg, ok) {
    var el = document.getElementById('gsync_status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gsync_status';
      el.style.cssText = 'position:fixed;right:10px;bottom:10px;padding:8px 12px;border-radius:6px;font:14px system-ui,sans-serif;z-index:99999;display:none';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = ok === false ? '#f8d7da' : '#d4edda';
    el.style.color = ok === false ? '#721c24' : '#155724';
    el.style.display = 'inline-block';
    setTimeout(function(){ el.style.display = 'none'; }, 4000);
  }

  // Identify form type for routing to TEAM / PEER tab
  function formType() {
    if (location.pathname.indexOf('/peer/') > -1) return 'peer';
    var sub = document.querySelector('.subheader');
    if (sub && /peer/i.test(sub.textContent || '')) return 'peer';
    return 'team';
  }

  // Collect current inputs
  function collect() {
  var o = { form: formType() };
  if (TOKEN) o.token = TOKEN;

  // 0) Make sure basic inputs have names so FormData can see them
  var els = document.querySelectorAll('input[id],select[id],textarea[id]');
  for (var i=0;i<els.length;i++){ if (!els[i].name) els[i].name = els[i].id; }

  // 1) Everything that the form already exposes
  var f = document.querySelector('form');
  if (f && window.FormData) {
    var fd = new FormData(f), it = fd.entries ? fd.entries() : null, e;
    if (it && it.next) while(!(e = it.next()).done) o[e.value[0]] = e.value[1];
  }

  // 2) Ratings — robust and order-aware
  var groups = [];             // {key, els[], selectedEl}
  var seenNames = Object.create(null);

  // 2a) Native radios → group by name
  var radios = document.querySelectorAll('input[type="radio"]');
  for (var i=0;i<radios.length;i++){
    var r = radios[i];
    var nm = r.name || r.id || '';
    if (!nm) continue;
    if (!seenNames[nm]) { seenNames[nm] = { key:nm, els:[] }; groups.push(seenNames[nm]); }
    seenNames[nm].els.push(r);
  }

  // 2b) Custom radio controls (role=radio or elements with data-qid/value)
  var customs = document.querySelectorAll('[role="radio"], [data-qid], [data-value]');
  for (i=0;i<customs.length;i++){
    var el = customs[i];

    // find a container that has multiple radio-like children
    var p = el.closest('[role="radiogroup"], .radio-group, .question, section, div');
    if (!p) p = el.parentElement;
    if (!p) continue;

    // collect children in this container that look like radio options
    var opts = p.querySelectorAll('[role="radio"], [data-value], .selected, .active, input[type="radio"]');
    if (opts.length < 3) continue; // avoid random containers

    // choose a stable key: prefer explicit data-qid/id on container; else index
    var key = p.getAttribute('data-qid') || p.id;
    if (!key) {
      key = 'q' + String(groups.length + 1).padStart(2,'0');
    }
    // ensure a single group object for each key
    var g = groups.find(function(G){ return G.key === key; });
    if (!g) { g = { key:key, els:[] }; groups.push(g); }

    // push option elements
    for (var j=0;j<opts.length;j++){ g.els.push(opts[j]); }
  }

  // 2c) Determine selected value per group
  for (i=0;i<groups.length;i++){
    var G = groups[i], picked = null, val = '';
    for (j=0;j<G.els.length;j++){
      var e = G.els[j];
      if (e.matches && e.matches('input[type="radio"]')) {
        if (e.checked) { picked = e; break; }
      } else {
        var isOn = (e.getAttribute('aria-checked') === 'true') || e.classList.contains('selected') || e.classList.contains('active');
        if (isOn) { picked = e; break; }
      }
    }
    if (picked) {
      val = picked.value || picked.getAttribute('data-value') || (picked.getAttribute('aria-label')||'').trim() || (picked.textContent||'').trim();
      if (!val && picked.dataset && picked.dataset.value) val = picked.dataset.value;
      if (val) o[G.key] = val;
    }
  }

  // 3) Overall score (if present on the results page)
  var scoreEl = document.getElementById('scorePercent');
  if (scoreEl) o.score_percent = String(scoreEl.textContent||'').trim();

  return o;
}


  function encode(obj){
    var s=[]; for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj,k))
      s.push(encodeURIComponent(k)+'='+encodeURIComponent(String(obj[k])));
    return s.join('&');
  }

  function post(payload, okCb, errCb){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', GS_ENDPOINT, true);
    xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');
    xhr.onreadystatechange = function(){
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        var json = null, ok = false, errMsg = 'Server error';
        try { json = JSON.parse(xhr.responseText || '{}'); ok = (json.ok === true); if (json.error) errMsg = json.error; } catch(e) { ok = true; } // treat non-JSON as success
        ok ? okCb() : errCb(new Error(errMsg));
      } else {
        errCb(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.send(encode(payload));
  }

  // Duplicate guard per form (TEAM/PEER) across page hops (PDF/back etc.)
  function savedKey(){ return 'gsync_saved_' + formType(); }
  function alreadySaved(){ try { return sessionStorage.getItem(savedKey()) === '1'; } catch(_) { return false; } }
  function markSaved(){ try { sessionStorage.setItem(savedKey(), '1'); } catch(_) {} }

  function save(tag){
    if (alreadySaved()) return; // skip duplicate attempts in same session for this form
    var data = collect();
    data._trigger = tag || 'submit';
    post(data, function(){
      markSaved();
      toast('✔ Saved!', true);
    }, function(err){
      toast('✖ Error: ' + err.message, false);
    });
  }

  // Click handler: use native confirm (no custom overlay), don’t block page unless user cancels
  function onClick(ev){
    var t = ev.target;
    // find a clickable button-ish ancestor
    while (t && t !== document && !(t.matches && t.matches('button,[role="button"],input[type="submit"]'))) t = t.parentNode;
    if (!t || t === document) return;

    var txt = String(t.textContent || t.value || '').toLowerCase().trim();

    // MAIN hook: Submit on Q2 (often id="submitAll")
    if (t.id === 'submitAll' || /(^|\b)submit(\b|$)/.test(txt)) {
      if (!window.confirm('Are you sure you want to submit now? Your answers will be saved to the spreadsheet.')) {
        // User cancelled: block the app’s own click
        ev.preventDefault(); ev.stopPropagation();
        return;
      }
      // User confirmed: let the app proceed normally, and save in parallel
      save('submit-confirm');
      return; // do not block the app
    }

    // FALLBACK: PDF on final page → if not saved yet, save once
    if (t.id === 'congratsPdf' || /(^|\b)pdf(\b|$)/.test(txt)) {
      save('pdf-click');
      // don’t block; let PDF open
      return;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ document.addEventListener('click', onClick, true); });
  } else {
    document.addEventListener('click', onClick, true);
  }

  // expose for quick manual test in console: gsync.save()
  window.gsync = { save: function(){ save('manual'); } };
})();
