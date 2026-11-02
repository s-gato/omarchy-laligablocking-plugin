# Rehearsal: LaLiga blocking — Omarchy bar widget + panel

Gold: `examples/share` (popover anchored to a measured trigger, beats with
seen causes, content reset while hidden). Kept its structure: measured
anchor, popover lifecycle, out-of-sight reset. Changed everything visual:
Omarchy desktop set, the live Jade Horse tokens, a top bar strip instead of a
window, a football badge instead of a Share button, and per-ISP status rows
instead of people.

Beats: 1 nothing blocking (no badge) → 2 another ISP starts blocking (white
badge appears) → 3 your ISP joins (red) → 4 click opens the panel, your ISP's
row located by a quiet fill → 5 full time clears the panel while it is open
(seen cause; the badge goes quiet but keeps its slot because the panel is
anchored to it) → 6 click closes the panel on a calm bar. Loop ~13s; rows
snap back while hidden.

The panel answers first: the hero is the state ("Your ISP is blocked" /
"Blocked elsewhere" / "Nothing is blocked" / "No data"), the section count
and the table are the evidence, and the footer is quiet. Counts sit in one
fixed column; changing values crossfade in place, so nothing swaps or moves.

Captured: widths 720 and 390 (compact), Jade Horse look, states
nothing/others/own/open/cleared. Reduced motion: poster only.

Film:
- `content that swaps instead of moving` on the clear beat → the hero
  title/meta, section count and row counts → fixed: crossfade slots keep both
  labels mounted, and the count column has a fixed width, so the table never
  jumps. One informational `same-box content change` line remains on the
  section count; it is the intended crossfade.
- `small text` on the compact footer → fixed: captions at 10px.
- No framing, cut-by-crop or spill findings. The gate passes; sampling-gap
  `incomplete` notices remain (busy host).
- Final: no motion findings.

Review (self, fresh-eye list):
- Focal content: the eye lands on the red hero icon and the red Vodafone row,
  which is the answer. Stands.
- Void: the wallpaper alone read empty; a dim, mostly cropped filler window
  occupies the left ground. Stands.
- Bar/panel proportions match Omarchy's 26–30px bar and compact popup
  surfaces. Stands.

Assumptions:
- Jade Horse palette stands in for the user's live theme; the QML reads
  theme tokens (`Color.urgent`, `bar.text`, `muted`, `accent`) rather than
  these literals.
- The real bar has more widgets to the right of this one, so the live panel
  is clamped near the screen edge; the mock pins it to the right gutter.

Not checked:
- A second human's fresh-eye review.
- The real panel's crossfading of live data (the QML updates text in place;
  the fixed count column keeps the table steady).
