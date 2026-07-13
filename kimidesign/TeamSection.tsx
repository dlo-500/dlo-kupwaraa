import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { teamData } from '../config'
import { escapeHtml } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

export default function TeamSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      gsap.from(section.querySelectorAll('.reveal-item'), {
        y: 30, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none none' },
      })
    })
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} style={{ padding: '100px 4vw', background: '#050A0F', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal-item" style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>Our Team</p>
          <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, margin: '0 auto 16px' }}>
            District Litigation Office — Officials
          </h2>
          <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px auto 0' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {teamData.map((member, i) => (
            <div
              key={i}
              className="reveal-item"
              style={{
                background: 'rgba(13, 27, 42, 0.5)',
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(201, 168, 76, 0.08)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                cursor: 'default',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(0, 0, 0, 0.2)' }}
            >
              <div
                style={{
                  background: '#0D1B2A',
                  padding: '32px 24px',
                  textAlign: 'center',
                  borderBottom: '3px solid #C9A84C',
                  backgroundImage: `linear-gradient(45deg, rgba(201, 168, 76, 0.04) 25%, transparent 25%),
                    linear-gradient(-45deg, rgba(201, 168, 76, 0.04) 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, rgba(201, 168, 76, 0.04) 75%),
                    linear-gradient(-45deg, transparent 75%, rgba(201, 168, 76, 0.04) 75%)`,
                  backgroundSize: '30px 30px',
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #C9A84C, #E8C96A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                    margin: '0 auto 14px',
                    boxShadow: '0 0 0 4px rgba(201, 168, 76, 0.15), 0 8px 24px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {member.icon}
                </div>
                <div style={{ fontSize: 10, color: '#E8C96A', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {escapeHtml(member.subtitle)}
                </div>
              </div>
              <div style={{ padding: '22px 24px', textAlign: 'center' }}>
                <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 18, color: '#EDE8E4', marginBottom: 8 }}>
                  {escapeHtml(member.name)}
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(237, 232, 228, 0.4)' }}>
                  {escapeHtml(member.role)}<br />DLO Kupwara
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
