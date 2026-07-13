import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CaseRow } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface StatsSectionProps {
  allRows: CaseRow[]
}

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true
            const start = performance.now()
            const step = (now: number) => {
              const progress = Math.min((now - start) / duration, 1)
              const eased = 1 - Math.pow(1 - progress, 3)
              setCount(Math.round(eased * target))
              if (progress < 1) requestAnimationFrame(step)
            }
            requestAnimationFrame(step)
          }
        })
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={ref}>{count.toLocaleString()}</span>
}

export default function StatsSection({ allRows }: StatsSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      gsap.from(section.querySelectorAll('.stat-card'), {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      })
    })
    return () => ctx.revert()
  }, [])

  const total = allRows.length
  const active = allRows.filter(r => r.status?.toLowerCase().includes('active')).length
  const disposed = allRows.filter(r => r.status?.toLowerCase().includes('disposed')).length
  const courts = new Set(allRows.map(r => r.court).filter(Boolean)).size

  const stats = [
    { value: total, label: 'Total Cases', icon: '\u2696\uFE0F' },
    { value: active, label: 'Active Cases', icon: '\uD83D\uDCCA' },
    { value: disposed, label: 'Disposed', icon: '\u2705' },
    { value: courts || 13, label: 'Courts Covered', icon: '\uD83C\uDFDB\uFE0F' },
  ]

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '80px 4vw',
        background: 'linear-gradient(180deg, rgba(5,10,15,0.95) 0%, #050A0F 100%)',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 2,
          background: 'rgba(201, 168, 76, 0.08)',
          border: '1px solid rgba(201, 168, 76, 0.15)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card"
            style={{
              background: 'rgba(13, 27, 42, 0.7)',
              padding: '36px 24px',
              textAlign: 'center',
              transition: 'background 0.25s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(13, 27, 42, 0.95)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(13, 27, 42, 0.7)'
            }}
          >
            <span
              style={{
                fontSize: 26,
                display: 'block',
                marginBottom: 14,
                opacity: 0.8,
              }}
            >
              {stat.icon}
            </span>
            <span
              style={{
                fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif",
                fontSize: 48,
                fontWeight: 700,
                color: '#C9A84C',
                lineHeight: 1,
                display: 'block',
              }}
            >
              <AnimatedCounter target={stat.value} />
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'rgba(237, 232, 228, 0.45)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 10,
                display: 'block',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
