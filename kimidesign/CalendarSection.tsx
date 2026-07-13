import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CaseRow } from '../hooks/useSupabase'
import { escapeHtml } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface CalendarSectionProps {
  allRows: CaseRow[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarSection({ allRows }: CalendarSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [hearingMap, setHearingMap] = useState<Record<number, CaseRow[]>>({})

  useEffect(() => {
    const map: Record<number, CaseRow[]> = {}
    allRows.forEach(r => {
      if (!(r.nextHearing instanceof Date)) return
      if (r.nextHearing.getFullYear() === calYear && r.nextHearing.getMonth() === calMonth) {
        const d = r.nextHearing.getDate()
        if (!map[d]) map[d] = []
        map[d].push(r)
      }
    })
    setHearingMap(map)
    setSelectedDay(null)
  }, [allRows, calYear, calMonth])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      gsap.from(section.querySelectorAll('.reveal-item'), {
        y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none none' },
      })
    })
    return () => ctx.revert()
  }, [])

  const changeMonth = useCallback((dir: number) => {
    setCalMonth(m => {
      let newMonth = m + dir
      let newYear = calYear
      if (newMonth > 11) { newMonth = 0; newYear++ }
      if (newMonth < 0) { newMonth = 11; newYear-- }
      setCalYear(newYear)
      return newMonth
    })
  }, [calYear])

  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <section ref={sectionRef} style={{ padding: '100px 4vw', background: '#050A0F', position: 'relative' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="reveal-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>Calendar View</p>
            <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, marginBottom: 16 }}>
              Hearing Calendar
            </h2>
            <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px 0 24px' }} />
            <p style={{ fontSize: 14, color: 'rgba(237, 232, 228, 0.45)' }}>Click any highlighted date to see hearings. Navy = has hearings.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => changeMonth(-1)} style={navBtnStyle}>‹</button>
            <span style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, fontWeight: 600, color: '#EDE8E4', minWidth: 140, textAlign: 'center' }}>
              {new Date(calYear, calMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} style={navBtnStyle}>›</button>
          </div>
        </div>

        <div className="reveal-item" style={{ background: 'rgba(13, 27, 42, 0.4)', borderRadius: 10, border: '1px solid rgba(201, 168, 76, 0.1)', padding: 24, boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: 'rgba(237, 232, 228, 0.35)', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {d}
              </div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: 8 }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1
              const hasH = hearingMap[d] && hearingMap[d].length > 0
              const isToday = new Date(calYear, calMonth, d).getTime() === today.getTime()
              return (
                <div
                  key={d}
                  onClick={() => hasH && setSelectedDay(d)}
                  style={{
                    aspectRatio: 1,
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    cursor: hasH ? 'pointer' : 'default',
                    border: isToday ? '2px solid #C9A84C' : '1px solid transparent',
                    background: hasH ? '#0D1B2A' : isToday ? 'rgba(201, 168, 76, 0.08)' : 'transparent',
                    color: hasH ? '#EDE8E4' : isToday ? '#C9A84C' : 'rgba(237, 232, 228, 0.5)',
                    fontWeight: isToday || hasH ? 700 : 400,
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => { if (hasH) { e.currentTarget.style.background = '#C9A84C'; e.currentTarget.style.color = '#0D1B2A' } }}
                  onMouseLeave={(e) => { if (hasH) { e.currentTarget.style.background = '#0D1B2A'; e.currentTarget.style.color = '#EDE8E4' } }}
                >
                  {d}
                  {hasH && (
                    <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, fontWeight: 700, color: '#C9A84C' }}>
                      {hearingMap[d].length}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {selectedDay !== null && hearingMap[selectedDay] && (
          <div className="reveal-item" style={{ marginTop: 20, background: 'rgba(13, 27, 42, 0.5)', borderRadius: 10, border: '1px solid rgba(201, 168, 76, 0.1)', padding: 20, boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)' }}>
            <h4 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 14 }}>
              Hearings on {selectedDay} {new Date(calYear, calMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h4>
            {hearingMap[selectedDay].map((r, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ color: '#C9A84C' }}>{r.caseNo || '—'}</strong> — {escapeHtml(r.title || '—')}<br />
                  <span style={{ color: 'rgba(237, 232, 228, 0.4)', fontSize: 12 }}>{escapeHtml(r.court || '—')} | {escapeHtml(r.dept || '—')}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not') ? '#4ADE80' : '#EF4444' }}>
                  {escapeHtml(r.reply || '—')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: '#0D1B2A',
  color: '#EDE8E4',
  border: '1px solid rgba(201, 168, 76, 0.2)',
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: 16,
  transition: 'all 0.2s',
}
