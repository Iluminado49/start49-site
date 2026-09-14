/* Start49 — contact form.
   The design's form was a prototype with an unbound submit handler, so it needs a
   real destination. Two modes, chosen at build time in build/pages.json:

     formEndpoint set   -> the form POSTs to it (Formspree, Basin, a function…)
                           and this script submits it over fetch for inline
                           feedback instead of a page navigation.
     formEndpoint empty -> fallback: compose a mailto: to hey@start49.com.

   The fallback keeps the site shippable on GitHub Pages, which has no backend,
   but it is a stopgap: it opens the visitor's mail client and loses anyone
   without one configured. Set formEndpoint before launch. */

(function () {
  'use strict';

  var form = document.querySelector('form');
  if (!form) return;

  var status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  form.appendChild(status);

  function say(msg, state) {
    status.textContent = msg;
    status.setAttribute('data-state', state);
  }

  function values() {
    var data = new FormData(form);
    var out = {};
    data.forEach(function (v, k) { out[k] = v; });
    // The design's inputs carry ids but no name attributes; fall back to ids.
    form.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (!el.name && el.id) out[el.id] = el.value;
    });
    return out;
  }

  form.addEventListener('submit', function (e) {
    if (!form.reportValidity()) return;

    var endpoint = form.getAttribute('action');
    var mailto = form.getAttribute('data-mailto');

    if (endpoint) {
      e.preventDefault();
      say('Sending…', '');
      fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          say('Thanks — we’ll come back to you shortly.', 'ok');
        })
        .catch(function () {
          say('Something went wrong. Email us at ' + (mailto || 'hey@start49.com') + '.', 'error');
        });
      return;
    }

    if (mailto) {
      e.preventDefault();
      var v = values();
      var body = [
        'Name: ' + (v['full-name'] || ''),
        'Email: ' + (v.email || ''),
        'Expected budget: ' + (v.budget || ''),
        '',
        v.brief || '',
      ].join('\n');
      window.location.href =
        'mailto:' + mailto +
        '?subject=' + encodeURIComponent('Project enquiry from start49.com') +
        '&body=' + encodeURIComponent(body);
      say('Opening your email client…', 'ok');
    }
  });
})();
