/* Lab player: loads a lab definition, runs the surfaces, grades, reports. */
(function () {
  var qs = new URLSearchParams(location.search);
  var labId = (qs.get('lab') || '').replace(/[^a-z0-9-]/gi, '');
  var embed = qs.get('embed') === '1' && window.parent !== window;
  var fixedMode = qs.get('mode') === 'graded' || qs.get('mode') === 'practice' ? qs.get('mode') : null;
  var $ = function (id) { return document.getElementById(id); };
  var lab, state, log, mode, student = '', started, hintsUsed, mounted = {}, submitted = false;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }
  function clock(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* --- embedding (SCORM launcher) --- */
  var parentName = null;
  if (embed) {
    window.addEventListener('message', function (ev) {
      if (ev.source !== window.parent || !ev.data || ev.data.type !== 'itvl-init') return;
      parentName = String(ev.data.name || '').slice(0, 80);
      if ($('student') && !$('student').value) $('student').value = parentName;
    });
    window.parent.postMessage({ type: 'itvl-ready', lab: labId }, '*');
  }

  fetch('labs/' + labId + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { lab = j; showStart(); })
    .catch(function () { $('start').innerHTML = '<h1>Lab not found</h1><p>Check the link, or go back to the <a href="index.html">lab list</a>.</p>'; });

  function showStart() {
    document.title = lab.title + ' — IT Virtual Labs';
    $('start-title').textContent = lab.title;
    $('start-scenario').textContent = lab.scenario;
    var saved = store('itvl-name'); $('student').value = parentName || saved || '';
    if (fixedMode) { $('mode-' + fixedMode).checked = true; if (embed) $('mode-pick').hidden = true; }
    $('start-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      student = $('student').value.trim().slice(0, 80); store('itvl-name', student);
      mode = $('mode-graded').checked ? 'graded' : 'practice';
      begin();
    });
  }

  function begin() {
    state = clone(lab.initialState); log = []; hintsUsed = 0; submitted = false; started = Date.now();
    $('start').hidden = true; $('report').hidden = true; $('lab').hidden = false;
    $('lab-title').textContent = lab.title;
    $('mode-badge').textContent = mode === 'graded' ? 'Graded' : 'Practice';
    $('mode-badge').className = 'badge ' + mode;
    $('scenario').textContent = lab.scenario;
    $('tasks').innerHTML = lab.tasks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    $('practice-box').hidden = mode !== 'practice';
    $('hint-list').innerHTML = ''; $('hint-btn').disabled = false; $('hint-btn').textContent = 'Show a hint';
    var tabs = $('tabs'), panes = $('panes'); tabs.innerHTML = ''; panes.innerHTML = ''; mounted = {};
    var ctx = { state: state, lab: lab, world: lab.world, log: addLog, changed: refresh, mode: mode };
    lab.surfaces.forEach(function (name, i) {
      var s = Surfaces[name];
      var b = document.createElement('button'); b.type = 'button'; b.textContent = s.title; b.id = 'tab-' + name;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'pane-' + name);
      var p = document.createElement('div'); p.id = 'pane-' + name; p.className = 'pane pane-' + name; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
      tabs.appendChild(b); panes.appendChild(p);
      mounted[name] = s.mount(p, ctx) || {};
      b.addEventListener('click', function () { select(name, true); });
    });
    select(lab.surfaces[0], false);
    refresh();
  }

  function select(name, focus) {
    lab.surfaces.forEach(function (n) {
      var on = n === name; $('tab-' + n).setAttribute('aria-selected', on ? 'true' : 'false'); $('pane-' + n).hidden = !on;
    });
    if (mounted[name].refresh) mounted[name].refresh();
    if (focus && mounted[name].focus) mounted[name].focus();
  }

  function addLog(e) { e.t = Date.now() - started; log.push(e); refresh(); }

  function refresh() {
    if (!lab || mode !== 'practice') return;
    var g = Grading.grade(lab, state, log);
    $('live').innerHTML = g.results.map(function (r) {
      return '<li class="' + (r.ok ? 'ok' : 'todo') + '"><span aria-hidden="true">' + (r.ok ? '✓' : '○') + '</span> ' + esc(r.practice) + '<span class="sr"> — ' + (r.ok ? 'done' : 'not yet') + '</span></li>';
    }).join('');
  }

  $('hint-btn').addEventListener('click', function () {
    if (hintsUsed >= lab.hints.length) return;
    var li = document.createElement('li'); li.textContent = lab.hints[hintsUsed]; $('hint-list').appendChild(li);
    hintsUsed++; addLog({ type: 'hint', text: 'Viewed hint ' + hintsUsed, tags: ['hint'] });
    if (hintsUsed >= lab.hints.length) { $('hint-btn').disabled = true; $('hint-btn').textContent = 'No more hints'; }
  });

  $('submit-btn').addEventListener('click', function () {
    if (submitted) return;
    if (mode === 'graded') { $('confirm').hidden = false; $('confirm-yes').focus(); return; }
    finish();
  });
  $('confirm-no').addEventListener('click', function () { $('confirm').hidden = true; $('submit-btn').focus(); });
  $('confirm-yes').addEventListener('click', function () { $('confirm').hidden = true; finish(); });

  function finish() {
    submitted = true;
    var g = Grading.grade(lab, state, log), dur = Date.now() - started;
    var actions = log.filter(function (e) { return e.type !== 'hint'; }).length;
    var code = Grading.makeCode({
      v: 1, l: lab.id, lv: lab.version, m: mode === 'graded' ? 'g' : 'p', n: student, s: g.score,
      c: g.results.map(function (r) { return r.ok ? '1' : '0'; }).join(''),
      t: Math.round(Date.now() / 60000), d: Math.round(dur / 1000), h: hintsUsed, a: actions
    });
    var best = store('itvl-best') || {}; var key = lab.id + ':' + mode;
    if (!(best[key] >= g.score)) { best[key] = g.score; store('itvl-best', best); }
    if (embed && mode === 'graded') window.parent.postMessage({ type: 'itvl-result', lab: lab.id, score: g.score, code: code }, '*');

    $('lab').hidden = true; $('report').hidden = false;
    $('r-title').textContent = lab.title;
    $('r-score').textContent = g.score + '%';
    $('r-meta').textContent = (mode === 'graded' ? 'Graded attempt' : 'Practice attempt') + ' · ' + g.earned + ' of ' + g.total + ' points · ' + clock(dur) + ' · ' + actions + (actions === 1 ? ' action' : ' actions') + (mode === 'practice' ? ' · ' + hintsUsed + (hintsUsed === 1 ? ' hint' : ' hints') : '');
    $('r-sent').hidden = !(embed && mode === 'graded');
    $('r-checks').innerHTML = g.results.map(function (r) {
      return '<li class="' + (r.ok ? 'ok' : 'miss') + '"><div class="rc-head"><span class="mark" aria-hidden="true">' + (r.ok ? '✓' : '✗') + '</span><strong>' + esc(r.label) + '</strong><span class="pts">' + (r.ok ? r.points : 0) + '/' + r.points + '</span></div><p><span class="sr">' + (r.ok ? 'Met. ' : 'Missed. ') + '</span>' + esc(r.text) + '</p></li>';
    }).join('');
    $('r-timeline').innerHTML = log.length ? log.map(function (e) {
      var kind = { cmd: 'Command', change: 'Change', hint: 'Hint', test: 'Test', attempt: 'Attempt', view: 'Viewed' }[e.type] || 'Action';
      return '<li class="t-' + e.type + '"><span class="t-time">' + clock(e.t) + '</span><span class="t-kind">' + kind + '</span><span class="t-text">' + esc(e.text) + ((e.type === 'cmd' || e.type === 'test') && e.ok === false ? ' <em>(failed)</em>' : '') + '</span></li>';
    }).join('') : '<li>No actions were recorded.</li>';
    $('r-code').value = code;
    $('r-copied').textContent = '';
    $('report').scrollIntoView(); $('r-heading').focus();
  }

  $('r-copy').addEventListener('click', function () {
    var c = $('r-code'); c.select();
    (navigator.clipboard ? navigator.clipboard.writeText(c.value) : Promise.reject()).catch(function () { try { document.execCommand('copy'); } catch (e) {} })
      .then(function () { $('r-copied').textContent = 'Copied.'; });
  });
  $('r-again').addEventListener('click', function () { begin(); });
})();
