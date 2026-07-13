import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CaseRow } from '../hooks/useSupabase'
import { escapeHtml, formatDate } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface HearingsSectionProps {
  allRows: CaseRow[]
}

const HEARINGS_DEFAULT_SHOW = 5

function toISODateInput(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function HearingsSection({ allRows }: HearingsSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [allUpcoming, setAllUpcoming] = useState<CaseRow[]>([])
  const [expanded, setExpanded] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [hrfStats, setHrfStats] = useState({ total: 0, filed: 0, notFiled: 0 })

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const in15 = new Date(today); in15.setDate(today.getDate() + 15)
    setFromDate(toISODateInput(today))
    setToDate(toISODateInput(in15))

    const upcoming = allRows
      .filter(r => r.nextHearing instanceof Date && r.nextHearing >= today && r.nextHearing <= in15)
      .sort((a, b) => (a.nextHearing!.getTime() - b.nextHearing!.getTime()))
    setAllUpcoming(upcoming)
    updateStats(upcoming)
  }, [allRows])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      gsap.from(section.querySelectorAll('.reveal-item'), {
        y: 30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      })
    })
    return () => ctx.revert()
  }, [])

  const updateStats = useCallback((rows: CaseRow[]) => {
    const filed = rows.filter(r => r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not')).length
    setHrfStats({ total: rows.length, filed, notFiled: rows.length - filed })
  }, [])

  const applyRange = useCallback(() => {
    if (!fromDate || !toDate) return
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0)
    const to = new Date(toDate); to.setHours(23, 59, 59, 999)
    if (from > to) { alert('The "From" date must be before the "To" date.'); return }

    const filtered = allRows
      .filter(r => r.nextHearing instanceof Date && r.nextHearing >= from && r.nextHearing <= to)
      .sort((a, b) => (a.nextHearing!.getTime() - b.nextHearing!.getTime()))
    setAllUpcoming(filtered)
    setExpanded(true)
    updateStats(filtered)
  }, [allRows, fromDate, toDate, updateStats])

  const resetRange = useCallback(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const in15 = new Date(today); in15.setDate(today.getDate() + 15)
    setFromDate(toISODateInput(today))
    setToDate(toISODateInput(in15))

    const upcoming = allRows
      .filter(r => r.nextHearing instanceof Date && r.nextHearing >= today && r.nextHearing <= in15)
      .sort((a, b) => (a.nextHearing!.getTime() - b.nextHearing!.getTime()))
    setAllUpcoming(upcoming)
    setExpanded(false)
    updateStats(upcoming)
  }, [allRows, updateStats])

  const shareOnWhatsApp = useCallback(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const in15 = new Date(today); in15.setDate(today.getDate() + 15)
    const upcoming = allRows
      .filter(r => r.nextHearing instanceof Date && r.nextHearing >= today && r.nextHearing <= in15)
      .sort((a, b) => (a.nextHearing!.getTime() - b.nextHearing!.getTime()))

    if (upcoming.length === 0) { alert('No upcoming hearings in the next 15 days.'); return }

    let msg = `⚖️ *DLO KUPWARA — UPCOMING HEARINGS*\n📅 Next 15 Days | ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n━━━━━━━━━━━━━━━━━━━━\n\n`
    upcoming.forEach(r => {
      msg += `• ${r.caseNo || '—'} — ${r.title || '—'}\n  📍 ${r.court || '—'} | 📆 ${formatDate(r.nextHearing)}\n\n`
    })
    msg += `━━━━━━━━━━━━━━━━━━━━\n⚖️ District Litigation Office Kupwara`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }, [allRows])

  const displayedRows = expanded ? allUpcoming : allUpcoming.slice(0, HEARINGS_DEFAULT_SHOW)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '100px 4vw',
        background: '#050A0F',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal-item" style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
            Scheduled Hearings
          </p>
          <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, marginBottom: 16 }}>
            Upcoming Hearings — Next 15 Days
          </h2>
          <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px 0 24px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 14, color: 'rgba(237, 232, 228, 0.45)' }}>
              🔴 Within 3 days &nbsp;·&nbsp; 🟡 Within 7 days &nbsp;·&nbsp; 🟢 Within 15 days
            </p>
            <button
              onClick={shareOnWhatsApp}
              style={{
                background: '#25D366',
                color: '#fff',
                border: 'none',
                padding: '12px 22px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(37, 211, 102, 0.2)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Share on WhatsApp
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div
          className="reveal-item"
          style={{
            background: 'rgba(13, 27, 42, 0.6)',
            border: '1px solid rgba(201, 168, 76, 0.1)',
            borderRadius: 12,
            padding: '20px 22px',
            marginBottom: 28,
            boxShadow: '0 4px 20px rgba(13, 27, 42, 0.15)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 14, marginBottom: 16 }}>
            {[
              { label: 'From Date', value: fromDate, onChange: setFromDate },
              { label: 'To Date', value: toDate, onChange: setToDate },
            ].map((field, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#C9A84C' }}>
                  {field.label}
                </label>
                <input
                  type="date"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  style={{
                    border: '1.5px solid rgba(201, 168, 76, 0.2)',
                    borderRadius: 7,
                    padding: '9px 12px',
                    fontSize: 13,
                    fontFamily: "'Inter', sans-serif",
                    color: '#EDE8E4',
                    background: 'rgba(255, 255, 255, 0.04)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>
            ))}
            <button onClick={applyRange} style={filterBtnStyle('#C9A84C', '#0D1B2A')}>Apply Range</button>
            <button onClick={resetRange} style={filterBtnStyle('rgba(255,255,255,0.08)', '#EDE8E4')}>Reset (15 Days)</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Hearings', value: hrfStats.total, color: '#EDE8E4' },
              { label: 'Reply Filed', value: hrfStats.filed, color: '#4ADE80' },
              { label: 'Reply Not Filed', value: hrfStats.notFiled, color: '#EF4444' },
            ].map((stat, i) => (
              <div key={i} style={{ background: 'rgba(5, 10, 15, 0.5)', borderRadius: 10, padding: '14px 10px', textAlign: 'center', border: '1px solid rgba(201, 168, 76, 0.08)' }}>
                <b style={{ display: 'block', fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 26, color: stat.color, transition: 'transform 0.2s' }}>
                  {stat.value}
                </b>
                <span style={{ display: 'block', fontSize: 10, color: 'rgba(237, 232, 228, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2, fontWeight: 600 }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hearing Cards */}
        {allUpcoming.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'rgba(237, 232, 228, 0.35)', fontStyle: 'italic', fontSize: 15 }}>
            No hearings scheduled in the next 15 days.
          </div>
        ) : (
          <>
            {displayedRows.map((r, i) => {
              const diff = r.nextHearing ? Math.round((r.nextHearing.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0
              const borderColor = diff <= 3 ? '#EF4444' : diff <= 7 ? '#F59E0B' : '#4ADE80'
              const chip = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`
              return (
                <div
                  key={i}
                  className="reveal-item"
                  style={{
                    background: 'rgba(13, 27, 42, 0.5)',
                    borderRadius: 10,
                    border: '1px solid rgba(201, 168, 76, 0.08)',
                    borderLeft: `5px solid ${borderColor}`,
                    marginBottom: 14,
                    padding: '18px 22px',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.25)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)'; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', background: 'rgba(201, 168, 76, 0.1)', padding: '3px 10px', borderRadius: 4 }}>
                        {escapeHtml(r.caseNo)}
                      </span>
                    </div>
                    <span
                      style={{
                        background: diff <= 3 ? 'rgba(239, 68, 68, 0.15)' : diff <= 7 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                        color: diff <= 3 ? '#EF4444' : diff <= 7 ? '#F59E0B' : '#4ADE80',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 20,
                      }}
                    >
                      {chip}
                    </span>
                  </div>
                  <h4 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 6 }}>
                    {escapeHtml(r.title)}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(201, 168, 76, 0.08)' }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Court</span>
                      <p style={{ fontSize: 13, color: 'rgba(237, 232, 228, 0.7)', marginTop: 2 }}>{escapeHtml(r.court)}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Department</span>
                      <p style={{ fontSize: 13, color: 'rgba(237, 232, 228, 0.7)', marginTop: 2 }}>{escapeHtml(r.dept)}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hearing Date</span>
                      <p style={{ fontSize: 13, fontWeight: 700, color: borderColor, marginTop: 2 }}>{formatDate(r.nextHearing)}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reply Status</span>
                      <p style={{ fontSize: 13, fontWeight: 600, color: r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not') ? '#4ADE80' : '#EF4444', marginTop: 2 }}>
                        {escapeHtml(r.reply)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            {allUpcoming.length > HEARINGS_DEFAULT_SHOW && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    background: expanded ? '#C9A84C' : '#0D1B2A',
                    color: expanded ? '#0D1B2A' : '#EDE8E4',
                    border: 'none',
                    padding: '10px 28px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  {expanded ? 'Show Less ▲' : `Show All ${allUpcoming.length} Hearings ▼`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function filterBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color: color,
    padding: '10px 20px',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: "'Inter', sans-serif",
    transition: 'opacity 0.2s',
  }
}
