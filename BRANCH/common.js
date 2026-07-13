// ═══════════════════════════════════════════════
//  CONFIG — Supabase project connection
// ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://ibicsdsehxlsaygjnefk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaWNzZHNlaHhsc2F5Z2puZWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjQxOTgsImV4cCI6MjA5OTAwMDE5OH0.VzI27sIsfb5AOOhF1zOmaeJPuoE0AnrzeavxWCWElsU';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Shared case-diary dataset — populated by fetchSheetData(), used across pages
let ALL_ROWS = [];
let CURRENT_POPUP_CASE = null;
let deferredPrompt = null;

// ═══════════════════════════════════════════════
//  BACK TO TOP + KEYBOARD SHORTCUTS (chrome present on every page)
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  BACK TO TOP BUTTON
// ═══════════════════════════════════════════════
let _backToTopTicking = false;
window.addEventListener('scroll', () => {
  if (_backToTopTicking) return;
  _backToTopTicking = true;
  requestAnimationFrame(() => {
    const btn = document.getElementById('backToTop');
    if (btn) btn.classList.toggle('visible', window.scrollY > 400);
    _backToTopTicking = false;
  });
}, {passive:true});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.getElementById('casePopup')&&document.getElementById('casePopup').classList.remove('open');
    const det=document.getElementById('calDayDetails');
    if(det) det.style.display='none';
  }
  if((e.key==='s'||e.key==='S')&&!e.ctrlKey&&!e.metaKey&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){
    e.preventDefault();
    const s=document.getElementById('globalSearch');
    if(s){s.focus();s.scrollIntoView({behavior:'smooth',block:'center'});}
  }
});

function escapeHtml(val) {
  if (val == null) return '';
  return String(val).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDDMMYYYY(d) {
  if (!d) return '—';
  if (d instanceof Date && !isNaN(d)) {
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return String(d);
}

function logStatusIsExparte(status) {
  if (!status) return false;
  const v = status.toLowerCase();
  return v.includes('ex-parte') || v.includes('exparte') || v.includes('ex parte');
}

function logStatusIsDisposed(status) {
  if (!status) return false;
  const v = status.toLowerCase();
  return v.includes('disposed') || v.includes('dismissed');
}

function logStatusIsReplyFiled(status) {
  if (!status) return false;
  const v = status.toLowerCase();
  return v.includes('reply filed') && !v.includes('not');
}

function formatDate(d) {
  if (!d) return '—';
  if (d instanceof Date) {
    return d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
  }
  return String(d);
}

function safeUrl(url) {
  const u = String(url || '').trim();
  // Only allow http(s) and mailto links; blocks javascript:, data:, vbscript: etc.
  if (/^(https?:|mailto:)/i.test(u)) return escapeHtml(u);
  return '';
}

function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function initReveal() {
  const obs = new IntersectionObserver(entries=>{
    entries.forEach((e,i)=>{ if(e.isIntersecting) setTimeout(()=>e.target.classList.add('visible'),i*80); });
  },{threshold:0.1});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}

function updateFooterDate() {
  const el = document.getElementById('footerLastUpdated');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

function getLetterhead(title, subtitle) {
  return `
  <div style="border-bottom:3px solid #1B2A4A;padding-bottom:16px;margin-bottom:20px;display:flex;align-items:center;gap:20px">
    <img src="logo.png" alt="DLO Logo" style="width:70px;height:70px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">
    <div>
      <p style="font-size:11px;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Government of Jammu & Kashmir</p>
      <h2 style="font-size:18px;font-weight:700;color:#1B2A4A;margin-bottom:2px">District Litigation Office Kupwara</h2>
      <p style="font-size:11px;color:#6B7280">Justice · Integrity · Law &nbsp;|&nbsp; District Court Complex, Kupwara, J&K — 193222</p>
    </div>
  </div>
  <div style="background:#f9f6ef;border-left:4px solid #C9A84C;padding:10px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
    <div><h3 style="font-size:16px;font-weight:700;color:#1B2A4A">${title}</h3><p style="font-size:12px;color:#6B7280">${subtitle}</p></div>
    <p style="font-size:12px;color:#6B7280">Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
  </div>`;
}

function getLetterFooter() {
  return `<div style="border-top:1px solid #DDD5C0;margin-top:24px;padding-top:12px;display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF">
    <span>District Litigation Office Kupwara &nbsp;·&nbsp; VERSION: NK.1.0</span>
    <span>This report is for internal departmental use only. Not for litigation purposes.</span>
  </div>`;
}

async function installPWA() {
  if (!deferredPrompt) {
    alert('This app is already installed or your browser does not support installation. On iOS Safari, tap the Share button and select "Add to Home Screen".');
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  const btn = document.getElementById('pwaInstallBtn');
  if (outcome === 'accepted' && btn) btn.classList.remove('visible');
}

function showUpdateToast(onRefresh) {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:76px;z-index:2000;background:#1B2A4A;border:1px solid #C9A84C;color:#fff;padding:12px 16px;border-radius:10px;font-family:Inter,sans-serif;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.4)';
  bar.innerHTML = '<span>A new version is available.</span><button style="background:#C9A84C;color:#0D1B2A;border:none;border-radius:6px;padding:7px 14px;font-weight:700;font-size:12px;cursor:pointer">Refresh</button>';
  bar.querySelector('button').onclick = () => { onRefresh(); bar.remove(); };
  document.body.appendChild(bar);
}

function setOfflineBanner(show, stale) {
  let bar = document.getElementById('offlineBanner');
  if (!show) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offlineBanner';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2001;background:#7A5C00;color:#fff;text-align:center;font-family:Inter,sans-serif;font-size:12px;font-weight:600;padding:8px 12px;padding-top:calc(8px + env(safe-area-inset-top,0px))';
    document.body.appendChild(bar);
  }
  bar.textContent = stale
    ? '📡 You\'re offline — showing the last data saved on this device.'
    : '📡 You\'re offline. Some information may be out of date.';
}

function setActiveTab(name) {
  document.querySelectorAll('.app-tabbar a').forEach(a => a.classList.remove('active'));
  const el = document.querySelector('.app-tabbar .' + name);
  if (el) el.classList.add('active');
}

function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('mobileMenu').classList.remove('open');
}

function openDeveloperCard(e) {
  if (e) e.preventDefault();
  document.getElementById('developerPopup').classList.add('open');
}

function closeDeveloperCard(e) {
  if (e.target === document.getElementById('developerPopup')) {
    document.getElementById('developerPopup').classList.remove('open');
  }
}

function copyToClipboard(text){
  navigator.clipboard.writeText(text).then(()=>{
    const el=document.createElement('div');
    el.textContent='✅ Copied to clipboard!';
    el.style.cssText='position:fixed;bottom:80px;right:28px;background:#1E6B45;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;z-index:999;font-family:Inter,sans-serif';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2500);
  });
}

function closePopup(e) {
  if (e.target === document.getElementById('casePopup')) {
    document.getElementById('casePopup').classList.remove('open');
  }
}

function openCasePopup(r) {
  CURRENT_POPUP_CASE = r;
  document.getElementById('popupTitle').textContent = r.caseNo || 'Case Details';
  document.getElementById('popupContent').innerHTML = `
    <div class="popup-field"><label>Case Number</label><p style="font-weight:700;color:var(--navy)">${escapeHtml(r.caseNo||'—')}</p></div>
    <div class="popup-field"><label>Case Status</label><p><span class="status-pill ${escapeHtml(r.status||'')}">${escapeHtml(r.status||'—')}</span></p></div>
    <div class="popup-field full"><label>Title of Case</label><p style="font-family:'Playfair Display',serif;font-size:16px">${escapeHtml(r.title||'—')}</p></div>
    <div class="popup-field full"><label>Subject Matter</label><p>${escapeHtml(r.subject||'—')}</p></div>
    <div class="popup-field"><label>Department</label><p>${escapeHtml(r.dept||'—')}</p></div>
    <div class="popup-field"><label>Case Type</label><p>${escapeHtml(r.type||'—')}</p></div>
    <div class="popup-field"><label>Court</label><p>${escapeHtml(r.court||'—')}</p></div>
    <div class="popup-field"><label>Next Hearing Date</label><p style="font-weight:700;color:var(--navy)">${formatDate(r.nextHearing)}</p></div>
    <div class="popup-field full"><label>Last Proceedings</label><p>${escapeHtml(r.lastProc||'—')}</p></div>
    <div class="popup-field"><label>Reply Status</label><p style="font-weight:700;color:${r.reply&&r.reply.toLowerCase().includes('filed')&&!r.reply.toLowerCase().includes('not')?'var(--active-fg)':'var(--disposed-fg)'}">${escapeHtml(r.reply||'—')}</p></div>
    <div class="popup-field"><label>Standing Counsel</label><p>${escapeHtml(r.counsel||'—')}</p></div>
    <div class="popup-field"><label>Ex-parte Status</label><p style="font-weight:700;color:${isExparte(r)?'var(--disposed-fg)':'var(--active-fg)'}">${escapeHtml(r.exparte||'—')}</p></div>
  `;
  document.getElementById('popupActions').innerHTML = `
    <button class="btn-primary" style="font-size:13px;padding:10px 18px;border:none" onclick="sharePopupOnWhatsAppCurrent()">📱 Share on WhatsApp</button>
    <button onclick="copyCurrentCaseDetails()" style="background:#EEF2FF;border:1px solid var(--border);padding:10px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--navy)">📋 Copy Details</button>
    <button onclick="document.getElementById('casePopup').classList.remove('open')" style="background:var(--grey-100,#f3f4f6);border:none;padding:10px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif">Close</button>
  `;
  document.getElementById('casePopup').classList.add('open');
}

function sharePopupOnWhatsAppCurrent() {
  if (CURRENT_POPUP_CASE) sharePopupOnWhatsApp(CURRENT_POPUP_CASE.caseNo);
}

function copyCurrentCaseDetails() {
  const r = CURRENT_POPUP_CASE;
  if (!r) return;
  copyToClipboard(`Case: ${r.caseNo||''} | ${r.title||''} | Court: ${r.court||''} | Next Hearing: ${formatDate(r.nextHearing)} | Status: ${r.status||''}`);
}

function sharePopupOnWhatsApp(caseNo) {
  const r = ALL_ROWS.find(row => row.caseNo === caseNo);
  if (!r) return;
  const msg = `⚖️ *Case Details — DLO Kupwara*\n\n*Case No:* ${r.caseNo||'—'}\n*Title:* ${r.title||'—'}\n*Department:* ${r.dept||'—'}\n*Court:* ${r.court||'—'}\n*Next Hearing:* ${formatDate(r.nextHearing)}\n*Reply Status:* ${r.reply||'—'}\n*Case Status:* ${r.status||'—'}\n*Standing Counsel:* ${r.counsel||'—'}\n*Ex-parte:* ${r.exparte||'—'}\n\n⚖️ District Litigation Office Kupwara`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank','noopener,noreferrer');
}

function shareOnWhatsApp() {
  const today = new Date(); today.setHours(0,0,0,0);
  const in15  = new Date(today); in15.setDate(today.getDate()+15);

  const upcoming = ALL_ROWS
    .filter(r => r.nextHearing instanceof Date && r.nextHearing >= today && r.nextHearing <= in15)
    .sort((a,b) => a.nextHearing - b.nextHearing);

  if (upcoming.length === 0) {
    alert('No upcoming hearings in the next 15 days.');
    return;
  }

  const urgent = upcoming.filter(r => Math.round((r.nextHearing-today)/(1000*60*60*24)) <= 3);
  const soon   = upcoming.filter(r => { const d=Math.round((r.nextHearing-today)/(1000*60*60*24)); return d>3&&d<=7; });
  const normal = upcoming.filter(r => Math.round((r.nextHearing-today)/(1000*60*60*24)) > 7);

  let msg = `⚖️ *DLO KUPWARA — UPCOMING HEARINGS*\n`;
  msg += `📅 Next 15 Days | ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (urgent.length) {
    msg += `🔴 *URGENT (within 3 days)*\n`;
    urgent.forEach(r => {
      msg += `• ${r.caseNo||'—'} — ${r.title||'—'}\n`;
      msg += `  📍 ${r.court||'—'} | 📆 ${formatDate(r.nextHearing)}\n`;
    });
    msg += `\n`;
  }

  if (soon.length) {
    msg += `🟡 *THIS WEEK (4–7 days)*\n`;
    soon.forEach(r => {
      msg += `• ${r.caseNo||'—'} — ${r.title||'—'}\n`;
      msg += `  📍 ${r.court||'—'} | 📆 ${formatDate(r.nextHearing)}\n`;
    });
    msg += `\n`;
  }

  if (normal.length) {
    msg += `🟢 *UPCOMING (8–15 days)*\n`;
    normal.forEach(r => {
      msg += `• ${r.caseNo||'—'} — ${r.title||'—'}\n`;
      msg += `  📍 ${r.court||'—'} | 📆 ${formatDate(r.nextHearing)}\n`;
    });
    msg += `\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚖️ District Litigation Office Kupwara\n`;
  msg += `🌐 lonetariq500-tech.github.io/dlo-kupwaraa`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function isExparte(r) {
  if (!r.exparte) return false;
  const v = r.exparte.toLowerCase().trim();
  if (v.includes('not')) return false;
  return v.includes('ex-parte') || v.includes('exparte') || v.includes('ex parte') || v === 'yes';
}

function checkAlerts() {
  const today = new Date(); today.setHours(0,0,0,0);

  // Urgent hearings in next 2 days — used only for the compact dismissible
  // banner and the App Home alert strip. Detailed case-by-case breakdowns
  // are intentionally not duplicated here — see the Hearings date-range
  // panel and the Analytics → Overdue/Missing-Reply cards for full lists.
  const urgent = ALL_ROWS.filter(r => {
    if (!(r.nextHearing instanceof Date)) return false;
    const diff = Math.round((r.nextHearing - today)/(1000*60*60*24));
    return diff >= 0 && diff <= 2;
  });

  if (urgent.length) {
    const banner = document.getElementById('urgentBanner');
    const text   = document.getElementById('urgentText');
    if (banner && text) {
      text.textContent = `${urgent.length} hearing${urgent.length>1?'s':''} in the next 2 days — see Upcoming Hearings for details`;
      banner.classList.add('show');
    }
    const appAlert = document.getElementById('appHomeAlert');
    const appAlertText = document.getElementById('appHomeAlertText');
    if (appAlert && appAlertText) {
      appAlertText.textContent = `${urgent.length} hearing${urgent.length>1?'s':''} in the next 2 days`;
      appAlert.classList.add('show');
    }
  }
}

function updateReplyStats() {
  const filed    = ALL_ROWS.filter(r => r.reply && r.reply.toLowerCase().includes('filed') && !r.reply.toLowerCase().includes('not')).length;
  const notFiled = ALL_ROWS.filter(r => r.reply && r.reply.toLowerCase().includes('not')).length;
  const el = document.getElementById('statReplyFiled');
  const el2 = document.getElementById('statReplyNot');
  if (el) animateCount('statReplyFiled', filed);
  if (el2) animateCount('statReplyNot', notFiled);
  animateCount('homeStatReplyFiled', filed);
  animateCount('homeStatReplyPending', notFiled);
}

function updateStats() {
  const total    = ALL_ROWS.length;
  const active   = ALL_ROWS.filter(r => r.status && r.status.toLowerCase().includes('active')).length;
  const disposed = ALL_ROWS.filter(r => r.status && r.status.toLowerCase().includes('disposed')).length;
  const exparte  = ALL_ROWS.filter(r => isExparte(r)).length;
  const courts   = new Set(ALL_ROWS.map(r => r.court).filter(Boolean)).size;

  animateCount('statTotal',   total);
  animateCount('statActive',  active);
  animateCount('statDisposed',disposed);
  animateCount('statExparte', exparte);
  animateCount('heroTotal',   total);
  animateCount('heroActive',  active);
  animateCount('heroDisposed',disposed);
  animateCount('appHomeTotal',   total);
  animateCount('appHomeActive',  active);
  animateCount('appHomeDisposed',disposed);
  animateCount('homeStatTotal',    total);
  animateCount('homeStatActive',   active);
  animateCount('homeStatDisposed', disposed);
  animateCount('homeStatExparte',  exparte);
  animateCount('homeStatCourts',   courts);
}

async function fetchSheetData() {
  try {
    const { data, error } = await sb.from('case_diary').select('*').order('s_no');
    if (error) throw error;

    ALL_ROWS = (data || []).map(r => ({
      sr:          r.s_no != null ? String(r.s_no) : '',
      caseNo:      r.cnr_case_no || '',
      title:       r.case_title || '',
      subject:     r.subject_matter || '',
      dept:        r.department || '',
      court:       r.court_name || '',
      lastProc:    r.last_proceedings || '',
      nextHearing: r.next_hearing_date ? new Date(r.next_hearing_date + 'T00:00:00') : null,
      reply:       r.reply_status || '',
      status:      r.case_status || '',
      type:        r.case_type || '',
      counsel:     r.advocate_name || '',
      exparte:     r.exparte_status || '',
    })).filter(r => r.title && r.title.trim() !== '');

    setOfflineBanner(false);
    return true;
  } catch (e) {
    console.error('Case diary fetch error:', e);
    return false;
  }
}

function updateTicker() {
  const today = new Date(); today.setHours(0,0,0,0);
  const in7   = new Date(today); in7.setDate(today.getDate()+7);
  const soon  = ALL_ROWS.filter(r => r.nextHearing instanceof Date && r.nextHearing >= today && r.nextHearing <= in7);
  const total = ALL_ROWS.length;
  const active = ALL_ROWS.filter(r=>r.status&&r.status.toLowerCase().includes('active')).length;

  const items = [
    `Total cases under DLO Kupwara: ${total}`,
    `Active cases: ${active}`,
    ...soon.map(r=>`Hearing scheduled — ${escapeHtml(r.caseNo)} — ${escapeHtml(r.court)} — ${formatDate(r.nextHearing)}`),
  ];
  const doubled = [...items, ...items];
  const track = document.getElementById('tickerTrack');
  track.innerHTML = doubled.map(t=>`<span>${t}</span>`).join('');
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let count = 0;
  const step = Math.max(1, Math.ceil(target/60));
  const timer = setInterval(()=>{
    count = Math.min(count+step, target);
    el.textContent = count;
    if (count >= target) clearInterval(timer);
  }, 25);
}

// ═══════════════════════════════════════════════
//  PWA INSTALL + SERVICE WORKER + OFFLINE BANNER (event-listener glue only —
//  the installPWA/showUpdateToast/setOfflineBanner/setActiveTab functions
//  themselves are defined once, above)
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  PWA INSTALL LOGIC
// ═══════════════════════════════════════════════
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.classList.add('visible');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.classList.remove('visible');
});


// ═══════════════════════════════════════════════
//  PWA SERVICE WORKER REGISTRATION + UPDATE PROMPT
// ═══════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // A new service worker took over (e.g. after an update) — reload once
      // so the user always ends up on the latest cached version.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(() => newWorker.postMessage('SKIP_WAITING'));
          }
        });
      });
    }).catch(() => {});
  });
}


// ═══════════════════════════════════════════════
//  ONLINE / OFFLINE STATUS BANNER
// ═══════════════════════════════════════════════
window.addEventListener('offline', () => setOfflineBanner(true, false));
window.addEventListener('online',  () => setOfflineBanner(false));
if (typeof navigator !== 'undefined' && navigator.onLine === false) setOfflineBanner(true, false);

// ═══════════════════════════════════════════════
//  APP BOTTOM TAB BAR — active state handling
// ═══════════════════════════════════════════════

