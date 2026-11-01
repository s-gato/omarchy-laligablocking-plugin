import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

import "Model.js" as LaLigaModel

BarWidget {
  id: root
  moduleName: "sergio.laliga-monitor"

  // ---- Configuration (manifest barWidget.defaults) ----
  // Poll interval in seconds; hayahora.futbol asks for conservative polling.
  property int intervalSeconds: 300
  // Optional: when set to one of Movistar / Orange / Vodafone / DIGI /
  // Masmovil, the bar answers "am *I* affected?" instead of the aggregate.
  property string isp: ""

  // ---- State ----
  // Parsed feed: { ok, lastUpdate, isps: [{ isp, blocked, total }], aggregate }
  property var feed: null
  readonly property var total: LaLigaModel.Model.totalState(feed, isp.length > 0 ? isp : null)
  readonly property string state: total.state  // clear | partial | blocked | unknown

  // Theme-token state colors (mirrors design/laliga-monitor):
  // clear -> dimmed bar text, partial -> accent, blocked -> urgent,
  // unknown -> muted.
  readonly property color stateColor: state === "blocked" ? (bar ? bar.urgent : Color.urgent)
    : state === "partial" ? Color.accent
    : state === "unknown" ? Color.muted
    : (bar ? bar.barForeground : Color.foreground)

  function refresh() {
    if (!fetchProc.running) fetchProc.running = true
  }

  function handleData(text) {
    feed = LaLigaModel.Model.parseFeed(text)
  }

  function tooltipFor(t) {
    if (t.state === "unknown") return "LaLiga blocking: data unavailable"
    if (t.state === "clear") return "LaLiga blocking: none of the tracked ISPs is blocking"
    var names = t.blockedIsps.join(", ")
    if (t.state === "blocked")
      return "LaLiga blocking: " + names + " (" + t.blockedCount + " of " + t.totalIsps + " tracked ISPs)"
    return "LaLiga blocking: " + names + " (partial)"
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()

  Component.onCompleted: refresh()

  // ---- Polling ----
  Timer {
    interval: Math.max(120, root.intervalSeconds) * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  Process {
    id: fetchProc
    // -f: fail on HTTP errors so a blocked/failed request leaves the last
    // known state untouched instead of parsing an error page.
    command: ["curl", "-sfL", "--max-time", "10", "https://hayahora.futbol/estado/data.json"]
    stdout: StdioCollector {
      onStreamFinished: root.handleData(this.text)
    }
    onExited: function (exitCode) {
      if (exitCode !== 0) root.feed = null
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
    text: root.state === "unknown"
      ? glyph + " ?"
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
