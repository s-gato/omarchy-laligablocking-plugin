# LaLiga blocking — Omarchy bar widget

A third-party [Omarchy](https://omarchy.org) shell plugin that tells you at a
glance whether LaLiga's IP blocking is active on Spanish ISPs, powered by the
public measurements of [hayahora.futbol](https://hayahora.futbol).

During football broadcasts, Spanish ISPs block IP addresses under court order
(sentencia 310/2024). Because of shared CDN infrastructure, those blocks can
take down unrelated websites and services. This widget surfaces the live
status of those blocks right in your bar:

- **One colored glyph** in the bar — dim when your connection is clear, red
  when it is being blocked, `?` when there is no data.
- **Your ISP, not all of them** — auto-detected from your WAN org (Vodafone,
  Movistar, Orange, DIGI, Masmovil; MVNOs map to their host network), or pin
  one manually. On a VPN the widget watches the general situation instead, so
  match-day blackouts stay visible.
- **A panel with the full picture** — every tracked ISP, who is blocking how
  many IPs, the feed's last update, and both your situation and the overall
  fraction on hover.

Data comes from community probes inside each Spanish ISP and refreshes every
5 minutes (configurable) — deliberately conservative, as hayahora.futbol
asks.

![preview](design/laliga-monitor/preview.png)

## Install

```sh
omarchy plugin add https://github.com/s-gato/omarchy-laliga-plugin.git --enable
```

Requires `curl` (preinstalled on Omarchy). The widget appears in the right
section of the bar.

## Reading the widget

| Badge | Meaning |
|---|---|
The badge is a single colored glyph — and it stays out of your way when
nothing is happening:

| Badge | Meaning |
|---|---|
| *(hidden)* | Nothing above the noise floor — the widget does not render |
| `⚽` white | Only **other** ISPs are blocking |
| `⚽` red | **Your** ISP is blocking |
| `⚽ ?` muted | Data unavailable, or your ISP not yet detected |

**Noise floor**: an ISP blocking 5 or fewer IPs counts as not blocking —
single collateral sites are noise, a match-day block is hundreds. The same
threshold drives the panel and the general mode (on a VPN, the ball turns
red only when half or more of the tracked ISPs are above the floor).

Hover for both lines at once: your situation *and* the overall fraction
("overall 2/5 ISPs blocking"). Click for the panel: the tracking line, the
full per-ISP table (general picture, always), and the feed timestamp.

## Which ISP is tracked: auto-detected by default

A network is blocked by one ISP, so the widget watches **your** ISP, not all
of them:

- **`"isp": "auto"` (default)** — at startup the widget looks up the org of
  your public IP (ipinfo.io → ifconfig.co → ipapi.co; tiny requests, retried
  3×, re-checked every 6 h) and maps it to one of the tracked ISPs. The
  mapping is network-level, so MVNOs resolve to their host network
  (Pepephone/Yoigo/Lebara → Masmovil, Jazztel → Orange). On a VPN or any
  untracked network the widget switches to the **general situation**: the
  ball turns red when half or more of the tracked ISPs are blocking — so you
  still know when a match-day blackout is underway.
- **`"isp": "Movistar"`** — pin it manually: `Movistar`, `Orange`,
  `Vodafone`, `DIGI`, `Masmovil` (case-insensitive).
- **`"isp": "all"`** — opt in to the aggregate view over every tracked ISP.

### Configure

Settings are inline keys on the widget's bar entry in
`~/.config/omarchy/shell.json`:

```jsonc
"bar": {
  "layout": {
    "right": [ { "id": "sergio.laliga-monitor", "isp": "Movistar" } ]
  }
}
```

Omitted keys fall back to `intervalSeconds: 300`, `isp: "auto"`. The shell
reloads `shell.json` live; the plugin also auto-reloads when you edit its
files.

- **Poll interval** — default 300 s. hayahora.futbol runs community
  measurements and asks users to avoid unnecessary queries; please keep the
  interval at 120 s or above.

## Data source and limits

Data comes from `https://hayahora.futbol/estado/data.json`, the public feed
of a volunteer group that measures the blocks from residential connections of
the major Spanish ISPs. Their measurements have limits: they depend on the
network, the moment, and the IPs observed. An empty result does not guarantee
a service is reachable from every connection. This plugin only displays their
data; it does not bypass anything and it is not affiliated with hayahora.futbol.

## Remove

```sh
omarchy plugin remove sergio.laliga-monitor
```

## Development

- `Model.js` holds all feed parsing and state logic, dependency-free, and is
  unit-tested with Node: `node --test tests/model.test.mjs`.
- `design/laliga-monitor/` holds the design mockup (stageshow) the QML
  implements, with rehearsal frames and notes.
- After editing any file under `~/.config/omarchy/plugins/`, the shell
  reloads automatically. Validate with `omarchy plugin validate <dir>` and
  lint with `qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml`.

## License

MIT — see [LICENSE](LICENSE).
