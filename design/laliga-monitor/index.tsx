import { Volleyball, Wifi } from 'lucide-react'
import { Bar as FillBar, Popover, Row, Stage, Text, type Act, type Layout } from './kit'
import './laliga.css'

// Omarchy desktop, Jade Horse. The top bar is the set; the LaLiga widget and
// its panel are the story. Beats: nothing blocking (no widget), another ISP
// starts blocking (the white badge appears), your ISP joins (red), the panel
// opens with the per-ISP breakdown, full time clears it while the panel is
// open (a seen cause), and the panel closes on a calm bar.
//
// Loop: the panel's cleared rows snap back while the panel is closed and
// hidden, so nothing rewinds in view. The panel answers first — the hero is
// the state, the table is the detail. Your ISP's row stays located with a
// quiet fill, so the answer and the evidence read as one.

type S = {
  own: boolean
  others: boolean
  open: boolean
  cleared: boolean
}

const initial: S = { own: false, others: false, open: false, cleared: false }
const poster: S = { own: true, others: true, open: true, cleared: false }

const YOUR_ISP = 'Vodafone'

const ISPS = [
  { name: 'Movistar', blocked: 142, when: 'others' },
  { name: 'Orange', blocked: 96, when: 'others' },
  { name: 'Vodafone', blocked: 287, when: 'own' },
  { name: 'DIGI', blocked: 0, when: null },
  { name: 'Masmovil', blocked: 0, when: null },
]

function blockedFor(isp: (typeof ISPS)[number], s: S) {
  if (s.cleared) return 0
  if (isp.when === 'own') return s.own ? isp.blocked : 0
  if (isp.when === 'others') return s.others ? isp.blocked : 0
  return 0
}

async function script(a: Act<S>) {
  await a.wait(700)

  // 1. Other ISPs start blocking; the quiet badge appears white
  a.mark('others')
  await a.set({ others: true })
  await a.wait(1200)

  // 2. Your ISP joins: the badge turns red
  a.mark('own')
  await a.set({ own: true })
  await a.wait(1100)

  // 3. Click: the panel opens with the breakdown
  a.mark('open')
  await a.click({ at: 'widget', x: 0.5, y: 0.5 })
  await a.set({ open: true })
  await a.wait(2600)

  // 4. Full time: the feed clears while the panel is open. The rows clear
  //    and the hero answers; the badge goes quiet but keeps its slot because
  //    the panel is anchored to it
  a.mark('clear')
  await a.set({ cleared: true, own: false, others: false })
  await a.wait(2400)

  // 5. Click again: the panel closes on a calm bar and the rows reset while
  //    hidden, so the loop ends where it began
  a.mark('close')
  await a.click({ at: 'widget', x: 0.5, y: 0.5 })
  await a.set({ open: false })
  await a.wait(450)
  await a.snap({ cleared: false })
  await a.move({ at: 'desktop', x: 0.82, y: 0.75 })
  await a.wait(500)
}

// The panel is 320 wide and pinned to the bar's own 16px right inset, so its
// edge lines up with the widget's edge at both widths.
const GEO: Record<Layout, { pop: number; right: number }> = {
  wide: { pop: 320, right: 720 - 16 },
  compact: { pop: 326, right: 358 - 16 },
}

export default function LaligaDemo() {
  return (
    <Stage<S>
      width={720}
      height={344}
      compact={{ below: 440, width: 358, height: 348 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { at: 'desktop', x: 0.82, y: 0.75 } }}
      className="lg"
      theme="dark"
    >
      {(s, _rect, layout) => {
        const g = GEO[layout]
        const pop = { left: g.right - g.pop, top: 30 + 8, width: g.pop }
        const visible = s.own || s.others || s.open
        const hits = ISPS.filter((isp) => blockedFor(isp, s) > 0)
        const tone = s.cleared ? 'is-quiet' : s.own ? 'is-own' : 'is-others'
        return (
          <>
            {/* Wallpaper ground */}
            <div className="lg-wall" data-target="desktop" />
            <div className="lg-bgwin">
              <div className="lg-bgwin__bar"><span /><span /><span /></div>
              <div className="lg-bgwin__body">
                <FillBar w={210} h={7} tone={1} />
                <FillBar w={150} h={7} tone={2} />
                <FillBar w={180} h={7} tone={2} />
                <FillBar w={90} h={7} tone={2} />
              </div>
            </div>

            {/* The Omarchy top bar */}
            <div className="lg-bar">
              <div className="lg-bar__left">
                {['1', '2', '3', '4'].map((n, i) => (
                  <span key={n} className={`lg-ws${i === 0 ? ' is-active' : ''}`}>{n}</span>
                ))}
              </div>
              <div className="lg-bar__right">
                <Wifi size={13} strokeWidth={1.75} className="lg-bar__icon" />
                <span className="lg-bar__icon lg-bar__clock">20:58</span>
                <span
                  className={`lg-widget ${tone}${visible ? ' is-visible' : ''}`}
                  data-target="widget"
                  data-cursor="pointer"
                  data-on={s.open || undefined}
                  aria-hidden={!visible}
                >
                  <Volleyball size={14} strokeWidth={1.9} />
                </span>
              </div>
            </div>

            {/* The panel: answer first, table second */}
            <Popover show={s.open} origin="top right" className="lg-pop" style={pop}>
              <div className="lg-hero">
                <span className={`lg-hero__icon ${tone}`}>
                  <Volleyball size={20} strokeWidth={1.8} />
                </span>
                <div className="lg-hero__body">
                  <span className="lg-slot lg-hero__title">
                    <span className={s.own && !s.cleared ? 'lg-on' : ''}>Your ISP is blocked</span>
                    <span className={!s.own && !s.cleared ? 'lg-on' : ''}>Blocked elsewhere</span>
                    <span className={s.cleared ? 'lg-on' : ''}>Nothing is blocked</span>
                  </span>
                  <span className="lg-slot lg-hero__meta">
                    <span className={s.own && !s.cleared ? 'lg-on' : ''}>Vodafone · auto-detected</span>
                    <span className={!s.own || s.cleared ? 'lg-on' : ''}>Vodafone · clear</span>
                  </span>
                </div>
              </div>

              <div className="lg-section">
                <Text className="lg-section__label">ISPs</Text>
                <span className={`lg-slot lg-section__count${hits.length === 0 ? ' is-quiet' : ''}`}>
                  <span className={hits.length > 0 ? 'lg-on' : ''}>{hits.length}/5 blocking</span>
                  <span className={hits.length === 0 ? 'lg-on' : ''}>0/5 blocking</span>
                </span>
              </div>

              <div className="lg-rows">
                {ISPS.map((isp) => {
                  const blocked = blockedFor(isp, s)
                  const hit = blocked > 0
                  return (
                    <Row
                      key={isp.name}
                      className={`lg-row${hit ? ' is-hit' : ''}`}
                      pad={6}
                      selected={isp.name === YOUR_ISP}
                      lead={<span className={`lg-dot${hit ? ' is-hit' : ''}`} />}
                      title={isp.name}
                      meta={
                        <span className="lg-slot lg-slot--end lg-count">
                          <span className={`lg-count__n${hit ? ' is-hit lg-on' : ''}`}>{isp.blocked} IPs</span>
                          <span className={hit ? 'lg-count__none' : 'lg-count__none lg-on'}>—</span>
                        </span>
                      }
                    />
                  )
                })}
              </div>

              <div className="lg-foot">
                <span>Updated 20:58</span>
                <span>hayahora.futbol</span>
              </div>
            </Popover>
          </>
        )
      }}
    </Stage>
  )
}
