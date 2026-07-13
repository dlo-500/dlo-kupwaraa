import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SUPABASE_URL, SUPABASE_ANON_KEY, contactData } from '../config'
import { escapeHtml } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

// @ts-ignore
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default function ContactSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get('name') || '').trim()
    const contact = String(formData.get('contact') || '').trim()
    const dept = String(formData.get('dept') || '')
    const caseNo = String(formData.get('caseNo') || '').trim()
    const message = String(formData.get('message') || '').trim()
    const honeypot = String(formData.get('hp_field_9f3') || '')

    if (honeypot) { console.warn('Bot detected'); return }
    if (!name || !contact) {
      setFormStatus({ type: 'error', message: '⚠️ Please fill in your Name and Contact Number.' })
      return
    }
    const digitsOnly = contact.replace(/\D/g, '')
    if (digitsOnly.length < 10) {
      setFormStatus({ type: 'error', message: '⚠️ Please enter a valid contact number.' })
      return
    }

    setSubmitting(true)
    setFormStatus(null)

    try {
      if (!sb) throw new Error('Supabase not loaded')
      const { error } = await sb.from('enquiries').insert({
        name: name.slice(0, 80),
        contact: contact.slice(0, 15),
        department: dept,
        case_no: caseNo.slice(0, 40),
        message: message.slice(0, 1000),
      })
      if (error) throw error
      setFormStatus({ type: 'success', message: '✅ Enquiry submitted successfully! We will contact you soon.' })
      form.reset()
    } catch (e) {
      setFormStatus({ type: 'error', message: '⚠️ Submission failed. Please email us directly.' })
    } finally {
      setSubmitting(false)
    }
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(201, 168, 76, 0.15)',
    borderRadius: 6,
    padding: '11px 14px',
    fontSize: 14,
    color: '#EDE8E4',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <section ref={sectionRef} style={{ padding: '100px 4vw', background: '#050A0F', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }}>
          {/* Left — Contact Info */}
          <div>
            <div className="reveal-item" style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>Get In Touch</p>
              <h2 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: '#EDE8E4', lineHeight: 1.2, marginBottom: 16 }}>
                Contact the District<br />Litigation Office
              </h2>
              <div style={{ width: 48, height: 3, background: '#C9A84C', borderRadius: 2, margin: '20px 0 32px' }} />
            </div>

            {contactData.map((item, i) => (
              <div
                key={i}
                className="reveal-item"
                style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 28 }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: 'rgba(201, 168, 76, 0.08)',
                    border: '1px solid rgba(201, 168, 76, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: '#E8C96A', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {escapeHtml(item.title)}
                  </h4>
                  {item.lines.map((line, j) => (
                    <p key={j} style={{ fontSize: 14, color: 'rgba(237, 232, 228, 0.6)', lineHeight: 1.6 }}>
                      {item.title === 'Email' ? (
                        <a href={`mailto:${line}`} style={{ color: 'rgba(237, 232, 228, 0.6)', textDecoration: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#C9A84C' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(237, 232, 228, 0.6)' }}
                        >{line}</a>
                      ) : escapeHtml(line)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right — Form */}
          <div
            className="reveal-item"
            style={{
              background: 'rgba(13, 27, 42, 0.5)',
              border: '1px solid rgba(201, 168, 76, 0.1)',
              borderRadius: 12,
              padding: 36,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif", fontSize: 22, color: '#EDE8E4', marginBottom: 8 }}>
              Send an Enquiry
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(237, 232, 228, 0.35)', marginBottom: 28, fontStyle: 'italic' }}>
              All enquiries are recorded directly in our database.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Honeypot */}
              <input type="text" name="hp_field_9f3" autoComplete="off" tabIndex={-1} style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#E8C96A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Full Name *
                </label>
                <input type="text" name="name" placeholder="Your full name" maxLength={80} autoComplete="name" required style={inputStyle} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#E8C96A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Contact Number *
                </label>
                <input type="tel" name="contact" placeholder="Your mobile number" maxLength={15} autoComplete="tel" required style={inputStyle} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#E8C96A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Subject / Department
                </label>
                <select name="dept" style={{ ...inputStyle, appearance: 'auto' }}>
                  <option value="">Select Department</option>
                  {['Revenue', 'Labour', 'Forest', 'Education', 'PWD', 'Police', 'Other'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#E8C96A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Case Number (if known)
                </label>
                <input type="text" name="caseNo" placeholder="e.g. CMR/001/2024" maxLength={40} style={inputStyle} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#E8C96A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Message
                </label>
                <textarea name="message" placeholder="Describe your enquiry..." maxLength={1000} rows={4}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  background: '#C9A84C',
                  color: '#0D1B2A',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: 14,
                  borderRadius: 6,
                  border: 'none',
                  cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.2s',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Enquiry'}
              </button>

              {formStatus && (
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 13,
                    textAlign: 'center',
                    color: formStatus.type === 'success' ? '#4ADE80' : '#EF4444',
                    padding: '10px',
                    borderRadius: 6,
                    background: formStatus.type === 'success' ? 'rgba(74, 222, 128, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  }}
                >
                  {formStatus.message}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
