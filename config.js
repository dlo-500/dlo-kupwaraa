/**
 * DLO Kupwara — Central Configuration
 * Single source of truth for office details, team, courts, and app version.
 * Update this file only when office information changes.
 */
window.DLO_CONFIG = {
  version: '2.1.0',
  buildDate: '2026-09-21',

  /**
   * Supabase connection — SINGLE SOURCE OF TRUTH.
   * Previously this URL + anon key were hardcoded separately inside
   * causelist.html, hearings.html, history.html, operator.html and
   * performance.html (5 copies of the same string), with department.html
   * left blank and never wired up at all. Every page must now read from
   * here instead of declaring its own copy — see common.js → DLO.getSupabaseClient().
   *
   * SECURITY NOTE: the anon key is meant to be public (it's shipped to every
   * browser) — it is safe ONLY because Row Level Security (RLS) is enforced
   * on every table it touches. Rotating the key or the URL now means editing
   * exactly one line, in exactly one file.
   */
  supabase: {
    url: 'https://case-portal-proxy.dlokupwara.workers.dev',
    anonKey: 'public-placeholder'
  },

  /**
   * Homepage "Latest Updates" carousel + right-side updates drawer.
   * Read-only, no Supabase table, no API key — just a published Google
   * Sheet. Paste that sheet's CSV link below; everything else (fetching,
   * sorting, display) reads from this one spot.
   *
   * HOW TO GET THE LINK:
   *   1. Open the Google Sheet → File → Share → Publish to web.
   *   2. Under "Link", pick the specific sheet/tab (not "Entire Document").
   *   3. Under "Embed", choose "Comma-separated values (.csv)".
   *   4. Click Publish, copy the link, paste it below.
   *
   * Sheet header row (row 1) should use these headings (case-insensitive):
   *   Date | Heading | Body | Attachments
   *   - Date: enter as YYYY-MM-DD. Updates are sorted newest first.
   *   - Attachments may be blank; use one link per line inside the cell, each either
   *     a bare URL or "Label|https://example.com/file.pdf" for a custom label.
   */
  updates: {
    // PASTE YOUR PUBLISHED GOOGLE SHEET CSV LINK HERE:
    sheetCsvUrl: ''
  },

  office: {
    fullName: 'District Litigation Office Kupwara',
    shortName: 'DLO Kupwara',
    department: 'Department of Law, Justice & Parliamentary Affairs',
    government: 'Government of Jammu & Kashmir',
    address: 'District Court Complex, Kupwara, Jammu & Kashmir – 193222',
    phone: '+91-1955-XXXXXX',
    email: 'dlo.kupwara@jk.gov.in',
    website: 'https://dlokupwara.in',
    workingHours: 'Mon–Sat 10:00 AM – 4:30 PM (IST)'
  },

  // Officials (update names/designations as required)
  officials: [
    { role: 'District Litigation Officer', name: '—', order: 1 },
    { role: 'Superintendent', name: '—', order: 2 },
    { role: 'Standing Counsel', name: '—', order: 3 },
    { role: 'Junior Assistant', name: '—', order: 4 }
  ],

  // Courts commonly handled (used by filters & distribution)
  courts: [
    'District Court Kupwara',
    'Additional District Court Kupwara',
    'Chief Judicial Magistrate Kupwara',
    'Munsiff Court Kupwara',
    'Special Mobile Magistrate',
    'High Court of J&K and Ladakh (Srinagar Wing)'
  ],

  // Case status vocabulary used across filters & analytics
  statuses: ['Pending', 'Disposed', 'Transferred', 'Stayed', 'Ex-parte'],

  // Departments
  departments: [
    'Revenue', 'Police', 'Forest', 'PWD', 'Education',
    'Health', 'Irrigation', 'Social Welfare', 'Others'
  ],

  // Theme defaults
  theme: {
    defaultMode: 'dark',          // 'dark' | 'light'
    // New key resets an older saved light preference once, establishing dark
    // as the updated default while preserving choices made after this release.
    storageKey: 'dlo-theme-mode-v2'
  },

  // Feature flags (client-side)
  features: {
    skeletons: true,
    toasts: true,
    offlineToast: true,
    themeToggle: true
  }
};
window.addEventListener('load', function () {
  try {
    var p = location.pathname;
    if (/\.html$/.test(p)) {
      var clean = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
      history.replaceState(null, '', clean + location.search + location.hash);
    }
  } catch (e) {}
});
/* Breadcrumb bar */
(function () {
  var CSS =
    '#dloCrumbs{background:linear-gradient(90deg,#0A1F3D,#123059);border-bottom:1px solid rgba(198,163,88,.45);' +
    'box-shadow:0 2px 10px rgba(0,0,0,.18);font-family:"Roboto Condensed","Roboto",system-ui,sans-serif;animation:dloCrumbIn .35s ease both}' +
    '#dloCrumbs ol{list-style:none;margin:0 auto;padding:10px 20px;max-width:1200px;display:flex;align-items:center;flex-wrap:wrap;gap:2px 0;font-size:13px;letter-spacing:.04em}' +
    '#dloCrumbs li{display:flex;align-items:center;min-width:0}' +
    '#dloCrumbs li+li::before{content:"";width:6px;height:6px;margin:0 12px;border-top:1.5px solid #C6A358;border-right:1.5px solid #C6A358;transform:rotate(45deg);opacity:.8}' +
    '#dloCrumbs a{color:rgba(255,255,255,.78);text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;transition:background .2s,color .2s}' +
    '#dloCrumbs a:hover,#dloCrumbs a:focus-visible{color:#fff;background:rgba(198,163,88,.18);outline:none}' +
    '#dloCrumbs [aria-current]{color:#E0C083;font-weight:600;padding:3px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw}' +
    '#dloCrumbs svg{width:14px;height:14px;fill:currentColor}' +
    '@keyframes dloCrumbIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){#dloCrumbs{animation:none}}' +
    '@media print{#dloCrumbs{display:none}}';

  function build() {
    if (document.getElementById('dloCrumbs')) return;
    var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (path === '/' || path === '' || /\/app$/.test(path)) return;

    var title = (document.title || '').split('|')[0].trim();
    if (!title) {
      title = decodeURIComponent(path.split('/').pop() || '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.id = 'dloCrumbs';
    nav.setAttribute('aria-label', 'Breadcrumb');
    var ol = document.createElement('ol');

    var li1 = document.createElement('li');
    var a = document.createElement('a');
    a.href = '/';
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3z"/></svg>';
    var home = document.createElement('span');
    home.textContent = 'Home';
    a.appendChild(home);
    li1.appendChild(a);

    var li2 = document.createElement('li');
    var cur = document.createElement('span');
    cur.setAttribute('aria-current', 'page');
    cur.textContent = title;
    li2.appendChild(cur);

    ol.appendChild(li1);
    ol.appendChild(li2);
    nav.appendChild(ol);

    var top = document.querySelector('.topbar');
    if (top && top.parentNode) top.parentNode.insertBefore(nav, top.nextSibling);
    else document.body.insertBefore(nav, document.body.firstChild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();