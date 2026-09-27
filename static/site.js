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

/* Phone navigation: collapse the header links behind a burger button.
   CSS hides #site-nav below 768px; this toggles .nav-open on the header. */

(function () {
  'use strict';

  var header = document.querySelector('[data-site-header]');
  if (!header) return;
  var btn = header.querySelector('.nav-toggle');
  var nav = header.querySelector('#site-nav');
  if (!btn || !nav) return;

  function setOpen(open) {
    header.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  btn.addEventListener('click', function () {
    setOpen(!header.classList.contains('nav-open'));
  });

  /* Following a link closes the panel, including in-page anchors where no
     navigation happens. */
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) {
      setOpen(false);
      btn.focus();
    }
  });

  /* Tapping the page behind the panel closes it. */
  document.addEventListener('click', function (e) {
    if (header.classList.contains('nav-open') && !header.contains(e.target)) {
      setOpen(false);
    }
  });

  /* Rotating to landscape can cross the breakpoint with the panel open. */
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 768) setOpen(false);
  });
})();
