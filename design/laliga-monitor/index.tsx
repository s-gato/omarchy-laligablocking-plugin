import { Volleyball, Wifi } from 'lucide-react'
import { Bar as FillBar, Popover, Row, Stage, Text, type Act, type Layout } from './kit'
import './laliga.css'

// Omarchy desktop, Tokyo Night. The top bar is the set; the LaLiga widget and
// its panel are the story. Beats: a quiet bar, the widget turns red when
// three ISPs start blocking (a match is on), the panel opens with the per-ISP
// breakdown, the block ends while the panel is open (rows clear, a seen
// cause), and the panel closes on a calm bar.
//
// Loop: the panel's cleared rows snap back while the panel is closed and
// hidden, so nothing rewinds in view. Widget badge and row metas crossfade
// between two always-mounted labels in fixed slots: nothing swaps, nothing
// moves.

type S = {
  blocked: boolean
  open: boolean
  cleared: boolean
}

const initial: S = { blocked: false, open: false, cleared: false }

// The poster is the payoff: the panel open, blocked rows on screen
const poster: S = { blocked: true, open: true, cleared: false }

const ISPS = [
  { name: 'Movistar', blocked: 12 },
  { name: 'Orange', blocked: 12 },
  { name: 'Vodafone', blocked: 11 },
  { name: 'DIGI', blocked: 0 },
  { name: 'MásMóvil', blocked: 0 },
]

async function script(a: Act<S>) {
  await a.wait(900)

  // 1. A match starts: three ISPs begin blocking, the widget turns red
  a.mark('alert')
  await a.set({ blocked: true })
  await a.wait(1100)

  // 2. Click: the panel opens with the breakdown
  a.mark('open')
  await a.click({ at: 'widget', x: 0.22, y: 0.5 })
  await a.set({ open: true })
  await a.wait(2400)

  // 3. Full time: the feed clears. The panel shows it (seen cause); the bar
  //    badge quiets with it
  a.mark('clear')
  await a.set({ cleared: true, blocked: false })
  await a.wait(2400)

  // 4. Click again: panel closes on a calm bar. Its rows reset while hidden
  //    so the loop ends where it began
  a.mark('close')
  await a.click({ at: 'widget', x: 0.22, y: 0.5 })
  await a.set({ open: false })
  await a.wait(500)
  await a.snap({ cleared: false })
  await a.move({ at: 'desktop', x: 0.82, y: 0.75 })
  await a.wait(400)
}

const GEO: Record<Layout, { pop: number; right: number }> = {
  wide: { pop: 274, right: 720 - 16 },
  compact: { pop: 326, right: 358 - 16 },
}

export default function LaligaDemo() {
  return (
    <Stage<S>
      width={720}
      height={330}
      compact={{ below: 440, width: 358, height: 430 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { at: 'desktop', x: 0.82, y: 0.75 } }}
      className="lg"
    >
      {(s, _rect, layout) => {
        const g = GEO[layout]
        const pop = { left: g.right - g.pop, top: 30 + 8, width: g.pop }
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
                  className={`lg-widget${s.blocked ? ' is-blocked' : ''}`}
                  data-target="widget"
                  data-cursor="pointer"
                  data-on={s.open || undefined}
                >
                  <Volleyball size={14} strokeWidth={1.9} />
                  <span className="lg-widget__count">
                    <span className={`lg-x lg-x--hit${s.blocked ? ' is-on' : ''}`}>3/5</span>
                    <span className={`lg-x lg-x--quiet${!s.blocked ? ' is-on' : ''}`}>0/5</span>
                  </span>
                </span>
              </div>
            </div>

            {/* The panel */}
            <Popover show={s.open} origin="top right" className="lg-pop" style={pop}>
              <div className="lg-pop__head">
                <Text className="lg-pop__title">LaLiga blocking</Text>
                <span className="lg-pop__updated">20:58</span>
              </div>
              <div className="lg-rows">
                {ISPS.map((isp) => {
                  const hit = isp.blocked > 0 && !s.cleared
                  return (
                    <Row
                      key={isp.name}
                      className="lg-row"
                      pad={7}
                      lead={<span className={`lg-dot${hit ? ' is-blocked' : ''}`} />}
                      title={isp.name}
                      meta={
                        <span className="lg-row__meta">
                          <span className={`lg-x lg-x--end lg-x--hit${hit ? ' is-on' : ''}`}>{isp.blocked} IPs</span>
                          <span className={`lg-x lg-x--end lg-x--quiet${!hit ? ' is-on' : ''}`}>No blocking</span>
                        </span>
                      }
                    />
                  )
                })}
              </div>
              <div className="lg-pop__foot">
                <FillBar w={120} h={6} tone={2} />
                <span className="lg-pop__src">hayahora.futbol</span>
              </div>
            </Popover>
          </>
        )
      }}
    </Stage>
  )
}
