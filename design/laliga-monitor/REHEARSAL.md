# Rehearsal: LaLiga blocking — Omarchy bar widget + panel

Gold: `examples/share` (popover anchored to a measured trigger, beats with
seen causes, content reset while hidden). Kept its structure: measured
anchor, popover lifecycle, out-of-sight reset. Changed everything visual:
Omarchy desktop set, Tokyo Night tokens, a top bar strip instead of a
window, a football badge instead of a Share button, and per-ISP rows
instead of people.

Beats: 1 quiet bar (0/5 muted) → 2 match starts, badge turns red 3/5 →
3 click opens the panel, breakdown holds → 4 full time: rows clear and the
badge quiets while the panel is open (seen cause) → 5 click closes the
panel on a calm bar. Loop ~13s; panel rows snap back while hidden.

Captured: widths 720 and 390 (compact), Tokyo Night dark look, states
quiet/alert/open/cleared. Reduced motion: not captured (headless env).

Film:
- `loop seam: cursor does not end where it starts` → end-of-loop frame →
  fixed: cursor moves back to its desktop rest point after the close click.
- `appears, then moves` / `bottom content geometry is moving` → opening
  frame → fixed: removed row Collapse stagger inside the opening popover;
  the popover's box never resizes while it opens.
- `jump: row title/meta` → clear-beat frame → fixed: meta labels now live
  in a fixed grid slot with both labels mounted (opacity crossfade), so no
  text swap and no layout shift.
- `appears/vanishes with no exit` on the badge → alert/clear frames →
  fixed the same way: 3/5 and 0/5 always mounted in one grid slot,
  crossfaded.
- `framing: opens within a gutter of the right edge` → open frames →
  fixed: bar's right inset is 16px, and the panel's right edge is pinned
  to that same 16px gutter.
- `covers: cursor sits on the label as it presses` → press frames →
  fixed: click targets the ball icon (x 0.22), off the count label.
- `handoff shift` on kit Roll/Swap items → clear frames → fixed by
  replacing text swaps with the crossfade pairs above.
- Final: no motion findings; only headless sampling-gap "incomplete"
  notices remain (largest gap 84 ms on a busy host).

Review (self, fresh-eye list applied to the frames):
- Focal content: the panel holds as much of the frame as the gold's
  popover does at both widths; the eye lands on the red rows, which is
  the result. Stands.
- Void: the wallpaper alone read empty; a dim, mostly cropped filler
  window now occupies the left ground. Stands.
- Bar/panel proportions match Omarchy's 30px bar and compact popup
  surfaces. Stands.

Assumptions:
- Tokyo Night palette stands in for the user's live theme; the QML
  implementation reads theme tokens (Color.urgent / accent / bar.text /
  muted) rather than these literals.

Unresolved: none blocking implementation.

Not checked: reduced-motion pass; a second human's fresh-eye review.
