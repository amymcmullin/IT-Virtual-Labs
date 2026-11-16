/* Check evaluation and completion codes. Loadable in the browser and in Node (for tests). */
(function (root) {
  var Net = root.Net || (typeof require !== 'undefined' ? require('./net.js') : null);
  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function dirLevel(D, user, share, groups) {
    var order = ['Read', 'Modify', 'Full control'], best = 0;
    D.shares[share].perms.forEach(function (p) {
      if (p.kind === 'everyone' || (p.kind === 'user' && p.who === user) || (p.kind === 'group' && groups.indexOf(p.who) !== -1)) best = Math.max(best, order.indexOf(p.level) + 1);
    });
    return best;
  }
  function evalCheck(c, state, log, world, lab) {
    if (c.type === 'dir') {
      var D = state.dir, g = D.users[c.user].groups;
      if ((c.memberOf || []).some(function (x) { return g.indexOf(x) === -1; })) return false;
      if ((c.notMemberOf || []).some(function (x) { return g.indexOf(x) !== -1; })) return false;
      if (c.canEdit && dirLevel(D, c.user, c.canEdit, g) < 2) return false;
      if (c.sharesUntouched && JSON.stringify(D.shares) !== JSON.stringify(lab.initialState.dir.shares)) return false;
      return true;
    }
    if (c.type === 'state') return getPath(state, c.path) === c.equals;
    if (c.type === 'probe') return !!Net.probes[c.probe](state, world);
    if (c.type === 'bench') {
      var bs = state.bench || { conn: {} };
      if (c.switchOn && !bs.switchOn) return false;
      if ((c.absent || []).some(function (id) { return !!bs.conn[id]; })) return false;
      return (c.need || []).every(function (n) { return n.ports.indexOf(bs.conn[n.item]) !== -1; });
    }
    if (c.type === 'log_order') {       // an event tagged c.first must happen before the first event tagged c.before
      var has = function (e, t) { return e.tags && [].concat(t).some(function (x) { return e.tags.indexOf(x) !== -1; }); };
      var ia = -1, ib = -1;
      log.forEach(function (e, i) { if (ia === -1 && has(e, c.first)) ia = i; if (ib === -1 && has(e, c.before)) ib = i; });
      return ia !== -1 && (ib === -1 || ia < ib);
    }
    if (c.type === 'log_none') return !log.some(function (e) { return e.tags && e.tags.indexOf(c.tag) !== -1; });
    if (c.type === 'log') {
      var first = -1, last = -1;
      log.forEach(function (e, i) { if (e.type === 'change') { if (first === -1) first = i; last = i; } });
      return log.some(function (e, i) {
        var want = [].concat(c.tag);
        if (!e.tags || !want.some(function (t) { return e.tags.indexOf(t) !== -1; })) return false;
        if (c.ok !== undefined && e.ok !== c.ok) return false;
        if (c.when === 'before_first_change') return first === -1 || i < first;
        if (c.when === 'after_last_change') return last !== -1 && i > last;
        return true;
      });
    }
    return false;
  }
  function grade(lab, state, log) {
    var total = 0, earned = 0;
    var results = lab.checks.map(function (c) {
      var ok = evalCheck(c, state, log, lab.world, lab);
      total += c.points; if (ok) earned += c.points;
      return { id: c.id, label: c.label, points: c.points, ok: ok, text: ok ? c.pass : c.fail };
    });
    return { results: results, earned: earned, total: total, score: total ? Math.round(100 * earned / total) : 0 };
  }
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  var SALT = '|itvl-v1';
  /* The code is a convenience and a deterrent, not a security control: anyone who reads this file can forge one. */
  function makeCode(d) {
    var body = b64e(JSON.stringify(d));
    return 'ITVL1.' + body + '.' + hash(body + SALT);
  }
  function readCode(code) {
    var m = /ITVL1\.([A-Za-z0-9_-]+)\.([a-z0-9]+)/.exec(code || '');
    if (!m) return null;
    try { return { data: JSON.parse(b64d(m[1])), valid: hash(m[1] + SALT) === m[2], raw: m[0] }; } catch (e) { return null; }
  }
  var Grading = { evalCheck: evalCheck, grade: grade, makeCode: makeCode, readCode: readCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = Grading; else root.Grading = Grading;
})(this);
