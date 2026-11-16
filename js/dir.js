/* Users and Groups, Shared Folders and Access Test surfaces.
   state.dir = { users: { id: { name, title, groups: [] } }, groups: { name: desc }, sessions: { id: [groups at last sign-in] },
                 shares: { id: { name, path, perms: [{ who, kind: 'group' | 'user' | 'everyone', level }] } } }
   A group change only reaches the user when they sign in again; a change to a folder's permission list applies at once. */
(function (root) {
  var LEVELS = ['Read', 'Modify', 'Full control'];
  function H(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function btn(parent, label, fn, aria) { var b = H('button', { type: 'button' }, parent, label); if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', fn); return b; }
  function table(parent, heads) { var w = H('div', { 'class': 'table-wrap' }, parent), t = H('table', {}, w), hr = H('tr', {}, H('thead', {}, t)); heads.forEach(function (h) { H('th', { scope: 'col' }, hr, h); }); return H('tbody', {}, t); }
  function sessions(D) { if (!D.sessions) { D.sessions = {}; Object.keys(D.users).forEach(function (u) { D.sessions[u] = D.users[u].groups.slice(); }); D.signedIn = {}; } return D.sessions; }
  /* 0 = no access, 1 = Read, 2 = Modify, 3 = Full control */
  function level(D, userId, shareId, groups) {
    var best = 0;
    D.shares[shareId].perms.forEach(function (p) {
      var hit = p.kind === 'everyone' || (p.kind === 'user' && p.who === userId) || (p.kind === 'group' && groups.indexOf(p.who) !== -1);
      if (hit) best = Math.max(best, LEVELS.indexOf(p.level) + 1);
    });
    return best;
  }
  root.DirSim = { level: level, LEVELS: LEVELS };

  root.Surfaces.accounts = {
    title: 'Users and Groups',
    mount: function (host, ctx) {
      var D = ctx.state.dir, open = null; sessions(D);
      host.classList.add('pane-app');
      var list = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host), detail = H('div', {}, host);
      function render() {
        list.textContent = ''; detail.textContent = '';
        H('h3', {}, list, 'Users');
        var tb = table(list, ['Name', 'Username', 'Job title', 'Member of', 'Action']);
        Object.keys(D.users).forEach(function (id) {
          var u = D.users[id], tr = H('tr', {}, tb);
          H('th', { scope: 'row' }, tr, u.name); H('td', {}, tr, id); H('td', {}, tr, u.title); H('td', {}, tr, u.groups.join(', ') || '(none)');
          btn(H('td', {}, tr), 'Manage', function () { open = id; ctx.log({ type: 'view', text: 'Viewed group membership for ' + u.name, tags: ['user:view', 'user:view:' + id] }); render(); var h = detail.querySelector('h3'); if (h) h.focus(); }, 'Manage ' + u.name);
        });
        if (!open) return;
        var u = D.users[open];
        H('h3', { tabindex: '-1' }, detail, 'Groups for ' + u.name);
        var gb = table(detail, ['Group', 'What it is for', 'Action']);
        u.groups.forEach(function (g) {
          var tr = H('tr', {}, gb); H('th', { scope: 'row' }, tr, g); H('td', {}, tr, D.groups[g] || '');
          btn(H('td', {}, tr), 'Remove', function () {
            u.groups.splice(u.groups.indexOf(g), 1); msg.textContent = u.name + ' removed from ' + g + '.';
            ctx.log({ type: 'change', text: 'Removed ' + u.name + ' from the ' + g + ' group', tags: ['group:remove', 'group:remove:' + g] }); ctx.changed(); render();
          }, 'Remove ' + u.name + ' from ' + g);
        });
        var row = H('div', { 'class': 'btn-row' }, detail);
        H('label', { 'for': 'grp-add', 'class': 'inline' }, row, 'Add to group');
        var sel = H('select', { id: 'grp-add' }, row);
        Object.keys(D.groups).filter(function (g) { return u.groups.indexOf(g) === -1; }).forEach(function (g) { H('option', { value: g }, sel, g + ' — ' + D.groups[g]); });
        var add = btn(row, 'Add', function () {
          var g = sel.value; if (!g) return; u.groups.push(g); msg.textContent = u.name + ' added to ' + g + '.';
          ctx.log({ type: 'change', text: 'Added ' + u.name + ' to the ' + g + ' group', tags: ['group:add', 'group:add:' + g] }); ctx.changed(); render();
        });
        add.disabled = !sel.options.length;
      }
      render();
      return { refresh: render };
    }
  };

  root.Surfaces.shares = {
    title: 'Shared Folders',
    mount: function (host, ctx) {
      var D = ctx.state.dir, open = null;
      host.classList.add('pane-app');
      var list = H('div', {}, host), msg = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host), detail = H('div', {}, host);
      function who(p) { return p.kind === 'everyone' ? 'Everyone' : p.kind === 'user' ? D.users[p.who].name + ' (user)' : p.who + ' (group)'; }
      function render() {
        list.textContent = ''; detail.textContent = '';
        H('h3', {}, list, 'Shared folders on FS01');
        var tb = table(list, ['Folder', 'Path', 'Who has access', 'Action']);
        Object.keys(D.shares).forEach(function (id) {
          var s = D.shares[id], tr = H('tr', {}, tb);
          H('th', { scope: 'row' }, tr, s.name); H('td', {}, tr, s.path); H('td', {}, tr, s.perms.map(function (p) { return who(p) + ': ' + p.level; }).join('; '));
          btn(H('td', {}, tr), 'Permissions', function () { open = id; ctx.log({ type: 'view', text: 'Viewed permissions on the ' + s.name + ' folder', tags: ['share:view', 'share:view:' + id] }); render(); var h = detail.querySelector('h3'); if (h) h.focus(); }, 'Permissions for ' + s.name);
        });
        if (!open) return;
        var s = D.shares[open];
        H('h3', { tabindex: '-1' }, detail, 'Permissions: ' + s.path);
        var pb = table(detail, ['User or group', 'Access level', 'Action']);
        s.perms.forEach(function (p) {
          var tr = H('tr', {}, pb); H('th', { scope: 'row' }, tr, who(p));
          var sel = H('select', { 'aria-label': 'Access level for ' + who(p) }, H('td', {}, tr));
          LEVELS.forEach(function (l) { var o = H('option', { value: l }, sel, l); if (l === p.level) o.selected = true; });
          sel.addEventListener('change', function () { p.level = sel.value; msg.textContent = who(p) + ' now has ' + p.level + ' on ' + s.name + '.';
            ctx.log({ type: 'change', text: 'Changed ' + who(p) + ' to ' + p.level + ' on the ' + s.name + ' folder', tags: ['perm:change'] }); ctx.changed(); render(); });
          btn(H('td', {}, tr), 'Remove', function () { s.perms.splice(s.perms.indexOf(p), 1); msg.textContent = who(p) + ' removed from ' + s.name + '.';
            ctx.log({ type: 'change', text: 'Removed ' + who(p) + ' from the ' + s.name + ' folder permissions', tags: ['perm:remove'] }); ctx.changed(); render(); }, 'Remove ' + who(p) + ' from ' + s.name);
        });
        var row = H('div', { 'class': 'btn-row' }, detail);
        H('label', { 'for': 'perm-who', 'class': 'inline' }, row, 'Add');
        var ws = H('select', { id: 'perm-who' }, row), ls = H('select', { 'aria-label': 'Access level to grant' }, row);
        var have = s.perms.map(function (p) { return p.kind + ':' + p.who; });
        Object.keys(D.groups).forEach(function (g) { if (have.indexOf('group:' + g) === -1) H('option', { value: 'group:' + g }, ws, g + ' (group)'); });
        Object.keys(D.users).forEach(function (u) { if (have.indexOf('user:' + u) === -1) H('option', { value: 'user:' + u }, ws, D.users[u].name + ' (user)'); });
        if (have.indexOf('everyone:Everyone') === -1) H('option', { value: 'everyone:Everyone' }, ws, 'Everyone');
        LEVELS.forEach(function (l) { H('option', { value: l }, ls, l); });
        btn(row, 'Add', function () {
          var v = ws.value.split(':'), p = { kind: v[0], who: v[1], level: ls.value }; s.perms.push(p); msg.textContent = who(p) + ' added to ' + s.name + ' with ' + p.level + '.';
          ctx.log({ type: 'change', text: 'Granted ' + who(p) + ' ' + p.level + ' on the ' + s.name + ' folder', tags: ['perm:add', 'perm:add:' + p.kind] }); ctx.changed(); render();
        });
      }
      render();
      return { refresh: render };
    }
  };

  root.Surfaces.accesstest = {
    title: 'Access Test',
    mount: function (host, ctx) {
      var D = ctx.state.dir; sessions(D);
      host.classList.add('pane-app');
      H('h3', {}, host, 'Test access as a user');
      H('p', { 'class': 'muted' }, host, 'This shows what the user would see from their own PC right now.');
      var row = H('div', { 'class': 'btn-row' }, host);
      H('label', { 'for': 'at-user', 'class': 'inline' }, row, 'User'); var us = H('select', { id: 'at-user' }, row);
      H('label', { 'for': 'at-share', 'class': 'inline' }, row, 'Folder'); var ss = H('select', { id: 'at-share' }, row);
      Object.keys(D.users).forEach(function (u) { H('option', { value: u }, us, D.users[u].name); });
      Object.keys(D.shares).forEach(function (s) { H('option', { value: s }, ss, D.shares[s].path); });
      if (ctx.lab.accessTest) { us.value = ctx.lab.accessTest.user; ss.value = ctx.lab.accessTest.share; }
      var since = H('p', { 'class': 'muted' }, host), row2 = H('div', { 'class': 'btn-row' }, host), out = H('p', { 'class': 'app-msg', role: 'status', 'aria-live': 'polite' }, host);
      function showSince() { since.textContent = D.users[us.value].name + ' has been signed in since ' + (D.signedIn[us.value] ? 'a moment ago (signed in again during this session).' : '8:02 this morning.'); }
      us.addEventListener('change', showSince);
      function test(need, verb) {
        var u = us.value, s = ss.value, lv = level(D, u, s, D.sessions[u]), ok = lv >= need;
        out.textContent = ok ? (need === 1 ? 'The folder opens and the files are listed.' : 'The file saves without error.') : (need === 2 && lv === 1 ? 'The folder opens, but saving fails: "You need permission to perform this action."' : D.shares[s].path + ' is not accessible. Access is denied.');
        ctx.log({ type: 'test', text: 'Tested ' + D.users[u].name + ' ' + verb + ' ' + D.shares[s].name + (ok ? ': allowed' : ': denied'), tags: ['access', (ok ? 'access-ok:' : 'access-denied:') + u + ':' + s + ':' + (need === 1 ? 'read' : 'edit')], ok: ok });
      }
      btn(row2, 'Open the folder', function () { test(1, 'opening'); });
      btn(row2, 'Save a file in it', function () { test(2, 'saving a file in'); });
      btn(row2, 'Have the user sign out and sign in', function () {
        var u = us.value; D.sessions[u] = D.users[u].groups.slice(); D.signedIn[u] = true; showSince();
        out.textContent = D.users[u].name + ' signed out and signed in again.';
        ctx.log({ type: 'cmd', text: 'Had ' + D.users[u].name + ' sign out and sign in again', tags: ['relogon', 'relogon:' + u], ok: true });
      });
      showSince();
      return { refresh: showSince };
    }
  };
})(this);
