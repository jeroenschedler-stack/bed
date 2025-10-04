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

    // Ratings – robust and order-aware
    var usedKeys = {};
    function put(k, v) { if (k && v != null && !(k in o)) { o[k] = String(v); usedKeys[k] = 1; } }
    function nextKey() {
      var n=1; while (usedKeys['q'+Strin]()
