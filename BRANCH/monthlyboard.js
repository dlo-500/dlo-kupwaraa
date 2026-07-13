let HISTORY_ROWS = [];
let monthlyBoardChartInst = null;
let historyAttendanceChartInst = null;

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

function renderMonthlyBoard() {
  const loading = document.getElementById('monthlyBoardLoading');
  if (loading) loading.style.display = 'none';

  const monthMap = {};
  HISTORY_ROWS.forEach(r => {
    if (!(r.entryDate instanceof Date) || isNaN(r.entryDate)) return;
    const key = `${r.entryDate.getFullYear()}-${String(r.entryDate.getMonth()+1).padStart(2,'0')}`;
    monthMap[key] = (monthMap[key] || 0) + 1;
  });

  const sortedKeys = Object.keys(monthMap).sort();
  const labels = sortedKeys.map(k => {
    const [y,m] = k.split('-');
    return new Date(+y, +m-1, 1).toLocaleDateString('en-IN', {month:'short', year:'numeric'});
  });
  const counts = sortedKeys.map(k => monthMap[k]);

  const canvas = document.getElementById('monthlyBoardChart');
  if (canvas) {
    if (monthlyBoardChartInst) monthlyBoardChartInst.destroy();
    monthlyBoardChartInst = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Cases Listed',
          data: counts,
          backgroundColor: 'rgba(13,27,42,0.85)',
          borderColor: '#0D1B2A',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  const tbody = document.getElementById('monthlyBoardBody');
  if (tbody) {
    if (!sortedKeys.length) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:20px;color:var(--muted)">No case history entries yet.</td></tr>`;
    } else {
      tbody.innerHTML = sortedKeys.map((k,i) => `<tr><td>${escapeHtml(labels[i])}</td><td>${counts[i]}</td></tr>`).reverse().join('');
    }
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

async function pageInit(){
  await fetchSheetData();
  const histOk = await fetchHistoryLog();
  if (histOk) renderMonthlyBoard();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
