import { useEffect, useState, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'

// @ts-ignore
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface CaseRow {
  sr: string
  caseNo: string
  title: string
  subject: string
  dept: string
  court: string
  lastProc: string
  nextHearing: Date | null
  reply: string
  status: string
  type: string
  counsel: string
  exparte: string
}

export interface HistoryEntry {
  entryDate: Date | null
  title: string
  cnr: string
  dept: string
  court: string
  hearingDate: Date | null
  proceedings: string
  counsel: string
  attendance: string
  exparte: string
  caseStatus: string
}

export interface PerfEntry {
  dateLogged: Date | null
  caseId: string
  title: string
  dept: string
  counsel: string
  forum: string
  orderDate: Date | null
  status: string
  remarks: string
}

export interface UpdateItem {
  date: string
  category: string
  title: string
  desc: string
  link: string
}

export function useSupabaseData() {
  const [allRows, setAllRows] = useState<CaseRow[]>([])
  const [historyRows, setHistoryRows] = useState<HistoryEntry[]>([])
  const [perfLogRows, setPerfLogRows] = useState<PerfEntry[]>([])
  const [updates, setUpdates] = useState<UpdateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSheetData = useCallback(async () => {
    try {
      if (!sb) throw new Error('Supabase not loaded')
      const { data, error } = await sb.from('case_diary').select('*').order('s_no')
      if (error) throw error
      const rows = (data || []).map((r: any) => ({
        sr: r.s_no != null ? String(r.s_no) : '',
        caseNo: r.cnr_case_no || '',
        title: r.case_title || '',
        subject: r.subject_matter || '',
        dept: r.department || '',
        court: r.court_name || '',
        lastProc: r.last_proceedings || '',
        nextHearing: r.next_hearing_date ? new Date(r.next_hearing_date + 'T00:00:00') : null,
        reply: r.reply_status || '',
        status: r.case_status || '',
        type: r.case_type || '',
        counsel: r.advocate_name || '',
        exparte: r.exparte_status || '',
      })).filter((r: CaseRow) => r.title && r.title.trim() !== '')
      setAllRows(rows)
      return rows
    } catch (e) {
      console.error('Case diary fetch error:', e)
      return []
    }
  }, [])

  const fetchPerformanceLog = useCallback(async () => {
    try {
      if (!sb) throw new Error('Supabase not loaded')
      const { data, error } = await sb
        .from('performance_log')
        .select('*, case_diary(case_title, department, court_name)')
        .order('logged_at', { ascending: false })
      if (error) throw error
      const rows = (data || []).map((r: any) => ({
        dateLogged: r.logged_at ? new Date(r.logged_at) : null,
        caseId: r.cnr_case_no || '',
        title: r.case_diary ? r.case_diary.case_title : '',
        dept: r.case_diary ? r.case_diary.department : '',
        counsel: r.advocate_name || '',
        forum: r.case_diary ? r.case_diary.court_name : '',
        orderDate: r.logged_at ? new Date(r.logged_at) : null,
        status: r.proceedings_snapshot || '',
        remarks: r.proceedings_snapshot || '',
      })).filter((r: PerfEntry) => r.title && r.title.trim() !== '')
      setPerfLogRows(rows)
      return rows
    } catch (e) {
      console.error('Performance log fetch error:', e)
      return []
    }
  }, [])

  const fetchHistoryLog = useCallback(async () => {
    try {
      if (!sb) throw new Error('Supabase not loaded')
      const { data, error } = await sb
        .from('case_history')
        .select('*, case_diary(case_title, cnr_case_no, department, court_name, exparte_status, case_status)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data || []).map((r: any) => ({
        entryDate: r.created_at ? new Date(r.created_at) : null,
        title: r.case_diary ? r.case_diary.case_title : '',
        cnr: r.case_diary ? r.case_diary.cnr_case_no : '',
        dept: r.case_diary ? r.case_diary.department : '',
        court: r.case_diary ? r.case_diary.court_name : '',
        hearingDate: r.hearing_date ? new Date(r.hearing_date + 'T00:00:00') : null,
        proceedings: r.proceedings_summary || '',
        counsel: r.advocate_name || '',
        attendance: r.attendance || '',
        exparte: r.case_diary ? r.case_diary.exparte_status : '',
        caseStatus: r.case_diary ? r.case_diary.case_status : '',
      })).filter((r: HistoryEntry) => r.title && r.title.trim() !== '')
      setHistoryRows(rows)
      return rows
    } catch (e) {
      console.error('History log fetch error:', e)
      return []
    }
  }, [])

  const fetchUpdates = useCallback(async () => {
    try {
      if (!sb) throw new Error('Supabase not loaded')
      const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      const items = (data || []).map((row: any) => ({
        date: row.date_label || new Date(row.created_at).toLocaleDateString('en-IN'),
        category: row.category || '',
        title: row.title || '',
        desc: row.description || '',
        link: row.link || '',
      })).filter((u: UpdateItem) => u.title && u.title.trim() !== '')
      setUpdates(items)
      return items
    } catch (e) {
      console.error('Announcements fetch error:', e)
      return []
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      setLoading(true)
      try {
        await Promise.all([fetchSheetData(), fetchPerformanceLog(), fetchHistoryLog(), fetchUpdates()])
      } catch (e) {
        if (mounted) setError('Failed to load data')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [fetchSheetData, fetchPerformanceLog, fetchHistoryLog, fetchUpdates])

  return { allRows, historyRows, perfLogRows, updates, loading, error, refetch: fetchSheetData }
}

export function escapeHtml(val: unknown): string {
  if (val == null) return ''
  const map: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}
  return String(val).replace(/[&<>"']/g, (c: string) => map[c] || c)
}

export function formatDate(d: Date | null | unknown): string {
  if (!d) return '\u2014'
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return String(d)
}

export function formatDDMMYYYY(d: Date | null | unknown): string {
  if (!d) return '\u2014'
  if (d instanceof Date && !isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }
  return String(d)
}

export function isExparte(r: CaseRow): boolean {
  if (!r.exparte) return false
  const v = r.exparte.toLowerCase().trim()
  if (v.includes('not')) return false
  return v.includes('ex-parte') || v.includes('exparte') || v.includes('ex parte') || v === 'yes'
}

export function logStatusIsExparte(status: string): boolean {
  if (!status) return false
  const v = status.toLowerCase()
  return v.includes('ex-parte') || v.includes('exparte') || v.includes('ex parte')
}

export function logStatusIsDisposed(status: string): boolean {
  if (!status) return false
  const v = status.toLowerCase()
  return v.includes('disposed') || v.includes('dismissed')
}

export function logStatusIsReplyFiled(status: string): boolean {
  if (!status) return false
  const v = status.toLowerCase()
  return v.includes('reply filed') && !v.includes('not')
}

export function safeUrl(url: string): string {
  const u = String(url || '').trim()
  if (/^(https?:|mailto:)/i.test(u)) return escapeHtml(u)
  return ''
}
