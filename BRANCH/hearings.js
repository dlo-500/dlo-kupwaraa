const HEARINGS_DEFAULT_SHOW = 5;
let hearingsExpanded = false;
let ALL_UPCOMING = [];

function renderHearings() {
  const today = new Date(); today.setHours(0,0,0,0);
  const in15  = new Date(today); in15.setDate(today.getDate()+15);

  ALL_UPCOMING = ALL_ROWS
    .filter(r => r.nextHearing instanceof Date && r.nextHearing >= today && r.nextHearing <= in15)
    .sort((a,b) => a.nextHearing - b.nextHearing);

  document.getElementById('hearingsLoading').style.display = 'none';

  if (ALL_UPCOMING.length === 0) {
    document.getElementById('noHearings').style.display = 'block';
    document.getElementById('hearingsExpandBar').style.display = 'none';
    return;
  }

  hearingsExpanded = false;
  renderHearingCards(ALL_UPCOMING.slice(0, HEARINGS_DEFAULT_SHOW));

  const bar = document.getElementById('hearingsExpandBar');
  if (ALL_UPCOMING.length > HEARINGS_DEFAULT_SHOW) {
    bar.style.display = 'block';
    document.getElementById('hearingsExpandBtn').textContent = `Show All ${ALL_UPCOMING.length} Hearings ▼`;
  } else {
    bar.style.display = 'none';
  }
}

function toggleHearings() {
  hearingsExpanded = !hearingsExpanded;
  const btn = document.getElementById('hearingsExpandBtn');
  if (hearingsExpanded) {
    renderHearingCards(ALL_UPCOMING);
    btn.textContent = 'Show Less ▲';
    btn.style.background = 'var(--gold)';
    btn.style.color = 'var(--navy)';
  } else {
    renderHearingCards(ALL_UPCOMING.slice(0, HEARINGS_DEFAULT_SHOW));
    btn.textContent = `Show All ${ALL_UPCOMING.length} Hearings ▼`;
    btn.style.background = 'var(--navy)';
    btn.style.color = 'var(--white)';
  }
}

function renderHearingCards(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const list = document.getElementById('hearingsList');
  list.innerHTML = rows.map((r,i) => {
    const diff  = Math.round((r.nextHearing - today)/(1000*60*60*24));
    const cls   = diff <= 3 ? 'urgent' : diff <= 7 ? 'soon' : 'normal';
    const chip  = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`;
    const borderColor = diff<=3?'#EF4444':diff<=7?'#F59E0B':'#4ADE80';
    const delay = Math.min(i, 12) * 0.04;
    return `
    <div class="hearing-card" style="animation-delay:${delay}s;background:var(--white);border-radius:10px;border:1px solid var(--border);border-left:5px solid ${borderColor};margin-bottom:14px;padding:18px 22px;box-shadow:0 2px 10px rgba(0,0,0,0.05);transition:box-shadow .2s,transform .2s" onmouseover="this.style.boxShadow='0 6px 24px rgba(0,0,0,0.1)';this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 2px 10px rgba(0,0,0,0.05)';this.style.transform='none'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div>
          <span style="font-size:12px;font-weight:700;color:var(--navy);background:#EEF2FF;padding:3px 10px;border-radius:4px">${escapeHtml(r.caseNo||'—')}</span>
          <span style="margin-left:10px;font-size:12px;color:var(--muted)">${escapeHtml(r.type||'')}</span>
        </div>
        <span style="background:${diff<=3?'#FEE2E2':diff<=7?'#FEF3C7':'#D4EDDA'};color:${diff<=3?'#EF4444':diff<=7?'#D97706':'#1E6B45'};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px${diff<=2?';animation:chipPulse 1.8s ease-in-out infinite':''}">${chip}</span>
      </div>
      <h4 style="font-family:'Playfair Display',serif;font-size:16px;color:var(--navy-mid);margin-bottom:6px">${escapeHtml(r.title||'—')}</h4>
      <p class="hearing-card-subject" style="font-size:13px;color:var(--muted);margin-bottom:10px;font-style:italic;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;white-space:normal;word-break:break-word;cursor:pointer" onclick="this.classList.toggle('expanded')" title="Tap to expand">${escapeHtml(r.subject||'')}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;padding-top:10px;border-top:1px solid var(--border)">
        <div><span style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px">Court</span><p style="font-size:13px;color:var(--text);margin-top:2px">${escapeHtml(r.court||'—')}</p></div>
        <div><span style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px">Department</span><p style="font-size:13px;color:var(--text);margin-top:2px">${escapeHtml(r.dept||'—')}</p></div>
        <div><span style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px">Hearing Date</span><p style="font-size:13px;font-weight:700;color:${borderColor};margin-top:2px">${formatDate(r.nextHearing)}</p></div>
        <div><span style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px">Reply Status</span><p style="font-size:13px;font-weight:600;color:${r.reply&&r.reply.toLowerCase().includes('filed')&&!r.reply.toLowerCase().includes('not')?'var(--active-fg)':'var(--disposed-fg)'};margin-top:2px">${escapeHtml(r.reply||'—')}</p></div>
      </div>
    </div>`;
  }).join('');
}

function toISODateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function initHearingRangeDefaults() {
  const fromEl = document.getElementById('hearingFromDate');
  const toEl   = document.getElementById('hearingToDate');
  if (!fromEl || !toEl) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const in15  = new Date(today); in15.setDate(today.getDate()+15);
  fromEl.value = toISODateInput(today);
  toEl.value   = toISODateInput(in15);
}

function updateHearingRangeStats(rows) {
  rows = rows || [];
  const filed    = rows.filter(r => r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not')).length;
  const notFiled = rows.length - filed;
  const totalEl = document.getElementById('hrfTotal');
  const filedEl = document.getElementById('hrfFiled');
  const notEl   = document.getElementById('hrfNotFiled');
  [[totalEl, rows.length], [filedEl, filed], [notEl, notFiled]].forEach(([el, val]) => {
    if (!el) return;
    el.textContent = val;
    el.classList.remove('bump');
    void el.offsetWidth; // restart animation
    el.classList.add('bump');
  });
}

function applyHearingRange() {
  const fromInput = document.getElementById('hearingFromDate');
  const toInput   = document.getElementById('hearingToDate');
  if (!fromInput || !toInput || !fromInput.value || !toInput.value) return;

  const from = new Date(fromInput.value); from.setHours(0,0,0,0);
  const to   = new Date(toInput.value);   to.setHours(23,59,59,999);
  if (from > to) { alert('The "From" date must be before the "To" date.'); return; }

  ALL_UPCOMING = ALL_ROWS
    .filter(r => r.nextHearing instanceof Date && r.nextHearing >= from && r.nextHearing <= to)
    .sort((a,b) => a.nextHearing - b.nextHearing);

  const loadingEl = document.getElementById('hearingsLoading');
  if (loadingEl) loadingEl.style.display = 'none';
  document.getElementById('noHearings').style.display = ALL_UPCOMING.length ? 'none' : 'block';

  hearingsExpanded = true;
  renderHearingCards(ALL_UPCOMING);
  document.getElementById('hearingsExpandBar').style.display = 'none';

  updateHearingRangeStats(ALL_UPCOMING);
}

function resetHearingRange() {
  initHearingRangeDefaults();
  document.getElementById('noHearings').style.display = 'none';
  renderHearings();
  updateHearingRangeStats(ALL_UPCOMING);
}

function downloadHearingRangeExcel() {
  const rows = ALL_UPCOMING || [];
  if (!rows.length) { alert('No hearings in the selected range to download.'); return; }
  const data = [['#','Case No.','Title','Department','Court','Hearing Date','Reply Status'],
    ...rows.map((r,i)=>[i+1,r.caseNo,r.title,r.dept,r.court,formatDate(r.nextHearing),r.reply])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hearings');
  XLSX.writeFile(wb, `DLO_Hearings_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function downloadHearingRangePDF() {
  const rows = ALL_UPCOMING || [];
  if (!rows.length) { alert('No hearings in the selected range to download.'); return; }
  const fromVal = document.getElementById('hearingFromDate').value;
  const toVal   = document.getElementById('hearingToDate').value;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Upcoming Hearings</title><style>body{font-family:Arial;font-size:12px;padding:20px}table{width:100%;border-collapse:collapse}th{background:#1B2A4A;color:#fff;padding:8px}td{padding:7px;border-bottom:1px solid #ddd}@media print{button{display:none}}</style></head>
  <body>${getLetterhead('Upcoming Hearings', `${fromVal||''} to ${toVal||''} — Total: ${rows.length}`)}
  <button onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#1B2A4A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print</button>
  <table><thead><tr><th>#</th><th>Case No.</th><th>Title</th><th>Court</th><th>Hearing Date</th><th>Reply Status</th></tr></thead>
  <tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.caseNo||''}</td><td>${r.title||''}</td><td>${r.court||''}</td><td>${formatDate(r.nextHearing)}</td><td>${r.reply||''}</td></tr>`).join('')}</tbody></table>
  ${getLetterFooter()}
  </body></html>`);
  win.document.close();
}

async function pageInit(){
  await fetchSheetData();
  initHearingRangeDefaults();
  renderHearings();
  updateHearingRangeStats(ALL_UPCOMING);
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
