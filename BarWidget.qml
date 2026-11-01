import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons as Commons
import qs.Ui

import "Model.js" as LaLigaModel

BarWidget {
  id: root
  moduleName: "sergio.laliga-monitor"

  // ---- Settings: inline keys on the bar layout entry (~/.config/omarchy/shell.json) ----
  //   { "id": "sergio.laliga-monitor", "isp": "Movistar", "intervalSeconds": 300 }
  // isp: "auto" (default) detects your ISP from the WAN org; "all" tracks
  // every ISP hayahora probes; or name one: Movistar, Orange, Vodafone,
  // DIGI, Masmovil. The BarWidget base owns `settings` and setting(); do
  // not redeclare them here — the base already injects them from the host.
  property int intervalSeconds: {
    var v = parseInt(setting("intervalSeconds", 300), 10)
    return (isFinite(v) && v >= 120) ? v : 300
  }
  property string ispSetting: {
    var s = String(setting("isp", "auto")).toLowerCase()
    if (s === "all") return "all"
    var known = LaLigaModel.Model.isKnownIsp(s)
    return known || "auto"
  }

  // ---- ISP resolution ----
  // detectedIsp: "" = lookup in flight, "none" = looked up and untracked.
  // generalMode ("all", or a VPN/untracked exit network) watches the overall
  // situation across all tracked ISPs; otherwise the bar answers for one ISP.
  // Aggregate is never shown as a silent fallback: an untracked network is a
  // deliberate, logged general mode (see the panel's tracking line).
  property string detectedIsp: ""
  property int _detectAttempts: 0
  readonly property bool generalMode: ispSetting === "all" || (ispSetting === "auto" && detectedIsp === "none")
  readonly property bool detectionSettled: ispSetting !== "auto" || detectedIsp.length > 0
  readonly property string activeIsp: generalMode ? "" : (ispSetting === "auto" ? detectedIsp : ispSetting)

  // ---- Feed state ----
  // feed: { ok, lastUpdate, isps: [{ isp, blocked, total }], aggregate }
  property var feed: null
  readonly property var own: (feed && feed.ok && activeIsp.length > 0) ? LaLigaModel.Model.ispState(feed, activeIsp) : null
  // The badge answers three ways (Model.badgeState): 'blocked' (my ISP, red),
  // 'others' (white), 'hidden' (nothing above the noise floor), plus
  // 'unknown' for no data or a detection still in flight.
  readonly property var badge: LaLigaModel.Model.badgeState(feed && detectionSettled ? feed : null, activeIsp)
  readonly property string state: badge.state

  // Theme-token state colors (L16): blocked -> urgent/red, others -> bar
  // text/white, unknown -> muted. 'hidden' never renders.
  readonly property color stateColor: state === "blocked" ? (bar ? bar.urgent : Commons.Color.urgent)
    : state === "others" ? (bar ? bar.barForeground : Commons.Color.foreground)
    : Commons.Color.muted

  function refresh() {
    if (!fetchProc.running) fetchProc.running = true
  }

  function handleData(text) {
    feed = LaLigaModel.Model.parseFeed(text)
  }

  function detectIsp() {
    if (root.ispSetting !== "auto") return
    if (!ipinfoProc.running && !ifconfigProc.running && !ipapiProc.running) {
      root._detectAttempts += 1
      ipinfoProc.running = true
    }
  }

  onStateChanged: console.info("laliga-monitor: state=" + state + " activeIsp=" + activeIsp + " ispSetting=" + ispSetting)
  onDetectedIspChanged: if (detectedIsp.length > 0) console.info("laliga-monitor: detectedIsp=" + detectedIsp)

  function tooltipFor() {
    var b = root.badge
    var overall = (root.feed && root.feed.ok && root.feed.aggregate.totalIsps > 0)
      ? "overall " + root.feed.aggregate.blockedCount + "/" + root.feed.aggregate.totalIsps + " ISPs blocking"
      : "no data"
    if (b.state === "unknown") return "LaLiga blocking: data unavailable"
    if (b.state === "hidden")
      return "LaLiga blocking: nothing above the noise floor (>" + LaLigaModel.Model.NOISE_FLOOR + " IPs) — " + overall
    if (b.state === "blocked" && b.myIsp)
      return "LaLiga blocking: YOUR ISP " + b.myIsp + " is blocked (" + (root.own ? root.own.blocked + " IPs" : "…") + ") — " + overall
    if (b.state === "blocked")
      return "LaLiga blocking: widespread — " + b.blockedIsps.join(", ") + " — " + overall
    if (b.myIsp)
      return "LaLiga blocking elsewhere: " + b.blockedIsps.join(", ") + " — " + overall
    return "LaLiga blocking: " + b.blockedIsps.join(", ") + " — " + overall
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight
  // Hidden when nothing above the noise floor is blocking (user rule L16)
  visible: root.state !== "hidden"

  onBarChanged: injectPanel()

  Component.onCompleted: {
    refresh()
    detectIsp()
  }

  // ---- Feed polling ----
  Timer {
    interval: Math.max(120, root.intervalSeconds) * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  Process {
    id: fetchProc
    // -f: fail on HTTP errors so a failed request leaves the last known
    // state untouched instead of parsing an error page.
    command: ["curl", "-sfL", "--max-time", "10", "https://hayahora.futbol/estado/data.json"]
    stdout: StdioCollector {
      onStreamFinished: root.handleData(this.text)
    }
    onExited: function (exitCode) {
      if (exitCode !== 0) root.feed = null
    }
  }

  // ---- ISP auto-detection (auto mode only; a couple of tiny requests at
  // startup and every 6h). Result is collected on exit (not on stream end,
  // which races with running/exitCode) and logged for debugging: see
  // `qs log -p "$OMARCHY_PATH/shell" --tail 100`. ----
  property string _ipinfoResp: ""
  property string _ifconfigResp: ""
  property string _ipapiResp: ""

  function applyOrg(raw, field, next) {
    var org = LaLigaModel.Model.orgFromLookup(raw, field)
    var isp = org === "" ? "" : LaLigaModel.Model.matchIsp(org)
    if (isp) {
      root.detectedIsp = isp
      console.info("laliga-monitor: ISP " + isp + " from org '" + org + "'")
    } else if (next !== null) {
      next.running = true
    } else if (root._detectAttempts < 3) {
      // Transient lookup failures are common; retry before giving up
      console.info("laliga-monitor: lookup attempt " + root._detectAttempts + " failed, retrying in 60s")
      retryTimer.restart()
    } else {
      root.detectedIsp = "none"
      console.info("laliga-monitor: ISP not detected after " + root._detectAttempts + " attempts — badge shows ?, set 'isp' in settings")
    }
  }

  Timer {
    id: retryTimer
    interval: 60000
    running: false
    repeat: false
    onTriggered: root.detectIsp()
  }

  Timer {
    interval: 21600000
    running: root.ispSetting === "auto"
    repeat: true
    triggeredOnStart: false
    onTriggered: root.detectIsp()
  }

  Process {
    id: ipinfoProc
    command: ["curl", "-sfL", "--max-time", "8", "https://ipinfo.io/json"]
    stdout: StdioCollector {
      onStreamFinished: root._ipinfoResp = this.text
    }
    onExited: function (exitCode) {
      root.applyOrg(root._ipinfoResp, "org", exitCode === 0 ? null : ifconfigProc)
    }
  }

  Process {
    id: ifconfigProc
    command: ["curl", "-sfL", "--max-time", "8", "https://ifconfig.co/json"]
    stdout: StdioCollector {
      onStreamFinished: root._ifconfigResp = this.text
    }
    onExited: function (exitCode) {
      root.applyOrg(root._ifconfigResp, "asn_org", exitCode === 0 ? null : ipapiProc)
    }
  }

  Process {
    id: ipapiProc
    command: ["curl", "-sfL", "--max-time", "8", "https://ipapi.co/json/"]
    stdout: StdioCollector {
      onStreamFinished: root._ipapiResp = this.text
    }
    onExited: function (exitCode) {
      root.applyOrg(root._ipapiResp, "org", null)
    }
  }

  // ---- Panel lifecycle (Quattro contract) ----
  readonly property bool opened: panelLoader.item
    ? panelLoader.item.opened === true
    : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    if (!panelLoader.item) return
    panelLoader.item.bar = root.bar
    panelLoader.item.anchorItem = button
    panelLoader.item.hostWidget = root
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar

    readonly property string glyph: "\uf1e3"  // futbol (Nerd Font)

    // The bar answers with one colored glyph: white = only other ISPs
    // blocked, red = my ISP blocked, muted "?" = no data. Hidden entirely
    // when nothing is blocking. Detail lives in the tooltip and the panel.
    text: root.state === "unknown" ? glyph + " ?" : glyph
    foreground: root.stateColor
    active: root.state === "blocked"
    dimmed: root.state === "unknown"
    tooltipText: root.tooltipFor()
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.LeftButton) root.toggle()
    }
  }
}
