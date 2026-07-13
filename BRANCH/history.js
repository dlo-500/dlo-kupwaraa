let HISTORY_ROWS = [];
let HIST_CASE_MATCHES = [];
let CURRENT_HIST_CASE = null;

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

function populateHistoryDropdowns() {
  const courtSel = document.getElementById('histCourtFilter');
  const deptSel  = document.getElementById('histDeptFilter');
  if (courtSel) {
    // Union of courts from the master case list AND the proceedings-history log,
    // so every court the office covers appears here — even ones with no history
    // entries logged yet — instead of only courts that already have an entry.
    const fromCases   = (typeof ALL_ROWS     !== 'undefined' ? ALL_ROWS     : []).map(r=>r.court);
    const fromHistory = (typeof HISTORY_ROWS !== 'undefined' ? HISTORY_ROWS : []).map(r=>r.court);
    const courts = [...new Set([...fromCases, ...fromHistory].filter(Boolean))].sort();
    courts.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; courtSel.appendChild(o); });
  }
  if (deptSel) {
    const fromCases   = (typeof ALL_ROWS     !== 'undefined' ? ALL_ROWS     : []).map(r=>r.dept);
    const fromHistory = (typeof HISTORY_ROWS !== 'undefined' ? HISTORY_ROWS : []).map(r=>r.dept);
    const depts = [...new Set([...fromCases, ...fromHistory].filter(Boolean))].sort();
    depts.forEach(d => { const o=document.createElement('option'); o.value=d; o.textContent=d; deptSel.appendChild(o); });
  }
}

function searchCaseHistory() {
  const kw     = (document.getElementById('histSearchTitle') ? document.getElementById('histSearchTitle').value : '').trim().toLowerCase();
  const cnrQ   = (document.getElementById('histSearchCNR')   ? document.getElementById('histSearchCNR').value   : '').trim().toLowerCase();
  const court  = document.getElementById('histCourtFilter') ? document.getElementById('histCourtFilter').value : '';
  const dept   = document.getElementById('histDeptFilter')  ? document.getElementById('histDeptFilter').value  : '';

  document.getElementById('histCaseDetail').style.display = 'none';

  if (!kw && !cnrQ && !court && !dept) {
    document.getElementById('histResultsList').style.display = 'none';
    document.getElementById('histPrompt').style.display = 'block';
    return;
  }

  const matched = HISTORY_ROWS.filter(r => {
    if (kw   && !(r.title||'').toLowerCase().includes(kw)) return false;
    if (cnrQ && !(r.cnr||'').toLowerCase().includes(cnrQ)) return false;
    if (court && r.court !== court) return false;
    if (dept  && r.dept  !== dept)  return false;
    return true;
  });

  const caseMap = {};
  matched.forEach(r => {
    const key = (r.cnr && r.cnr.trim()) ? r.cnr.trim().toLowerCase() : r.title.trim().toLowerCase();
    if (!caseMap[key]) caseMap[key] = { title:r.title, cnr:r.cnr, dept:r.dept, court:r.court, latestDate:null, entries:[] };
    caseMap[key].entries.push(r);
    if (r.entryDate instanceof Date && (!caseMap[key].latestDate || r.entryDate > caseMap[key].latestDate)) {
      caseMap[key].latestDate = r.entryDate;
      caseMap[key].title = r.title || caseMap[key].title;
      caseMap[key].dept  = r.dept  || caseMap[key].dept;
      caseMap[key].court = r.court || caseMap[key].court;
      caseMap[key].cnr   = r.cnr   || caseMap[key].cnr;
    }
  });

  HIST_CASE_MATCHES = Object.values(caseMap).sort((a,b) => {
    const ta = a.latestDate instanceof Date ? a.latestDate.getTime() : 0;
    const tb = b.latestDate instanceof Date ? b.latestDate.getTime() : 0;
    return tb - ta;
  });

  renderHistoryCaseList();
}

function renderHistoryCaseList() {
  const listWrap = document.getElementById('histResultsList');
  const prompt   = document.getElementById('histPrompt');
  prompt.style.display = 'none';
  listWrap.style.display = 'block';

  if (HIST_CASE_MATCHES.length === 0) {
    listWrap.innerHTML = `<div class="hist-prompt">⚖️ No matching cases found. Try a different keyword, CNR, court, or department.</div>`;
    return;
  }

  listWrap.innerHTML = `<p style="font-size:13px;color:var(--muted);margin-bottom:16px;font-style:italic">${HIST_CASE_MATCHES.length} matching case${HIST_CASE_MATCHES.length===1?'':'s'} found — click a case to view its full proceedings history</p>` +
    HIST_CASE_MATCHES.map((c,i) => `
      <div class="hist-case-card" onclick="openCaseHistory(${i})">
        <div class="hist-case-card-title">⚖️ ${escapeHtml(c.title || '—')}</div>
        <div class="hist-case-card-meta">
          <span>📌 ${escapeHtml(c.cnr || 'CNR not available')}</span>
          <span>🏛️ ${escapeHtml(c.court || '—')}</span>
          <span>🗂️ ${escapeHtml(c.dept || '—')}</span>
          <span>📖 ${c.entries.length} logged entr${c.entries.length===1?'y':'ies'}</span>
        </div>
      </div>`).join('');
}

function openCaseHistory(i) {
  const c = HIST_CASE_MATCHES[i];
  if (!c) return;
  CURRENT_HIST_CASE = c;

  const entries = [...c.entries].sort((a,b) => {
    const ta = a.entryDate instanceof Date ? a.entryDate.getTime() : 0;
    const tb = b.entryDate instanceof Date ? b.entryDate.getTime() : 0;
    return ta - tb; // chronological — earliest first
  });

  document.getElementById('histResultsList').style.display = 'none';
  const detail = document.getElementById('histCaseDetail');
  detail.style.display = 'block';
  detail.scrollIntoView({behavior:'smooth', block:'start'});

  document.getElementById('histCaseTitle').textContent = '⚖️ ' + (c.title || '—');
  document.getElementById('histCaseCNR').textContent   = c.cnr  || '—';
  document.getElementById('histCaseDept').textContent  = c.dept || '—';
  document.getElementById('histCaseCourt').textContent = c.court || '—';
  document.getElementById('histCaseCount').textContent = entries.length;

  const latestHearing = entries.reduce((latest, e) => {
    if (e.hearingDate instanceof Date && (!latest || e.hearingDate > latest)) return e.hearingDate;
    return latest;
  }, null);
  document.getElementById('histCaseNextHearing').textContent = latestHearing ? formatDDMMYYYY(latestHearing) : '—';

  const tbody = document.getElementById('histTimelineBody');
  tbody.innerHTML = entries.map(e => `
    <tr>
      <td style="white-space:nowrap;font-size:12px">${e.entryDate instanceof Date ? e.entryDate.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
      <td style="white-space:nowrap">${escapeHtml(e.court || '—')}</td>
      <td style="max-width:360px">${escapeHtml(e.proceedings || '—')}</td>
      <td style="white-space:nowrap;font-weight:600;color:var(--navy)">${formatDDMMYYYY(e.hearingDate)}</td>
    </tr>`).join('');
}

function backToHistResults() {
  document.getElementById('histCaseDetail').style.display = 'none';
  document.getElementById('histResultsList').style.display = 'block';
}

function clearHistorySearch() {
  const t = document.getElementById('histSearchTitle');  if (t) t.value = '';
  const c = document.getElementById('histSearchCNR');     if (c) c.value = '';
  const co = document.getElementById('histCourtFilter');  if (co) co.value = '';
  const d = document.getElementById('histDeptFilter');    if (d) d.value = '';
  document.getElementById('histResultsList').style.display = 'none';
  document.getElementById('histCaseDetail').style.display  = 'none';
  document.getElementById('histPrompt').style.display      = 'block';
}

function downloadHistoryExcel() {
  if (!CURRENT_HIST_CASE) return;
  const entries = [...CURRENT_HIST_CASE.entries].sort((a,b) => {
    const ta = a.entryDate instanceof Date ? a.entryDate.getTime() : 0;
    const tb = b.entryDate instanceof Date ? b.entryDate.getTime() : 0;
    return ta - tb;
  });
  const data = [
    ['Case Proceedings History — DLO Kupwara (PROCEEDINGS_HISTORY)'],
    ['Case Title', CURRENT_HIST_CASE.title || ''],
    ['CNR / Case Number', CURRENT_HIST_CASE.cnr || ''],
    ['Department', CURRENT_HIST_CASE.dept || ''],
    ['Court Forum', CURRENT_HIST_CASE.court || ''],
    ['Total Logged Entries', entries.length],
    [],
    ['#','Date of Entry','Court Forum','Summary of Proceedings / Interim Orders Passed That Day','Hearing Date'],
    ...entries.map((e,i) => [
      i+1,
      e.entryDate instanceof Date ? e.entryDate.toLocaleDateString('en-IN') : '',
      e.court || '', e.proceedings || '', formatDDMMYYYY(e.hearingDate)
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Case History');
  const safeTitle = (CURRENT_HIST_CASE.title || 'Case').replace(/[^a-z0-9]/gi,'_').slice(0,40);
  XLSX.writeFile(wb, `DLO_Case_History_${safeTitle}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function downloadHistoryPDF() {
  if (!CURRENT_HIST_CASE) return;
  const entries = [...CURRENT_HIST_CASE.entries].sort((a,b) => {
    const ta = a.entryDate instanceof Date ? a.entryDate.getTime() : 0;
    const tb = b.entryDate instanceof Date ? b.entryDate.getTime() : 0;
    return ta - tb;
  });
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Case Proceedings History</title>
  <meta charset="UTF-8">
  <style>
    body{font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Inter',Arial,sans-serif;padding:24px;color:#1A1F2E}
    h2{color:#1B2A4A;font-family:Georgia,serif;margin-bottom:6px}
    .meta{font-size:12px;color:#6B7280;margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#1B2A4A;color:#fff;padding:8px;text-align:left;font-size:11px}
    td{padding:8px;border-bottom:1px solid #ddd;font-size:11px;vertical-align:top}
    tr:nth-child(even) td{background:#f9f6ef}
    @media print{button{display:none}}
  </style></head>
  <body>
  <h2>⚖️ DLO Kupwara — Case Proceedings History</h2>
  <p class="meta"><strong>Case:</strong> ${CURRENT_HIST_CASE.title || '—'}</p>
  <p class="meta"><strong>CNR:</strong> ${CURRENT_HIST_CASE.cnr || '—'} &nbsp;|&nbsp; <strong>Department:</strong> ${CURRENT_HIST_CASE.dept || '—'} &nbsp;|&nbsp; <strong>Court:</strong> ${CURRENT_HIST_CASE.court || '—'}</p>
  <p class="meta">Generated: ${new Date().toLocaleDateString('en-IN')} &nbsp;|&nbsp; Total Entries: ${entries.length}</p>
  <button onclick="window.print()" style="margin-top:10px;padding:8px 16px;background:#1B2A4A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print / Save as PDF</button>
  <table><thead><tr><th>#</th><th>Date of Entry</th><th>Court Forum</th><th>Proceedings / Orders of That Day</th><th>Hearing Date</th></tr></thead>
  <tbody>${entries.map((e,i)=>`<tr><td>${i+1}</td><td>${e.entryDate instanceof Date ? e.entryDate.toLocaleDateString('en-IN') : ''}</td><td>${e.court||''}</td><td>${e.proceedings||''}</td><td>${formatDDMMYYYY(e.hearingDate)}</td></tr>`).join('')}</tbody></table>
  </body></html>`);
  win.document.close();
}

async function pageInit(){
  const histLoading = document.getElementById('histLoading');
  const histError = document.getElementById('histError');
  if (histLoading) histLoading.style.display = 'block';
  const [ok, histOk] = await Promise.all([fetchSheetData(), fetchHistoryLog()]);
  if (histLoading) histLoading.style.display = 'none';
  if (histError) histError.style.display = histOk ? 'none' : 'block';
  if (histOk) populateHistoryDropdowns();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
