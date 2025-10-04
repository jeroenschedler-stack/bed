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

  // 1) Ensure names so FormData can see fields
  var els = document.querySelectorAll('input[id],select[id],textarea[id]');
  for (var i=0;i<els.length;i++){ if (!els[i].name) els[i].name = els[i].id; }

  // 2) Pull everything the page already exposes via <form>
  var f = document.querySelector('form');
  if (f && window.FormData) {
    var fd = new FormData(f), it = fd.entries ? fd.entries() : null, e;
    if (it && it.next) while(!(e = it.next()).done) o[e.value[0]] = e.value[1];
  }

  // 3) Explicitly collect ratings
  // 3a) Native radios
  var r = document.querySelectorAll('input[type="radio"]:checked');
  for (i=0;i<r.length;i++){
    var key = r[i].name || r[i].id || r[i].getAttribute('data-qid');
    var val = r[i].value || r[i].getAttribute('data-value') || (r[i].getAttribute('aria-label')||'').trim();
    if (key) o[key] = val || '1';
  }

  // 3b) Common custom patterns (role=radio / .selected[data-qid])
  var custom = document.querySelectorAll('[role="radio"][aria-checked="true"], .selected[data-qid], .active[data-qid]');
  for (i=0;i<custom.length;i++){
    var el = custom[i];
    var k = el.getAttribute('data-qid') || el.id;
    var v = el.getAttribute('data-value') || (el.textContent||'').trim();
    if (k && !(k in o)) o[k] = v;
  }

  // Optional: group & overall already shown on your results page
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
