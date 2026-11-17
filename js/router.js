/* Router admin page surface. Pages and fields come from lab.router.pages:
   { id, title, intro, fields: [{ path, label, type: 'text' | 'select' | 'check' | 'secret', options, help }], firmware: true }
   Values live in state.router. Each page saves as one change; secrets are never written to the timeline. */
(function (root) {
  function H(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function get(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split('.'), last = ks.pop(); ks.reduce(function (a, k) { return a[k]; }, o)[last] = v; }

  root.Surfaces.router = {
    title: 'Router Admin',
    mount: function (host, ctx) {
      var R = ctx.lab.router, st = ctx.state, page = R.pages[0].id;
      host.classList.add('pane-app');
      var nav = H('div', { 'class': 'subnav', role: 'group', 'aria-label': 'Router pages' }, host), body = H('div', {}, host);
      var msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host);

      function render() {
        nav.textContent = ''; body.textContent = '';
        R.pages.forEach(function (p) {
          var b = H('button', { type: 'button', 'aria-pressed': p.id === page ? 'true' : 'false' }, nav, p.title);
          b.addEventListener('click', function () { page = p.id; msg.textContent = ''; if (p.status) ctx.log({ type: 'view', text: 'Opened the router ' + p.title + ' page', tags: ['router:status'] }); render(); });
        });
        var p = R.pages.filter(function (x) { return x.id === page; })[0];
        H('h3', {}, body, R.model + ' — ' + p.title);
        if (p.intro) H('p', { 'class': 'muted' }, body, p.intro);
        if (p.status) { status(body); return; }
        var form = H('form', { 'class': 'settings', novalidate: '', autocomplete: 'off' }, body), inputs = [];
        (p.fields || []).forEach(function (f, i) {
          var id = 'rt-' + p.id + '-' + i, cur = get(st, f.path), inp;
          if (f.type === 'check') {
            var l = H('label', { 'class': 'radio' }, form); inp = H('input', { type: 'checkbox', id: id }, l); inp.checked = !!cur; l.appendChild(document.createTextNode(' ' + f.label));
          } else {
            H('label', { 'for': id }, form, f.label);
            if (f.type === 'select') { inp = H('select', { id: id }, form); f.options.forEach(function (o) { var op = H('option', { value: o }, inp, o); if (o === cur) op.selected = true; }); }
            else { inp = H('input', { id: id, type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }, form); inp.value = cur == null ? '' : cur; }
          }
          if (f.help) H('p', { 'class': 'muted field-help' }, form, f.help);
          inputs.push([f, inp]);
        });
        if (p.fields && p.fields.length) {
          var row = H('div', { 'class': 'btn-row' }, form); H('button', { type: 'submit', 'class': 'primary' }, row, 'Save settings');
          form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var changed = [];
            inputs.forEach(function (x) {
              var f = x[0], v = f.type === 'check' ? x[1].checked : x[1].value.trim();
              if (v !== get(st, f.path)) { set(st, f.path, v); changed.push(f.type === 'secret' ? f.label + ' changed' : f.label + ': ' + (f.type === 'check' ? (v ? 'on' : 'off') : (v || '(blank)'))); }
            });
            if (!changed.length) { msg.textContent = 'No changes to save.'; return; }
            ctx.log({ type: 'change', text: 'Router ' + p.title + ' — ' + changed.join('; '), tags: ['router:save', 'router:save:' + p.id] });
            msg.textContent = 'Settings saved.'; ctx.changed(); render();
          });
        }
        if (p.firmware) firmware(body);
      }

      function firmware(parent) {
        var F = st.router.firmware, box = H('section', { 'class': 'app-card' }, parent);
        H('strong', {}, box, 'Firmware');
        H('p', {}, box, 'Installed version: ' + F.version + (F.checked ? (F.version === F.latest ? ' (up to date)' : ' · version ' + F.latest + ' is available') : ''));
        var row = H('div', { 'class': 'btn-row' }, box);
        var c = H('button', { type: 'button' }, row, 'Check for update');
        c.addEventListener('click', function () { F.checked = true; ctx.log({ type: 'view', text: 'Checked for a router firmware update', tags: ['router:fwcheck'] }); msg.textContent = F.version === F.latest ? 'The firmware is up to date.' : 'Version ' + F.latest + ' is available.'; render(); });
        var i = H('button', { type: 'button' }, row, 'Install update'); i.disabled = !F.checked || F.version === F.latest;
        i.addEventListener('click', function () { F.version = F.latest; ctx.log({ type: 'change', text: 'Installed router firmware ' + F.latest, tags: ['router:firmware'] }); msg.textContent = 'Firmware ' + F.latest + ' installed. The router restarted.'; ctx.changed(); render(); });
      }

      function status(parent) {
        var r = st.router, dl = H('dl', { 'class': 'status-list' }, parent);
        function row(k, v) { H('dt', {}, dl, k); H('dd', {}, dl, v); }
        row('Firmware', r.firmware.version);
        row('Office network', (r.ssid || '(no name)') + ' · ' + r.security + (r.security === 'Open (no password)' ? ' · anyone nearby can join' : ''));
        row('Guest network', r.guest.enabled ? (r.guest.ssid || '(no name)') + (r.guest.isolate ? ' · isolated from the office network' : ' · can reach office devices') : 'Off');
        row('Admin sign-in', r.adminPass === R.defaultAdminPass ? 'Still using the default password printed on the label' : 'Custom password set');
        row('Remote management', r.remote ? 'On: the admin page is reachable from the internet' : 'Off');
        row('WPS', r.wps ? 'On' : 'Off'); row('UPnP', r.upnp ? 'On' : 'Off');
      }

      render();
      return { refresh: render };
    }
  };
})(this);
