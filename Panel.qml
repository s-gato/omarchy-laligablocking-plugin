import QtQuick
import Quickshell
import qs.Commons
import qs.Commons as Commons
import qs.Ui

import "Model.js" as LaLigaModel

Panel {
  id: root
  moduleName: "sergio.laligablocking-plugin"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null

  // Live state from the bar widget (injected via hostWidget)
  readonly property var feed: hostWidget ? hostWidget.feed : null
  readonly property string activeIsp: hostWidget ? hostWidget.activeIsp : ""
  readonly property bool generalMode: hostWidget ? hostWidget.generalMode : false
  readonly property string ispSetting: hostWidget ? hostWidget.ispSetting : "auto"
  readonly property var badge: hostWidget ? hostWidget.badge : null
  readonly property string badgeState: badge ? badge.state : "unknown"
  readonly property string fontFamily: root.bar ? root.bar.fontFamily : Style.font.family

  // A feed with no usable ISP rows is no data, never a calm "nothing blocked"
  readonly property bool hasData: !!(feed && feed.ok && feed.isps && feed.isps.length > 0)
  // Stable table order (known ISPs first) so a refresh never reshuffles rows
  readonly property var rowModel: hasData ? LaLigaModel.Model.orderedIsps(feed) : []
  readonly property int blockedCount: hasData ? feed.aggregate.blockedCount : 0
  readonly property int totalIsps: hasData ? feed.aggregate.totalIsps : 0

  // ---- The answer, first ----
  readonly property string heroTitle: {
    if (!hasData) return "No data"
    if (badgeState === "blocked") return activeIsp.length > 0 ? "Your ISP is blocked" : "Widespread blocking"
    if (badgeState === "others")
      return generalMode ? "Some ISPs are blocking" : "Blocked elsewhere"
    if (badgeState === "hidden") return "Nothing is blocked"
    return "Detecting your ISP…"
  }
  readonly property string heroMeta: {
    if (!hasData) return "Retrying on the next poll"
    if (generalMode) return "Watching the general situation"
    if (activeIsp.length > 0)
      return activeIsp + (ispSetting === "auto" ? " · auto-detected" : " · pinned")
    return "Checking your network"
  }
  // Red for your own block, bar ink for someone else's, muted when calm
  readonly property color heroColor: badgeState === "blocked" ? Commons.Color.urgent
    : badgeState === "others" ? root.barForeground
    : Commons.Color.muted

  function open() {
    // The panel is opened on demand: fetch fresh data rather than showing a
    // snapshot up to a poll interval old
    if (hostWidget && typeof hostWidget.refresh === "function") hostWidget.refresh()
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
    contentWidth: panel.fittedContentWidth(Style.space(320))
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
      spacing: 0

      // ---- Hero: the state is the headline, the table is the detail ----
      PanelHero {
        width: parent.width
        title: root.heroTitle
        meta: root.heroMeta
        foreground: root.barForeground
        fontFamily: root.fontFamily
        iconComponent: Component {
          Text {
            text: "\uf1e3"  // futbol (Nerd Font)
            color: root.heroColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.iconLarge
          }
        }
      }

      Item { width: 1; height: Style.space(14) }

      // ---- Table ----
      Item {
        width: parent.width
        height: Math.max(sectionLabel.implicitHeight, sectionCount.implicitHeight)
        visible: root.hasData

        Text {
          id: sectionLabel
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: "ISPs"
          textFormat: Text.PlainText
          color: Commons.Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          font.letterSpacing: 1.2
        }

        Text {
          id: sectionCount
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: root.blockedCount + "/" + root.totalIsps + " blocking"
          textFormat: Text.PlainText
          color: root.blockedCount > 0 ? Commons.Color.urgent : Commons.Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          font.letterSpacing: 1.2
          horizontalAlignment: Text.AlignRight
        }
      }

      Item { width: 1; height: Style.space(5); visible: root.hasData }

      Column {
        width: parent.width
        visible: root.hasData
        spacing: 0

        Repeater {
          model: root.rowModel

          delegate: Item {
            id: row
            required property var modelData
            width: parent.width
            height: Style.space(28)

            readonly property bool hit: LaLigaModel.Model.isBlocking(modelData)
            readonly property bool mine: root.activeIsp.length > 0 && modelData.isp === root.activeIsp

            // Your ISP keeps its place without a tag: the fill is the locator
            Rectangle {
              anchors.fill: parent
              radius: Style.space(7)
              color: root.barForeground
              opacity: row.mine ? 0.055 : 0
            }

            Item {
              id: dot
              anchors.left: parent.left
              anchors.leftMargin: Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              width: Style.space(13)
              height: width

              Rectangle {
                anchors.centerIn: parent
                width: Style.space(13)
                height: width
                radius: width / 2
                color: Commons.Color.urgent
                opacity: row.hit ? 0.14 : 0
              }

              Rectangle {
                anchors.centerIn: parent
                width: Style.space(7)
                height: width
                radius: width / 2
                color: row.hit ? Commons.Color.urgent : Commons.Color.muted
                opacity: row.hit ? 1 : 0.5
              }
            }

            Text {
              id: rowName
              anchors.left: dot.right
              anchors.leftMargin: Style.space(9)
              anchors.right: rowCount.left
              anchors.rightMargin: Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              text: row.modelData.isp
              textFormat: Text.PlainText
              elide: Text.ElideRight
              color: root.barForeground
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
            }

            Text {
              id: rowCount
              anchors.right: parent.right
              anchors.rightMargin: Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              width: Style.space(58)
              text: row.hit ? row.modelData.blocked + " IPs" : "—"
              textFormat: Text.PlainText
              elide: Text.ElideRight
              horizontalAlignment: Text.AlignRight
              color: row.hit ? Commons.Color.urgent : Commons.Color.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall
              font.bold: row.hit
            }
          }
        }
      }

      Item { width: 1; height: Style.space(9); visible: root.hasData }

      Rectangle {
        width: parent.width
        height: Style.spacing.hairline
        color: root.barForeground
        opacity: 0.08
        visible: root.hasData
      }

      Item {
        width: parent.width
        height: Math.max(updatedText.implicitHeight, sourceText.implicitHeight) + Style.space(18)
        visible: root.hasData

        Text {
          id: updatedText
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: root.hasData ? "Updated " + LaLigaModel.Model.formatTime(root.feed.lastUpdate) : ""
          textFormat: Text.PlainText
          color: Commons.Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Text {
          id: sourceText
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: "hayahora.futbol"
          textFormat: Text.PlainText
          color: Commons.Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }
      }
    }
  }
}
