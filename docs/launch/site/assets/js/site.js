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
        if (typeof val === 'string' && val.trim()) { el.setAttribute('href', val); el.classList.add('ready'); }
      });
    })
    .catch(function () { /* opened from file:// or offline: placeholders stay visible */ });

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
