import QtQuick
import Quickshell
import qs.Commons as Commons
import qs.Ui

import "Model.js" as LaLigaModel

Panel {
  id: root
  moduleName: "sergio.laliga-monitor"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null

  // Live state from the bar widget (injected via hostWidget)
  readonly property var feed: hostWidget ? hostWidget.feed : null
  readonly property string activeIsp: hostWidget ? hostWidget.activeIsp : ""
  readonly property bool aggregateMode: hostWidget ? hostWidget.aggregateMode : true
  readonly property string ispSetting: hostWidget ? hostWidget.ispSetting : "auto"

  function open() {
    root.controller.show()
  }

  function close() {
    root.controller.hide()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.hostWidget || root, direction)
    return false
  }

  // In single-ISP mode the rows answer for your ISP; aggregate shows everyone
  readonly property var rowModel: {
    if (!feed || !feed.ok) return []
    if (!aggregateMode && activeIsp.length > 0) {
      var own = null
      for (var i = 0; i < feed.isps.length; i++) {
        if (feed.isps[i].isp === activeIsp) { own = feed.isps[i]; break }
      }
      return own ? [own] : []
    }
    return feed.isps
  }

  // What to tell the user about which ISP is being watched
  readonly property string trackingLine: {
    if (!aggregateMode && activeIsp.length > 0)
      return "Tracking: " + activeIsp + (ispSetting === "auto" ? " (auto-detected)" : "")
    if (ispSetting === "auto")
      return "Your ISP was not detected — showing all. Set \"isp\" in settings."
    return "Tracking: all ISPs hayahora probes"
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.hostWidget || root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(250))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function (direction) { root.switchPanel(direction) }
    }

    Column {
      id: content
      width: parent.width
      spacing: Style.space(4)

      // ---- Header ----
      // Two-sided slots: the right side is measured first, the left elides
      // within the room left over, so long text can never overlap
      Item {
        width: parent.width
        height: Math.max(headerText.implicitHeight, updatedText.implicitHeight)

        Text {
          id: updatedText
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: root.feed && root.feed.ok ? "Updated " + LaLigaModel.Model.formatTime(root.feed.lastUpdate) : ""
          color: Commons.Color.muted
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.small
        }

        Text {
          id: headerText
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          width: parent.width - updatedText.implicitWidth - Style.space(12)
          text: "LaLiga blocking"
          color: root.barForeground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.subtitle
          font.bold: true
          elide: Text.ElideRight
        }
      }

      // ---- Tracking line ----
      Text {
        width: parent.width
        text: root.trackingLine
        color: Commons.Color.muted
        font.family: root.bar ? root.bar.fontFamily : Style.font.family
        font.pixelSize: Style.font.small
        elide: Text.ElideRight
      }

      // ---- Data unavailable ----
      Text {
        width: parent.width
        visible: !root.feed || !root.feed.ok
        text: "Data unavailable. Retrying on the next poll."
        color: Commons.Color.muted
        font.family: root.bar ? root.bar.fontFamily : Style.font.family
        font.pixelSize: Style.font.body
        wrapMode: Text.WordWrap
      }

      // ---- Per-ISP rows ----
      Repeater {
        model: root.rowModel

        delegate: Item {
          required property var modelData
          width: parent.width
          height: Math.max(dot.width, rowLabel.implicitHeight) + Style.space(6)

          readonly property bool hit: modelData.blocked > 0

          Rectangle {
            id: dot
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            width: Style.space(8)
            height: width
            radius: width / 2
            color: hit ? Commons.Color.urgent : Commons.Color.muted
            opacity: hit ? 1.0 : 0.55
          }

          Text {
            id: rowLabel
            anchors.left: dot.right
            anchors.leftMargin: Style.space(9)
            anchors.verticalCenter: parent.verticalCenter
            text: modelData.isp
            color: root.barForeground
            font.family: root.bar ? root.bar.fontFamily : Style.font.family
            font.pixelSize: Style.font.body
          }

          Text {
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: hit ? modelData.blocked + " IPs" : "No blocking"
            color: hit ? Commons.Color.urgent : Commons.Color.muted
            font.family: root.bar ? root.bar.fontFamily : Style.font.family
            font.pixelSize: Style.font.small
            font.bold: hit
          }
        }
      }

      // ---- Footer ----
      // Same two-sided slot as the header: measured right side, eliding left
      Item {
        width: parent.width
        height: Math.max(footerText.implicitHeight, footerCount.implicitHeight) + Style.space(4)

        Text {
          id: footerCount
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: root.feed && root.feed.ok && root.feed.aggregate.totalIsps > 0
            ? root.feed.aggregate.blockedCount + "/" + root.feed.aggregate.totalIsps + " ISPs"
            : ""
          color: root.barForeground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.small
        }

        Text {
          id: footerText
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          width: parent.width - footerCount.implicitWidth - Style.space(12)
          text: "Data: hayahora.futbol"
          color: Commons.Color.muted
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.small
          elide: Text.ElideRight
        }
      }
    }
  }
}
