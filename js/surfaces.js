/* Surfaces: the simulated tools a lab can expose. Each has mount(el, ctx).
   ctx = { state, lab, world, log(event), changed() }  */
(function (root) {
  var Net = root.Net;
  var Surfaces = {};

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- Command Prompt ---------- */
  Surfaces.terminal = {
    title: 'Command Prompt',
    mount: function (host, ctx) {
      var out = el('div', { 'class': 'term-out', role: 'log', 'aria-live': 'polite', 'aria-label': 'Command output', tabindex: '0' });
      var form = el('form', { 'class': 'term-in', autocomplete: 'off' });
      var prompt = 'C:\\Users\\' + ctx.state.user + '>';
      form.appendChild(el('label', { 'for': 'term-cmd', 'class': 'term-prompt' }, prompt));
      var input = el('input', { id: 'term-cmd', type: 'text', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Type a command', enterkeyhint: 'send' });
      form.appendChild(input);
      form.appendChild(el('button', { type: 'submit', 'class': 'term-run' }, 'Run'));
      host.appendChild(out); host.appendChild(form);
      var history = [], hpos = 0;

      function print(text, cls) { var p = el('pre', cls ? { 'class': cls } : {}, text); out.appendChild(p); out.scrollTop = out.scrollHeight; }
      print('LabOS Command Prompt (simulated)\nType "help" to list the commands available in this lab.\n');

      function ipconfig(args) {
        var a = (args[0] || '').toLowerCase(), n = ctx.state.net, e = Net.effective(ctx.state, ctx.world);
        if (a === '/release' || a === '/renew') {
          if (n.mode !== 'dhcp') return { text: 'The operation failed as no adapter is in the state permissible for\nthis operation.', tags: ['ipconfig-lease'], ok: false };
          n.leased = (a === '/renew'); ctx.changed();
          return { text: show(false), tags: ['ipconfig-lease'], ok: true };
        }
        if (a === '/flushdns') return { text: 'Windows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.', tags: ['flushdns'], ok: true };
        if (a && a !== '/all') return { text: 'Error: unrecognized or incomplete command line.\n\nUSAGE:\n    ipconfig [/all | /release | /renew | /flushdns]', tags: [], ok: false };
        return { text: show(a === '/all'), tags: ['ipconfig'], ok: true };

        function show(all) {
          e = Net.effective(ctx.state, ctx.world);
          var L = ['Windows IP Configuration', ''];
          if (all) L.push('   Host Name . . . . . . . . . . . . : ' + ctx.state.hostname, '');
          L.push('Ethernet adapter Ethernet:', '');
          if (all) L.push('   Physical Address. . . . . . . . . : 3C-52-82-1A-9F-04',
                          '   DHCP Enabled. . . . . . . . . . . : ' + (e.dhcp ? 'Yes' : 'No'));
          L.push('   ' + (e.apipa ? 'Autoconfiguration IPv4 Address. . : ' : 'IPv4 Address. . . . . . . . . . . : ') + e.ip,
                 '   Subnet Mask . . . . . . . . . . . : ' + e.mask,
                 '   Default Gateway . . . . . . . . . : ' + e.gateway);
          if (all) {
            if (e.dhcp && !e.apipa) L.push('   DHCP Server . . . . . . . . . . . : ' + e.server);
            L.push('   DNS Servers . . . . . . . . . . . : ' + e.dns);
          }
          return L.join('\n');
        }
      }

      function lookup(target) {
        if (Net.ipToInt(target) !== null) return { ip: target };
        var r = Net.resolve(ctx.state, ctx.world, target);
        return r.ok ? { ip: r.ip, name: target } : { fail: r.reason };
      }
      function scope(ip) { return Net.sameSubnet(ip, ctx.world.gateway, ctx.world.mask) || /^127\./.test(ip) ? 'local' : 'remote'; }

      function ping(args) {
        var t = args.filter(function (x) { return x[0] !== '-' && x[0] !== '/'; })[0];
        if (!t) return { text: 'Usage: ping target_name', tags: [], ok: false };
        var r = lookup(t);
        if (r.fail) return { text: 'Ping request could not find host ' + t + '. Please check the name and try again.', tags: ['ping', 'ping:name'], ok: false };
        var ok = Net.canReach(ctx.state, ctx.world, r.ip), me = Net.effective(ctx.state, ctx.world).ip;
        var head = 'Pinging ' + (r.name ? r.name + ' [' + r.ip + ']' : r.ip) + ' with 32 bytes of data:\n';
        var line = ok ? 'Reply from ' + r.ip + ': bytes=32 time' + (scope(r.ip) === 'local' ? '<1ms TTL=128' : '=18ms TTL=116')
                      : (Net.isLocal(ctx.state, ctx.world, r.ip) ? 'Reply from ' + me + ': Destination host unreachable.' : 'Request timed out.');
        var stats = '\n\nPing statistics for ' + r.ip + ':\n    Packets: Sent = 4, Received = ' + (ok ? 4 : 0) + ', Lost = ' + (ok ? '0 (0% loss),' : '4 (100% loss),');
        return { text: head + [line, line, line, line].join('\n') + stats, tags: ['ping', 'ping:' + scope(r.ip)], ok: ok };
      }

      function tracert(args) {
        var t = args[0]; if (!t) return { text: 'Usage: tracert target_name', tags: [], ok: false };
        var r = lookup(t);
        if (r.fail) return { text: 'Unable to resolve target system name ' + t + '.', tags: ['tracert'], ok: false };
        var ok = Net.canReach(ctx.state, ctx.world, r.ip), e = Net.effective(ctx.state, ctx.world);
        var L = ['', 'Tracing route to ' + r.ip + ' over a maximum of 30 hops', ''];
        if (scope(r.ip) === 'local') L.push(ok ? '  1    <1 ms    <1 ms    <1 ms  ' + r.ip : '  1  ' + e.ip + '  reports: Destination host unreachable.');
        else if (ok) L.push('  1    <1 ms    <1 ms    <1 ms  ' + e.gateway, '  2     9 ms     8 ms     9 ms  198.51.100.1', '  3    18 ms    17 ms    18 ms  ' + r.ip);
        else L.push('  1     *        *        *     Request timed out.', '  2     *        *        *     Request timed out.');
        L.push('', 'Trace complete.');
        return { text: L.join('\n'), tags: ['tracert', 'tracert:' + scope(r.ip)], ok: ok };
      }

      function nslookup(args) {
        var t = args[0]; if (!t) return { text: 'Usage: nslookup name', tags: [], ok: false };
        var e = Net.effective(ctx.state, ctx.world), r = Net.resolve(ctx.state, ctx.world, t);
        if (r.reason === 'noserver') return { text: 'DNS request timed out.\n    timeout was 2 seconds.\n*** Request to ' + (e.dns || 'UnKnown') + ' timed-out', tags: ['nslookup'], ok: false };
        if (!r.ok) return { text: 'Server:  ' + e.dns + '\n\n*** ' + e.dns + " can't find " + t + ': Non-existent domain', tags: ['nslookup'], ok: false };
        return { text: 'Server:  ' + e.dns + '\nAddress:  ' + e.dns + '\n\nName:    ' + t + '\nAddress:  ' + r.ip, tags: ['nslookup'], ok: true };
      }

      var commands = {
        help: function () { return { text: 'Commands in this lab:\n  ipconfig [/all | /release | /renew | /flushdns]\n  ping <address or name>\n  tracert <address or name>\n  nslookup <name>\n  hostname\n  whoami\n  cls', tags: [], ok: true }; },
        ipconfig: ipconfig, ping: ping, tracert: tracert, nslookup: nslookup,
        hostname: function () { return { text: ctx.state.hostname, tags: ['hostname'], ok: true }; },
        whoami: function () { return { text: ctx.state.hostname.toLowerCase() + '\\' + ctx.state.user, tags: ['whoami'], ok: true }; }
      };

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var raw = input.value.trim(); input.value = '';
        if (!raw) return;
        history.push(raw); hpos = history.length;
        print(prompt + raw, 'term-echo');
        var parts = raw.split(/\s+/), name = parts[0].toLowerCase().replace(/\.exe$/, '');
        if (name === 'cls') { out.textContent = ''; return; }
        var fn = commands[name];
        var res = fn ? fn(parts.slice(1)) : { text: "'" + parts[0] + "' is not recognized as an internal or external command,\noperable program or batch file.", tags: ['unknown'], ok: false };
        print(res.text + '\n');
        ctx.log({ type: 'cmd', text: raw, tags: res.tags, ok: res.ok });
      });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowUp' && hpos > 0) { hpos--; input.value = history[hpos]; ev.preventDefault(); }
        else if (ev.key === 'ArrowDown') { hpos = Math.min(history.length, hpos + 1); input.value = history[hpos] || ''; ev.preventDefault(); }
      });
      return { focus: function () { input.focus(); } };
    }
  };

  /* ---------- Network Settings ---------- */
  Surfaces.netsettings = {
    title: 'Network Settings',
    mount: function (host, ctx) {
      var n = ctx.state.net;
      var form = el('form', { 'class': 'settings', novalidate: '' });
      form.appendChild(el('h3', {}, 'Ethernet adapter — IPv4 properties'));
      var fs = el('fieldset'); fs.appendChild(el('legend', {}, 'IP assignment'));
      function radio(val, label) {
        var w = el('label', { 'class': 'radio' }), r = el('input', { type: 'radio', name: 'mode', value: val });
        w.appendChild(r); w.appendChild(document.createTextNode(' ' + label)); fs.appendChild(w); return r;
      }
      var rDhcp = radio('dhcp', 'Obtain an IP address automatically (DHCP)');
      var rStatic = radio('static', 'Use the following IP address');
      form.appendChild(fs);
      var grid = el('div', { 'class': 'fields' }), inputs = {};
      [['ip', 'IP address'], ['mask', 'Subnet mask'], ['gateway', 'Default gateway'], ['dns', 'Preferred DNS server']].forEach(function (f) {
        var id = 'net-' + f[0];
        grid.appendChild(el('label', { 'for': id }, f[1]));
        inputs[f[0]] = el('input', { id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off' });
        grid.appendChild(inputs[f[0]]);
      });
      form.appendChild(grid);
      var msg = el('p', { 'class': 'settings-msg', role: 'status', 'aria-live': 'polite' });
      var row = el('div', { 'class': 'btn-row' });
      row.appendChild(el('button', { type: 'submit', 'class': 'primary' }, 'Apply'));
      var cancel = el('button', { type: 'button' }, 'Reset form'); row.appendChild(cancel);
      form.appendChild(row); form.appendChild(msg); host.appendChild(form);

      function load() {
        rDhcp.checked = n.mode === 'dhcp'; rStatic.checked = n.mode === 'static';
        for (var k in inputs) inputs[k].value = n.static[k] || '';
        sync();
      }
      function sync() { for (var k in inputs) inputs[k].disabled = rDhcp.checked; }
      rDhcp.addEventListener('change', sync); rStatic.addEventListener('change', sync);
      cancel.addEventListener('click', function () { load(); msg.textContent = 'Form reset to the current settings.'; });
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (rDhcp.checked) {
          if (n.mode === 'dhcp') { msg.textContent = 'No change: the adapter is already set to DHCP.'; return; }
          n.mode = 'dhcp'; n.leased = true;
          ctx.log({ type: 'change', text: 'Network Settings: set adapter to obtain an address automatically (DHCP)', tags: ['set:dhcp'] });
          msg.textContent = 'Applied. The adapter now obtains its address automatically.';
        } else {
          var v = {}; for (var k in inputs) v[k] = inputs[k].value.trim();
          var bad = Net.ipToInt(v.ip) === null ? 'IP address' : !Net.validMask(v.mask) ? 'Subnet mask'
                  : (v.gateway && Net.ipToInt(v.gateway) === null) ? 'Default gateway' : (v.dns && Net.ipToInt(v.dns) === null) ? 'DNS server' : '';
          if (bad) { msg.textContent = 'Not applied: the ' + bad + ' is not valid.'; return; }
          var same = n.mode === 'static' && ['ip', 'mask', 'gateway', 'dns'].every(function (k) { return n.static[k] === v[k]; });
          if (same) { msg.textContent = 'No change: those are the current settings.'; return; }
          n.mode = 'static'; n.static = v;
          ctx.log({ type: 'change', text: 'Network Settings: static IP ' + v.ip + ', mask ' + v.mask + ', gateway ' + (v.gateway || '(none)') + ', DNS ' + (v.dns || '(none)'), tags: ['set:static'] });
          msg.textContent = 'Applied. The adapter is using the manual settings.';
        }
        ctx.changed();
      });
      load();
      return { focus: function () { (rDhcp.checked ? rDhcp : rStatic).focus(); }, refresh: load };
    }
  };

  root.Surfaces = Surfaces;
})(this);
