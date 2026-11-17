/* Hypervisor, System Information, Disk Cleanup and Software Install surfaces.
   Hypervisor: state.hv = { host: { ramGB, reserveGB, cores }, drives: { C: { freeGB }, D: { freeGB } }, isos: [], vms: { id: vm } }
     vm = { name, iso, ramGB, cpus, diskGB, drive, net, running, osInstalled, appInstalled, snapshots: [], locked }
   Install labs: state.pc = { freeGB, cleanup: { id: { label, gb, userData, done } }, downloads: [...], installed, ranUnknown } */
(function (root) {
  function H(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function btn(parent, label, fn, aria) { var b = H('button', { type: 'button' }, parent, label); if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', fn); return b; }
  function field(form, id, label, el) { H('label', { 'for': id }, form, label); el.id = id; form.appendChild(el); return el; }
  function select(opts, cur) { var s = document.createElement('select'); opts.forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; var op = H('option', { value: String(v) }, s, t); if (String(v) === String(cur)) op.selected = true; }); return s; }
  var NETS = [['bridged', 'Bridged: joins the office network like a real PC'], ['nat', 'NAT: internet through the host, hidden from the office network'], ['internal', 'Internal: isolated, can reach only other internal VMs']];
  function netName(v) { return NETS.filter(function (n) { return n[0] === v; })[0][1].split(':')[0]; }

  root.Surfaces.hypervisor = {
    title: 'Hypervisor',
    mount: function (host, ctx) {
      var V = ctx.state.hv, open = null, editing = false;
      host.classList.add('pane-app');
      var top = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host), detail = H('div', {}, host);
      function say(t) { msg.textContent = t; }
      function assigned() { return Object.keys(V.vms).reduce(function (n, id) { return n + V.vms[id].ramGB; }, 0); }
      function inUse() { return Object.keys(V.vms).reduce(function (n, id) { return n + (V.vms[id].running ? V.vms[id].ramGB : 0); }, 0); }
      function change(text, tags) { ctx.log({ type: 'change', text: 'Hypervisor: ' + text, tags: tags || [] }); ctx.changed(); render(); }

      function render() {
        top.textContent = ''; detail.textContent = '';
        H('h3', {}, top, 'Host: ' + V.host.name);
        var hc = H('section', { 'class': 'app-card' }, top);
        H('p', {}, hc, 'Memory: ' + V.host.ramGB + ' GB installed · ' + assigned() + ' GB assigned to virtual machines · ' + inUse() + ' GB in use by running VMs');
        H('p', {}, hc, 'Processor: ' + V.host.cores + ' cores · Storage: C: ' + V.drives.C.freeGB + ' GB free (operating system drive), D: ' + V.drives.D.freeGB + ' GB free (VM storage drive)');
        H('h3', {}, top, 'Virtual machines');
        var w = H('div', { 'class': 'table-wrap' }, top), t = H('table', {}, w), hr = H('tr', {}, H('thead', {}, t)), tb = H('tbody', {}, t);
        ['Name', 'State', 'Memory', 'Processors', 'Disk', 'Network', 'Action'].forEach(function (h) { H('th', { scope: 'col' }, hr, h); });
        Object.keys(V.vms).forEach(function (id) {
          var m = V.vms[id], tr = H('tr', {}, tb);
          H('th', { scope: 'row' }, tr, m.name); H('td', {}, tr, m.running ? 'Running' : 'Off'); H('td', {}, tr, m.ramGB + ' GB'); H('td', {}, tr, String(m.cpus));
          H('td', {}, tr, m.diskGB + ' GB on ' + m.drive + ':'); H('td', {}, tr, netName(m.net));
          btn(H('td', {}, tr), 'Open', function () { open = id; editing = false; ctx.log({ type: 'view', text: 'Opened ' + m.name, tags: ['vm:view'] }); render(); var h = detail.querySelector('h3'); if (h) h.focus(); }, 'Open ' + m.name);
        });
        var nb = btn(H('div', { 'class': 'btn-row' }, top), 'New virtual machine', function () { open = 'new'; editing = true; render(); var h = detail.querySelector('h3'); if (h) h.focus(); });
        nb.disabled = !!V.vms['new'];
        if (open === 'new' && editing && !V.vms['new']) return form(null);
        if (open && V.vms[open]) { if (editing) form(V.vms[open]); else vmView(open); }
      }

      function form(m) {
        var isNew = !m; m = m || { name: '', iso: V.isos[0], ramGB: 2, cpus: 1, diskGB: 40, drive: 'C', net: 'bridged' };
        H('h3', { tabindex: '-1' }, detail, isNew ? 'New virtual machine' : 'Settings: ' + m.name);
        var f = H('form', { 'class': 'settings', novalidate: '', autocomplete: 'off' }, detail);
        var name = field(f, 'vm-name', 'Name', H('input', { type: 'text' })); name.value = m.name;
        var iso = field(f, 'vm-iso', 'Install from (ISO image)', select(V.isos, m.iso)); iso.disabled = !isNew;
        var ram = field(f, 'vm-ram', 'Memory (GB)', select([1, 2, 3, 4, 5, 6, 8, 10, 12], m.ramGB));
        var cpu = field(f, 'vm-cpu', 'Virtual processors', select([1, 2, 3, 4], m.cpus));
        var disk = field(f, 'vm-disk', 'Virtual disk size (GB)', select([20, 40, 60, 80, 120, 250], m.diskGB)); disk.disabled = !isNew;
        var drive = field(f, 'vm-drive', 'Store the virtual disk on', select([['C', 'C: operating system drive'], ['D', 'D: VM storage drive']], m.drive)); drive.disabled = !isNew;
        var net = field(f, 'vm-net', 'Network', select(NETS, m.net));
        if (!isNew) H('p', { 'class': 'muted field-help' }, f, 'The ISO, disk size and disk location cannot be changed after a VM is created. Delete and recreate it to change them.');
        var row = H('div', { 'class': 'btn-row' }, f); H('button', { type: 'submit', 'class': 'primary' }, row, isNew ? 'Create' : 'Save');
        btn(row, 'Cancel', function () { editing = false; if (isNew) open = null; render(); });
        f.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var v = { name: name.value.trim(), iso: iso.value, ramGB: Number(ram.value), cpus: Number(cpu.value), diskGB: Number(disk.value), drive: drive.value, net: net.value };
          if (!v.name) { say('Not saved: give the virtual machine a name.'); return; }
          if (isNew && v.diskGB > V.drives[v.drive].freeGB) { say('Not created: drive ' + v.drive + ': has only ' + V.drives[v.drive].freeGB + ' GB free.'); return; }
          var desc = v.name + ', ' + v.iso + ', ' + v.ramGB + ' GB memory, ' + v.cpus + ' processor' + (v.cpus === 1 ? '' : 's') + ', ' + v.diskGB + ' GB disk on ' + v.drive + ':, ' + netName(v.net) + ' network';
          if (isNew) {
            V.drives[v.drive].freeGB -= v.diskGB;
            V.vms['new'] = { name: v.name, iso: v.iso, ramGB: v.ramGB, cpus: v.cpus, diskGB: v.diskGB, drive: v.drive, net: v.net, running: false, osInstalled: false, appInstalled: false, snapshots: [] };
            open = 'new'; editing = false; say('Virtual machine created.'); change('created ' + desc, ['vm:create']);
          } else {
            ['name', 'ramGB', 'cpus', 'net'].forEach(function (k) { m[k] = v[k]; });
            editing = false; say('Settings saved.'); change('changed settings of ' + m.name + ' to ' + v.ramGB + ' GB memory, ' + v.cpus + ' processors, ' + netName(v.net) + ' network', ['vm:edit', m.locked ? 'vm:touch:locked' : 'vm:edit:new']);
          }
        });
      }

      function vmView(id) {
        var m = V.vms[id], A = ctx.lab.vmApp;
        H('h3', { tabindex: '-1' }, detail, m.name);
        var c = H('section', { 'class': 'app-card' }, detail);
        H('p', {}, c, m.iso + ' · ' + m.ramGB + ' GB memory · ' + m.cpus + ' processor' + (m.cpus === 1 ? '' : 's') + ' · ' + m.diskGB + ' GB disk on ' + m.drive + ': · ' + netName(m.net) + ' network');
        H('p', { 'class': 'muted' }, c, 'State: ' + (m.running ? 'running' : 'off') + (m.locked ? '' : ' · Guest OS: ' + (m.osInstalled ? 'installed' : 'not installed') + ' · ' + A.name + ': ' + (m.appInstalled ? 'installed' : 'not installed')));
        if (m.osInstalled && m.running && /32-bit/.test(m.iso) && m.ramGB > 4) H('p', { 'class': 'app-warn' }, c, 'The guest reports 4 GB of usable memory. ' + (m.ramGB - 4) + ' GB assigned to this VM cannot be used by a 32-bit operating system.');
        var r1 = H('div', { 'class': 'btn-row' }, detail);
        btn(r1, m.running ? 'Shut down' : 'Start', function () {
          if (!m.running && inUse() + m.ramGB > V.host.ramGB - 2) { say('Cannot start ' + m.name + ': the host does not have enough free memory.'); ctx.log({ type: 'test', text: 'Tried to start ' + m.name + ': not enough host memory', tags: ['vm:start:fail'], ok: false }); return; }
          m.running = !m.running; say(m.name + (m.running ? ' started.' : ' shut down.'));
          change((m.running ? 'started ' : 'shut down ') + m.name, [m.running ? 'vm:start' : 'vm:stop', m.locked ? 'vm:touch:locked' : 'vm:power:new']);
        });
        var eb = btn(r1, 'Settings', function () { editing = true; render(); }); eb.disabled = m.running;
        if (m.running) H('span', { 'class': 'muted' }, r1, 'Shut the VM down to change its settings.');
        btn(r1, 'Delete', function () {
          V.drives[m.drive].freeGB += m.diskGB; delete V.vms[id]; open = null; say(m.name + ' was deleted.');
          change('deleted ' + m.name, ['vm:delete', m.locked ? 'vm:touch:locked' : 'vm:delete:new']);
        });
        if (m.locked) return;
        H('h4', {}, detail, 'Inside the VM');
        var r2 = H('div', { 'class': 'btn-row' }, detail);
        var b1 = btn(r2, 'Install the guest OS from the ISO', function () { m.osInstalled = true; say(m.iso.replace(/ \(.*/, '') + ' installed in ' + m.name + '.'); change('installed the guest OS in ' + m.name, ['vm:os']); });
        b1.disabled = !m.running || m.osInstalled;
        var b2 = btn(r2, 'Install ' + A.name, function () {
          if (m.iso !== A.iso) { say(A.name + ' setup: "This program is supported only on ' + A.iso + '." The installation stopped.'); ctx.log({ type: 'test', text: 'Tried to install ' + A.name + ' on ' + m.iso + ': not supported', tags: ['vm:app:fail'], ok: false }); return; }
          m.appInstalled = true; say(A.name + ' installed.'); change('installed ' + A.name + ' in ' + m.name, ['vm:app']);
        });
        b2.disabled = !m.running || !m.osInstalled || m.appInstalled;
        var b3 = btn(r2, 'Run the ' + A.name + ' test', function () {
          var ok = m.appInstalled && m.ramGB >= A.minRamGB;
          say(ok ? A.name + ' opened and loaded the sample data.' : m.appInstalled ? A.name + ' reports: not enough memory (needs ' + A.minRamGB + ' GB).' : A.name + ' is not installed.');
          ctx.log({ type: 'test', text: 'Ran the ' + A.name + ' test in ' + m.name + (ok ? ': passed' : ': failed'), tags: ['vm:test', ok ? 'vm:test:ok' : 'vm:test:fail'], ok: ok });
        });
        b3.disabled = !m.running;
        H('h4', {}, detail, 'Snapshots');
        if (m.snapshots.length) { var ul = H('ul', {}, detail); m.snapshots.forEach(function (s) { H('li', {}, ul, s.label); }); } else H('p', { 'class': 'muted' }, detail, 'No snapshots yet.');
        var r3 = H('div', { 'class': 'btn-row' }, detail);
        btn(r3, 'Take snapshot', function () {
          var lbl = 'Snapshot ' + (m.snapshots.length + 1) + ': guest OS ' + (m.osInstalled ? 'installed' : 'not installed') + ', ' + A.name + ' ' + (m.appInstalled ? 'installed' : 'not installed');
          m.snapshots.push({ label: lbl, osInstalled: m.osInstalled, appInstalled: m.appInstalled });
          if (m.osInstalled && !m.appInstalled) m.cleanSnapshot = true;
          say('Snapshot taken.'); change('took a snapshot of ' + m.name + ' (' + lbl.split(': ')[1] + ')', ['vm:snapshot']);
        });
        var rv = btn(r3, 'Revert to latest snapshot', function () {
          var s = m.snapshots[m.snapshots.length - 1]; m.osInstalled = s.osInstalled; m.appInstalled = s.appInstalled;
          say(m.name + ' reverted to ' + s.label.split(':')[0] + '.'); change('reverted ' + m.name + ' to its latest snapshot', ['vm:revert']);
        }); rv.disabled = !m.snapshots.length;
      }
      render();
      return { refresh: render };
    }
  };

  root.Surfaces.sysinfo = {
    title: 'System Information',
    mount: function (host, ctx) {
      var P = ctx.state.pc, S = ctx.lab.sys, seen = false;
      host.classList.add('pane-app');
      var body = H('div', {}, host);
      function render() {
        body.textContent = '';
        H('h3', {}, body, 'System Information');
        var dl = H('dl', { 'class': 'status-list' }, body);
        S.rows.concat([['Storage (C:)', S.diskGB + ' GB SSD, ' + P.freeGB.toFixed(1) + ' GB free']]).forEach(function (r) { H('dt', {}, dl, r[0]); H('dd', {}, dl, r[1]); });
      }
      render();
      return { refresh: function () { if (!seen && !host.hidden) { seen = true; ctx.log({ type: 'view', text: 'Checked System Information', tags: ['investigate', 'sysinfo:view'] }); } render(); } };
    }
  };

  root.Surfaces.cleanup = {
    title: 'Disk Cleanup',
    mount: function (host, ctx) {
      var P = ctx.state.pc;
      host.classList.add('pane-app');
      var body = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host);
      function render() {
        body.textContent = '';
        H('h3', {}, body, 'Disk Cleanup for C:');
        H('p', { 'class': 'muted' }, body, P.freeGB.toFixed(1) + ' GB free now. Choose what to delete. Deleted items cannot be recovered.');
        var fs = H('fieldset', {}, body); H('legend', {}, fs, 'Files to delete');
        var boxes = [];
        Object.keys(P.cleanup).forEach(function (id) {
          var c = P.cleanup[id]; if (c.done) return;
          var l = H('label', { 'class': 'radio' }, fs), cb = H('input', { type: 'checkbox', value: id }, l);
          H('span', {}, l, c.label + ' (' + c.gb.toFixed(1) + ' GB)' + (c.note ? ' — ' + c.note : '')); boxes.push(cb);
        });
        if (!boxes.length) H('p', {}, fs, 'Nothing left to clean.');
        var b = btn(H('div', { 'class': 'btn-row' }, body), 'Delete selected files', function () {
          var ids = boxes.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
          if (!ids.length) { msg.textContent = 'Select at least one item.'; return; }
          var gb = 0; ids.forEach(function (id) { var c = P.cleanup[id]; c.done = true; gb += c.gb; if (c.userData) P.userDataLost = true; if (c.clearsDownloads) P.downloads.forEach(function (f) { f.deleted = true; }); });
          P.freeGB += gb; msg.textContent = gb.toFixed(1) + ' GB freed. ' + P.freeGB.toFixed(1) + ' GB is now free.';
          ctx.log({ type: 'change', text: 'Disk Cleanup: deleted ' + ids.map(function (id) { return P.cleanup[id].label; }).join(', ') + ' (' + gb.toFixed(1) + ' GB)', tags: ['cleanup'] });
          ctx.changed(); render();
        });
        b.disabled = !boxes.length;
      }
      render();
      return { refresh: render };
    }
  };

  root.Surfaces.installer = {
    title: 'Software Install',
    mount: function (host, ctx) {
      var P = ctx.state.pc, A = ctx.lab.app;
      host.classList.add('pane-app');
      var body = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host);
      function install(pkg, viaPortal) {
        if (P.freeGB < A.needGB) { msg.textContent = 'Setup failed: ' + A.name + ' needs ' + A.needGB + ' GB of free space and only ' + P.freeGB.toFixed(1) + ' GB is free.'; ctx.log({ type: 'test', text: 'Tried to install ' + pkg.label + ': not enough disk space', tags: ['install:fail'], ok: false }); return; }
        P.freeGB -= A.needGB; P.installed = pkg.id;
        msg.textContent = pkg.label + ' installed.' + (pkg.warn ? ' ' + pkg.warn : '');
        ctx.log({ type: 'change', text: 'Installed ' + pkg.label + (viaPortal ? ' from the software portal' : ' from the downloaded file'), tags: ['install', 'install:' + pkg.id] });
        ctx.changed(); render();
      }
      function render() {
        body.textContent = '';
        H('h3', {}, body, 'Company software portal');
        H('p', { 'class': 'muted' }, body, 'Approved software, installed with IT permission.');
        A.portal.forEach(function (pkg) {
          var c = H('section', { 'class': 'app-card' }, body); H('strong', {}, c, pkg.label); H('p', { 'class': 'muted' }, c, pkg.desc);
          var b = btn(H('div', { 'class': 'btn-row' }, c), 'Install', function () { install(pkg, true); }, 'Install ' + pkg.label); b.disabled = !!P.installed;
        });
        H('h3', {}, body, 'Downloads folder');
        P.downloads.forEach(function (f) {
          if (f.deleted) return;
          var c = H('section', { 'class': 'app-card' }, body); H('strong', {}, c, f.name); H('p', { 'class': 'muted' }, c, f.desc);
          var row = H('div', { 'class': 'btn-row' }, c);
          if (f.exe) {
            btn(row, 'Run', function () {
              row.textContent = '';
              H('p', { 'class': 'app-warn' }, row, 'This app might put your PC at risk. Publisher: Unknown publisher. Downloaded from ' + f.from + '.');
              btn(row, 'Run anyway', function () {
                P.ranUnknown = true; msg.textContent = 'The installer ran, added two browser toolbars and a "PC Optimizer" program, then failed: "Setup could not complete."';
                ctx.log({ type: 'change', text: 'Ran ' + f.name + ' from an unknown publisher', tags: ['install:unknown'] }); ctx.changed(); render();
              });
              btn(row, "Don't run", function () { msg.textContent = 'The file was not run.'; ctx.log({ type: 'view', text: 'Opened ' + f.name + ' and chose not to run it', tags: ['investigate'] }); render(); });
            });
            btn(row, 'Delete', function () { f.deleted = true; P.freeGB += f.gb; msg.textContent = f.name + ' was deleted.'; ctx.log({ type: 'change', text: 'Deleted ' + f.name, tags: ['download:delete'] }); ctx.changed(); render(); });
          }
        });
        H('h3', {}, body, 'Test');
        btn(H('div', { 'class': 'btn-row' }, body), 'Open ' + A.name + ' and load a sample drawing', function () {
          var pkg = A.portal.filter(function (p) { return p.id === P.installed; })[0];
          var ok = !!pkg && !!pkg.full;
          msg.textContent = !pkg ? A.name + ' is not installed.' : ok ? 'The sample drawing opened.' : pkg.testFail;
          ctx.log({ type: 'test', text: 'Opened ' + A.name + ' with a sample drawing' + (ok ? ': worked' : ': failed'), tags: ['apptest', ok ? 'apptest:ok' : 'apptest:fail'], ok: ok });
        });
      }
      render();
      return { refresh: render };
    }
  };
})(this);
