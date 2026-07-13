import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CaseRow } from '../hooks/useSupabase'
import { escapeHtml, formatDate, isExparte } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface AnalyticsSectionProps {
  allRows: CaseRow[]
}

export default function AnalyticsSection({ allRows }: AnalyticsSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const caseTypeCanvasRef = useRef<HTMLCanvasElement>(null)
  const replyCanvasRef = useRef<HTMLCanvasElement>(null)
  const [deptPerf, setDeptPerf] = useState<[string, { total: number; active: number; disposed: number; pending: number }][]>([])
  const [overdueRows, setOverdueRows] = useState<CaseRow[]>([])
  const [missingRows, setMissingRows] = useState<CaseRow[]>([])

  useEffect(() => {
    // Department performance
    const deptMap: Record<string, { total: number; active: number; disposed: number; pending: number }> = {}
    allRows.forEach(r => {
      if (!r.dept) return
      const d = r.dept.trim()
      if (!deptMap[d]) deptMap[d] = { total: 0, active: 0, disposed: 0, pending: 0 }
      deptMap[d].total++
      const isActive = r.status && r.status.toLowerCase().includes('active')
      const isDisposed = r.status && r.status.toLowerCase().includes('disposed')
      if (isActive) deptMap[d].active++
      if (isDisposed) deptMap[d].disposed++
      if (isActive && r.reply && r.reply.toLowerCase().includes('not')) deptMap[d].pending++
    })
    setDeptPerf(Object.entries(deptMap).sort((a, b) => b[1].pending - a[1].pending))

    // Overdue and missing
    const today = new Date(); today.setHours(0, 0, 0, 0)
    setOverdueRows(allRows.filter(r => r.nextHearing instanceof Date && r.nextHearing < today && r.status && r.status.toLowerCase().includes('active')))
    setMissingRows(allRows.filter(r => {
      if (!(r.nextHearing instanceof Date)) return false
      const diff = Math.round((r.nextHearing.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 7 && r.reply && r.reply.toLowerCase().includes('not')
    }))
  }, [allRows])

  // Case Type Chart
  useEffect(() => {
    const canvas = caseTypeCanvasRef.current
    if (!canvas || allRows.length === 0) return
    // @ts-ignore
    const Chart = window.Chart
    if (!Chart) return

    const typeMap: Record<string, number> = {}
    allRows.forEach(r => { if (r.type && r.type.trim()) typeMap[r.type.trim()] = (typeMap[r.type.trim()] || 0) + 1 })
    const entries = Object.entries(typeMap).sort((a, b) => b[1] - a[1])
    const palette = ['#1B2A4A', '#C9A84C', '#1E6B45', '#8B1A1A', '#243660', '#7A5C00', '#4A7B9D', '#6B4226', '#E07A5F', '#81B29A']
    const colors = entries.map((_: any, i: number) => palette[i % palette.length])

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(([n]) => n),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: colors,
          borderColor: '#050A0F',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c: any) => ` ${c.label}: ${c.raw} (${((c.raw / entries.reduce((a: number, b: [string, number]) => a + b[1], 0)) * 100).toFixed(1)}%)` } }
        }
      }
    })
    return () => { chart.destroy() }
  }, [allRows])

  // Reply by Court Chart
  useEffect(() => {
    const canvas = replyCanvasRef.current
    if (!canvas || allRows.length === 0) return
    // @ts-ignore
    const Chart = window.Chart
    if (!Chart) return

    const courtMap: Record<string, number> = {}
    allRows.forEach(r => {
      if (!r.court) return
      const c = r.court.trim()
      if (!courtMap[c]) courtMap[c] = 0
      if (r.reply && r.reply.toLowerCase().includes('not')) courtMap[c]++
    })
    const entries = Object.entries(courtMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10)
    if (entries.length === 0) return

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: entries.map(([n]) => n.length > 18 ? n.substring(0, 18) + '…' : n),
        datasets: [{
          label: 'Reply Pending',
          data: entries.map(([, v]) => v),
          backgroundColor: 'rgba(139, 26, 26, 0.8)',
          borderColor: '#8B1A1A',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: 'rgba(237, 232, 228, 0.4)', font: { size: 10 } }, grid: { color: 'rgba(237, 232, 228, 0.05)' } },
          y: { ticks: { color: 'rgba(237, 232, 228, 0.5)', font: { size: 10 } } },
        }
      }
    })
    return () => { chart.destroy() }
  }, [allRows])

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

  const total = allRows.length
  const active = allRows.filter(r => r.status && r.status.toLowerCase().includes('active')).length
  const disposed = allRows.filter(r => r.status && r.status.toLowerCase().includes('disposed')).length
  const pending = allRows.filter(r => r.status && r.status.toLowerCase().includes('pending')).length
  const exparte = allRows.filter(r => isExparte(r)).length
  const pct = total ? Math.round((disposed / total) * 100) : 0

  const ProgressBar = ({ label, value, color, max }: { label: string; value: number; color: string; max: number }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'rgba(237, 232, 228, 0.6)' }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <div style={{ background: 'rgba(237, 232, 228, 0.06)', borderRadius: 20, height: 16, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 20, width: `${max ? (value / max) * 100 : 0}%`, background: color, transition: 'width 1.5s ease' }} />
      </div>
    </div>
  )

  const cardStyle: React.CSSProperties = {
    background: 'rgba(13, 27, 42, 0.5)',
    borderRadius: 10,
    border: '1px solid rgba(201, 168, 76, 0.08)',
    padding: 24,
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
  }

  return (
    <section ref={sectionRef} style={{ padding: '100px 4vw', background: '#050A0F', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal-item" style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>Analytics & Insights</p>
          <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, marginBottom: 16 }}>
            Case Statistics & Performance
          </h2>
          <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px 0 24px' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Disposal Rate */}
          <div className="reveal-item" style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 4 }}>Disposal Rate</h3>
            <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.4)', marginBottom: 16 }}>Percentage of cases disposed vs total registered</p>
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <span style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 52, fontWeight: 700, color: '#4ADE80' }}>{pct}</span>
              <span style={{ fontSize: 24, color: '#4ADE80' }}>%</span>
            </div>
            <div style={{ background: 'rgba(237, 232, 228, 0.06)', borderRadius: 20, height: 28, overflow: 'hidden', position: 'relative', margin: '8px 0' }}>
              <div style={{ height: '100%', borderRadius: 20, width: `${pct}%`, background: 'linear-gradient(90deg, #1E6B45, #4ADE80)', transition: 'width 1.5s ease', display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                {pct > 15 && <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{pct}%</span>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'rgba(237, 232, 228, 0.4)' }}>
              <span>{disposed} disposed</span><span>{total} total</span>
            </div>
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(237, 232, 228, 0.6)', marginBottom: 8 }}>Case Breakdown</p>
              <ProgressBar label="Active" value={active} color="linear-gradient(90deg, #1E6B45, #4ADE80)" max={total} />
              <ProgressBar label="Disposed" value={disposed} color="linear-gradient(90deg, #8B1A1A, #EF4444)" max={total} />
              <ProgressBar label="Pending" value={pending} color="linear-gradient(90deg, #7A5C00, #F59E0B)" max={total} />
              <ProgressBar label="Ex-parte" value={exparte} color="linear-gradient(90deg, #7C2D12, #F97316)" max={total} />
            </div>
          </div>

          {/* Department Performance */}
          <div className="reveal-item" style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 4 }}>Department Performance</h3>
            <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.4)', marginBottom: 16 }}>Pending reply count by department</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0D1B2A' }}>
                    {['#', 'Department', 'Total', 'Active', 'Disposed', 'Reply Pending'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(237, 232, 228, 0.7)', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deptPerf.map(([name, d], i) => (
                    <tr key={name} style={{ background: i % 2 === 0 ? 'rgba(13, 27, 42, 0.3)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(237, 232, 228, 0.04)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid rgba(237, 232, 228, 0.04)' }}>{escapeHtml(name)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid rgba(237, 232, 228, 0.04)' }}>{d.total}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#4ADE80', fontWeight: 600, borderBottom: '1px solid rgba(237, 232, 228, 0.04)' }}>{d.active}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#EF4444', fontWeight: 600, borderBottom: '1px solid rgba(237, 232, 228, 0.04)' }}>{d.disposed}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid rgba(237, 232, 228, 0.04)' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: d.pending > 0 ? 'rgba(139, 26, 26, 0.2)' : 'rgba(30, 107, 69, 0.2)', color: d.pending > 0 ? '#EF4444' : '#4ADE80' }}>
                          {d.pending}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="reveal-item" style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 4 }}>Case Type Distribution</h3>
            <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.4)', marginBottom: 16 }}>Breakdown by case type across all registered cases</p>
            <canvas ref={caseTypeCanvasRef} style={{ maxHeight: 260 }} />
          </div>
          <div className="reveal-item" style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 4 }}>Reply Pending by Court</h3>
            <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.4)', marginBottom: 16 }}>Courts with highest number of unfiled replies</p>
            <canvas ref={replyCanvasRef} style={{ maxHeight: 260 }} />
          </div>
        </div>

        {/* Overdue & Missing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <AlertListCard title="⚠️ Overdue Cases" subtitle="Cases where hearing date has passed but status is still Active" rows={overdueRows} />
          <AlertListCard title="❗ Missing Reply — Hearing Soon" subtitle="Reply not filed but hearing is within 7 days" rows={missingRows} />
        </div>
      </div>
    </section>
  )
}

function AlertListCard({ title, subtitle, rows }: { title: string; subtitle: string; rows: CaseRow[] }) {
  return (
    <div className="reveal-item" style={{ background: 'rgba(13, 27, 42, 0.5)', borderRadius: 10, border: '1px solid rgba(201, 168, 76, 0.08)', padding: 24, boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)' }}>
      <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 4 }}>{title}</h3>
      <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.4)', marginBottom: 14 }}>{subtitle}</p>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <p style={{ color: 'rgba(237, 232, 228, 0.35)', fontStyle: 'italic', padding: 12, fontSize: 13 }}>✅ No items found.</p>
        ) : (
          rows.map((r, i) => (
            <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#C9A84C' }}>{escapeHtml(r.caseNo || '—')}</strong> — {escapeHtml(r.title || '—')}<br />
                <span style={{ color: 'rgba(237, 232, 228, 0.35)' }}>{escapeHtml(r.court || '—')} | {formatDate(r.nextHearing)}</span>
              </div>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: r.status === 'Active' ? 'rgba(30, 107, 69, 0.15)' : 'rgba(139, 26, 26, 0.15)',
                color: r.status === 'Active' ? '#4ADE80' : '#EF4444',
              }}>
                {escapeHtml(r.status)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
