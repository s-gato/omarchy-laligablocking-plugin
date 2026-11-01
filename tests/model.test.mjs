import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Model = require('../Model.js')

// Real-shaped samples of https://hayahora.futbol/estado/data.json:
// { lastUpdate, data: [{ ip, isp, description, stateChanges: [{ timestamp, state }] }] }
// The last stateChange's `state` is the current one; true = blocked.
// Under the user's noise-floor rule (L16), <= 5 blocked IPs is not blocking.

// Build a feed: counts = { ispName: numberOfCurrentlyBlockedIPs }
function feedWith(counts, extra = {}) {
  return JSON.stringify({
    lastUpdate: '2026-11-01 19:30:55Z',
    data: Object.entries(counts).flatMap(([isp, n]) =>
      Array.from({ length: Math.max(n, 1) }, (_, i) => ({
        ip: `104.16.${isp.length}.${i}`,
        isp,
        description: 'Cloudflare',
        stateChanges: [{ timestamp: '2026-10-25 20:00:00Z', state: true }].concat(
          i < n ? [] : [{ timestamp: '2026-10-25 22:00:00Z', state: false }]
        ),
      }))
    ).concat(extra.data || []),
  })
}

const partialFeed = feedWith({ Movistar: 6, Orange: 0, Vodafone: 0 })
const allBlockedFeed = feedWith({ Movistar: 6, Orange: 6, Vodafone: 6, DIGI: 6, Masmovil: 6 })
// Exactly half of the tracked ISPs blocking: the blocked threshold boundary
const boundaryFeed = feedWith({ Movistar: 6, Orange: 6, Vodafone: 6, DIGI: 0, Masmovil: 0 })

test('parseFeed reads the feed and counts current blocked IPs per ISP', () => {
  const r = Model.parseFeed(partialFeed)
  assert.equal(r.ok, true)
  assert.equal(r.lastUpdate, '2026-11-01 19:30:55Z')
  const movistar = r.isps.find((x) => x.isp === 'Movistar')
  assert.deepEqual({ isp: movistar.isp, blocked: movistar.blocked, total: movistar.total },
    { isp: 'Movistar', blocked: 6, total: 6 })
  const orange = r.isps.find((x) => x.isp === 'Orange')
  assert.deepEqual({ blocked: orange.blocked, total: orange.total }, { blocked: 0, total: 1 })
  const vodafone = r.isps.find((x) => x.isp === 'Vodafone')
  assert.deepEqual({ blocked: vodafone.blocked, total: vodafone.total }, { blocked: 0, total: 1 })
})

test('parseFeed: the last stateChange decides, not any past one', () => {
  const r = Model.parseFeed(JSON.stringify({
    lastUpdate: 'x',
    data: [{ ip: '1.2.3.4', isp: 'Movistar', description: 'd', stateChanges: [
      { timestamp: 'a', state: true },
      { timestamp: 'b', state: false },
    ] }],
  }))
  assert.equal(r.isps.find((x) => x.isp === 'Movistar').blocked, 0)
})

test('aggregate: 0 blocking ISPs is clear, some is partial, half or more is blocked', () => {
  assert.equal(Model.parseFeed(partialFeed).aggregate.state, 'partial') // 1 of 3
  assert.equal(Model.parseFeed(allBlockedFeed).aggregate.state, 'blocked') // 5 of 5
  assert.equal(Model.parseFeed(boundaryFeed).aggregate.state, 'blocked') // 3 of 5, the boundary
})

test('aggregate: unknown feed (unavailable data) is not clear and never lies', () => {
  for (const bad of ['', 'not json', '{"lastUpdate":"x"}', '{"lastUpdate":"x","data":{}}', 'null']) {
    const r = Model.parseFeed(bad)
    assert.equal(r.ok, false, `expected ok:false for ${JSON.stringify(bad)}`)
    assert.equal(r.aggregate.state, 'unknown')
  }
  const empty = Model.parseFeed('{"lastUpdate":"x","data":[]}')
  assert.equal(empty.ok, true)
  assert.equal(empty.aggregate.state, 'unknown')
})

test('aggregate: entries without stateChanges are skipped, not counted as blocked', () => {
  const r = Model.parseFeed(JSON.stringify({
    lastUpdate: 'x',
    data: [
      { ip: '1.2.3.4', isp: 'Movistar', description: 'd', stateChanges: [] },
      { ip: '1.2.3.5', isp: 'Movistar', description: 'd' },
    ],
  }))
  assert.equal(r.ok, true)
  assert.deepEqual(r.isps, []) // no usable entries at all -> no ISP row
  assert.equal(r.aggregate.state, 'unknown')
})

test('aggregate lists the blocking ISPs by name', () => {
  const r = Model.parseFeed(boundaryFeed)
  assert.deepEqual(r.aggregate.blockedIsps.sort(), ['Movistar', 'Orange', 'Vodafone'])
})

test('ispState answers for one ISP and null for an untracked one', () => {
  const r = Model.parseFeed(partialFeed)
  assert.deepEqual(Model.ispState(r, 'Movistar'), { blocked: 6, total: 6, blockedNow: true })
  assert.deepEqual(Model.ispState(r, 'Vodafone'), { blocked: 0, total: 1, blockedNow: false })
  assert.equal(Model.ispState(r, 'Jazztel'), null)
})

test('totalState: a configured ISP overrides the aggregate', () => {
  const r = Model.parseFeed(partialFeed)
  assert.equal(Model.totalState(r, null).state, 'partial')
  assert.equal(Model.totalState(r, 'Movistar').state, 'blocked')
  assert.equal(Model.totalState(r, 'Vodafone').state, 'clear')
  assert.equal(Model.totalState(r, 'Jazztel').state, 'unknown')
})

// ---- Noise floor + badge states (L16) ----

test('NOISE_FLOOR: 5 or fewer blocked IPs is not blocking', () => {
  assert.equal(Model.NOISE_FLOOR, 5)
  const r = Model.parseFeed(feedWith({ Vodafone: 5, Movistar: 1, Orange: 6 }))
  const v = r.isps.find((x) => x.isp === 'Vodafone')
  const m = r.isps.find((x) => x.isp === 'Movistar')
  const o = r.isps.find((x) => x.isp === 'Orange')
  assert.equal(Model.isBlocking(v), false) // exactly at the floor
  assert.equal(Model.isBlocking(m), false)
  assert.equal(Model.isBlocking(o), true) // 6 > 5
})

test('aggregate respects the noise floor', () => {
  // 3 of 5 ISPs each blocking 1 IP -> nothing is really blocking -> clear
  assert.equal(Model.parseFeed(feedWith({ Movistar: 1, Orange: 2, Vodafone: 3, DIGI: 0, Masmovil: 0 })).aggregate.state, 'clear')
  // Movistar 6 = blocking; one of five blocking -> partial
  assert.equal(Model.parseFeed(feedWith({ Movistar: 6, Orange: 1, Vodafone: 0, DIGI: 0, Masmovil: 0 })).aggregate.state, 'partial')
})

test('badgeState: my ISP blocking red, only others white, none hidden', () => {
  const myBlocked = Model.parseFeed(feedWith({ Vodafone: 6, Movistar: 6, Orange: 0, DIGI: 0, Masmovil: 0 }))
  assert.deepEqual(Model.badgeState(myBlocked, 'Vodafone'), { state: 'blocked', myIsp: 'Vodafone', blockedIsps: ['Vodafone', 'Movistar'] })

  const othersOnly = Model.parseFeed(feedWith({ Vodafone: 1, Movistar: 6, Orange: 0, DIGI: 0, Masmovil: 0 }))
  assert.deepEqual(Model.badgeState(othersOnly, 'Vodafone'), { state: 'others', myIsp: 'Vodafone', blockedIsps: ['Movistar'] })

  const quiet = Model.parseFeed(feedWith({ Vodafone: 1, Movistar: 5, Orange: 0, DIGI: 0, Masmovil: 0 }))
  assert.deepEqual(Model.badgeState(quiet, 'Vodafone'), { state: 'hidden', myIsp: 'Vodafone', blockedIsps: [] })
})

test('badgeState: general mode (activeIsp empty) — white when some, red when half or more, hidden when none', () => {
  const some = Model.parseFeed(feedWith({ Vodafone: 0, Movistar: 6, Orange: 0, DIGI: 0, Masmovil: 0 }))
  assert.equal(Model.badgeState(some, '').state, 'others')
  const widespread = Model.parseFeed(feedWith({ Vodafone: 6, Movistar: 6, Orange: 6, DIGI: 0, Masmovil: 0 }))
  assert.equal(Model.badgeState(widespread, '').state, 'blocked')
  const none = Model.parseFeed(feedWith({ Vodafone: 1, Movistar: 2, Orange: 0, DIGI: 0, Masmovil: 0 }))
  assert.equal(Model.badgeState(none, '').state, 'hidden')
})

test('badgeState: unavailable feed is unknown', () => {
  assert.equal(Model.badgeState(null, 'Vodafone').state, 'unknown')
  assert.equal(Model.badgeState(Model.parseFeed('garbage'), '').state, 'unknown')
})

// ---- ISP detection (WAN org mapping) ----

test('matchIsp maps a WAN org name to the tracked ISP label', () => {
  assert.equal(Model.matchIsp('Telefonica de Espana SAU'), 'Movistar')
  assert.equal(Model.matchIsp('Telefónica Móviles España'), 'Movistar')
  assert.equal(Model.matchIsp('Orange Espana SA'), 'Orange')
  assert.equal(Model.matchIsp('MASORANGE ESPAÑA S.L.'), 'Orange') // merged entity
  assert.equal(Model.matchIsp('Jazztel SA'), 'Orange') // Orange group
  assert.equal(Model.matchIsp('VODAFONE ESPANA, S.A.U.'), 'Vodafone')
  assert.equal(Model.matchIsp('Digi Spain Telecom S.L.'), 'DIGI')
  assert.equal(Model.matchIsp('MASMOVIL IBERCOM SA'), 'Masmovil')
  assert.equal(Model.matchIsp('MásMóvil'), 'Masmovil')
  assert.equal(Model.matchIsp('Pepephone'), 'Masmovil') // MVNO on MasMóvil net
  assert.equal(Model.matchIsp('YOIGO ESPAÑA'), 'Masmovil') // MVNO on MasMóvil net
  assert.equal(Model.matchIsp('Lebara'), 'Masmovil') // MVNO on MasMóvil net
})

test('matchIsp answers null for untracked or empty orgs', () => {
  assert.equal(Model.matchIsp('Starlink Spain'), null)
  assert.equal(Model.matchIsp(''), null)
  assert.equal(Model.matchIsp(null), null)
  assert.equal(Model.matchIsp(undefined), null)
})

test('isKnownIsp validates a user-provided setting and canonicalizes it', () => {
  assert.equal(Model.isKnownIsp('Movistar'), 'Movistar')
  assert.equal(Model.isKnownIsp('movistar'), 'Movistar') // case-insensitive
  assert.equal(Model.isKnownIsp('Jazztel'), false)
  assert.equal(Model.isKnownIsp('all'), false)
  assert.equal(Model.isKnownIsp(null), false)
})

test('orgFromLookup extracts the org field from IP-lookup bodies', () => {
  assert.equal(Model.orgFromLookup('{"ip":"1.2.3.4","org":"Telefonica de Espana SAU"}', 'org'), 'Telefonica de Espana SAU')
  assert.equal(Model.orgFromLookup('{"asn_org":"Digi Spain Telecom S.L."}', 'asn_org'), 'Digi Spain Telecom S.L.')
  assert.equal(Model.orgFromLookup('not json', 'org'), '')
  assert.equal(Model.orgFromLookup('{}', 'org'), '')
  assert.equal(Model.orgFromLookup('{"org":null}', 'org'), '')
})

test('formatTime shortens the feed timestamp to HH:MM', () => {
  assert.equal(Model.formatTime('2026-11-01 19:30:55Z'), '19:30')
  assert.equal(Model.formatTime('2026-11-01 9:05:00Z'), '9:05')
  assert.equal(Model.formatTime(''), '')
  assert.equal(Model.formatTime('garbage'), 'garbage') // pass through, never invent
})
