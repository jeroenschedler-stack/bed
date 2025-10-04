/* ===== CONFIG ===== */
var GS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxuCs7VB4t-iSbvv_PneUs0dA8wbB3GeUR2QmaNelUEU4IbGmkrhPr_QksIaZwlvkGA/exec';
var TOKEN = ''; // optional
/* ================== */

(function () {
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
    setTimeout(function(){ el.style.display='none'; }, 4000);
  }

  function confirmBox(text, onYes, onNo) {
    var back = document.getElementById('gsync_confirm');
    if (!back) {
      back = document.createElement('div');
      back.id = 'gsync_confirm';
      back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99998';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(92vw,520px);background:#fff;border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25)';
      card.innerHTML =
        '<h3 style="margin:0 0 10px 0;font-size:18px;">please confirm</h3>' +
        '<p style="margin:0 0 18px 0;font-size:16px;line-height:1.5;color:#222;">' + text + '</p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
        '  <button id="gsync_cancel" style="width:120px;height:42px;font-size:12pt;border:1px solid #ccc;border-radius:14px;background:#f3f4f6;color:#111;">Cancel</button>' +
        '  <button id="gsync_ok" style="width:120px;height:42px;font-size:12pt;border:none;border-radius:14px;background:#1E90FF;color:#fff;">Submit</button>' +
        '</div>';
      back.addEventListener('click', function (e) { if (e.target === back) close(false); });
      document.body.appendChild(back);
      document.getElementById('gsync_cancel').onclick = function(){ close(false); };
      document.getElementById('gsync_ok').onclick = function(){ close(true); };
    } else {
      document.body.appendChild(back);
    }
    function close(ok){ back.parentNode.removeChild(back); ok ? onYes&&onYes() : onNo&&onNo(); }
  }

  function formType() {
    if (location.pathname.indexOf('/peer/') > -1) return 'peer';
    var sub = document.querySelector('.subheader');
    if (sub && /peer/i.test(sub.textContent||'')) return 'peer';
    return 'team';
  }

  function collect() {
    var o = { form: formType() };
    if (TOKEN) o.token = TOKEN;

    var els = document.querySelectorAll('input[id],select[id],textarea[id]');
    for (var i=0;i<els.length;i++){ if(!els[i].name) els[i].name = els[i].id; }

    var f = document.querySelector('form');
    if (f && window.FormData) {
      var fd = new FormData(f), it = fd.entries ? fd.entries() : null, e;
      if (it && it.next) while(!(e=it.next()).done) o[e.value[0]] = e.value[1];
    }
    if (!f || !window.FormData) {
      var inputs = document.querySelectorAll('input,select,textarea,[data-field]');
      for (var j=0;j<inputs.length;j++){
        var el = inputs[j], name = el.name || el.getAttribute('data-field'); if(!name) continue;
        if ((el.type==='checkbox'||el.type==='radio')) { if(el.checked) o[name]=el.value||'on'; }
        else { o[name] = el.value || ''; }
      }
    }
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
    var xhr=new XMLHttpRequest();
    xhr.open('POST', GS_ENDPOINT, true);
    xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');
    xhr.onreadystatechange=function(){
      if (xhr.readyState!==4) return;
      if (xhr.status>=200 && xhr.status<300){
        var ok=true; try{ ok=JSON.parse(xhr.responseText||'{}').ok===true; }catch(e){}
        ok ? okCb() : errCb(new Error('Server error'));
      } else errCb(new Error('HTTP '+xhr.status));
    };
    xhr.send(encode(payload));
  }

  var savedOnce=false;
  function save(tag){
    if (savedOnce) return;
    savedOnce=true;
    var data=collect(); data._trigger=tag||'submit';
    post(data,function(){ toast('✔ Saved!', true); },
             function(err){ savedOnce=false; toast('✖ Error: '+err.message, false); });
  }

  function onClick(ev){
    var t=ev.target;
    while (t && t!==document && !(t.matches && t.matches('button,[role="button"],input[type="submit"]'))) t=t.parentNode;
    if (!t || t===document) return;
    var txt=String(t.textContent||t.value||'').toLowerCase().trim();

    if (t.id==='submitAll' || /(^|\b)submit(\b|$)/.test(txt)) {
      confirmBox('Are you sure you want to submit now? Your answers will be saved to the spreadsheet.',
        function(){ save('submit-confirm'); }, function(){});
    }
    if (t.id==='congratsPdf' || /(^|\b)pdf(\b|$)/.test(txt)) {
      save('pdf-click');
    }
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', function(){ document.addEventListener('click', onClick, true); });
  } else {
    document.addEventListener('click', onClick, true);
  }
})();
