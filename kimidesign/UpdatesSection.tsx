import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { UpdateItem } from '../hooks/useSupabase'
import { escapeHtml, safeUrl } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface UpdatesSectionProps {
  updates: UpdateItem[]
  loading: boolean
}

const CAT_COLORS: Record<string, { bg: string; fg: string }> = {
  'Court Order': { bg: 'rgba(239, 68, 68, 0.1)', fg: '#FCA5A5' },
  'Notice': { bg: 'rgba(245, 158, 11, 0.1)', fg: '#FCD34D' },
  'Circular': { bg: 'rgba(74, 222, 128, 0.1)', fg: '#86EFAC' },
  'Hearing': { bg: 'rgba(96, 165, 250, 0.1)', fg: '#93C5FD' },
}

export default function UpdatesSection({ updates, loading }: UpdatesSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)

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

  return (
    <section ref={sectionRef} style={{ padding: '100px 4vw', background: '#050A0F', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal-item" style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>Latest Updates</p>
          <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, marginBottom: 16 }}>
            Orders, Notices & Circulars
          </h2>
          <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px 0 24px' }} />
          <p style={{ fontSize: 14, color: 'rgba(237, 232, 228, 0.45)' }}>Auto-updated. Click "View Document" to open attached files.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'rgba(237, 232, 228, 0.35)', fontStyle: 'italic' }}>⏳ Loading updates...</div>
        ) : updates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'rgba(237, 232, 228, 0.35)', fontStyle: 'italic', fontSize: 15 }}>No updates available at this time.</div>
        ) : (
          updates.map((u, i) => {
            const c = CAT_COLORS[u.category] || { bg: 'rgba(96, 165, 250, 0.1)', fg: '#93C5FD' }
            const link = safeUrl(u.link)
            return (
              <div
                key={i}
                className="reveal-item"
                style={{
                  background: 'rgba(13, 27, 42, 0.4)',
                  border: '1px solid rgba(201, 168, 76, 0.08)',
                  borderRadius: 10,
                  padding: '20px 24px',
                  marginBottom: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 20,
                  flexWrap: 'wrap',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.08)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.fg }}>
                      {escapeHtml(u.category || 'Update')}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.35)' }}>{escapeHtml(u.date)}</span>
                  </div>
                  <h4 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 16, color: '#EDE8E4', marginBottom: 6 }}>
                    {escapeHtml(u.title)}
                  </h4>
                  <p style={{ fontSize: 13, color: 'rgba(237, 232, 228, 0.45)', lineHeight: 1.6 }}>{escapeHtml(u.desc)}</p>
                </div>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#0D1B2A',
                      color: '#EDE8E4',
                      padding: '10px 18px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      border: '1px solid rgba(201, 168, 76, 0.2)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#C9A84C'; e.currentTarget.style.color = '#0D1B2A' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#0D1B2A'; e.currentTarget.style.color = '#EDE8E4' }}
                  >
                    📄 View Document
                  </a>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
