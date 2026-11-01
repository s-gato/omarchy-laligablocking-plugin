# LaLiga block monitor — Omarchy bar widget

Omarchy shell plugin (`bar-widget` + nested panel) that shows whether LaLiga IP
blocking is active on Spanish ISPs, powered by https://hayahora.futbol.

## Specs

- S1: "There is a website that advises you whether LaLiga is blocking
  (https://hayahora.futbol/) it has an API and you can leverage for this by
  ISP. I want to create an Omarchy plugin that tells you whether la Liga is
  blocking in a simple way."
- S2: The bar widget shows the current blocking state at a glance: green when
  no blocking is observed, amber when some ISPs are blocking, red when most or
  all tracked ISPs are blocking, gray when data is unavailable.
- S3: Clicking the widget opens a details panel with a per-ISP breakdown
  (Movistar, Orange, Vodafone, DIGI, Masmovil): blocked-IP count and current
  state per ISP, plus the feed's `lastUpdate` timestamp.
- S4: Data comes from `https://hayahora.futbol/estado/data.json`
  (`{lastUpdate, data:[{ip, isp, description, stateChanges:[{timestamp,
  state}]}]}`; last `state` per (ip, isp) is current; `state: true` = blocked).
  Polling interval is configurable and conservative (default 300 s) — the site
  asks users to avoid unnecessary queries.
- S5: The plugin is a valid third-party Omarchy plugin: repo root with
  `manifest.json` (`schemaVersion` 1, namespaced id, kinds + entryPoints,
  `barWidget` block), installable with `omarchy plugin add <git-url> --enable`,
  validatable with `omarchy plugin validate`.
- S6: Design follows Omarchy's design principles (theme-token-driven, dark
  minimal look) and is mocked up first with the stageshow skill before
  implementing the QML.
- S7: Parsing and state logic lives in a dependency-free `Model.js` testable
  from Node: feed parsing, per-ISP aggregation, overall state, unavailable-data
  handling (malformed/empty/timeout input must not crash or lie).

## Tasks

- T1 (S6): Stageshow mockup of bar widget states + panel, Omarchy look. → design/
  DONE — commit 3efae40 (design/laliga-monitor/ with preview.png, rehearsal
  frames, REHEARSAL.md).
- T2 (S1,S4,S7): Model.js feed parsing + state logic + Node tests (RED first).
  DONE — commit 44f0a61; 8/8 tests green.
- T3 (S2,S3,S5): manifest.json, BarWidget.qml, Panel.qml implementing the design.
  DONE — commit b8c803b.
- T4 (S5): README (install/config/remove), LICENSE, icon, final validate pass.
  DONE — commit 1b8db58; scripts/validate-manifest.mjs passes (manifest rules,
  no symlinks, safe entry points); qmllint NOT run (no Qt on this Ubuntu box) —
  to run on the Omarchy machine at deploy time.
- T5 (S1): Deploy to Omarchy machine and live-test (widget states, panel open,
  disable/re-enable). BLOCKED: no SSH access to the Omarchy host from this box.

## Log

- L1 (original request, verbatim): "I'm sick of getting blocked by La Liga in
  Spain. There is a website that advises you whether LaLiga is blocking
  (https://hayahora.futbol/) it has an API and you can leverage for this by
  ISP. I want to create an Omarchy plugin that tells you whether la Liga is
  blocking in a simple way. This machine is running ubuntu, but I'm operating
  t3 code from x390-proxmox from where we can test locally in omarchy: For
  design let's use the npx skills add benjitaylor/skills --skill stageshow
  while considering Omarchy's design principles, theme integration,etc"
- L2: ask_user_question unavailable (non-interactive session). Decisions taken
  by default, all reversible: UI copy in English (Omarchy UI convention);
  scope v1 = bar-widget + panel (S2/S3), notifications deferred; state logic =
  "any ISP" aggregate (S2) plus optional configured-ISP mode via manifest
  setting; plugin id `sergio.laliga-monitor` (rename before publishing if you
  prefer another namespace).
- L3: No Omarchy host reachable from this machine (no DNS/SSH). T5 needs SSH
  details or manual install by the user.
- L4: T3 QML written against the quattro shell's real sources (SystemUpdate
  widget + WidgetButton + Color/Style singletons fetched from the omacom repo)
  instead of guesses: WidgetButton { text, foreground, active, dimmed,
  tooltipText }, Color.{urgent,accent,muted,foreground,popups.*}.
- L5: Verification evidence at close: node --test 8/8;
  scripts/validate-manifest.mjs all passed; Model.js plain-ES smoke;
  qmllint and live Omarchy run pending (no Qt, no Omarchy host here).
  Risk line for the diff: none of the high-risk items apply (read-only HTTP
  GET, no stored data, no security surface, new plugin id, no concurrency
  beyond one Timer + one Process, new repo).
