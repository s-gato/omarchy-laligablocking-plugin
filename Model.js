// LaLiga block monitor — pure feed logic.
//
// Parses the public status feed of https://hayahora.futbol
// (https://hayahora.futbol/estado/data.json) and derives states for the
// Omarchy bar widget and its panel. Dependency-free on purpose: the same
// file is imported by QML (import "Model.js" as LaLigaModel -> LaLigaModel.Model)
// and by the Node test suite (tests/model.test.mjs).
//
// Feed shape:
// {
//   "lastUpdate": "2026-11-01 19:30:55Z",
//   "data": [
//     { "ip": "104.16.93.114", "isp": "Movistar", "description": "Cloudflare",
//       "stateChanges": [ { "timestamp": "...", "state": false },
//                         { "timestamp": "...", "state": true } ] }
//   ]
// }
//
// The LAST entry of stateChanges is the current state; state === true means
// that IP is being blocked on that ISP right now.

var Model = {

  version: '1.1.0',

  // The five ISPs hayahora probes, in their exact label spelling
  KNOWN_ISPS: ['Movistar', 'Orange', 'Vodafone', 'DIGI', 'Masmovil'],

  // Map a WAN org name (public-IP ASN/org lookup, e.g. ipinfo.io "org") to
  // the tracked ISP label. Blocks are applied at network level, so MVNOs
  // riding a tracked network map to their host network. Answers null when
  // the org does not belong to a tracked network.
  matchIsp: function (org) {
    if (typeof org !== 'string') return null
    // Lowercase and strip accents so 'MásMóvil' / 'España' compare plainly
    var s = org.toLowerCase()
      .replace(/[\u00e0-\u00e6]/g, 'a').replace(/[\u00e8-\u00eb]/g, 'e')
      .replace(/[\u00ec-\u00ef]/g, 'i').replace(/[\u00f2-\u00f6]/g, 'o')
      .replace(/[\u00f9-\u00fc]/g, 'u').replace(/\u00f1/g, 'n')
    if (s.length === 0) return null
    var groups = [
      ['movistar', 'telefonica', 'telefonic'], ['Movistar'],
      ['orange', 'jazztel', 'masorange'], ['Orange'],
      ['vodafone', 'ono '], ['Vodafone'],
      ['digi '], ['DIGI'],
      ['masmovil', 'mas mov', 'yoigo', 'pepephone', 'lebara', 'lycamobile', 'quiero'], ['Masmovil'],
    ]
    for (var g = 0; g < groups.length; g += 2) {
      var needles = groups[g]
      for (var i = 0; i < needles.length; i++) {
        if (s.indexOf(needles[i]) !== -1) return groups[g + 1][0]
      }
    }
    // 'digi ' needs a trailing word in the org string; accept bare 'digi' too
    if (/\bdigi\b/.test(s)) return 'DIGI'
    return null
  },

  // True when name is one of the tracked ISP labels (case-insensitive);
  // answers the canonical spelling so the feed match is exact
  isKnownIsp: function (name) {
    if (typeof name !== 'string') return false
    var lower = name.toLowerCase()
    for (var i = 0; i < this.KNOWN_ISPS.length; i++) {
      if (this.KNOWN_ISPS[i].toLowerCase() === lower) return this.KNOWN_ISPS[i]
    }
    return false
  },

  // Extract a field from a public-IP lookup body (ipinfo.io "org",
  // ifconfig.co "asn_org"). Answers "" for unusable input.
  orgFromLookup: function (raw, field) {
    try {
      var o = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (o && typeof o === 'object' && typeof o[field] === 'string') return o[field]
    } catch (e) { /* fall through */ }
    return ''
  },

  // Parse a raw feed body. Never throws: any unusable input answers
  // { ok: false, aggregate: { state: 'unknown', ... } } so the widget can
  // show "data unavailable" instead of a wrong "no blocking".
  parseFeed: function (raw) {
    var feed = null
    try {
      feed = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (e) {
      feed = null
    }
    if (!feed || typeof feed !== 'object' || !Array.isArray(feed.data)) {
      return { ok: false, lastUpdate: '', isps: [], aggregate: this.aggregate([], false) }
    }

    var byIsp = {}
    var order = []
    var data = feed.data
    for (var i = 0; i < data.length; i++) {
      var entry = data[i]
      if (!entry || typeof entry !== 'object') continue
      var changes = entry.stateChanges
      if (!Array.isArray(changes) || changes.length === 0) continue
      var last = changes[changes.length - 1]
      var blocked = !!(last && last.state === true)
      var isp = String(entry.isp || 'Unknown')
      if (!byIsp[isp]) {
        byIsp[isp] = { isp: isp, blocked: 0, total: 0 }
        order.push(isp)
      }
      byIsp[isp].total += 1
      if (blocked) byIsp[isp].blocked += 1
    }

    var isps = []
    for (var j = 0; j < order.length; j++) isps.push(byIsp[order[j]])

    return {
      ok: true,
      lastUpdate: String(feed.lastUpdate || ''),
      isps: isps,
      aggregate: this.aggregate(isps, true),
    }
  },

  // Overall state across ISPs. With data: 'clear' (nobody blocking),
  // 'partial' (1+ but fewer than half), 'blocked' (half or more of the
  // tracked ISPs blocking). Without data: 'unknown'.
  aggregate: function (isps, hasData) {
    if (!hasData || !isps || isps.length === 0) {
      return { state: 'unknown', blockedIsps: [], blockedCount: 0, totalIsps: 0 }
    }
    var blockedIsps = []
    for (var i = 0; i < isps.length; i++) {
      if (isps[i].blocked > 0) blockedIsps.push(isps[i].isp)
    }
    var n = isps.length
    var state = blockedIsps.length === 0 ? 'clear'
      : (blockedIsps.length * 2 >= n ? 'blocked' : 'partial')
    return { state: state, blockedIsps: blockedIsps, blockedCount: blockedIsps.length, totalIsps: n }
  },

  // State for one ISP: { blocked, total, blockedNow } or null if untracked.
  ispState: function (feed, name) {
    if (!feed || !feed.ok || !feed.isps) return null
    for (var i = 0; i < feed.isps.length; i++) {
      var isp = feed.isps[i]
      if (isp.isp === name) {
        return { blocked: isp.blocked, total: isp.total, blockedNow: isp.blocked > 0 }
      }
    }
    return null
  },

  // The state the bar widget should show. A configured ISP (config.isp)
  // overrides the aggregate: the bar then answers "am *I* affected?".
  // Answers one of 'clear' | 'partial' | 'blocked' | 'unknown'.
  totalState: function (feed, configuredIsp) {
    if (!feed || !feed.ok) return { state: 'unknown', blockedIsps: [], blockedCount: 0, totalIsps: 0 }
    if (configuredIsp) {
      var own = this.ispState(feed, configuredIsp)
      if (!own) return { state: 'unknown', blockedIsps: [], blockedCount: 0, totalIsps: 0 }
      return { state: own.blockedNow ? 'blocked' : 'clear', blockedIsps: [configuredIsp], blockedCount: own.blockedNow ? 1 : 0, totalIsps: 1 }
    }
    return feed.aggregate
  },
}

if (typeof module !== 'undefined' && module.exports) module.exports = Model
