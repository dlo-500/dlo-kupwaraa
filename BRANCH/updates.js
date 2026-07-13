async function fetchUpdates() {
  try {
    const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    document.getElementById('updatesLoading').style.display = 'none';
    const updates = (data || []).map(row => ({
      date:     row.date_label || new Date(row.created_at).toLocaleDateString('en-IN'),
      category: row.category || '',
      title:    row.title || '',
      desc:     row.description || '',
      link:     row.link || '',
    })).filter(u => u.title && u.title.trim() !== '');
    if (updates.length === 0) { document.getElementById('noUpdates').style.display='block'; return; }
    const catColors = {
      'Court Order':{bg:'#FEE2E2',fg:'#8B1A1A'},
      'Notice':{bg:'#FFF3CD',fg:'#7A5C00'},
      'Circular':{bg:'#D4EDDA',fg:'#1E6B45'},
      'Hearing':{bg:'#EEF2FF',fg:'#1B2A4A'},
    };
    document.getElementById('updatesList').innerHTML = updates.map(u => {
      const c = catColors[u.category]||{bg:'#EEF2FF',fg:'#1B2A4A'};
      const link = safeUrl(u.link);
      return `<div style="background:var(--cream);border:1px solid var(--border);border-radius:10px;padding:20px 24px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.bg};color:${c.fg}">${escapeHtml(u.category||'Update')}</span>
            <span style="font-size:12px;color:var(--muted)">${escapeHtml(u.date||'')}</span>
          </div>
          <h4 style="font-family:'Playfair Display',serif;font-size:16px;color:var(--navy-mid);margin-bottom:6px">${escapeHtml(u.title)}</h4>
          <p style="font-size:13px;color:var(--muted);line-height:1.6">${escapeHtml(u.desc||'')}</p>
        </div>
        ${link?`<a href="${link}" target="_blank" rel="noopener noreferrer" style="background:var(--navy);color:var(--white);padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;white-space:nowrap;flex-shrink:0">📄 View Document</a>`:''}
      </div>`;
    }).join('');
  } catch(e) {
    console.error('Announcements fetch error:', e);
    document.getElementById('updatesLoading').style.display='none';
    document.getElementById('noUpdates').style.display='block';
  }
}

async function pageInit(){
  await fetchSheetData();
  fetchUpdates();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
