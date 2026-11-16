/* Printers and Services surfaces.
   state.print = { defaultPrinter, cancelledGood, printers: { id: { name, note, offline, paused, printed, jobs: [{ doc, owner, pages, status, bad }] } } }
   state.services = { id: { name, desc, status: 'running' | 'stopped' } }   (the print spooler has id "spooler") */
(function (root) {
  function H(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function spoolerUp(state) { return !state.services || !state.services.spooler || state.services.spooler.status === 'running'; }
  function blocked(pr) { return pr.jobs.length && /^(Error|Deleting)/.test(pr.jobs[0].status); }

  /* Let the simulated queues move: healthy printers print whatever is waiting. */
  function settle(state) {
    if (!state.print || !spoolerUp(state)) return;
    Object.keys(state.print.printers).forEach(function (id) {
      var pr = state.print.printers[id];
      if (pr.offline || pr.paused || blocked(pr)) return;
      pr.printed = (pr.printed || 0) + pr.jobs.length; pr.jobs = [];
    });
  }
  function spoolerStarted(state) {            // jobs stuck in "Deleting" only clear when the spooler restarts
    if (!state.print) return;
    Object.keys(state.print.printers).forEach(function (id) {
      var pr = state.print.printers[id]; pr.jobs = pr.jobs.filter(function (j) { return !/^Deleting/.test(j.status); });
    });
    settle(state);
  }
  function statusOf(pr) { return pr.offline ? 'Offline' : pr.paused ? 'Paused' : blocked(pr) ? 'Error' : 'Ready'; }

  root.Surfaces.printers = {
    title: 'Printers',
    mount: function (host, ctx) {
      var P = ctx.state.print, open = null;
      host.classList.add('pane-app');
      var list = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host), queue = H('div', {}, host);
      function say(t) { msg.textContent = t; }
      function change(text, tags) { ctx.log({ type: 'change', text: text, tags: tags || [] }); settle(ctx.state); ctx.changed(); render(); }
      function btn(parent, label, fn, cls) { var b = H('button', { type: 'button' }, parent, label); if (cls) b.className = cls; b.addEventListener('click', fn); return b; }

      function render() {
        settle(ctx.state);
        list.textContent = ''; queue.textContent = '';
        H('h3', {}, list, 'Printers on this PC');
        if (!spoolerUp(ctx.state)) { H('p', { 'class': 'app-warn' }, list, 'The print spooler service is not running. No printers are available.'); return; }
        Object.keys(P.printers).forEach(function (id) {
          var pr = P.printers[id], card = H('section', { 'class': 'app-card', 'aria-label': pr.name }, list);
          var head = H('div', { 'class': 'app-card-head' }, card);
          H('strong', {}, head, pr.name);
          if (P.defaultPrinter === id) H('span', { 'class': 'badge' }, head, 'Default');
          H('p', { 'class': 'muted' }, card, 'Status: ' + statusOf(pr) + ' · ' + pr.jobs.length + ' document' + (pr.jobs.length === 1 ? '' : 's') + ' in queue' + (pr.note ? ' · ' + pr.note : ''));
          var row = H('div', { 'class': 'btn-row' }, card);
          btn(row, 'Open print queue', function () { open = id; ctx.log({ type: 'view', text: 'Opened the print queue for ' + pr.name, tags: ['queue:open', 'queue:open:' + id] }); render(); var h = queue.querySelector('h3'); if (h) h.focus(); });
          var d = btn(row, 'Set as default', function () { P.defaultPrinter = id; say(pr.name + ' is now the default printer.'); change('Set ' + pr.name + ' as the default printer', ['default:' + id]); });
          d.disabled = P.defaultPrinter === id;
          btn(row, 'Print test page', function () {
            pr.jobs.push({ doc: 'Test page', owner: 'labtech', pages: 1, status: 'Waiting' });
            settle(ctx.state);
            var ok = !pr.jobs.length;
            say(ok ? 'The test page printed on ' + pr.name + '.' : 'The test page did not print. It is waiting in the queue for ' + pr.name + '.');
            ctx.log({ type: 'test', text: 'Printed a test page on ' + pr.name + (ok ? ': printed' : ': did not print'), tags: ['testpage', (ok ? 'testpage-ok:' : 'testpage-fail:') + id], ok: ok });
            render();
          });
        });
        if (open && P.printers[open]) drawQueue(open);
      }

      function drawQueue(id) {
        var pr = P.printers[id];
        H('h3', { tabindex: '-1' }, queue, 'Print queue: ' + pr.name);
        var opts = H('div', { 'class': 'app-opts' }, queue);
        [['offline', 'Use printer offline'], ['paused', 'Pause printing']].forEach(function (o) {
          var l = H('label', { 'class': 'radio' }, opts), c = H('input', { type: 'checkbox' }, l); c.checked = !!pr[o[0]];
          l.appendChild(document.createTextNode(' ' + o[1]));
          c.addEventListener('change', function () { pr[o[0]] = c.checked; say(o[1] + (c.checked ? ' turned on.' : ' turned off.')); change(pr.name + ': "' + o[1] + '" turned ' + (c.checked ? 'on' : 'off'), [o[0] + ':' + (c.checked ? 'on' : 'off')]); });
        });
        if (!pr.jobs.length) { H('p', {}, queue, 'There are no documents in the queue.' + (pr.printed ? ' ' + pr.printed + ' printed this session.' : '')); }
        else {
          var wrap = H('div', { 'class': 'table-wrap' }, queue), t = H('table', {}, wrap), hr = H('tr', {}, H('thead', {}, t)), tb = H('tbody', {}, t);
          ['Document', 'Status', 'Owner', 'Pages', 'Action'].forEach(function (h) { H('th', { scope: 'col' }, hr, h); });
          pr.jobs.forEach(function (j) {
            var tr = H('tr', {}, tb); H('td', {}, tr, j.doc); H('td', {}, tr, j.status); H('td', {}, tr, j.owner); H('td', {}, tr, String(j.pages));
            var td = H('td', {}, tr);
            var c = btn(td, 'Cancel', function () { cancel(pr, [j]); }); c.setAttribute('aria-label', 'Cancel ' + j.doc); c.disabled = /^Deleting/.test(j.status);
          });
        }
        var row = H('div', { 'class': 'btn-row' }, queue);
        var all = btn(row, 'Cancel all documents', function () { cancel(pr, pr.jobs.slice()); }); all.disabled = !pr.jobs.length;
        btn(row, 'Close queue', function () { open = null; render(); });
      }

      function cancel(pr, jobs) {
        jobs.forEach(function (j) {
          if (j.bad) j.status = 'Deleting - Error';            // a jammed job hangs in "Deleting" until the spooler restarts
          else { if (j.doc !== 'Test page') P.cancelledGood = (P.cancelledGood || 0) + 1; pr.jobs.splice(pr.jobs.indexOf(j), 1); }
        });
        say(jobs.length === 1 ? 'Cancel requested for ' + jobs[0].doc + '.' : 'Cancel requested for all documents.');
        change(pr.name + ': cancelled ' + (jobs.length === 1 ? jobs[0].doc : 'all documents (' + jobs.length + ')'), ['cancel']);
      }

      render();
      return { refresh: render, focus: function () { var b = host.querySelector('button'); if (b) b.focus(); } };
    }
  };

  root.Surfaces.services = {
    title: 'Services',
    mount: function (host, ctx) {
      var Sv = ctx.state.services;
      host.classList.add('pane-app');
      H('h3', {}, host, 'Services');
      var wrap = H('div', { 'class': 'table-wrap' }, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host);
      function set(id, to, verb) {
        var s = Sv[id];
        if (verb === 'Restarted') { s.status = 'running'; } else s.status = to;
        ctx.log({ type: 'change', text: verb + ' the ' + s.name + ' service', tags: ['service', 'service:' + id, 'service:' + id + ':' + verb.toLowerCase()] });
        if (id === 'spooler' && s.status === 'running') spoolerStarted(ctx.state);
        msg.textContent = 'The ' + s.name + ' service was ' + verb.toLowerCase() + '.';
        ctx.changed(); render();
      }
      function render() {
        wrap.textContent = '';
        var t = H('table', {}, wrap), hr = H('tr', {}, H('thead', {}, t)), tb = H('tbody', {}, t);
        ['Name', 'Description', 'Status', 'Actions'].forEach(function (h) { H('th', { scope: 'col' }, hr, h); });
        Object.keys(Sv).forEach(function (id) {
          var s = Sv[id], tr = H('tr', {}, tb), up = s.status === 'running';
          H('th', { scope: 'row' }, tr, s.name); H('td', {}, tr, s.desc); H('td', {}, tr, up ? 'Running' : 'Stopped');
          var td = H('td', {}, tr), row = H('div', { 'class': 'btn-row tight' }, td);
          [['Start', !up, function () { set(id, 'running', 'Started'); }], ['Stop', up, function () { set(id, 'stopped', 'Stopped'); }], ['Restart', up, function () { set(id, 'running', 'Restarted'); }]].forEach(function (a) {
            var b = H('button', { type: 'button', 'aria-label': a[0] + ' ' + s.name }, row, a[0]); b.disabled = !a[1]; b.addEventListener('click', a[2]);
          });
        });
      }
      render();
      return { refresh: render };
    }
  };
})(this);
