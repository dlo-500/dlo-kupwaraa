let TODAY_HEARINGS = [];

function buildChessBoard() {
  const board = document.getElementById('chessboard');
  if (!board) return;
  const layout = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    ['','','','','','','',''],['','','','','','','',''],
    ['','','','','','','',''],['','','','','','','',''],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖'],
  ];
  layout.forEach((row,r)=>row.forEach((piece,c)=>{
    const cell = document.createElement('div');
    cell.className='chess-cell '+((r+c)%2===1?'dark':'light');
    if(piece){cell.textContent=piece;cell.style.color=r<2?'#C9A84C':'#FFFFFF';cell.style.textShadow=r<2?'0 0 12px rgba(201,168,76,0.6)':'0 1px 4px rgba(0,0,0,0.5)'}
    board.appendChild(cell);
  }));
}

// Adapted for the multi-page site: "Cases" now lives on its own page
// (cases.html), so the home search box hands the query off via a URL
// parameter instead of scrolling to an in-page section.
function homeSearch(q) {
  q = (q || '').trim();
  window.location.href = 'cases.html' + (q ? ('?q=' + encodeURIComponent(q)) : '');
}

function renderAppHomeCauseList() {
  const box = document.getElementById('appHomeCauseList');
  if (!box) return;
  if (!TODAY_HEARINGS || !TODAY_HEARINGS.length) {
    box.innerHTML = '<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px">No hearings scheduled for today.</div>';
    return;
  }
  box.innerHTML = TODAY_HEARINGS.slice(0, 6).map(r => `
    <div class="row">
      <div>
        <div class="ttl">${escapeHtml(r.caseNo || '—')}</div>
        <div class="sub">${escapeHtml(r.court || '—')}</div>
      </div>
      <span class="tag">${escapeHtml(r.reply || 'Pending')}</span>
    </div>`).join('');
}

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

async function pageInit(){
  buildChessBoard();
  await fetchSheetData();
  renderCauseList();
  renderAppHomeCauseList();
  updateStats();
  updateTicker();
  checkAlerts();
  updateReplyStats();
}
document.addEventListener('DOMContentLoaded', pageInit);
