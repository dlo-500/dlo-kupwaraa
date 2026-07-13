import { useState } from 'react'

export default function DeveloperCredit() {
  const [showPopup, setShowPopup] = useState(false)

  return (
    <>
      <div
        style={{
          background: '#030810',
          borderTop: '1px solid rgba(201, 168, 76, 0.12)',
          padding: '14px 4vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.2)' }}>
            District Litigation Office Kupwara &nbsp;·&nbsp; Justice · Integrity · Law
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.2)' }}>
          Designed & Developed by &nbsp;
          <button
            onClick={() => setShowPopup(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#C9A84C',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: "'Inter', sans-serif",
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Tariq Ahmad Lone
          </button>
          &nbsp;·&nbsp; <span style={{ color: 'rgba(237, 232, 228, 0.12)' }}>VERSION: NK.1.0</span>
        </p>
      </div>

      {/* Developer Popup */}
      {showPopup && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowPopup(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#0D1B2A',
              borderRadius: 14,
              maxWidth: 440,
              width: '100%',
              textAlign: 'center',
              overflow: 'visible',
              border: '1px solid rgba(201, 168, 76, 0.15)',
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ background: '#0D1B2A', padding: '16px 20px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPopup(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(237, 232, 228, 0.4)', fontSize: 24, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '0 28px 32px', marginTop: -30 }}>
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A84C, #E8C96A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 42,
                  margin: '0 auto 18px',
                  boxShadow: '0 0 0 5px #0D1B2A, 0 12px 30px rgba(13, 27, 42, 0.5)',
                }}
              >
                👨‍💻
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>Developer</p>
              <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 24, fontWeight: 700, color: '#EDE8E4', marginBottom: 8 }}>
                Tariq Ahmad Lone
              </h3>
              <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(237, 232, 228, 0.7)', lineHeight: 1.6 }}>
                AN OFFICIAL OF DISTRICT LITIGATION OFFICE KUPWARA
              </p>
              <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.35)', marginTop: 14, fontStyle: 'italic' }}>
                Designed & Developed this Case Management Portal
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
