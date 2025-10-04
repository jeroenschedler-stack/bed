/* ===== CONFIG (your live web app URL) ===== */
var GS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbytTVOr2w_I5szx8-64rdeQ7en8SW3FbGP_1Fyjhyv1rbWJYDtSliAbCqwboB9xTKMz/exec';
var TOKEN = ''; // optional shared secret; keep '' to disable
/* ========================================= */

(function () {
  // ---------- UI helpers ----------
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

  function formType() {
    if (location.pathname.indexOf('/peer/') > -1) return 'peer';
    var sub = document.querySelector('.subheader');
    if (sub && /peer/i.test(sub.textContent || '')) return 'peer';
    return 'team';
  }

  // ---------- payload encoder ----------
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
        var ok = true, err = 'Server error';
        try {
          var json = JSON.parse(xhr.responseText || '{}');
          ok = (json.ok === true);
          if (json.error) err = json.error;
        } catch(e) { ok = true; } // tolerate non-JSON success
        ok ? okCb() : errCb(new Error(err));
      } else {
        errCb(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.send(encode(payload));
  }

  // ---------- ratings collector (captures all statements) ----------
  function collect() {
    var o = { form: formType() };
    if (TOKEN) o.token = TOKEN;

    // Ensure basic inputs have names so FormData can see them
    var els = document.querySelectorAll('input[id],select[id],textarea[id]');
    for (var i=0;i<els.length;i++){ if (!els[i].name) els[i].name = els[i].id; }

    // Pull everything already in <form>
    var f = document.querySelector('form');
    if (f && window.FormData) {
      var fd = new FormData(f), it = fd.entries ? fd.entries() : null, e;
      if (it && it.next) while(!(e = it.next()).done) o[e.value[0]] = e.value[1];
    }

    // A) Your main pattern: .q-item[data-qid] with .pill.selected[data-val]
    var items = document.querySelectorAll('.q-item');
    for (var j=0; j<items.length; j++) {
      var ci   = items[j];
      var qid  = ci.getAttribute('data-qid') || ci.id || ('q'+String(j+1).padStart(2,'0'));
      var picked = ci.querySelector('.pill.selected, [role="radio"][aria-checked="true"], .active, .is-selected, input[type="radio"]:checked');
      var val = '';
      if (picked) {
        if (picked.matches && picked.matches('input[type="radio"]')) {
          val = picked.value || picked.getAttribute('data-value') || (picked.getAttribute('aria-label')||'').trim();
        }
        if (!val) {
          val = picked.getAttribute('data-val') || picked.getAttribute('data-value') ||
                (picked.getAttribute('aria-label')||'').trim() || (picked.textContent||'').trim();
        }
      }
      if (!val) {
        var chk = ci.querySelector('input[type="radio"]:checked');
        if (chk) val = chk.value || chk.getAttribute('data-value') || (chk.getAttribute('aria-label')||'').trim();
      }
      if (qid && val && !(qid in o)) o[qid] = String(val);
    }

    // B) Fallbacks: any other checked radios on the page
    var radios = document.querySelectorAll('input[type="radio"]:checked');
    for (i=0;i<radios.length;i++){
      var key = radios[i].name || radios[i].id || radios[i].getAttribute('data-qid');
      var val2 = radios[i].value || radios[i].getAttribute('data-value') || (radios[i].getAttribute('aria-label')||'').trim();
      if (key && !(key in o) && val2) o[key] = val2;
    }

    // C) Fallback for custom widgets with data-qid + selected class
    var customs = document.querySelectorAll('.selected[data-qid], .active[data-qid], [role="radio"][aria-checked="true"][data-qid]');
    for (i=0;i<customs.length;i++){
      var el = customs[i], k = el.getAttribute('data-qid') || el.id;
      var v = el.getAttribute('data-val') || el.getAttribute('data-value') ||
              (el.getAttribute('aria-label')||'').trim() || (el.textContent||'').trim();
      if (k && !(k in o) && v) o[k] = v;
    }

    // Overall score (if present on the results page)
    var scoreEl = document.getElementById('scorePercent');
    if (scoreEl) o.score_percent = String(scoreEl.textContent||'').trim();

    return o;
  }

  // ---------- one-time duplicate guard per form ----------
  function savedKey(){ return 'gsync_saved_' + formType(); }
  function alreadySaved(){ try { return sessionStorage.getItem(savedKey()) === '1'; } catch(_) { return false; } }
  function markSaved(){ try { sessionStorage.setItem(savedKey(), '1'); } catch(_) {} }

  function save(tag){
    if (alreadySaved()) return;
    var data = collect();
    data._trigger = tag || 'submit';
    post(data, function(){
      markSaved();
      var count = 0; for (var k in data) if (Object.prototype.hasOwnProperty.call(data,k)) count++;
      toast('✔ Saved! (' + (count-1) + ' fields)', true); // minus _trigger
      if (window.console) console.log('[gsync] payload', data);
    }, function(err){
      toast('✖ Error: ' + err.message, false);
      if (window.console) console.error('[gsync] error', err);
    });
  }

  // ---------- find submit/pdf from any clicked element ----------
  function _findAction(el){
    var SUBMIT_PAT = /(submit|finish|done|complete|confirm)/i;
    var PDF_PAT    = /(pdf|download)/i;
    while (el && el !== document) {
      var id  = (el.id || '').toLowerCase();
      var cls = (el.className || '').toString().toLowerCase();
      var txt = (el.textContent || el.value || '').toString().trim().toLowerCase();
      var role= (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
      var isButtonish =
        el.tagName === 'BUTTON' ||
        (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) ||
        role === 'button' ||
        cls.indexOf('btn') > -1 || cls.indexOf('button') > -1 ||
        el.tagName === 'A' || (el.hasAttribute && el.hasAttribute('data-action'));
      if (isButtonish) {
        if (SUBMIT_PAT.test(id) || SUBMIT_PAT.test(cls) || SUBMIT_PAT.test(txt) || (el.getAttribute && el.getAttribute('data-action') === 'submit')) {
          return { type: 'submit', el: el };
        }
        if (PDF_PAT.test(id) || PDF_PAT.test(cls) || PDF_PAT.test(txt) || (el.getAttribute && el.getAttribute('data-action') === 'pdf')) {
          return { type: 'pdf', el: el };
        }
      }
      el = el.parentNode;
    }
    return null;
  }

  function onClick(ev){
    var act = _findAction(ev.target);
    if (!act) return;
    if (act.type === 'submit') {
      if (!window.confirm('Are you sure you want to submit now? Your answers will be saved to the spreadsheet.')) {
        ev.preventDefault(); ev.stopPropagation(); return;
      }
      save('submit-confirm');   // do not block app navigation
      return;
    }
    if (act.type === 'pdf') {
      save('pdf-click');        // save once before opening PDF
      return;
    }
  }

  // attach
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ document.addEventListener('click', onClick, true); });
  } else {
    document.addEventListener('click', onClick, true);
  }

  // expose for quick manual tests
  window.gsync = { save: function(){ save('manual'); }, collect: collect };
})();
