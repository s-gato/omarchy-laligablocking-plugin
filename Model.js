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

  version: '1.0.0',

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
