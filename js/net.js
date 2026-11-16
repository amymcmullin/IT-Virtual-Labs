/* Network model shared by the terminal, the settings dialog and the grading probes. */
(function (root) {
  function ipToInt(s) {
    if (typeof s !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(s.trim())) return null;
    var p = s.trim().split('.').map(Number);
    if (p.some(function (x) { return x > 255; })) return null;
    return ((p[0] * 16777216) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
  }
  function validMask(m) {
    var n = ipToInt(m); if (n === null || n === 0) return false;
    var inv = (~n) >>> 0; return ((inv + 1) & inv) === 0;
  }
  function sameSubnet(a, b, mask) {
    var x = ipToInt(a), y = ipToInt(b), m = ipToInt(mask);
    if (x === null || y === null || m === null) return false;
    return ((x & m) >>> 0) === ((y & m) >>> 0);
  }
  /* The addressing the adapter is actually using right now. */
  function effective(state, world) {
    var n = state.net;
    if (n.mode === 'static') return { ip: n.static.ip, mask: n.static.mask, gateway: n.static.gateway, dns: n.static.dns, dhcp: false };
    if (n.leased) return { ip: world.dhcp.ip, mask: world.dhcp.mask, gateway: world.dhcp.gateway, dns: world.dhcp.dns, dhcp: true, server: world.dhcp.server };
    return { ip: '169.254.37.201', mask: '255.255.0.0', gateway: '', dns: '', dhcp: true, apipa: true };
  }
  function onRealNetwork(eff, world) {
    return eff.mask === world.mask && sameSubnet(eff.ip, world.gateway, world.mask);
  }
  function canReach(state, world, ip) {
    if (/^127\./.test(ip)) return true;
    var eff = effective(state, world);
    if (ip === eff.ip) return true;
    if (!onRealNetwork(eff, world)) return false;
    if (sameSubnet(ip, eff.ip, eff.mask)) return world.localHosts.indexOf(ip) !== -1;
    return eff.gateway === world.gateway && world.remoteHosts.indexOf(ip) !== -1;
  }
  function isLocal(state, world, ip) {
    var eff = effective(state, world);
    return /^127\./.test(ip) || sameSubnet(ip, eff.ip, eff.mask);
  }
  function resolve(state, world, name) {
    var eff = effective(state, world);
    if (!eff.dns || world.dnsServers.indexOf(eff.dns) === -1 || !canReach(state, world, eff.dns)) return { ok: false, reason: 'noserver' };
    var ip = world.names[String(name).toLowerCase()];
    return ip ? { ok: true, ip: ip } : { ok: false, reason: 'nxdomain' };
  }
  var probes = {
    internet: function (state, world) {
      var r = resolve(state, world, 'www.example.com');
      return canReach(state, world, world.remoteHosts[0]) && r.ok && canReach(state, world, r.ip);
    }
  };
  var Net = { ipToInt: ipToInt, validMask: validMask, sameSubnet: sameSubnet, effective: effective, canReach: canReach, isLocal: isLocal, resolve: resolve, probes: probes };
  if (typeof module !== 'undefined' && module.exports) module.exports = Net; else root.Net = Net;
})(this);
