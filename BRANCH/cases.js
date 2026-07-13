let FILTERED_ROWS = [];
const FILTER_IDS = ['statusFilter','courtFilter','deptFilter','replyFilter','typeFilter','counselFilter','exparteFilter'];
let debouncedApplySearch;

function populateDropdowns() {
  const courts   = [...new Set(ALL_ROWS.map(r=>r.court).filter(Boolean))].sort();
  const depts    = [...new Set(ALL_ROWS.map(r=>r.dept).filter(Boolean))].sort();
  const types    = [...new Set(ALL_ROWS.map(r=>r.type).filter(Boolean))].sort();
  const counsels = [...new Set(ALL_ROWS.map(r=>r.counsel).filter(Boolean))].sort();

  const cSel = document.getElementById('courtFilter');
  courts.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; cSel.appendChild(o); });

  const dSel = document.getElementById('deptFilter');
  depts.forEach(d => { const o=document.createElement('option'); o.value=d; o.textContent=d; dSel.appendChild(o); });

  const tSel = document.getElementById('typeFilter');
  if(tSel) types.forEach(t => { const o=document.createElement('option'); o.value=t; o.textContent=t; tSel.appendChild(o); });

  const scSel = document.getElementById('counselFilter');
  if(scSel) counsels.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; scSel.appendChild(o); });
}

function applyFilter() {
  const status  = document.getElementById('statusFilter')  ? document.getElementById('statusFilter').value  : '';
  const court   = document.getElementById('courtFilter').value;
  const dept    = document.getElementById('deptFilter').value;
  const reply   = document.getElementById('replyFilter')   ? document.getElementById('replyFilter').value   : '';
  const type    = document.getElementById('typeFilter')    ? document.getElementById('typeFilter').value    : '';
  const counsel = document.getElementById('counselFilter') ? document.getElementById('counselFilter').value : '';
  const exparte = document.getElementById('exparteFilter') ? document.getElementById('exparteFilter').value : '';
  const query   = document.getElementById('globalSearch').value.trim().toLowerCase();

  // If no filter selected at all, show prompt instead of all cases
  if (!status && !court && !dept && !reply && !type && !counsel && !exparte && !query) {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('filterPrompt').style.display = 'block';
    return;
  }

  document.getElementById('filterPrompt').style.display = 'none';

  FILTERED_ROWS = ALL_ROWS.filter(r => {
    const matchStatus  = !status  || (r.status && r.status.toLowerCase().includes(status.toLowerCase()));
    const matchCourt   = !court   || r.court === court;
    const matchDept    = !dept    || r.dept  === dept;
    const matchType    = !type    || r.type  === type;
    const matchCounsel = !counsel || r.counsel === counsel;
    const matchExparte = !exparte || (exparte==='yes' ? isExparte(r) : !isExparte(r));
    const matchReply   = !reply   ||
      (reply==='filed' && r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not')) ||
      (reply==='not'   && r.reply && r.reply.toLowerCase().includes('not'));
    const matchSearch  = !query   || [r.caseNo, r.title, r.subject, r.dept, r.court,
      r.lastProc, formatDate(r.nextHearing), r.reply, r.status, r.type, r.counsel, r.exparte]
      .some(val => val && val.toLowerCase().includes(query));
    return matchStatus && matchCourt && matchDept && matchType && matchCounsel && matchExparte && matchReply && matchSearch;
  });

  renderResults(FILTERED_ROWS);
}

function clearFilter() {
  FILTER_IDS.forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('globalSearch').value = '';
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('filterPrompt').style.display = 'block';
}

function viewAllCases() {
  FILTER_IDS.forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('globalSearch').value = '';
  FILTERED_ROWS = [...ALL_ROWS];
  document.getElementById('filterPrompt').style.display = 'none';
  renderResults(FILTERED_ROWS);
}

function viewOverdueCases() {
  const today = new Date(); today.setHours(0,0,0,0);
  FILTERED_ROWS = ALL_ROWS.filter(r =>
    r.nextHearing instanceof Date &&
    r.nextHearing < today &&
    r.status && r.status.toLowerCase().includes('active')
  );
  FILTER_IDS.forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('globalSearch').value = '';
  document.getElementById('filterPrompt').style.display = 'none';
  renderResults(FILTERED_ROWS, '⚠️ Overdue Cases — Hearing date passed, still Active');
}

function renderResults(rows, label) {
  const section = document.getElementById('resultsSection');
  const body    = document.getElementById('resultsBody');
  const count   = document.getElementById('resultsCount');
  section.style.display = 'block';

  const labelText = label ? `${label} — ` : '';
  count.textContent = `${labelText}Showing ${rows.length} case${rows.length!==1?'s':''} — click any row for full details`;

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="13" class="no-results">No cases found for the selected filter.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r,i) => `
    <tr style="cursor:pointer" onclick="openCasePopup(FILTERED_ROWS[${i}]||ALL_ROWS[${i}])" title="Click to view full details">
      <td>${i+1}</td>
      <td style="white-space:nowrap;font-weight:600;color:var(--navy)">${escapeHtml(r.caseNo||'—')}</td>
      <td style="max-width:200px">${escapeHtml(r.title||'—')}</td>
      <td style="max-width:180px;font-size:12px">${escapeHtml(r.subject||'—')}</td>
      <td>${escapeHtml(r.dept||'—')}</td>
      <td style="white-space:nowrap">${escapeHtml(r.court||'—')}</td>
      <td style="max-width:160px;font-size:12px">${escapeHtml(r.lastProc||'—')}</td>
      <td style="white-space:nowrap;font-weight:600">${formatDate(r.nextHearing)}</td>
      <td><span style="font-size:12px;font-weight:600;color:${r.reply&&r.reply.toLowerCase().includes('filed')&&!r.reply.toLowerCase().includes('not')?'var(--active-fg)':'var(--disposed-fg)'}">${escapeHtml(r.reply||'—')}</span></td>
      <td><span class="status-pill ${escapeHtml(r.status||'')}">${escapeHtml(r.status||'—')}</span></td>
      <td>${escapeHtml(r.type||'—')}</td>
      <td style="white-space:nowrap">${escapeHtml(r.counsel||'—')}</td>
      <td><span style="font-size:12px;font-weight:600;color:${isExparte(r)?'var(--disposed-fg)':'var(--active-fg)'}">${isExparte(r)?'Ex-parte':escapeHtml(r.exparte||'—')}</span></td>
    </tr>`).join('');
}

function applySearch() {
  const query = document.getElementById('globalSearch').value.trim().toLowerCase();
  if (!query) {
    FILTERED_ROWS = [...ALL_ROWS];
    renderResults(FILTERED_ROWS);
    return;
  }
  FILTERED_ROWS = ALL_ROWS.filter(r => {
    return [r.caseNo, r.title, r.subject, r.dept, r.court,
            r.lastProc, formatDate(r.nextHearing), r.reply, r.status, r.type]
      .some(val => val && val.toLowerCase().includes(query));
  });
  renderResults(FILTERED_ROWS);
}

function clearSearch() {
  document.getElementById('globalSearch').value = '';
  FILTERED_ROWS = [...ALL_ROWS];
  renderResults(FILTERED_ROWS);
}

function exportExcel() {
  const rows = FILTERED_ROWS.length > 0 ? FILTERED_ROWS : ALL_ROWS;
  const data = [
    ['SR#','Case No.','Title','Subject Matter','Department','Court','Last Proceedings','Next Hearing','Reply Status','Case Status','Case Type','Standing Counsel','Ex-parte Status'],
    ...rows.map((r,i) => [i+1, r.caseNo, r.title, r.subject, r.dept, r.court, r.lastProc, formatDate(r.nextHearing), r.reply, r.status, r.type, r.counsel, r.exparte])
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cases');
  XLSX.writeFile(wb, `DLO_Kupwara_Cases_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportPDF() {
  const rows = FILTERED_ROWS.length > 0 ? FILTERED_ROWS : ALL_ROWS;
  const win = window.open('','_blank');
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
      <tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.caseNo||''}</td><td>${r.title||''}</td><td>${r.dept||''}</td><td>${r.court||''}</td><td>${formatDate(r.nextHearing)}</td><td>${r.reply||''}</td><td>${r.status||''}</td><td>${r.counsel||''}</td><td>${r.exparte||''}</td></tr>`).join('')}</tbody>
    </table></body></html>`);
  win.document.close();
}

debouncedApplySearch = debounce(() => applySearch(), 220);

async function pageInit(){
  await fetchSheetData();
  populateDropdowns();
  updateStats();
  updateReplyStats();
  checkAlerts();
  updateTicker();

  const q = new URLSearchParams(window.location.search).get('q');
  if (q) {
    const gs = document.getElementById('globalSearch');
    if (gs) { gs.value = q; applySearch(); gs.focus(); }
  } else {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('filterPrompt').style.display = 'block';
  }
}
document.addEventListener('DOMContentLoaded', pageInit);
