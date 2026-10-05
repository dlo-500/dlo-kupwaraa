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
