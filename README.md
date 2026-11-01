# LaLiga blocking — Omarchy bar widget

A third-party [Omarchy](https://omarchy.org) shell plugin that tells you at a
glance whether LaLiga's IP blocking is active on Spanish ISPs, powered by the
public measurements of [hayahora.futbol](https://hayahora.futbol).

During football broadcasts, Spanish ISPs block IP addresses under court order
(sentencia 310/2024). Because of shared CDN infrastructure, those blocks can
take down unrelated websites and services. This widget surfaces the live
status of those blocks right in your bar.

![preview](design/laliga-monitor/preview.png)

## Install

```sh
omarchy plugin add https://github.com/sergio/omarchy-laliga-plugin.git --enable
```

Or, from a local checkout:

```sh
omarchy plugin validate /path/to/omarchy-laliga-plugin
cp -r /path/to/omarchy-laliga-plugin ~/.config/omarchy/plugins/sergio.laliga-monitor
omarchy plugin enable sergio.laliga-monitor
```

The widget appears in the right section of the bar. `jq` is not required;
`curl` is (preinstalled on Omarchy).

## Reading the widget

| Badge | Meaning |
|---|---|
| `⚽ 0/5` (dimmed) | No tracked ISP is blocking right now |
| `⚽ 1/5`–`⚽ 2/5` (accent) | Blocking on some ISPs — check the panel |
| `⚽ 3/5`+ (urgent/red) | Blocking on half or more of the tracked ISPs |
| `⚽ ?` (muted) | Data unavailable (feed unreachable or malformed) |

Click the widget for the panel: per-ISP breakdown (Movistar, Orange,
Vodafone, DIGI, Masmovil) with the number of IPs currently blocked, plus the
feed's last update time.

## Configure

- **Poll interval** — default 300 s. hayahora.futbol runs community
  measurements and asks users to avoid unnecessary queries; please keep the
  interval at 120 s or above.
- **Your ISP** — optional. Set it (e.g. `Movistar`) and the bar answers
  "am I affected?" for that ISP instead of the aggregate.

Both live in the manifest's `barWidget.defaults` block
(`intervalSeconds`, `isp`).

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
