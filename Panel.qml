import QtQuick
import Quickshell
import qs.Commons
import qs.Ui

Panel {
  id: root
  moduleName: "sergio.laliga-monitor"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null

  // Live feed from the bar widget (injected via hostWidget)
  readonly property var feed: hostWidget ? hostWidget.feed : null

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
      Item {
        width: parent.width
        height: headerText.implicitHeight
        Text {
          id: headerText
          anchors.left: parent.left
          text: "LaLiga blocking"
          color: root.barForeground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.subtitle
          font.bold: true
        }
        Text {
          anchors.right: parent.right
          anchors.baseline: headerText.baseline
          text: root.feed && root.feed.ok ? root.feed.lastUpdate : ""
          color: Color.muted
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.small
        }
      }

      // ---- Data unavailable ----
      Text {
        width: parent.width
        visible: !root.feed || !root.feed.ok
        text: "Data unavailable. Retrying on the next poll."
        color: Color.muted
        font.family: root.bar ? root.bar.fontFamily : Style.font.family
        font.pixelSize: Style.font.body
        wrapMode: Text.WordWrap
      }

      // ---- Per-ISP rows ----
      Repeater {
        model: root.feed && root.feed.ok ? root.feed.isps : []

        delegate: Item {
          required property var modelData
          width: parent.width
          height: Math.max(dot.implicitHeight, rowLabel.implicitHeight) + Style.space(6)

          readonly property bool hit: modelData.blocked > 0

          Rectangle {
            id: dot
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            width: Style.space(8)
            height: width
            radius: width / 2
            color: hit ? Color.urgent : Color.muted
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
            color: hit ? Color.urgent : Color.muted
            font.family: root.bar ? root.bar.fontFamily : Style.font.family
            font.pixelSize: Style.font.small
            font.bold: hit
          }
        }
      }

      // ---- Footer ----
      Item {
        width: parent.width
        height: footerText.implicitHeight + Style.space(6)
        Text {
          id: footerText
          anchors.bottom: parent.bottom
          anchors.left: parent.left
          text: "Data: hayahora.futbol"
          color: Color.muted
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.small
        }
        Text {
          anchors.baseline: footerText.baseline
          anchors.right: parent.right
          text: root.feed && root.feed.ok && root.feed.aggregate.totalIsps > 0
            ? root.feed.aggregate.blockedCount + "/" + root.feed.aggregate.totalIsps + " ISPs"
            : ""
          color: root.barForeground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.small
        }
      }
    }
  }
}
