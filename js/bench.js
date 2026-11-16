/* Workbench surface: the back of a PC and a tray of cables.
   Select a cable (tap, click or keyboard), then select the port it goes to. No dragging needed.
   Lab data: lab.bench = { dedicatedGpu, groups[], ports[], items[] };  state.bench = { conn: {itemId: portId}, switchOn } */
(function (root) {
  var NS = 'http://www.w3.org/2000/svg';
  function S(tag, attrs, parent, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function H(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  var SIZE = { ddr4: [150, 10], 'psu-bay': [110, 70], esd: [26, 26], 'usb-a': [44, 16], dp: [50, 16], hdmi: [50, 18], 'usb-c': [30, 12], rj45: [40, 34], audio: [22, 22], c14: [76, 50], 'switch': [40, 30] };
  var METAL = '#c9d1d8', HOLE = '#10161c';

  function shape(g, p) {
    var t = p.type;
    if (t === 'usb-a') { S('rect', { width: 44, height: 16, rx: 1.5, fill: HOLE, stroke: METAL, 'stroke-width': 2 }, g); S('rect', { x: 5, y: 8, width: 34, height: 5, fill: p.color || '#1b1b1b', stroke: '#6b7680', 'stroke-width': .6 }, g); }
    else if (t === 'dp') { S('path', { d: 'M0 0H50V16H8L0 8Z', fill: HOLE, stroke: METAL, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); S('rect', { x: 9, y: 6, width: 34, height: 3, fill: '#55616c' }, g); }
    else if (t === 'hdmi') { S('path', { d: 'M0 0H50V10L43 18H7L0 10Z', fill: HOLE, stroke: METAL, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); S('rect', { x: 8, y: 6, width: 34, height: 3, fill: '#55616c' }, g); }
    else if (t === 'usb-c') { S('rect', { width: 30, height: 12, rx: 6, fill: HOLE, stroke: METAL, 'stroke-width': 2 }, g); S('rect', { x: 7, y: 5, width: 16, height: 2, fill: '#55616c' }, g); }
    else if (t === 'rj45') { S('path', { d: 'M0 0H40V34H27V40H13V34H0Z', fill: HOLE, stroke: METAL, 'stroke-width': 2, 'stroke-linejoin': 'round', transform: 'translate(0,-6)' }, g); for (var i = 0; i < 8; i++) S('rect', { x: 6 + i * 3.6, y: -3, width: 1.6, height: 8, fill: '#c9a227' }, g); }
    else if (t === 'audio') { S('circle', { cx: 11, cy: 11, r: 11, fill: p.color || '#888' }, g); S('circle', { cx: 11, cy: 11, r: 5.5, fill: HOLE }, g); }
    else if (t === 'ddr4') { S('rect', { width: 150, height: 10, rx: 1, fill: p.color || '#1b1b1b', stroke: METAL, 'stroke-width': 1.5 }, g); S('rect', { x: 4, y: 4, width: 142, height: 2, fill: '#c9a227' }, g); S('rect', { x: 80, y: 2, width: 3, height: 6, fill: METAL }, g); S('rect', { x: -5, y: -2, width: 5, height: 14, fill: '#e7edf1' }, g); S('rect', { x: 150, y: -2, width: 5, height: 14, fill: '#e7edf1' }, g); }
    else if (t === 'psu-bay') { S('rect', { width: 110, height: 70, rx: 3, fill: '#2a333b', stroke: METAL, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, g); S('text', { x: 55, y: 39, 'text-anchor': 'middle', fill: '#aab4bd', 'font-size': 10 }, g, 'empty bay'); }
    else if (t === 'esd') { S('circle', { cx: 13, cy: 13, r: 13, fill: '#dfe5ea', stroke: '#8c979f', 'stroke-width': 2 }, g); S('path', { d: 'M6 13H20M13 6V20', stroke: '#6b7680', 'stroke-width': 2.5 }, g); }
    else if (t === 'c14') { S('path', { d: 'M8 0H68L76 10V50H0V10Z', fill: HOLE, stroke: METAL, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); [[20, 30], [38, 16], [56, 30]].forEach(function (c) { S('rect', { x: c[0] - 3, y: c[1] - 7, width: 6, height: 14, fill: '#aab4bd' }, g); }); }
  }
  function shortName(p) {
    return { 'usb-a': p.speed === 3 ? 'USB 3' : 'USB 2.0', dp: 'DisplayPort', hdmi: 'HDMI', 'usb-c': 'USB-C', rj45: 'Ethernet', c14: 'Power', 'switch': 'On/off',
             audio: { out: 'Line out', mic: 'Mic', linein: 'Line in' }[p.func] }[p.type] || p.short || '';
  }

  root.Surfaces.bench = {
    title: 'Workbench',
    mount: function (host, ctx) {
      var B = ctx.lab.bench, st = ctx.state.bench, selected = null, showNames = ctx.mode === 'practice';
      var portById = {}, itemById = {};
      B.ports.forEach(function (p) { portById[p.id] = p; });
      B.items.forEach(function (it, i) { itemById[it.id] = it; it.n = i + 1; });
      function pname(p) { return showNames ? p.name : p.look; }
      function occupant(pid) { for (var k in st.conn) if (st.conn[k] === pid) return itemById[k]; return null; }

      host.classList.add('bench');
      var left = H('div', { 'class': 'bench-panel' }, host), right = H('div', { 'class': 'bench-side' }, host);
      H('h3', {}, left, B.title || 'Back of the PC');
      var svg = S('svg', { viewBox: '0 0 360 ' + (B.height || 490), role: 'group', 'aria-label': B.title || 'Back panel ports' }, left);
      H('h3', {}, right, B.trayTitle || 'Cable tray');
      H('p', { 'class': 'muted bench-how' }, right, B.how || 'Select a cable, then select the port it goes to.');
      var tray = H('ul', { 'class': 'tray' }, right);
      var row = H('div', { 'class': 'btn-row' }, right);
      var unplug = H('button', { type: 'button' }, row, 'Unplug selected');
      var power = H('button', { type: 'button', 'class': 'primary' }, row, 'Press power button');
      var status = H('p', { 'class': 'bench-status', role: 'status', 'aria-live': 'polite' }, right);
      var obsBox = H('div', { 'class': 'bench-obs', 'aria-live': 'polite' }, right);
      function say(t) { status.textContent = t; }

      function render() {
        svg.textContent = '';
        S('rect', { x: 2, y: 2, width: 356, height: (B.height || 490) - 4, rx: 8, fill: '#3b4651', stroke: '#222b33', 'stroke-width': 3 }, svg);
        B.groups.forEach(function (gr) {
          S('rect', { x: 16, y: gr.y, width: 328, height: gr.h, rx: 4, fill: '#56626d', stroke: '#2a333b' }, svg);
          S('text', { x: 24, y: gr.y + 16, fill: '#e7edf1', 'font-size': 11, 'font-weight': 600 }, svg, gr.label);
        });
        if (B.decor) B.decor.forEach(function (d) { var attrs = {}; for (var k in d) if (k !== 't' && k !== 'text') attrs[k] = d[k]; S(d.t, attrs, svg, d.text); });
        else {
          var g0 = B.groups[0], g2 = B.groups[B.groups.length - 1];
          S('circle', { cx: 278, cy: g0.y + g0.h / 2 + 4, r: 40, fill: '#2a333b', stroke: '#87939d', 'stroke-dasharray': '3 4', 'stroke-width': 6 }, svg);
          for (var s = 1; s < 4; s++) S('rect', { x: 30, y: g2.y + 28 + s * 30, width: 250, height: 14, rx: 2, fill: '#6d7a85', stroke: '#2a333b' }, svg);
        }
        B.ports.forEach(function (p) {
          var sz = SIZE[p.type], occ = occupant(p.id), isSw = p.type === 'switch';
          var label = pname(p) + (isSw ? (st.switchOn ? ', on' : ', off') : (occ ? ', ' + occ.name + ' connected' : ', empty'));
          var g = S('g', { 'class': 'port' + (occ ? ' used' : ''), transform: 'translate(' + p.x + ',' + p.y + ')', tabindex: 0, role: 'button', 'aria-label': label, 'data-port': p.id }, svg);
          if (isSw) { g.setAttribute('aria-pressed', st.switchOn ? 'true' : 'false');
            S('rect', { width: 40, height: 30, rx: 3, fill: '#11171d', stroke: METAL, 'stroke-width': 2 }, g);
            S('rect', { x: st.switchOn ? 3 : 21, y: 3, width: 16, height: 24, rx: 2, fill: st.switchOn ? '#d43c2f' : '#5d6770' }, g);
            S('text', { x: 11, y: 20, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12, 'font-weight': 700 }, g, 'I');
            S('text', { x: 29, y: 20, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12, 'font-weight': 700 }, g, 'O');
          } else {
            shape(g, p);
            if (occ) {
              S('rect', { x: -2, y: -2, width: sz[0] + 4, height: sz[1] + 4, rx: 3, fill: '#0b5d7a', opacity: .88 }, g);
              S('circle', { cx: sz[0] / 2, cy: sz[1] / 2, r: 9, fill: '#fff' }, g);
              S('text', { x: sz[0] / 2, y: sz[1] / 2 + 4, 'text-anchor': 'middle', fill: '#0b5d7a', 'font-size': 11, 'font-weight': 700 }, g, String(occ.n));
            }
          }
          if (p.silk) S('text', { x: -10, y: sz[1] / 2 + 3, 'text-anchor': 'end', fill: '#e7edf1', 'font-size': 9, 'font-weight': 600 }, g, p.silk);
          if (showNames && shortName(p)) S('text', { x: sz[0] / 2, y: sz[1] + (p.type === 'rj45' ? 13 : 10), 'text-anchor': 'middle', fill: '#e7edf1', 'font-size': 8 }, g, shortName(p));
          S('rect', { 'class': 'hit', x: -7, y: p.type === 'rj45' ? -13 : -7, width: sz[0] + 14, height: sz[1] + 14 + (p.type === 'rj45' ? 6 : 0), rx: 4, fill: 'transparent' }, g);
          g.addEventListener('click', function () { clickPort(p); });
          g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); clickPort(p, true); } });
        });

        tray.textContent = '';
        B.items.forEach(function (it) {
          var li = H('li', {}, tray), at = st.conn[it.id];
          var b = H('button', { type: 'button', 'class': 'tray-item' + (at ? ' used' : ''), 'aria-pressed': selected === it.id ? 'true' : 'false', 'data-item': it.id }, li);
          H('span', { 'class': 'num', 'aria-hidden': 'true' }, b, String(it.n));
          var txt = H('span', { 'class': 'tray-text' }, b);
          H('strong', {}, txt, it.name);
          H('span', { 'class': 'where' }, txt, at ? 'In: ' + pname(portById[at]) : 'In the tray');
          b.addEventListener('click', function () { selected = selected === it.id ? null : it.id; say(selected ? it.name + ' selected. Now choose a port.' : 'Nothing selected.'); render(); refocus('[data-item="' + it.id + '"]'); if (selected && window.innerWidth < 760) svg.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
        });
        unplug.disabled = !(selected && st.conn[selected]);
      }
      function refocus(sel) { var n = host.querySelector(sel); if (n) n.focus(); }

      function clickPort(p, viaKey) {
        var back = function () { if (viaKey) refocus('[data-port="' + p.id + '"]'); };
        if (p.type === 'switch') {
          st.switchOn = !st.switchOn;
          ctx.log({ type: 'change', text: 'Power supply switch turned ' + (st.switchOn ? 'on' : 'off'), tags: ['switch'] });
          say('Power supply switch is now ' + (st.switchOn ? 'on (I).' : 'off (O).')); ctx.changed(); render(); back(); return;
        }
        var occ = occupant(p.id);
        if (!selected) {
          if (occ) { selected = occ.id; say(occ.name + ' selected. Choose another port, or use Unplug selected.'); render(); back(); }
          else say('Select an item from the tray first.');
          return;
        }
        var it = itemById[selected];
        if (st.conn[it.id] === p.id) { say(it.name + ' is already in that port.'); return; }
        if (occ) { say('That port is already in use by ' + occ.name + '.'); return; }
        if (it.fits !== p.type) {
          ctx.log({ type: 'attempt', text: 'Tried ' + it.name + ' in ' + p.name + ': does not fit', tags: ['misfit'], ok: false });
          say(it.name + ' does not fit there.'); return;
        }
        st.conn[it.id] = p.id; selected = null;
        ctx.log({ type: 'change', text: 'Connected ' + it.name + ' to ' + p.name, tags: ['connect', 'connect:' + it.id, 'handle:' + it.role] });
        say(it.name + ' connected to the ' + pname(p) + '.'); ctx.changed(); render(); back();
      }

      unplug.addEventListener('click', function () {
        if (!selected || !st.conn[selected]) return;
        var it = itemById[selected], p = portById[st.conn[it.id]];
        delete st.conn[it.id]; selected = null;
        ctx.log({ type: 'change', text: 'Unplugged ' + it.name + ' from ' + p.name, tags: ['disconnect', 'disconnect:' + it.id, 'handle:' + it.role] });
        say(it.name + ' unplugged.'); ctx.changed(); render(); refocus('[data-item="' + it.id + '"]');
      });

      function at(role) { return B.items.filter(function (i) { return i.role === role && st.conn[i.id]; }).map(function (i) { return { item: i, port: portById[st.conn[i.id]] }; }); }
      power.addEventListener('click', function () {
        var obs = [], ok = false, short;
        var has = function (role) { return B.items.some(function (i) { return i.role === role; }); };
        var psu = at('psu')[0];
        var powered = st.switchOn && at('power').some(function (c) { return c.port.role === 'power-in'; }) && (!has('psu') || !!psu);
        if (!powered) { obs.push('Nothing happens: no fans, no lights.'); short = 'no power'; }
        else {
          obs.push('Fans spin up and the power light comes on.');
          ok = true; short = 'started normally';
          if (has('ram')) {
            var ram = at('ram'), gb = ram.reduce(function (n, c) { return n + (c.item.gb || 0); }, 0);
            if (!ram.length) { ok = false; short = 'no memory, would not start'; obs.push('The PC beeps repeatedly and the screen stays blank.'); }
            else {
              var slots = ram.map(function (c) { return c.port.id; });
              var dual = (B.pairs || []).some(function (pr) { return pr.every(function (id) { return slots.indexOf(id) !== -1; }); }) && ram.length % 2 === 0;
              obs.push('The firmware screen reports ' + gb + ' GB of memory, ' + (dual ? 'dual-channel mode.' : 'single-channel mode.'));
              short = 'started, ' + gb + ' GB detected';
            }
          }
          if (psu) obs.push('Power supply installed: ' + psu.item.watts + ' W.');
          if (ok && has('video')) {
            var vids = at('video'), good = vids.filter(function (c) { return c.item.works && (!B.dedicatedGpu || c.port.gpu); });
            ok = good.length > 0;
            obs.push(ok ? 'The monitor shows the desktop.' : 'The monitor stays on "No signal".');
            short = ok ? 'desktop appeared' : 'no picture';
          }
          if (has('net')) obs.push(at('net').length ? 'The network port link light is on.' : 'The network port link light is off.');
          if (ok && has('kbd')) {
            var k = at('kbd').length, m = at('mouse').length;
            obs.push(k && m ? 'Keyboard and mouse respond.' : !k && !m ? 'No keyboard or mouse detected.' : k ? 'Keyboard responds; no mouse detected.' : 'Mouse responds; no keyboard detected.');
          }
          if (ok) {
            var d = at('storage')[0];
            if (has('storage')) obs.push(!d ? 'Backup drive not detected.' : d.port.speed === 3 ? 'Backup drive detected at USB 3 speed.' : 'Backup drive detected, with a notice: "This device can perform faster."');
            var o = at('audio-out')[0], mi = at('audio-in')[0];
            if (has('audio-out')) obs.push(o && o.port.func === 'out' ? 'Sound plays in the headphones.' : 'No sound in the headphones.');
            if (has('audio-in')) obs.push(mi && mi.port.func === 'mic' ? 'The microphone picks up sound.' : 'The microphone records nothing.');
          }
        }
        ctx.log({ type: 'test', text: 'Pressed the power button: ' + short, tags: ['power', ok ? 'power:ok' : 'power:fail'], ok: ok });
        obsBox.textContent = ''; H('h4', {}, obsBox, 'What you observe'); var ul = H('ul', {}, obsBox);
        obs.forEach(function (t) { H('li', {}, ul, t); });
        say('Power button pressed.');
      });

      render();
      return { focus: function () { refocus('.tray-item'); }, refresh: render };
    }
  };
})(this);
