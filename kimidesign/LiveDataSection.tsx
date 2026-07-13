import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CaseRow } from '../hooks/useSupabase'
import { escapeHtml, formatDate, isExparte } from '../hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

interface LiveDataSectionProps {
  allRows: CaseRow[]
  loading?: boolean
}

const FILTER_IDS = ['statusFilter', 'courtFilter', 'deptFilter', 'replyFilter', 'typeFilter', 'counselFilter', 'exparteFilter']

export default function LiveDataSection({ allRows }: LiveDataSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [filteredRows, setFilteredRows] = useState<CaseRow[]>([])
  const [showResults, setShowResults] = useState(false)
  const [showPrompt, setShowPrompt] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [popupCase, setPopupCase] = useState<CaseRow | null>(null)

  const filters = useRef<Record<string, string>>({})

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

  const getUniqueValues = useCallback((key: keyof CaseRow) => {
    return [...new Set(allRows.map(r => r[key]).filter(Boolean))].sort() as string[]
  }, [allRows])

  const applyFilter = useCallback(() => {
    const status = filters.current['statusFilter'] || ''
    const court = filters.current['courtFilter'] || ''
    const dept = filters.current['deptFilter'] || ''
    const reply = filters.current['replyFilter'] || ''
    const type = filters.current['typeFilter'] || ''
    const counsel = filters.current['counselFilter'] || ''
    const exparte = filters.current['exparteFilter'] || ''
    const query = searchQuery.trim().toLowerCase()

    if (!status && !court && !dept && !reply && !type && !counsel && !exparte && !query) {
      setShowResults(false)
      setShowPrompt(true)
      return
    }

    setShowPrompt(false)
    const result = allRows.filter(r => {
      const matchStatus = !status || (r.status && r.status.toLowerCase().includes(status.toLowerCase()))
      const matchCourt = !court || r.court === court
      const matchDept = !dept || r.dept === dept
      const matchType = !type || r.type === type
      const matchCounsel = !counsel || r.counsel === counsel
      const matchExparte = !exparte || (exparte === 'yes' ? isExparte(r) : !isExparte(r))
      const matchReply = !reply ||
        (reply === 'filed' && r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not')) ||
        (reply === 'not' && r.reply && r.reply.toLowerCase().includes('not'))
      const matchSearch = !query || [r.caseNo, r.title, r.subject, r.dept, r.court,
        r.lastProc, formatDate(r.nextHearing), r.reply, r.status, r.type, r.counsel, r.exparte]
        .some(val => val && val.toLowerCase().includes(query))
      return matchStatus && matchCourt && matchDept && matchType && matchCounsel && matchExparte && matchReply && matchSearch
    })
    setFilteredRows(result)
    setShowResults(true)
  }, [allRows, searchQuery])

  const clearFilter = useCallback(() => {
    FILTER_IDS.forEach(id => { filters.current[id] = '' })
    setSearchQuery('')
    setShowResults(false)
    setShowPrompt(true)
    // Reset select elements
    FILTER_IDS.forEach(id => {
      const el = document.getElementById(id) as HTMLSelectElement
      if (el) el.value = ''
    })
    const gs = document.getElementById('globalSearch') as HTMLInputElement
    if (gs) gs.value = ''
  }, [])

  const viewAllCases = useCallback(() => {
    FILTER_IDS.forEach(id => { filters.current[id] = '' })
    setSearchQuery('')
    FILTER_IDS.forEach(id => {
      const el = document.getElementById(id) as HTMLSelectElement
      if (el) el.value = ''
    })
    setFilteredRows([...allRows])
    setShowPrompt(false)
    setShowResults(true)
  }, [allRows])

  const viewOverdueCases = useCallback(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const overdue = allRows.filter(r =>
      r.nextHearing instanceof Date && r.nextHearing < today &&
      r.status && r.status.toLowerCase().includes('active')
    )
    setFilteredRows(overdue)
    setShowPrompt(false)
    setShowResults(true)
  }, [allRows])

  const exportExcel = useCallback(() => {
    const rows = filteredRows.length > 0 ? filteredRows : allRows
    // @ts-ignore
    const XLSX = window.XLSX
    if (!XLSX) return
    const data = [
      ['SR#', 'Case No.', 'Title', 'Subject Matter', 'Department', 'Court', 'Last Proceedings', 'Next Hearing', 'Reply Status', 'Case Status', 'Case Type', 'Standing Counsel', 'Ex-parte Status'],
      ...rows.map((r, i) => [i + 1, r.caseNo, r.title, r.subject, r.dept, r.court, r.lastProc, formatDate(r.nextHearing), r.reply, r.status, r.type, r.counsel, r.exparte])
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cases')
    XLSX.writeFile(wb, `DLO_Kupwara_Cases_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [filteredRows, allRows])

  const exportPDF = useCallback(() => {
    const rows = filteredRows.length > 0 ? filteredRows : allRows
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>DLO Kupwara Cases</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
        h2{color:#1B2A4A;margin-bottom:4px}
        p{color:#6B7280;margin-bottom:16px;font-size:11px}
        table{width:100%;border-collapse:collapse}
        th{background:#1B2A4A;color:#fff;padding:8px 10px;text-align:left;font-size:10px}
        td{padding:7px 10px;border-bottom:1px solid #ddd;font-size:10px}
        tr:nth-child(even) td{background:#f9f6ef}
        @media print{button{display:none}}
      </style></head><body>
      <h2>District Litigation Office Kupwara</h2>
      <p>Case Report — Generated on ${new Date().toLocaleDateString('en-IN')} &nbsp;|&nbsp; Total: ${rows.length} cases</p>
      <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#1B2A4A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print / Save as PDF</button>
      <table>
        <thead><tr><th>#</th><th>Case No.</th><th>Title</th><th>Department</th><th>Court</th><th>Next Hearing</th><th>Reply</th><th>Status</th><th>Standing Counsel</th><th>Ex-parte</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.caseNo || ''}</td><td>${r.title || ''}</td><td>${r.dept || ''}</td><td>${r.court || ''}</td><td>${formatDate(r.nextHearing)}</td><td>${r.reply || ''}</td><td>${r.status || ''}</td><td>${r.counsel || ''}</td><td>${r.exparte || ''}</td></tr>`).join('')}</tbody>
      </table></body></html>`)
    win.document.close()
  }, [filteredRows, allRows])

  const handleFilterChange = (id: string, value: string) => {
    filters.current[id] = value
  }

  const goldColor = '#C9A84C'
  const navyColor = '#0D1B2A'
  const navyMid = '#1B2A4A'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid rgba(201, 168, 76, 0.3)`,
    borderRadius: 7,
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#EDE8E4',
    outline: 'none',
    transition: 'border-color 0.2s',
    appearance: 'none',
  }

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
        <div className="reveal-item" style={{ marginBottom: 48 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: goldColor,
              marginBottom: 12,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Live Case Database
          </p>
          <h2
            style={{
              fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif",
              fontSize: 'clamp(26px, 3vw, 40px)',
              fontWeight: 700,
              color: '#EDE8E4',
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            Search & Filter Cases
          </h2>
          <div style={{ width: 48, height: 3, background: goldColor, borderRadius: 2, margin: '20px 0 24px' }} />
          <p style={{ fontSize: 14, color: 'rgba(237, 232, 228, 0.5)' }}>
            Search across any column or use dropdown filters.
          </p>
        </div>

        {/* Global Search */}
        <div className="reveal-item" style={{ marginBottom: 24, position: 'relative' }}>
          <input
            type="text"
            id="globalSearch"
            placeholder="🔍  Search by case number, title, subject, department, court, status, type..."
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            style={{
              ...inputStyle,
              padding: '14px 20px 14px 48px',
              border: `2px solid ${goldColor}`,
              borderRadius: 10,
              fontSize: 14,
              background: 'rgba(255, 255, 255, 0.03)',
              boxShadow: '0 2px 12px rgba(201, 168, 76, 0.08)',
            }}
          />
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>
            🔍
          </span>
          <button
            onClick={() => { setSearchQuery(''); applyFilter() }}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(237, 232, 228, 0.08)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: 'rgba(237, 232, 228, 0.4)',
              padding: '4px 10px',
              borderRadius: 6,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Clear
          </button>
        </div>

        {/* Filter Box */}
        <div
          className="reveal-item"
          style={{
            background: navyColor,
            borderRadius: 10,
            padding: 28,
            marginBottom: 32,
            border: '1px solid rgba(201, 168, 76, 0.12)',
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif",
              fontSize: 18,
              color: '#EDE8E4',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            🔍 Filter & Search Cases
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginBottom: 16,
            }}
          >
            {[
              { id: 'statusFilter', label: 'Case Status', options: ['', 'Active', 'Disposed', 'Pending'] },
              { id: 'courtFilter', label: 'Select Court', options: ['', ...getUniqueValues('court')] },
              { id: 'deptFilter', label: 'Select Department', options: ['', ...getUniqueValues('dept')] },
              { id: 'replyFilter', label: 'Reply Status', options: ['', 'filed', 'not'] },
              { id: 'typeFilter', label: 'Case Type', options: ['', ...getUniqueValues('type')] },
              { id: 'counselFilter', label: 'Standing Counsel', options: ['', ...getUniqueValues('counsel')] },
              { id: 'exparteFilter', label: 'Ex-parte Status', options: ['', 'yes', 'no'] },
            ].map((group) => (
              <div key={group.id}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#E8C96A',
                    marginBottom: 8,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {group.label}
                </label>
                <select
                  id={group.id}
                  onChange={(e) => handleFilterChange(group.id, e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— Select —</option>
                  {group.options.slice(1).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={applyFilter}
              style={{
                background: goldColor,
                color: navyColor,
                fontWeight: 600,
                fontSize: 13,
                padding: '10px 20px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#E8C96A' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = goldColor }}
            >
              Apply Filter
            </button>
            <button
              onClick={clearFilter}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#EDE8E4',
                fontSize: 13,
                fontWeight: 600,
                padding: '10px 20px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
            >
              Clear All
            </button>
            <button
              onClick={viewAllCases}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#EDE8E4',
                border: '1px solid rgba(237, 232, 228, 0.15)',
                padding: '9px 18px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
            >
              📋 View All Cases
            </button>
            <button
              onClick={viewOverdueCases}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#FCA5A5',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '9px 18px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
            >
              ⚠️ Overdue Cases
            </button>
          </div>
        </div>

        {/* Prompt */}
        {showPrompt && (
          <div
            className="reveal-item"
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'rgba(13, 27, 42, 0.4)',
              borderRadius: 10,
              border: '1px dashed rgba(201, 168, 76, 0.2)',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <h3
              style={{
                fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif",
                fontSize: 18,
                color: '#EDE8E4',
                marginBottom: 8,
              }}
            >
              Select filters to view cases
            </h3>
            <p style={{ fontSize: 14, color: 'rgba(237, 232, 228, 0.4)' }}>
              Use the filters above or click <strong>View All Cases</strong> to see all registered cases.
            </p>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(237, 232, 228, 0.45)',
                marginBottom: 12,
                fontStyle: 'italic',
              }}
            >
              Showing {filteredRows.length} case{filteredRows.length !== 1 ? 's' : ''} — click any row for full details
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={exportExcel} className="btn-export" style={exportBtnStyle('#1E6B45')}>⬇ Download Excel</button>
              <button onClick={exportPDF} className="btn-export" style={exportBtnStyle('#8B1A1A')}>⬇ Download PDF</button>
              <button onClick={() => window.print()} className="btn-export" style={exportBtnStyle(navyMid)}>🖨 Print</button>
            </div>

            <div
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid rgba(201, 168, 76, 0.1)',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: 900,
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: navyColor }}>
                      {['#', 'Case No.', 'Title', 'Subject', 'Department', 'Court', 'Next Hearing', 'Reply', 'Status', 'Type', 'Counsel'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '12px 14px',
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: 'rgba(237, 232, 228, 0.8)',
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          style={{
                            textAlign: 'center',
                            padding: 48,
                            color: 'rgba(237, 232, 228, 0.35)',
                            fontStyle: 'italic',
                          }}
                        >
                          No cases found for the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r, i) => (
                        <tr
                          key={i}
                          onClick={() => setPopupCase(r)}
                          style={{
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            background: i % 2 === 0 ? 'rgba(13, 27, 42, 0.5)' : 'rgba(13, 27, 42, 0.3)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201, 168, 76, 0.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'rgba(13, 27, 42, 0.5)' : 'rgba(13, 27, 42, 0.3)' }}
                        >
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{i + 1}</td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', fontWeight: 600, color: '#C9A84C', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.caseNo)}</td>
                          <td style={{ padding: '11px 14px', maxWidth: 200, borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.title)}</td>
                          <td style={{ padding: '11px 14px', maxWidth: 180, fontSize: 12, borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.subject)}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.dept)}</td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.court)}</td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', fontWeight: 600, borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{formatDate(r.nextHearing)}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not') ? '#4ADE80' : '#EF4444'
                            }}>
                              {escapeHtml(r.reply)}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                background: r.status === 'Active' ? 'rgba(30, 107, 69, 0.2)' : r.status === 'Disposed' ? 'rgba(139, 26, 26, 0.2)' : 'rgba(122, 92, 0, 0.2)',
                                color: r.status === 'Active' ? '#4ADE80' : r.status === 'Disposed' ? '#EF4444' : '#F59E0B',
                              }}
                            >
                              {escapeHtml(r.status)}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.type)}</td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(237, 232, 228, 0.05)' }}>{escapeHtml(r.counsel)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Case Popup */}
      {popupCase && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPopupCase(null) }}
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
              maxWidth: 720,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(201, 168, 76, 0.15)',
            }}
          >
            <div
              style={{
                background: navyColor,
                padding: '20px 28px',
                borderRadius: '14px 14px 0 0',
                borderBottom: '3px solid #C9A84C',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Playfair Display', 'Noto Serif SC', Georgia, serif",
                  fontSize: 18,
                  color: '#EDE8E4',
                }}
              >
                {escapeHtml(popupCase.caseNo) || 'Case Details'}
              </h3>
              <button
                onClick={() => setPopupCase(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(237, 232, 228, 0.5)',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 4,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[
                  { label: 'Case Number', value: popupCase.caseNo, full: false },
                  { label: 'Case Status', value: popupCase.status, full: false },
                  { label: 'Title of Case', value: popupCase.title, full: true },
                  { label: 'Subject Matter', value: popupCase.subject, full: true },
                  { label: 'Department', value: popupCase.dept, full: false },
                  { label: 'Case Type', value: popupCase.type, full: false },
                  { label: 'Court', value: popupCase.court, full: false },
                  { label: 'Next Hearing Date', value: formatDate(popupCase.nextHearing), full: false },
                  { label: 'Last Proceedings', value: popupCase.lastProc, full: true },
                  { label: 'Reply Status', value: popupCase.reply, full: false },
                  { label: 'Standing Counsel', value: popupCase.counsel, full: false },
                  { label: 'Ex-parte Status', value: popupCase.exparte, full: false },
                ].map((field, i) => (
                  <div key={i} style={{ gridColumn: field.full ? '1 / -1' : undefined }}>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: '#C9A84C',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      {field.label}
                    </label>
                    <p style={{ fontSize: 14, color: '#EDE8E4', lineHeight: 1.5 }}>
                      {escapeHtml(field.value) || '—'}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid rgba(201, 168, 76, 0.1)' }}>
                <button
                  onClick={() => {
                    const msg = `⚖️ *Case Details — DLO Kupwara*\n\n*Case No:* ${popupCase.caseNo || '—'}\n*Title:* ${popupCase.title || '—'}\n*Department:* ${popupCase.dept || '—'}\n*Court:* ${popupCase.court || '—'}\n*Next Hearing:* ${formatDate(popupCase.nextHearing)}\n*Reply Status:* ${popupCase.reply || '—'}\n*Case Status:* ${popupCase.status || '—'}\n*Standing Counsel:* ${popupCase.counsel || '—'}\n\n⚖️ District Litigation Office Kupwara`
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
                  }}
                  style={{
                    background: '#C9A84C',
                    color: '#0D1B2A',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '10px 18px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  📱 Share on WhatsApp
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Case: ${popupCase.caseNo || ''} | ${popupCase.title || ''} | Court: ${popupCase.court || ''} | Next Hearing: ${formatDate(popupCase.nextHearing)} | Status: ${popupCase.status || ''}`)
                  }}
                  style={{
                    background: 'rgba(201, 168, 76, 0.1)',
                    border: '1px solid rgba(201, 168, 76, 0.2)',
                    padding: '10px 18px',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: '#EDE8E4',
                  }}
                >
                  📋 Copy Details
                </button>
                <button
                  onClick={() => setPopupCase(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: 'rgba(237, 232, 228, 0.6)',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function exportBtnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    padding: '9px 18px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: "'Inter', sans-serif",
    transition: 'opacity 0.2s',
  }
}
