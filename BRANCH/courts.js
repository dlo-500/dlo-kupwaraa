let courtChartInstance = null;

function renderCourtsTable() {
  const tbody = document.getElementById('courtsTableBody');

  // Build dynamic court list from actual data
  const courtMap = {};
  ALL_ROWS.forEach(r => {
    if (r.court && r.court.trim()) {
      courtMap[r.court.trim()] = (courtMap[r.court.trim()]||0) + 1;
    }
  });

  const courts = Object.entries(courtMap).sort((a,b) => b[1]-a[1]);

  if (courts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No court data available</td></tr>';
    return;
  }

  tbody.innerHTML = courts.map(([name, count], i) => {
    const zeroClass = count === 0 ? 'zero' : '';
    return `<tr><td>${i+1}</td><td>${escapeHtml(name)}</td><td><span class="case-count ${zeroClass}">${count}</span></td></tr>`;
  }).join('');

  document.getElementById('courtsTotalFooter').textContent = ALL_ROWS.length;
  document.getElementById('lastUpdated').textContent = 'Last updated: ' + new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  renderCourtChart(courts);
}

function renderCourtChart(courts) {
  const canvas = document.getElementById('courtChart');
  if (!canvas) return;

  const labels = courts.map(([name]) => name.length > 22 ? name.substring(0,22)+'…' : name);
  const fullLabels = courts.map(([name]) => name);
  const data   = courts.map(([,count]) => count);

  const palette = [
    '#1B2A4A','#C9A84C','#1E6B45','#8B1A1A','#243660',
    '#7A5C00','#4A7B9D','#6B4226','#2D6A4F','#9B2335',
    '#3D5A80','#E07A5F','#81B29A','#F2CC8F','#3D405B'
  ];
  const colors = data.map((_,i) => palette[i % palette.length]);

  if (courtChartInstance) courtChartInstance.destroy();

  courtChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: fullLabels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#F9F6EF',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} cases (${((ctx.raw/data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`
          }
        }
      }
    }
  });

  // Custom legend
  const legend = document.getElementById('chartLegend');
  if (legend) {
    legend.innerHTML = courts.slice(0,8).map(([name, count], i) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:11px">
        <span style="width:12px;height:12px;border-radius:3px;background:${colors[i]};flex-shrink:0"></span>
        <span style="color:#374151;flex:1;line-height:1.3">${escapeHtml(name)}</span>
        <span style="font-weight:700;color:${colors[i]}">${count}</span>
      </div>`).join('') + (courts.length > 8 ? `<div style="font-size:11px;color:var(--muted);font-style:italic">+ ${courts.length-8} more courts</div>` : '');
  }
}

async function pageInit(){
  await fetchSheetData();
  renderCourtsTable();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
