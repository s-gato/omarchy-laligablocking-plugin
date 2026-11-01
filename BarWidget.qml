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
  // DIGI, Masmovil.
  property var settings: ({})
  property int intervalSeconds: {
    var v = parseInt(settings.intervalSeconds, 10)
    return (isFinite(v) && v >= 120) ? v : 300
  }
  property string ispSetting: {
    var s = String(settings.isp === undefined ? "auto" : settings.isp).toLowerCase()
    if (s === "all") return "all"
    var known = LaLigaModel.Model.isKnownIsp(s)
    return known || "auto"
  }

  // ---- ISP resolution ----
  // detectedIsp: "" = lookup in flight, "none" = looked up and untracked
  property string detectedIsp: ""
  readonly property bool aggregateMode: ispSetting === "all" || (ispSetting === "auto" && detectedIsp === "none")
  readonly property string activeIsp: {
    if (ispSetting !== "auto") return ispSetting === "all" ? "" : ispSetting
    return detectedIsp === "none" ? "" : detectedIsp
  }

  // ---- Feed state ----
  // feed: { ok, lastUpdate, isps: [{ isp, blocked, total }], aggregate }
  property var feed: null
  readonly property var total: LaLigaModel.Model.totalState(feed, activeIsp.length > 0 ? activeIsp : null)
  readonly property string state: total.state  // clear | partial | blocked | unknown

  // Theme-token state colors (mirrors design/laliga-monitor):
  // clear -> dimmed bar text, partial -> accent, blocked -> urgent,
  // unknown -> muted.
  readonly property color stateColor: state === "blocked" ? (bar ? bar.urgent : Commons.Color.urgent)
    : state === "partial" ? Commons.Color.accent
    : state === "unknown" ? Commons.Color.muted
    : (bar ? bar.barForeground : Commons.Color.foreground)

  function refresh() {
    if (!fetchProc.running) fetchProc.running = true
  }

  function handleData(text) {
    feed = LaLigaModel.Model.parseFeed(text)
  }

  function detectIsp() {
    if (root.ispSetting !== "auto") return
    if (!ipinfoProc.running && !ifconfigProc.running) ipinfoProc.running = true
  }

  function tooltipFor(t) {
    if (t.state === "unknown") return "LaLiga blocking: data unavailable"
    if (activeIsp.length > 0) {
      if (t.state === "blocked")
        return "LaLiga blocking: " + activeIsp + " is being blocked (" + (own ? own.blocked + " of " + own.total + " IPs" : "…") + ")"
      return "LaLiga blocking: " + activeIsp + " is not being blocked"
    }
    if (t.state === "clear") return "LaLiga blocking: none of the tracked ISPs is blocking"
    var names = t.blockedIsps.join(", ")
    if (t.state === "blocked")
      return "LaLiga blocking: " + names + " (" + t.blockedCount + " of " + t.totalIsps + " tracked ISPs)"
    return "LaLiga blocking: " + names + " (partial)"
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

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
  // startup and every 6h) ----
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
      onStreamFinished: {
        var org = LaLigaModel.Model.orgFromLookup(this.text, "org")
        var isp = org === "" ? "" : LaLigaModel.Model.matchIsp(org)
        if (isp) root.detectedIsp = isp
        else if (!ipinfoProc.running && ipinfoProc.exitCode !== 0) ifconfigProc.running = true
        else root.detectedIsp = "none"
      }
    }
    onExited: function (exitCode) {
      if (exitCode !== 0) ifconfigProc.running = true
    }
  }

  Process {
    id: ifconfigProc
    command: ["curl", "-sfL", "--max-time", "8", "https://ifconfig.co/json"]
    stdout: StdioCollector {
      onStreamFinished: {
        var org = LaLigaModel.Model.orgFromLookup(this.text, "asn_org")
        var isp = org === "" ? "" : LaLigaModel.Model.matchIsp(org)
        root.detectedIsp = isp || "none"
      }
    }
    onExited: function (exitCode) {
      if (exitCode !== 0) root.detectedIsp = "none"
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

    // Single-ISP mode answers "am I affected?"; aggregate keeps the n/m ratio
    text: root.state === "unknown" ? glyph + " ?"
      : root.activeIsp.length > 0
        ? (root.state === "blocked" ? glyph + " " + (root.own ? root.own.blocked : "") + " IPs" : glyph + " OK")
        : glyph + " " + root.total.blockedCount + "/" + root.total.totalIsps
    foreground: root.stateColor
    active: root.state === "blocked"
    dimmed: root.state === "clear" || root.state === "unknown"
    tooltipText: root.tooltipFor(root.total)
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.LeftButton) root.toggle()
    }
  }
}
