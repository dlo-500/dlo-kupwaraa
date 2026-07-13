let TODAY_HEARINGS = [];

function renderCauseList() {
  const today=new Date(); today.setHours(0,0,0,0);
  const tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
  TODAY_HEARINGS=ALL_ROWS.filter(r=>r.nextHearing instanceof Date&&r.nextHearing>=today&&r.nextHearing<tomorrow);

  const dateEl=document.getElementById('causeListDate');
  if(dateEl) dateEl.textContent=today.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  const tbody=document.getElementById('causeListBody');
  if(!tbody) return;
  if(!TODAY_HEARINGS.length){
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No hearings scheduled for today.</td></tr>';
    return;
  }
  tbody.innerHTML=TODAY_HEARINGS.map((r,i)=>`
    <tr style="${i%2===0?'background:#F9F6EF':''}">
      <td style="padding:12px 16px;font-weight:700">${i+1}</td>
      <td style="padding:12px 16px;font-weight:600;color:var(--navy)">${escapeHtml(r.caseNo||'—')}</td>
      <td style="padding:12px 16px">${escapeHtml(r.title||'—')}</td>
      <td style="padding:12px 16px">${escapeHtml(r.dept||'—')}</td>
      <td style="padding:12px 16px">${escapeHtml(r.court||'—')}</td>
      <td style="padding:12px 16px"><span style="font-weight:600;font-size:12px;color:${r.reply&&r.reply.toLowerCase().includes('filed')&&!r.reply.toLowerCase().includes('not')?'#1E6B45':'#8B1A1A'}">${escapeHtml(r.reply||'—')}</span></td>
    </tr>`).join('');
}

function printCauseList(){
  const content=document.getElementById('causeListContent').outerHTML;
  const win=window.open('','_blank');
  win.document.write(`<html><head><title>Cause List DLO Kupwara</title><style>body{font-family:Arial;padding:20px}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#1B2A4A;color:#fff;border:none;border-radius:4px;cursor:pointer">Print</button>${content}</body></html>`);
  win.document.close();
}

function shareCauseListWhatsApp(){
  const today=new Date();
  let msg=`⚖️ *DLO KUPWARA — DAILY CAUSE LIST*\n📅 ${today.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'short',year:'numeric'})}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  if(!TODAY_HEARINGS.length){ msg+='No hearings today.\n'; }
  else { TODAY_HEARINGS.forEach((r,i)=>{ msg+=`${i+1}. *${r.caseNo||'—'}*\n   📝 ${r.title||'—'}\n   🏛️ ${r.court||'—'}\n   📋 Reply: ${r.reply||'—'}\n\n`; }); }
  msg+=`━━━━━━━━━━━━━━━━━━━━\n⚖️ District Litigation Office Kupwara`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank','noopener,noreferrer');
}

function downloadCauseListExcel(){
  const data=[['#','Case No.','Title','Department','Court','Reply Status'],
    ...TODAY_HEARINGS.map((r,i)=>[i+1,r.caseNo,r.title,r.dept,r.court,r.reply])];
  const ws=XLSX.utils.aoa_to_sheet(data);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Cause List');
  XLSX.writeFile(wb,`DLO_CauseList_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function pageInit(){
  await fetchSheetData();
  renderCauseList();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
