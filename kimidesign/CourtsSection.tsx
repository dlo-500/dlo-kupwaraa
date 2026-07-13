import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CaseRow } from '../hooks/useSupabase'
import { escapeHtml } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface CourtsSectionProps {
  allRows: CaseRow[]
}

const PALETTE = ['#1B2A4A', '#C9A84C', '#1E6B45', '#8B1A1A', '#243660', '#7A5C00', '#4A7B9D', '#6B4226', '#2D6A4F', '#9B2335', '#3D5A80', '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B']

export default function CourtsSection({ allRows }: CourtsSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [courtData, setCourtData] = useState<[string, number][]>([])

  useEffect(() => {
    const courtMap: Record<string, number> = {}
    allRows.forEach(r => {
      if (r.court && r.court.trim()) {
        courtMap[r.court.trim()] = (courtMap[r.court.trim()] || 0) + 1
      }
    })
    const sorted = Object.entries(courtMap).sort((a, b) => b[1] - a[1])
    setCourtData(sorted)
  }, [allRows])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || courtData.length === 0) return

    // @ts-ignore
    const Chart = window.Chart
    if (!Chart) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = courtData.map(([, count]) => count)
    const colors = data.map((_: number, i: number) => PALETTE[i % PALETTE.length])

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: courtData.map(([name]) => name),
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#050A0F',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c: any) => ` ${c.label}: ${c.raw} cases (${((c.raw / data.reduce((a: number, b: number) => a + b, 0)) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    })

    return () => { chart.destroy() }
  }, [courtData])

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

  const totalCases = allRows.length

  return (
    <section ref={sectionRef} style={{ padding: '100px 4vw', background: '#050A0F', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal-item" style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>Jurisdiction</p>
          <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, marginBottom: 16 }}>
            Court-wise Case Distribution
          </h2>
          <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px 0 24px' }} />
        </div>

        <div className="reveal-item" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 28, alignItems: 'start' }}>
          {/* Courts Table */}
          <div style={{ borderRadius: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid rgba(201, 168, 76, 0.1)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500, fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#0D1B2A' }}>
                  {['#', 'Court Name', 'Total Cases'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(237, 232, 228, 0.8)', textAlign: h === 'Total Cases' ? 'center' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courtData.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'rgba(237, 232, 228, 0.35)' }}>⏳ Loading court data...</td>
                  </tr>
                ) : (
                  courtData.map(([name, count], i) => (
                    <tr
                      key={name}
                      style={{
                        background: i % 2 === 0 ? 'rgba(13, 27, 42, 0.4)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201, 168, 76, 0.05)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'rgba(13, 27, 42, 0.4)' : 'transparent' }}
                    >
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{i + 1}</td>
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(name)}</td>
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          background: count > 0 ? '#0D1B2A' : 'rgba(237, 232, 228, 0.08)',
                          color: count > 0 ? '#EDE8E4' : 'rgba(237, 232, 228, 0.4)',
                          borderRadius: 20,
                          padding: '3px 14px',
                          fontSize: 13,
                          fontWeight: 700,
                          minWidth: 40,
                          border: '1px solid rgba(201, 168, 76, 0.15)',
                        }}>
                          {count}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1B2A4A' }}>
                  <td colSpan={2} style={{ padding: '14px 20px', fontWeight: 700, fontSize: 15, color: '#EDE8E4' }}>Total Cases Registered</td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: '#C9A84C', fontSize: 18, fontWeight: 700 }}>{totalCases}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Donut Chart */}
          <div style={{ background: 'rgba(13, 27, 42, 0.4)', borderRadius: 10, border: '1px solid rgba(201, 168, 76, 0.1)', padding: 24, boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)' }}>
            <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 4, textAlign: 'center' }}>
              Case Distribution
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.4)', textAlign: 'center', marginBottom: 16 }}>
              Court-wise proportional spread
            </p>
            <canvas ref={canvasRef} style={{ maxHeight: 280 }} />
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {courtData.slice(0, 8).map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                  <span style={{ color: 'rgba(237, 232, 228, 0.6)', flex: 1, lineHeight: 1.3 }}>{escapeHtml(name)}</span>
                  <span style={{ fontWeight: 700, color: PALETTE[i % PALETTE.length] }}>{count}</span>
                </div>
              ))}
              {courtData.length > 8 && (
                <div style={{ fontSize: 11, color: 'rgba(237, 232, 228, 0.3)', fontStyle: 'italic' }}>
                  + {courtData.length - 8} more courts
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div
          className="reveal-item"
          style={{
            marginTop: 36,
            background: 'rgba(122, 92, 0, 0.08)',
            border: '1px solid rgba(201, 168, 76, 0.15)',
            borderLeft: '4px solid #C9A84C',
            borderRadius: 6,
            padding: '20px 24px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#E8C96A', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              Important Disclaimer
            </p>
            <p style={{ fontSize: 13, color: 'rgba(237, 232, 228, 0.5)', lineHeight: 1.7 }}>
              The information provided on this website is intended solely to keep the employees of stakeholder departments aware regarding statistics and developments of cases being handled by the District Litigation Office Kupwara. <strong style={{ color: '#EDE8E4' }}>This information cannot be made the basis of any litigation, legal proceeding, claim, or action of any nature whatsoever.</strong> For official case records, kindly contact the District Litigation Office Kupwara directly.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
