// SparkleTeam launch page: fill placeholders from assets/placeholders.json, copy BibTeX.
(function () {
  // Placeholders: any key with a non-empty string value replaces the {{KEY}} text / pending link.
  fetch('assets/placeholders.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (ph) {
      var v = (ph && ph.values) || {};
      document.querySelectorAll('[data-ph]').forEach(function (el) {
        var val = v[el.getAttribute('data-ph')];
        if (typeof val === 'string' && val.trim()) { el.textContent = val; el.classList.remove('ph'); }
      });
      document.querySelectorAll('[data-ph-href]').forEach(function (el) {
        var val = v[el.getAttribute('data-ph-href')];
        if (typeof val === 'string' && val.trim()) { el.setAttribute('href', val); el.classList.add('ready'); el.classList.remove('pending'); }
      });
    })
    .catch(function () { /* opened from file:// or offline: placeholders stay visible */ });

  // Live demo: swap the "coming" slot for a player once assets/video/sparkleteam-demo.mp4 exists,
  // and point the Video button at it (otherwise it keeps pointing at the full video).
  var DEMO = 'assets/video/sparkleteam-demo.mp4', DEMO_POSTER = 'assets/video/sparkleteam-demo-poster.png';
  var slot = document.getElementById('demo-slot');
  if (slot && window.fetch) {
    fetch(DEMO, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
      if (!r.ok) return;
      var v = document.createElement('video');
      v.src = DEMO; v.controls = true; v.playsInline = true; v.preload = 'metadata';
      v.width = 1920; v.height = 1080;
      v.setAttribute('aria-label', 'SparkleTeam live demo, 60 seconds');
      fetch(DEMO_POSTER, { method: 'HEAD', cache: 'no-cache' }).then(function (p) { if (p.ok) v.poster = DEMO_POSTER; }).catch(function () {});
      slot.innerHTML = ''; slot.appendChild(v);
      var btn = document.getElementById('video-btn');
      if (btn) btn.setAttribute('href', DEMO);
    }).catch(function () {});
  }

  document.querySelectorAll('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = document.getElementById(btn.getAttribute('data-copy')).innerText;
      var done = function () {
        btn.textContent = 'Copied'; btn.classList.add('done');
        setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done);
      } else {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
        ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove();
      }
    });
  });
})();
