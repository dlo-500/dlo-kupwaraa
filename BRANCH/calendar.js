let calYear = new Date().getFullYear(), calMonth = new Date().getMonth();

function renderCalendar(){
  const label=document.getElementById('calMonthLabel');
  if(label) label.textContent=new Date(calYear,calMonth,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  const grid=document.getElementById('calendarGrid');
  if(!grid) return;

  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html=days.map(d=>`<div class="cal-header">${d}</div>`).join('');

  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);

  // Build hearing date map for this month
  const hearingMap={};
  ALL_ROWS.forEach(r=>{
    if(!(r.nextHearing instanceof Date)) return;
    if(r.nextHearing.getFullYear()===calYear&&r.nextHearing.getMonth()===calMonth){
      const d=r.nextHearing.getDate();
      if(!hearingMap[d]) hearingMap[d]=[];
      hearingMap[d].push(r);
    }
  });

  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;

  for(let d=1;d<=daysInMonth;d++){
    const hasH=hearingMap[d]&&hearingMap[d].length>0;
    const isToday=new Date(calYear,calMonth,d).getTime()===today.getTime();
    const cls=['cal-day',hasH?'has-hearing':'',isToday?'today':''].filter(Boolean).join(' ');
    const onclick=hasH?`showCalDay(${d})`:'';
    html+=`<div class="${cls}" ${onclick?`onclick="${onclick}"`:''}>${d}${hasH?`<span class="cal-hearing-count">${hearingMap[d].length}</span>`:''}</div>`;
  }

  grid.innerHTML=html;
  window._calHearingMap=hearingMap;
}

function showCalDay(d){
  const hearings=window._calHearingMap&&window._calHearingMap[d]||[];
  const title=document.getElementById('calDayTitle');
  const list=document.getElementById('calDayList');
  const details=document.getElementById('calDayDetails');
  if(!title||!list||!details) return;
  title.textContent=`Hearings on ${d} ${new Date(calYear,calMonth,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}`;
  list.innerHTML=hearings.map((r,i)=>`
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div><strong style="color:var(--navy)">${r.caseNo||'—'}</strong> — ${r.title||'—'}<br><span style="color:var(--muted);font-size:12px">${r.court||'—'} | ${r.dept||'—'}</span></div>
      <span style="font-size:12px;font-weight:600;color:${r.reply&&r.reply.toLowerCase().includes('filed')&&!r.reply.toLowerCase().includes('not')?'#1E6B45':'#8B1A1A'}">${r.reply||'—'}</span>
    </div>`).join('');
  details.style.display='block';
  details.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function changeCalMonth(dir){
  calMonth+=dir;
  if(calMonth>11){calMonth=0;calYear++;}
  if(calMonth<0){calMonth=11;calYear--;}
  renderCalendar();
  const det=document.getElementById('calDayDetails');
  if(det) det.style.display='none';
}

async function pageInit(){
  await fetchSheetData();
  renderCalendar();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
