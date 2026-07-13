let PERF_LOG_ROWS = [];
let COUNSEL_PERF_DATA = [];
let COUNSEL_PERF_ROWS = [];
let HISTORY_ROWS = [];
let historyAttendanceChartInst = null;

async function fetchPerformanceLog() {
  try {
    const { data, error } = await sb
      .from('performance_log')
      .select('*, case_diary(case_title, department, court_name)')
      .order('logged_at', { ascending: false });
    if (error) throw error;

    PERF_LOG_ROWS = (data || []).map(r => ({
      dateLogged: r.logged_at ? new Date(r.logged_at) : null,
      caseId:     r.cnr_case_no || '',
      title:      r.case_diary ? r.case_diary.case_title : '',
      dept:       r.case_diary ? r.case_diary.department : '',
      counsel:    r.advocate_name || '',
      forum:      r.case_diary ? r.case_diary.court_name : '',
      orderDate:  r.logged_at ? new Date(r.logged_at) : null,
      status:     r.proceedings_snapshot || '',
      remarks:    r.proceedings_snapshot || '',
    })).filter(r => r.title && r.title.trim() !== '');

    return true;
  } catch (e) {
    console.error('Performance log fetch error:', e);
    return false;
  }
}

async function fetchHistoryLog() {
  try {
    const { data, error } = await sb
      .from('case_history')
      .select('*, case_diary(case_title, cnr_case_no, department, court_name, exparte_status, case_status)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    HISTORY_ROWS = (data || []).map(r => ({
      entryDate:   r.created_at ? new Date(r.created_at) : null,
      title:       r.case_diary ? r.case_diary.case_title : '',
      cnr:         r.case_diary ? r.case_diary.cnr_case_no : '',
      dept:        r.case_diary ? r.case_diary.department : '',
      court:       r.case_diary ? r.case_diary.court_name : '',
      hearingDate: r.hearing_date ? new Date(r.hearing_date + 'T00:00:00') : null,
      proceedings: r.proceedings_summary || '',
      counsel:     r.advocate_name || '',
      attendance:  r.attendance || '',
      exparte:     r.case_diary ? r.case_diary.exparte_status : '',
      caseStatus:  r.case_diary ? r.case_diary.case_status : '',
    })).filter(r => r.title && r.title.trim() !== '');

    return true;
  } catch (e) {
    console.error('History log fetch error:', e);
    return false;
  }
}

function renderHistoryAttendanceStats() {
  const fromVal = document.getElementById('perfFromDate') ? document.getElementById('perfFromDate').value : '';
  const toVal   = document.getElementById('perfToDate')   ? document.getElementById('perfToDate').value   : '';
  const counselVal = document.getElementById('counselPerfSelect') ? document.getElementById('counselPerfSelect').value : '';

  const from = fromVal ? new Date(fromVal + 'T00:00:00') : null;
  const to   = toVal   ? new Date(toVal   + 'T23:59:59') : null;

  const rows = HISTORY_ROWS.filter(r => {
    if (counselVal && r.counsel !== counselVal) return false;
    if (from && !(r.entryDate instanceof Date && r.entryDate >= from)) return false;
    if (to   && !(r.entryDate instanceof Date && r.entryDate <= to))   return false;
    return true;
  });

  const total = rows.length;
  const attended = rows.filter(r => r.attendance === 'Attended').length;
  const notAttended = rows.filter(r => r.attendance === 'Not Attended').length;
  const exparteCt = rows.filter(r => r.exparte === 'Ex-parte').length;
  const disposedCt = rows.filter(r => r.caseStatus === 'Disposed/Dismissed').length;

  const rangeText = (fromVal || toVal)
    ? `${fromVal ? 'from ' + formatDate(new Date(fromVal + 'T00:00:00')) : ''}${(fromVal && toVal) ? ' ' : ''}${toVal ? 'to ' + formatDate(new Date(toVal + 'T00:00:00')) : ''}`
    : 'all time';
  const sub = document.getElementById('historyStatsSubtitle');
  if (sub) sub.textContent = `Case history entries ${counselVal ? 'for ' + counselVal : 'for all counsels'} — ${rangeText}`;

  const elT = document.getElementById('histStatTotal');       if (elT) elT.textContent = total;
  const elA = document.getElementById('histStatAttended');    if (elA) elA.textContent = attended;
  const elN = document.getElementById('histStatNotAttended'); if (elN) elN.textContent = notAttended;
  const elE = document.getElementById('histStatExparte');     if (elE) elE.textContent = exparteCt;
  const elD = document.getElementById('histStatDisposed');    if (elD) elD.textContent = disposedCt;
}

function populatePerfCounselDropdown() {
  const scPerfSel = document.getElementById('counselPerfSelect');
  if (!scPerfSel) return;
  const perfCounsels = [...new Set(PERF_LOG_ROWS.map(r=>r.counsel).filter(Boolean))].sort();
  perfCounsels.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; scPerfSel.appendChild(o); });
}

function getCounselPerfRows() {
  const fromVal = document.getElementById('perfFromDate') ? document.getElementById('perfFromDate').value : '';
  const toVal   = document.getElementById('perfToDate')   ? document.getElementById('perfToDate').value   : '';
  const counselVal = document.getElementById('counselPerfSelect') ? document.getElementById('counselPerfSelect').value : '';

  const from = fromVal ? new Date(fromVal + 'T00:00:00') : null;
  const to   = toVal   ? new Date(toVal   + 'T23:59:59') : null;

  return PERF_LOG_ROWS.filter(r => {
    if (counselVal && r.counsel !== counselVal) return false;
    if (from && !(r.dateLogged instanceof Date && r.dateLogged >= from)) return false;
    if (to   && !(r.dateLogged instanceof Date && r.dateLogged <= to))   return false;
    return true;
  });
}

function renderCounselPerformance() {
  renderHistoryAttendanceStats();
  const rows = getCounselPerfRows();
  COUNSEL_PERF_ROWS = [...rows].sort((a,b) => {
    const ta = a.dateLogged instanceof Date ? a.dateLogged.getTime() : 0;
    const tb = b.dateLogged instanceof Date ? b.dateLogged.getTime() : 0;
    return tb - ta;
  });

  const fromVal = document.getElementById('perfFromDate') ? document.getElementById('perfFromDate').value : '';
  const toVal   = document.getElementById('perfToDate')   ? document.getElementById('perfToDate').value   : '';

  const rangeText = (fromVal || toVal)
    ? `Date Logged ${fromVal?('from '+formatDate(new Date(fromVal+'T00:00:00'))):''}${(fromVal&&toVal)?' ':''}${toVal?('to '+formatDate(new Date(toVal+'T00:00:00'))):''}`
    : 'all time';

  const subtitle = document.getElementById('counselPerfSubtitle');
  if (subtitle) subtitle.textContent = `Logged entries grouped by Standing Counsel — ${rangeText}`;
  const detailSubtitle = document.getElementById('counselPerfDetailSubtitle');
  if (detailSubtitle) detailSubtitle.textContent = `Full details of every matching PERFORMANCE_LOG entry — ${rangeText} — ${rows.length} entr${rows.length===1?'y':'ies'}`;

  // Summary cards
  const total    = rows.length;
  const exparte  = rows.filter(r => logStatusIsExparte(r.status)).length;
  const disposed = rows.filter(r => logStatusIsDisposed(r.status)).length;
  const replied  = rows.filter(r => logStatusIsReplyFiled(r.status)).length;
  const st = document.getElementById('perfSummaryTotal');    if(st) st.textContent = total;
  const se = document.getElementById('perfSummaryExparte');  if(se) se.textContent = exparte;
  const sd = document.getElementById('perfSummaryDisposed'); if(sd) sd.textContent = disposed;
  const sr = document.getElementById('perfSummaryReply');    if(sr) sr.textContent = replied;

  // Per-counsel breakdown
  const counselMap = {};
  rows.forEach(r => {
    if (!r.counsel) return;
    const c = r.counsel.trim();
    if (!counselMap[c]) counselMap[c] = {total:0, exparte:0, disposed:0, replied:0};
    counselMap[c].total++;
    if (logStatusIsExparte(r.status))    counselMap[c].exparte++;
    if (logStatusIsDisposed(r.status))   counselMap[c].disposed++;
    if (logStatusIsReplyFiled(r.status)) counselMap[c].replied++;
  });

  COUNSEL_PERF_DATA = Object.entries(counselMap).sort((a,b)=>b[1].total-a[1].total);
  const tbody = document.getElementById('counselPerfBody');
  if (tbody) {
    if (COUNSEL_PERF_DATA.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">No entries found for the selected date range / counsel.</td></tr>`;
    } else {
      tbody.innerHTML = COUNSEL_PERF_DATA.map(([name,d],i)=>`
        <tr>
          <td>${i+1}</td>
          <td style="font-weight:600">${escapeHtml(name)}</td>
          <td style="text-align:center">${d.total}</td>
          <td style="text-align:center"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${d.exparte>0?'#FAD7D7':'#D4EDDA'};color:${d.exparte>0?'#8B1A1A':'#1E6B45'}">${d.exparte}</span></td>
          <td style="text-align:center"><span style="color:var(--disposed-fg);font-weight:600">${d.disposed}</span></td>
          <td style="text-align:center"><span style="color:var(--active-fg);font-weight:600">${d.replied}</span></td>
        </tr>`).join('');
    }
  }

  // Full detail log table
  const dbody = document.getElementById('counselPerfDetailBody');
  if (dbody) {
    if (COUNSEL_PERF_ROWS.length === 0) {
      dbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted)">No entries found for the selected date range / counsel.</td></tr>`;
    } else {
      dbody.innerHTML = COUNSEL_PERF_ROWS.map((r,i)=>`
        <tr>
          <td>${i+1}</td>
          <td style="white-space:nowrap;font-size:12px">${r.dateLogged instanceof Date ? r.dateLogged.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
          <td style="white-space:nowrap;font-weight:600;color:var(--navy)">${escapeHtml(r.caseId||'—')}</td>
          <td style="max-width:200px">${escapeHtml(r.title||'—')}</td>
          <td>${escapeHtml(r.dept||'—')}</td>
          <td style="white-space:nowrap">${escapeHtml(r.counsel||'—')}</td>
          <td style="white-space:nowrap">${escapeHtml(r.forum||'—')}</td>
          <td style="white-space:nowrap">${formatDDMMYYYY(r.orderDate)}</td>
          <td style="max-width:220px;font-size:12px;color:${logStatusIsExparte(r.status)?'var(--disposed-fg)':'var(--text)'};font-weight:${logStatusIsExparte(r.status)?'700':'400'}">${escapeHtml(r.status||'—')}</td>
          <td style="max-width:220px;font-size:12px">${escapeHtml(r.remarks||'—')}</td>
        </tr>`).join('');
    }
  }
}

function clearCounselPerfFilter() {
  const f = document.getElementById('perfFromDate'); if (f) f.value = '';
  const t = document.getElementById('perfToDate');   if (t) t.value = '';
  const c = document.getElementById('counselPerfSelect'); if (c) c.value = '';
  renderCounselPerformance();
}

function downloadCounselPerfExcel() {
  const fromVal = document.getElementById('perfFromDate') ? document.getElementById('perfFromDate').value : '';
  const toVal   = document.getElementById('perfToDate')   ? document.getElementById('perfToDate').value   : '';
  const rangeLabel = (fromVal||toVal) ? `${fromVal||'Start'} to ${toVal||'Today'}` : 'All Time';

  const data = [
    ['Standing Counsel Performance Report — PERFORMANCE_LOG'],
    ['Date Range (Date Logged)', rangeLabel],
    ['Total Entries', COUNSEL_PERF_ROWS.length],
    [],
    ['#','Date of Court Order','CNR / Case ID','Title of Case','Contesting Department','Standing Counsel','Judicial Forum','Next Hearing Date','Status / Proceedings','Remarks'],
    ...COUNSEL_PERF_ROWS.map((r,i)=>[
      i+1,
      r.dateLogged instanceof Date ? r.dateLogged.toLocaleString('en-IN') : '',
      r.caseId, r.title, r.dept, r.counsel, r.forum, formatDDMMYYYY(r.orderDate), r.status, r.remarks
    ])
  ];
  const ws=XLSX.utils.aoa_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Standing Counsel Log');
  XLSX.writeFile(wb,`DLO_Standing_Counsel_Performance_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function downloadCounselPerfPDF() {
  const fromVal = document.getElementById('perfFromDate') ? document.getElementById('perfFromDate').value : '';
  const toVal   = document.getElementById('perfToDate')   ? document.getElementById('perfToDate').value   : '';
  const rangeLabel = (fromVal||toVal) ? `${fromVal?formatDate(new Date(fromVal+'T00:00:00')):'Start'} to ${toVal?formatDate(new Date(toVal+'T00:00:00')):'Today'}` : 'All Time';

  const win=window.open('','_blank');
  win.document.write(`<html><head><title>Standing Counsel Performance</title>
  <style>body{font-family:Arial;font-size:10px;padding:20px}h2{color:#1B2A4A}p{color:#6B7280}table{width:100%;border-collapse:collapse}th{background:#1B2A4A;color:#fff;padding:6px;text-align:left;font-size:9px}td{padding:6px;border-bottom:1px solid #ddd;font-size:9px}tr:nth-child(even) td{background:#f9f6ef}@media print{button{display:none}}</style></head>
  <body><h2>DLO Kupwara — Standing Counsel Performance (PERFORMANCE_LOG)</h2>
  <p>Date Range: ${rangeLabel} &nbsp;|&nbsp; Total Entries: ${COUNSEL_PERF_ROWS.length} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-IN')}</p>
  <button onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#1B2A4A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print</button>
  <table><thead><tr><th>#</th><th>Date of Court Order</th><th>CNR/Case ID</th><th>Title</th><th>Dept.</th><th>Standing Counsel</th><th>Forum</th><th>Next Hearing Date</th><th>Status/Proceedings</th><th>Remarks</th></tr></thead>
  <tbody>${COUNSEL_PERF_ROWS.map((r,i)=>`<tr><td>${i+1}</td><td>${r.dateLogged instanceof Date ? r.dateLogged.toLocaleString('en-IN') : ''}</td><td>${r.caseId||''}</td><td>${r.title||''}</td><td>${r.dept||''}</td><td>${r.counsel||''}</td><td>${r.forum||''}</td><td>${formatDDMMYYYY(r.orderDate)}</td><td>${r.status||''}</td><td>${r.remarks||''}</td></tr>`).join('')}</tbody></table>
  </body></html>`);
  win.document.close();
}

async function pageInit(){
  const perfLoading = document.getElementById('counselPerfLoading');
  const perfError = document.getElementById('counselPerfError');
  if (perfLoading) perfLoading.style.display = 'block';
  const [ok, perfOk, histOk] = await Promise.all([fetchSheetData(), fetchPerformanceLog(), fetchHistoryLog()]);
  if (perfLoading) perfLoading.style.display = 'none';
  if (perfError) perfError.style.display = perfOk ? 'none' : 'block';
  if (perfOk) {
    populatePerfCounselDropdown();
    renderCounselPerformance();
  }
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
