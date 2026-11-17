/* Device Manager surface.
   state.dev = { devices: { id: { cat, name, status: 'ok' | 'error' | 'disabled' | 'nodriver', present, driver: { version, date, prev }, fixBy, realName, need } } }
   fixBy says what actually cures a faulty device: 'rollback', 'enable' or 'update'. Anything else behaves the way it would on a real PC. */
(function (root) {
  function H(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function btn(parent, label, fn) { var b = H('button', { type: 'button' }, parent, label); b.addEventListener('click', fn); return b; }
  var MARK = { ok: '', error: 'Warning', disabled: 'Disabled', nodriver: 'Warning' };
  var TEXT = { ok: 'This device is working properly.', error: 'This device cannot start. (Code 10)', disabled: 'This device is disabled. (Code 22)', nodriver: 'The drivers for this device are not installed. (Code 28)' };

  root.Surfaces.devmgr = {
    title: 'Device Manager',
    mount: function (host, ctx) {
      var D = ctx.state.dev.devices, open = null;
      host.classList.add('pane-app');
      var top = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host), detail = H('div', {}, host);
      function change(text, tags) { ctx.log({ type: 'change', text: 'Device Manager: ' + text, tags: tags || [] }); ctx.changed(); render(); }

      function render() {
        top.textContent = ''; detail.textContent = '';
        H('h3', {}, top, 'Devices on this PC');
        var row = H('div', { 'class': 'btn-row' }, top);
        btn(row, 'Scan for hardware changes', function () {
          var back = [];
          Object.keys(D).forEach(function (id) { var d = D[id]; if (!d.present) { d.present = true; d.status = d.fixBy && d.fixBy !== 'enable' && !d.fixed ? d.faultStatus : 'ok'; back.push(d.name); } });
          msg.textContent = back.length ? 'Found and reinstalled: ' + back.join(', ') + '.' : 'No new hardware was found.';
          if (back.length) change('scanned for hardware changes; reinstalled ' + back.join(', '), ['dev:scan']); else ctx.log({ type: 'view', text: 'Scanned for hardware changes: nothing new', tags: ['dev:scan'] });
        });
        btn(row, 'Test the devices in the ticket', function () {
          var res = ctx.lab.deviceTest.map(function (t) { var d = D[t.id]; return t.label + ': ' + (d.present && d.status === 'ok' ? t.ok : t.bad); });
          var ok = ctx.lab.deviceTest.every(function (t) { return D[t.id].present && D[t.id].status === 'ok'; });
          msg.textContent = res.join(' ');
          ctx.log({ type: 'test', text: 'Tested the devices in the ticket: ' + (ok ? 'all working' : 'not all working'), tags: ['dev:test', ok ? 'dev:test:ok' : 'dev:test:fail'], ok: ok });
        });
        var cats = {}; Object.keys(D).forEach(function (id) { if (D[id].present) (cats[D[id].cat] = cats[D[id].cat] || []).push(id); });
        var ul = H('ul', { 'class': 'devtree' }, top);
        Object.keys(cats).sort().forEach(function (c) {
          var li = H('li', {}, ul); H('strong', {}, li, c); var sub = H('ul', {}, li);
          cats[c].forEach(function (id) {
            var d = D[id], b = H('button', { type: 'button', 'class': 'dev dev-' + d.status }, H('li', {}, sub));
            if (MARK[d.status]) H('span', { 'class': 'dev-mark' }, b, d.status === 'disabled' ? '↓' : '!');
            b.appendChild(document.createTextNode(d.name));
            if (MARK[d.status]) H('span', { 'class': 'sr' }, b, ' (' + MARK[d.status] + ')');
            b.addEventListener('click', function () { open = id; ctx.log({ type: 'view', text: 'Opened properties for ' + d.name, tags: ['dev:view', d.status === 'ok' ? 'dev:view:ok' : 'dev:view:problem'] }); render(); var h = detail.querySelector('h3'); if (h) h.focus(); });
          });
        });
        if (open && D[open] && D[open].present) props(open);
      }

      function props(id) {
        var d = D[id];
        H('h3', { tabindex: '-1' }, detail, d.name + ' — properties');
        var c = H('section', { 'class': 'app-card' + (d.status === 'ok' ? '' : ' app-alert') }, detail);
        H('p', {}, c, 'Device status: ' + TEXT[d.status]);
        H('p', { 'class': 'muted' }, c, d.driver ? 'Driver version ' + d.driver.version + ', dated ' + d.driver.date + (d.driver.prev ? ' · previous version ' + d.driver.prev.version + ' is kept on this PC' : '') : 'No driver installed.');
        var row = H('div', { 'class': 'btn-row' }, detail);
        btn(row, 'Update driver', function () {
          if (d.status === 'nodriver') { d.status = 'ok'; d.fixed = true; d.driver = d.need; var old = d.name; d.name = d.realName || d.name; msg.textContent = 'A driver was found and installed. ' + old + ' is now ' + d.name + '.'; change('installed a driver for ' + d.name, ['dev:update']); }
          else { msg.textContent = 'The best drivers for this device are already installed.'; ctx.log({ type: 'test', text: 'Tried Update driver on ' + d.name + ': already the newest', tags: ['dev:update:none'], ok: false }); }
        });
        var rb = btn(row, 'Roll back driver', function () {
          var cur = d.driver; d.driver = { version: cur.prev.version, date: cur.prev.date }; if (d.fixBy === 'rollback') { d.fixed = true; if (d.status === 'error') d.status = 'ok'; }
          msg.textContent = 'The previous driver (version ' + d.driver.version + ') was restored.'; change('rolled back the driver for ' + d.name + ' to version ' + d.driver.version, ['dev:rollback']);
        }); rb.disabled = !(d.driver && d.driver.prev);
        btn(row, d.status === 'disabled' ? 'Enable device' : 'Disable device', function () {
          if (d.status === 'disabled') { d.status = d.wasStatus || 'ok'; if (d.status === 'error' && d.fixed) d.status = 'ok'; msg.textContent = d.name + ' was enabled.'; change('enabled ' + d.name, ['dev:enable']); }
          else { d.wasStatus = d.status; d.status = 'disabled'; msg.textContent = d.name + ' was disabled.'; change('disabled ' + d.name, ['dev:disable']); }
        });
        btn(row, 'Uninstall device', function () { d.present = false; open = null; msg.textContent = d.name + ' was uninstalled.'; change('uninstalled ' + d.name, ['dev:uninstall']); });
      }
      render();
      return { refresh: render };
    }
  };
})(this);
