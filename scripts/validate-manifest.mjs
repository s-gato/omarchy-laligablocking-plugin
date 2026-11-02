#!/usr/bin/env node
// Structural check of the plugin against Omarchy's manifest rules
// (the same checks `omarchy plugin validate` runs at install time).
import { readFileSync, existsSync, lstatSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] || process.cwd()
let failed = 0
const fail = (msg) => { console.error('FAIL:', msg); failed++ }
const ok = (msg) => console.log('ok:', msg)

// No symlinks anywhere inside the plugin folder
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (lstatSync(p).isSymbolicLink()) fail(`symlink not allowed: ${relative(root, p)}`)
    else if (statSync(p).isDirectory()) walk(p)
  }
}
walk(root)

let m
try {
  m = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
  ok('manifest.json parses as JSON')
} catch (e) {
  fail('manifest.json does not parse: ' + e.message)
  process.exit(1)
}

for (const key of ['schemaVersion', 'id', 'name', 'version', 'kinds', 'entryPoints']) {
  if (m[key] === undefined) fail(`missing required field: ${key}`)
}
if (m.schemaVersion !== 1) fail('schemaVersion must be 1')
if (typeof m.id !== 'string' || !m.id.includes('.')) fail('id must be a namespaced string')
if (m.id.startsWith('omarchy.')) fail('third-party ids cannot use the reserved omarchy.* namespace')
else ok(`id "${m.id}" is namespaced and not reserved`)

const entryKeyByKind = { 'bar-widget': 'barWidget', panel: 'panel', overlay: 'overlay', menu: 'menu', service: 'service', bar: 'bar' }
for (const kind of m.kinds || []) {
  const ep = (m.entryPoints || {})[entryKeyByKind[kind]]
  if (!ep) fail(`kind "${kind}" has no entryPoints.${entryKeyByKind[kind]}`)
  else if (typeof ep !== 'string' || ep.includes('..') || ep.startsWith('/')) fail(`entry point is not a safe relative path: ${ep}`)
  else if (!existsSync(join(root, ep))) fail(`entry point file not found: ${ep}`)
  else ok(`kind "${kind}" -> ${ep}`)
}

if (m.kinds?.includes('bar-widget')) {
  const bw = m.barWidget || {}
  for (const key of ['displayName', 'category']) {
    if (!bw[key]) fail(`barWidget.${key} is required`)
  }
  if (typeof bw.allowMultiple !== 'boolean') fail('barWidget.allowMultiple must be a boolean')
  if (bw.defaults && bw.schema) {
    const keys = new Set(bw.schema.map((s) => s.key))
    for (const key of Object.keys(bw.defaults)) {
      if (!keys.has(key)) fail(`defaults key "${key}" is not declared in barWidget.schema`)
    }
    ok('barWidget defaults all declared in schema')
  }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall manifest checks passed')
process.exit(failed ? 1 : 0)
