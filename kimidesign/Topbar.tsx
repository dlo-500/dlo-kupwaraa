import { useEffect, useState } from 'react'

export default function Topbar() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY < 100)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'rgba(5, 10, 15, 0.85)',
        borderBottom: '1px solid rgba(201, 168, 76, 0.2)',
        padding: '6px 4vw',
        fontSize: '11px',
        color: 'rgba(237, 232, 228, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'transform 0.4s ease, opacity 0.4s ease',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em' }}>
          Government of Jammu & Kashmir &nbsp;|&nbsp; Department of Law, Justice & Parliamentary Affairs
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(201, 168, 76, 0.1)',
              border: '1px solid rgba(201, 168, 76, 0.3)',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 10,
              color: '#C9A84C',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: '#4ADE80',
                borderRadius: '50%',
                animation: 'pulse 2s infinite',
              }}
            />
            Live Data
          </div>
          <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
        </div>
      </div>
    </div>
  )
}
