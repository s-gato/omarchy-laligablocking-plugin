import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Model = require('../Model.js')

// Real-shaped samples of https://hayahora.futbol/estado/data.json:
// { lastUpdate, data: [{ ip, isp, description, stateChanges: [{ timestamp, state }] }] }
// The last stateChange's `state` is the current one; true = blocked.

const partialFeed = JSON.stringify({
  lastUpdate: '2026-11-01 19:30:55Z',
  data: [
    { ip: '104.16.93.114', isp: 'Movistar', description: 'Cloudflare', stateChanges: [
      { timestamp: '2026-10-25 20:38:50Z', state: true },
      { timestamp: '2026-10-25 22:58:44Z', state: false },
    ] },
    { ip: '104.16.94.114', isp: 'Movistar', description: 'Cloudflare', stateChanges: [
      { timestamp: '2026-10-25 20:41:12Z', state: true },
    ] },
    { ip: '104.16.95.114', isp: 'Movistar', description: 'Cloudflare', stateChanges: [
      { timestamp: '2026-10-25 20:42:20Z', state: true },
    ] },
    { ip: '104.18.50.34', isp: 'Orange', description: 'Cloudflare R2', stateChanges: [
      { timestamp: '2026-10-24 17:09:45Z', state: true },
      { timestamp: '2026-10-24 22:15:51Z', state: false },
    ] },
    { ip: '104.18.54.45', isp: 'Vodafone', description: 'Cloudflare R2', stateChanges: [
      { timestamp: '2026-10-31 20:34:20Z', state: true },
      { timestamp: '2026-10-31 22:50:07Z', state: false },
    ] },
    { ip: '104.18.54.46', isp: 'Vodafone', description: 'Cloudflare R2', stateChanges: [
      { timestamp: '2026-10-31 20:34:21Z', state: true },
      { timestamp: '2026-10-31 22:50:08Z', state: false },
    ] },
  ],
})

const allBlockedFeed = JSON.stringify({
  lastUpdate: '2026-11-01 20:58:00Z',
  data: ['Movistar', 'Orange', 'Vodafone', 'DIGI', 'Masmovil'].map((isp, i) => ({
    ip: `104.16.9${i}.114`, isp, description: 'Cloudflare',
    stateChanges: [{ timestamp: '2026-11-01 20:30:00Z', state: true }],
  })),
})

// Exactly half of the tracked ISPs blocking: the blocked threshold boundary
const boundaryFeed = JSON.stringify({
  lastUpdate: '2026-11-01 20:58:00Z',
  data: [
    ...['Movistar', 'Orange', 'Vodafone'].map((isp, i) => ({
      ip: `104.16.9${i}.114`, isp, description: 'Cloudflare',
      stateChanges: [{ timestamp: '2026-11-01 20:30:00Z', state: true }],
    })),
    ...['DIGI', 'Masmovil'].map((isp, i) => ({
      ip: `104.18.5${i}.45`, isp, description: 'Cloudflare R2',
      stateChanges: [{ timestamp: '2026-11-01 20:30:00Z', state: false }],
    })),
  ],
})

test('parseFeed reads the feed and counts current blocked IPs per ISP', () => {
  const r = Model.parseFeed(partialFeed)
  assert.equal(r.ok, true)
  assert.equal(r.lastUpdate, '2026-11-01 19:30:55Z')
  const movistar = r.isps.find((x) => x.isp === 'Movistar')
  assert.deepEqual({ isp: movistar.isp, blocked: movistar.blocked, total: movistar.total },
    { isp: 'Movistar', blocked: 2, total: 3 })
  const orange = r.isps.find((x) => x.isp === 'Orange')
  assert.deepEqual({ blocked: orange.blocked, total: orange.total }, { blocked: 0, total: 1 })
  const vodafone = r.isps.find((x) => x.isp === 'Vodafone')
  assert.deepEqual({ blocked: vodafone.blocked, total: vodafone.total }, { blocked: 0, total: 2 })
})

test('parseFeed: the last stateChange decides, not any past one', () => {
  const r = Model.parseFeed(partialFeed)
  const movistar = r.isps.find((x) => x.isp === 'Movistar')
  // 2 of 3: the first IP was unblocked at 22:58, the other two are still blocked
  assert.equal(movistar.blocked, 2)
})

test('aggregate: 0 blocking ISPs is clear, 1-2 is partial, half or more is blocked', () => {
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
  assert.deepEqual(Model.ispState(r, 'Movistar'), { blocked: 2, total: 3, blockedNow: true })
  assert.deepEqual(Model.ispState(r, 'Vodafone'), { blocked: 0, total: 2, blockedNow: false })
  assert.equal(Model.ispState(r, 'Jazztel'), null)
})

test('totalState: a configured ISP overrides the aggregate', () => {
  const r = Model.parseFeed(partialFeed)
  assert.equal(Model.totalState(r, null).state, 'partial')
  assert.equal(Model.totalState(r, 'Movistar').state, 'blocked')
  assert.equal(Model.totalState(r, 'Vodafone').state, 'clear')
  assert.equal(Model.totalState(r, 'Jazztel').state, 'unknown')
})

test('matchIsp maps a WAN org name to the tracked ISP label', () => {
  // The five networks hayahora probes, as Spanish WAN orgs name themselves
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

test('orgFromLookup extracts the org field from IP-lookup bodies', () => {
  assert.equal(Model.orgFromLookup('{"ip":"1.2.3.4","org":"Telefonica de Espana SAU"}', 'org'), 'Telefonica de Espana SAU')
  assert.equal(Model.orgFromLookup('{"asn_org":"Digi Spain Telecom S.L."}', 'asn_org'), 'Digi Spain Telecom S.L.')
  assert.equal(Model.orgFromLookup('not json', 'org'), '')
  assert.equal(Model.orgFromLookup('{}', 'org'), '')
  assert.equal(Model.orgFromLookup('{"org":null}', 'org'), '')
})

test('isKnownIsp validates a user-provided setting and canonicalizes it', () => {
  assert.equal(Model.isKnownIsp('Movistar'), 'Movistar')
  assert.equal(Model.isKnownIsp('movistar'), 'Movistar') // case-insensitive
  assert.equal(Model.isKnownIsp('Jazztel'), false)
  assert.equal(Model.isKnownIsp('all'), false)
  assert.equal(Model.isKnownIsp(null), false)
})
