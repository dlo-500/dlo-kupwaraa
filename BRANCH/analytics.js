let caseTypeChartInst = null;
let replyCourtChartInst = null;
let OVERDUE_ROWS = [], MISSING_ROWS = [];

function renderDisposalRate() {
  const total    = ALL_ROWS.length;
  const active   = ALL_ROWS.filter(r=>r.status&&r.status.toLowerCase().includes('active')).length;
  const disposed = ALL_ROWS.filter(r=>r.status&&r.status.toLowerCase().includes('disposed')).length;
  const pending  = ALL_ROWS.filter(r=>r.status&&r.status.toLowerCase().includes('pending')).length;
  const exparte  = ALL_ROWS.filter(r=>isExparte(r)).length;
  const pct = total ? Math.round((disposed/total)*100) : 0;

  const dpEl = document.getElementById('disposalPct');
  if(dpEl) dpEl.textContent = pct;
  const db = document.getElementById('disposalBar');
  if(db){ db.style.width=pct+'%'; document.getElementById('disposalBarLabel').textContent=pct+'%'; }
  const dc = document.getElementById('disposalCount'); if(dc) dc.textContent=disposed+' disposed';
  const tc = document.getElementById('totalCount');    if(tc) tc.textContent=total+' total';

  const ab = document.getElementById('activeBar');
  if(ab) ab.style.width=(total?Math.round(active/total*100):0)+'%';
  const adl = document.getElementById('activeCountLbl'); if(adl) adl.textContent=active;
  const diB = document.getElementById('disposedBar');
  if(diB) diB.style.width=(total?Math.round(disposed/total*100):0)+'%';
  const dil = document.getElementById('disposedCountLbl'); if(dil) dil.textContent=disposed;
  const pB = document.getElementById('pendingBar');
  if(pB) pB.style.width=(total?Math.round(pending/total*100):0)+'%';
  const pl = document.getElementById('pendingCountLbl'); if(pl) pl.textContent=pending;
  const eB = document.getElementById('exparteBar');
  if(eB) eB.style.width=(total?Math.round(exparte/total*100):0)+'%';
  const el = document.getElementById('exparteCountLbl'); if(el) el.textContent=exparte;
}

function renderDeptPerformance() {
  const deptMap = {};
  ALL_ROWS.forEach(r => {
    if (!r.dept) return;
    const d = r.dept.trim();
    if (!deptMap[d]) deptMap[d] = {total:0, active:0, disposed:0, pending:0};
    deptMap[d].total++;
    const isActive   = r.status && r.status.toLowerCase().includes('active');
    const isDisposed = r.status && r.status.toLowerCase().includes('disposed');
    if (isActive)   deptMap[d].active++;
    if (isDisposed) deptMap[d].disposed++;
    // Reply pending only for active cases
    if (isActive && r.reply && r.reply.toLowerCase().includes('not')) deptMap[d].pending++;
  });

  DEPT_PERF_DATA = Object.entries(deptMap).sort((a,b)=>b[1].pending-a[1].pending);
  const tbody = document.getElementById('deptPerfBody');
  if (!tbody) return;
  tbody.innerHTML = DEPT_PERF_DATA.map(([name,d],i)=>`
    <tr>
      <td>${i+1}</td>
      <td style="font-weight:600">${name}</td>
      <td style="text-align:center">${d.total}</td>
      <td style="text-align:center"><span style="color:var(--active-fg);font-weight:600">${d.active}</span></td>
      <td style="text-align:center"><span style="color:var(--disposed-fg);font-weight:600">${d.disposed}</span></td>
      <td style="text-align:center"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${d.pending>0?'#FAD7D7':'#D4EDDA'};color:${d.pending>0?'#8B1A1A':'#1E6B45'}">${d.pending}</span></td>
    </tr>`).join('');
}

function downloadDeptExcel() {
  const data = [['#','Department','Total Cases','Reply Pending'],
    ...DEPT_PERF_DATA.map(([n,d],i)=>[i+1,n,d.total,d.pending])];
  const ws=XLSX.utils.aoa_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Department Performance');
  XLSX.writeFile(wb,`DLO_Dept_Performance_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function downloadDeptPDF() {
  const win=window.open('','_blank');
  win.document.write(`<html><head><title>Department Performance</title>
  <style>body{font-family:Arial;font-size:12px;padding:20px}h2{color:#1B2A4A}table{width:100%;border-collapse:collapse}th{background:#1B2A4A;color:#fff;padding:8px}td{padding:7px;border-bottom:1px solid #ddd}@media print{button{display:none}}</style></head>
  <body><h2>DLO Kupwara — Department Performance</h2>
  <p>Generated: ${new Date().toLocaleDateString('en-IN')}</p>
  <button onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#1B2A4A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print</button>
  <table><thead><tr><th>#</th><th>Department</th><th>Total</th><th>Reply Pending</th></tr></thead>
  <tbody>${DEPT_PERF_DATA.map(([n,d],i)=>`<tr><td>${i+1}</td><td>${n}</td><td>${d.total}</td><td>${d.pending}</td></tr>`).join('')}</tbody></table>
  </body></html>`);
  win.document.close();
}

function renderCaseTypeChart() {
  const typeMap={};
  ALL_ROWS.forEach(r=>{ if(r.type&&r.type.trim()) typeMap[r.type.trim()]=(typeMap[r.type.trim()]||0)+1; });
  const entries=Object.entries(typeMap).sort((a,b)=>b[1]-a[1]);
  const labels=entries.map(([n])=>n);
  const data=entries.map(([,v])=>v);
  const palette=['#1B2A4A','#C9A84C','#1E6B45','#8B1A1A','#243660','#7A5C00','#4A7B9D','#6B4226','#E07A5F','#81B29A'];
  const colors=data.map((_,i)=>palette[i%palette.length]);
  const canvas=document.getElementById('caseTypeChart');
  if(!canvas) return;
  if(caseTypeChartInst) caseTypeChartInst.destroy();
  caseTypeChartInst=new Chart(canvas,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderColor:'#F9F6EF',borderWidth:3,hoverOffset:8}]},options:{responsive:true,cutout:'55%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${ctx.raw} (${((ctx.raw/data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`}}}}});
  const leg=document.getElementById('caseTypeLegend');
  if(leg) leg.innerHTML=entries.map(([n,v],i)=>`<div style="display:flex;align-items:center;gap:8px;font-size:11px"><span style="width:12px;height:12px;border-radius:3px;background:${colors[i]};flex-shrink:0"></span><span style="flex:1">${escapeHtml(n)}</span><span style="font-weight:700;color:${colors[i]}">${v}</span></div>`).join('');
}

function renderReplyCourtChart() {
  const courtMap={};
  ALL_ROWS.forEach(r=>{
    if(!r.court) return;
    const c=r.court.trim();
    if(!courtMap[c]) courtMap[c]=0;
    if(r.reply&&r.reply.toLowerCase().includes('not')) courtMap[c]++;
  });
  const entries=Object.entries(courtMap).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const canvas=document.getElementById('replyCourtChart');
  if(!canvas||!entries.length) return;
  if(replyCourtChartInst) replyCourtChartInst.destroy();
  const labels=entries.map(([n])=>n.length>18?n.substring(0,18)+'…':n);
  const data=entries.map(([,v])=>v);
  replyCourtChartInst=new Chart(canvas,{type:'bar',data:{labels,datasets:[{label:'Reply Pending',data,backgroundColor:'rgba(139,26,26,0.8)',borderColor:'#8B1A1A',borderWidth:1,borderRadius:4}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}},grid:{color:'rgba(0,0,0,0.05)'}},y:{ticks:{font:{size:10}}}}}});
}

function renderAlertLists() {
  const today=new Date(); today.setHours(0,0,0,0);
  OVERDUE_ROWS=ALL_ROWS.filter(r=>r.nextHearing instanceof Date&&r.nextHearing<today&&r.status&&r.status.toLowerCase().includes('active'));
  MISSING_ROWS=ALL_ROWS.filter(r=>{
    if(!(r.nextHearing instanceof Date)) return false;
    const diff=Math.round((r.nextHearing-today)/(1000*60*60*24));
    return diff>=0&&diff<=7&&r.reply&&r.reply.toLowerCase().includes('not');
  });

  const rowHtml=(r,i)=>`<div style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;display:flex;justify-content:space-between;align-items:center"><div><strong style="color:var(--navy)">${escapeHtml(r.caseNo||'—')}</strong> — ${escapeHtml(r.title||'—')}<br><span style="color:var(--muted)">${escapeHtml(r.court||'—')} | ${formatDate(r.nextHearing)}</span></div><span class="status-pill ${escapeHtml(r.status||'')}">${escapeHtml(r.status||'')}</span></div>`;

  const ol=document.getElementById('overdueList');
  if(ol) ol.innerHTML=OVERDUE_ROWS.length?OVERDUE_ROWS.map(rowHtml).join(''):'<p style="color:var(--muted);font-style:italic;padding:12px;font-size:13px">✅ No overdue cases found.</p>';

  const ml=document.getElementById('missingReplyList');
  if(ml) ml.innerHTML=MISSING_ROWS.length?MISSING_ROWS.map(rowHtml).join(''):'<p style="color:var(--muted);font-style:italic;padding:12px;font-size:13px">✅ No missing replies for upcoming hearings.</p>';
}

function downloadOverdueExcel() {
  const data=[['#','Case No.','Title','Department','Court','Hearing Date','Status'],...OVERDUE_ROWS.map((r,i)=>[i+1,r.caseNo,r.title,r.dept,r.court,formatDate(r.nextHearing),r.status])];
  const ws=XLSX.utils.aoa_to_sheet(data);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Overdue Cases');
  XLSX.writeFile(wb,`DLO_Overdue_Cases_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function downloadOverduePDF() {
  const win=window.open('','_blank');
  win.document.write(`<html><head><title>Overdue Cases</title><style>body{font-family:Arial;font-size:12px;padding:20px}h2{color:#8B1A1A}table{width:100%;border-collapse:collapse}th{background:#8B1A1A;color:#fff;padding:8px}td{padding:7px;border-bottom:1px solid #ddd}@media print{button{display:none}}</style></head>
  <body><h2>DLO Kupwara — Overdue Cases</h2><p>Generated: ${new Date().toLocaleDateString('en-IN')} | Total: ${OVERDUE_ROWS.length}</p>
  <button onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#8B1A1A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print</button>
  <table><thead><tr><th>#</th><th>Case No.</th><th>Title</th><th>Court</th><th>Hearing Date</th><th>Status</th></tr></thead>
  <tbody>${OVERDUE_ROWS.map((r,i)=>`<tr><td>${i+1}</td><td>${r.caseNo||''}</td><td>${r.title||''}</td><td>${r.court||''}</td><td>${formatDate(r.nextHearing)}</td><td>${r.status||''}</td></tr>`).join('')}</tbody></table></body></html>`);
  win.document.close();
}

function downloadMissingExcel() {
  const data=[['#','Case No.','Title','Department','Court','Hearing Date','Reply Status'],...MISSING_ROWS.map((r,i)=>[i+1,r.caseNo,r.title,r.dept,r.court,formatDate(r.nextHearing),r.reply])];
  const ws=XLSX.utils.aoa_to_sheet(data);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Missing Reply');
  XLSX.writeFile(wb,`DLO_Missing_Reply_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function downloadMissingPDF() {
  const win=window.open('','_blank');
  win.document.write(`<html><head><title>Missing Reply</title><style>body{font-family:Arial;font-size:12px;padding:20px}h2{color:#7A5C00}table{width:100%;border-collapse:collapse}th{background:#7A5C00;color:#fff;padding:8px}td{padding:7px;border-bottom:1px solid #ddd}@media print{button{display:none}}</style></head>
  <body><h2>DLO Kupwara — Missing Reply (Hearing within 7 days)</h2><p>Generated: ${new Date().toLocaleDateString('en-IN')} | Total: ${MISSING_ROWS.length}</p>
  <button onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#7A5C00;color:#fff;border:none;border-radius:4px;cursor:pointer">Print</button>
  <table><thead><tr><th>#</th><th>Case No.</th><th>Title</th><th>Court</th><th>Hearing Date</th><th>Reply</th></tr></thead>
  <tbody>${MISSING_ROWS.map((r,i)=>`<tr><td>${i+1}</td><td>${r.caseNo||''}</td><td>${r.title||''}</td><td>${r.court||''}</td><td>${formatDate(r.nextHearing)}</td><td>${r.reply||''}</td></tr>`).join('')}</tbody></table></body></html>`);
  win.document.close();
}

async function pageInit(){
  await fetchSheetData();
  renderDisposalRate();
  renderDeptPerformance();
  renderCaseTypeChart();
  renderReplyCourtChart();
  renderAlertLists();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
