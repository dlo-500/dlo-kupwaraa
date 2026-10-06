/**
 * DLO Kupwara — Shared Utilities
 * Include after config.js on every page that needs helpers.
 */
(function (global) {
  'use strict';

  const CFG = global.DLO_CONFIG || {};

  // Mark app visits before layout so linked app pages keep the same shell.
  (function markAppContextEarly() {
    try {
      const standalone = global.matchMedia && (
        global.matchMedia('(display-mode: standalone)').matches ||
        global.matchMedia('(display-mode: fullscreen)').matches
      );
      const preview = /(?:\?|&)app=1(?:&|$)/.test(global.location.search || '');
      const ios = global.navigator.standalone === true;
      const androidApp = global.document.referrer && global.document.referrer.indexOf('android-app://') === 0;
      if (standalone || preview || ios || androidApp) document.documentElement.classList.add('app-mode');
    } catch (e) {}
  })();

  // ── Supabase: single, memoized client factory ─────────────────────────────
  // Every page that needs Supabase should call DLO.getSupabaseClient() instead
  // of declaring its own SUPABASE_URL / SUPABASE_ANON_KEY / createClient().
  // config.js must be loaded synchronously (no `defer`) BEFORE this file and
  // before any code that calls this — see the <head> of causelist.html for
  // the pattern. Returns null (and logs why) rather than throwing, so a
  // misconfigured page degrades instead of taking down the whole script.
  let _sbClient = null;
  function getSupabaseClient() {
    if (_sbClient) return _sbClient;
    const cfg = CFG.supabase;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      console.error('[DLO] Supabase is not configured — check window.DLO_CONFIG.supabase in config.js');
      return null;
    }
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      console.error('[DLO] supabase-js failed to load before common.js ran — check the <script src="…supabase-js…"> tag and CSP script-src.');
      return null;
    }
    _sbClient = global.supabase.createClient(cfg.url, cfg.anonKey);
    return _sbClient;
  }

  // ── Shared data fetch: case_diary → the row shape calculateStats() expects ─
  // Table/column names verified against causelist.html's own fetchSheetData().
  // Every page that needs case data should call this instead of writing its
  // own query — one place to fix if the schema ever changes.
  // Keep this projection aligned with the public case-search allowlist. Using
  // select('*') can fail when table-level column grants are narrower than the
  // full schema, and would request fields the public UI does not need.
  const CASE_DIARY_SELECT_COLUMNS = [
    'cnr_case_no', 'case_title', 'subject_matter', 'department', 'court_name',
    'last_proceedings', 'reply_status', 'case_status', 'case_type',
    'advocate_name', 'exparte_status', 'next_hearing_date'
  ].join(',');
  // v2: the cache now holds the complete (paged) table, not a 1,000-row slice.
  const CASE_DIARY_SESSION_KEY = 'dlo-case-diary-session-v2';
  const CASE_DIARY_CACHE_MAX_AGE = 45 * 1000;
  let _caseDiaryCache = null;
  let _caseDiaryUpdatedAt = 0;
  let _caseDiaryPromise = null;

  function restoreCaseDiarySession() {
    if (_caseDiaryCache) return _caseDiaryCache;
    try {
      const saved = JSON.parse(sessionStorage.getItem(CASE_DIARY_SESSION_KEY) || 'null');
      if (saved && Array.isArray(saved.rows)) {
        _caseDiaryCache = saved.rows;
        _caseDiaryUpdatedAt = Number(saved.updatedAt) || 0;
      }
    } catch (e) {}
    return _caseDiaryCache;
  }

  function saveCaseDiarySession(rows) {
    _caseDiaryCache = rows;
    _caseDiaryUpdatedAt = Date.now();
    try {
      sessionStorage.setItem(CASE_DIARY_SESSION_KEY, JSON.stringify({ updatedAt: _caseDiaryUpdatedAt, rows }));
    } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent('dlo:case-diary-updated', { detail: { rows } }));
    } catch (e) {}
    return rows;
  }

  // ── Paged reads (no database changes) ────────────────────────────────────
  // The API caps every response (1,000 rows by default), so a bare select()
  // silently drops rows beyond the cap. These helpers read page by page until
  // the exact count is reached. Ordering is the Case Search ordering
  // (cnr_case_no ascending, blanks last) plus s_no as a tiebreaker so pages
  // never overlap or skip rows; if s_no is not readable we retry without it.
  const DLO_PAGE_SIZE = 1000;
  let _sNoOrderOk = true;

  function orderCases(query, withTiebreak) {
    let q = query.order('cnr_case_no', { ascending: true, nullsFirst: false });
    if (withTiebreak && _sNoOrderOk) q = q.order('s_no', { ascending: true });
    return q;
  }

  async function pagedSelect(build, signal) {
    const rows = [];
    let total = null;
    for (let from = 0; ; ) {
      let q = build(from === 0).range(from, from + DLO_PAGE_SIZE - 1);
      if (signal && q.abortSignal) q = q.abortSignal(signal);
      const res = await q;
      if (res.error) throw res.error;
      const data = res.data || [];
      if (from === 0 && Number.isFinite(res.count)) total = res.count;
      rows.push.apply(rows, data);
      from += data.length;
      if (!data.length || (total !== null ? rows.length >= total : data.length < DLO_PAGE_SIZE)) break;
    }
    return rows;
  }

  async function pagedSelectOrdered(build, signal) {
    try {
      return await pagedSelect(build, signal);
    } catch (error) {
      if (_sNoOrderOk && /s_no|permission|column/i.test(String(error && error.message))) {
        _sNoOrderOk = false;
        return pagedSelect(build, signal);
      }
      throw error;
    }
  }

  function mapCaseRow(r) {
    return {
      cnrCaseNo: r.cnr_case_no || '',
      caseTitle: r.case_title || '',
      subjectMatter: r.subject_matter || '',
      department: r.department || 'Unknown',
      court: r.court_name || 'Unknown',
      lastProceedings: r.last_proceedings || '',
      nextHearing: r.next_hearing_date || null,
      reply: r.reply_status || '',
      status: r.case_status || '',
      type: r.case_type || 'Other',
      advocateName: r.advocate_name || '',
      exparte: r.exparte_status || ''
    };
  }

  let _caseDiaryLastError = null;

  function refreshCaseDiary() {
    if (_caseDiaryPromise) return _caseDiaryPromise;
    const sb = getSupabaseClient();
    if (!sb) return Promise.resolve(restoreCaseDiarySession() || []);
    _caseDiaryPromise = pagedSelectOrdered(
      first => orderCases(sb.from('case_diary')
        .select(CASE_DIARY_SELECT_COLUMNS, first ? { count: 'exact' } : undefined), true)
    ).then(data => {
      _caseDiaryLastError = null;
      return saveCaseDiarySession(data.map(mapCaseRow));
    }).catch(error => {
      _caseDiaryLastError = error || new Error('case_diary fetch failed');
      console.error('[DLO] case_diary fetch failed:', error && error.message ? error.message : error);
      return restoreCaseDiarySession() || [];
    }).finally(() => { _caseDiaryPromise = null; });
    return _caseDiaryPromise;
  }

  // ── Case Search data access (shared with search-filter-cases.html) ──────
  const CASE_SEARCH_FIELDS = [
    'cnr_case_no', 'case_title', 'subject_matter', 'department', 'court_name',
    'last_proceedings', 'reply_status', 'case_status',
    'case_type', 'advocate_name', 'exparte_status'
  ];
  const CASE_FILTER_COLUMNS = [
    'case_status', 'court_name', 'department', 'reply_status',
    'case_type', 'advocate_name', 'exparte_status'
  ];

  function applySearch(query, term, filters) {
    const pattern = '%' + term + '%';
    let q = query.or(CASE_SEARCH_FIELDS.map(c => c + '.ilike.' + pattern).join(','));
    Object.keys(filters || {}).forEach(c => { q = q.eq(c, filters[c]); });
    return q;
  }

  // One chunk of matches, in Case Search order. Returns { rows, count }.
  async function searchCases(term, filters, offset, limit, signal) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('The case database is unavailable.');
    async function run(withTiebreak) {
      let q = orderCases(applySearch(
        sb.from('case_diary').select(CASE_DIARY_SELECT_COLUMNS, { count: 'exact' }), term, filters
      ), withTiebreak).range(offset, offset + limit - 1);
      if (signal && q.abortSignal) q = q.abortSignal(signal);
      return q;
    }
    let res = await run(true);
    if (res.error && _sNoOrderOk && /s_no|permission|column/i.test(String(res.error.message))) {
      _sNoOrderOk = false;
      res = await run(false);
    }
    if (res.error) throw res.error;
    const data = res.data || [];
    return { rows: data.map(mapCaseRow), raw: data, count: Number.isFinite(res.count) ? res.count : data.length };
  }

  // Distinct values for every filter column across ALL matches of a search
  // (not just the first page). Reads only the 7 filter columns, 1,000 rows per
  // request. Returns { case_status: [...], court_name: [...], ... }.
  async function getDistinctFilterValues(term, signal) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('The case database is unavailable.');
    const rows = await pagedSelectOrdered(
      first => orderCases(applySearch(
        sb.from('case_diary').select(CASE_FILTER_COLUMNS.join(','), first ? { count: 'exact' } : undefined), term, {}
      ), true), signal
    );
    const out = {};
    CASE_FILTER_COLUMNS.forEach(col => {
      const values = Array.from(new Set(rows.map(r => String(r[col] || '').trim()).filter(Boolean)));
      values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      out[col] = values;
    });
    return out;
  }

  async function fetchCaseDiary(force) {
    const cached = restoreCaseDiarySession();
    if (cached && !force) {
      if (Date.now() - _caseDiaryUpdatedAt > CASE_DIARY_CACHE_MAX_AGE) refreshCaseDiary();
      return cached;
    }
    return refreshCaseDiary();
  }

  // ── Shared data fetch: site updates, from a published Google Sheet ────────
  // Read-only, no API key: paste the sheet's "Publish to web" CSV link into
  // window.DLO_CONFIG.updates.sheetCsvUrl (config.js) — that's the one place
  // to change it. Every page that needs update records should call
  // DLO.fetchSiteUpdates() instead of fetching/parsing its own copy.
  let _siteUpdatesCache = null;

  // Minimal RFC4180-style CSV parser (quoted fields, embedded commas/
  // newlines, doubled "" for an escaped quote) — enough for a Sheets export,
  // without pulling in a dependency for one column of free text.
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\r') {
        // ignore; \n (below) ends the row
      } else if (c === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
  }

  // A cell's attachments: one per line (Alt+Enter in Sheets) or separated by
  // ';', each either a bare URL or "Label|https://url" for custom link text.
  function normalizeAttachments(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];
    function safeUrl(value) {
      const candidate = String(value || '').trim();
      if (!candidate) return '';
      try {
        const parsed = new URL(candidate, global.location && global.location.href);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : '';
      } catch (e) {
        return '';
      }
    }
    return text.split(/\r?\n|;/)
      .map(s => s.trim())
      .filter(Boolean)
      .map((part, i) => {
        const pipeIdx = part.indexOf('|');
        if (pipeIdx > -1) {
          const label = part.slice(0, pipeIdx).trim();
          const url = safeUrl(part.slice(pipeIdx + 1));
          return url ? { label: label || ('Attachment ' + (i + 1)), url } : null;
        }
        const url = safeUrl(part);
        return url ? { label: 'Attachment ' + (i + 1), url } : null;
      })
      .filter(Boolean);
  }

  async function fetchSiteUpdates(force) {
    if (_siteUpdatesCache && !force) return _siteUpdatesCache;
    const url = CFG.updates && CFG.updates.sheetCsvUrl;
    if (!url) {
      console.warn('[DLO] No Google Sheet CSV link configured — set window.DLO_CONFIG.updates.sheetCsvUrl in config.js');
      return _siteUpdatesCache || [];
    }
    let text;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      text = await res.text();
    } catch (e) {
      console.error('[DLO] Failed to fetch updates sheet:', e.message);
      // If a previous successful fetch exists, keep it during a temporary
      // network failure instead of replacing live headlines with empty slots.
      return _siteUpdatesCache || [];
    }

    // Google exports may prefix the first heading with a UTF-8 byte-order mark.
    const rows = parseCSV(String(text || '').replace(/^\uFEFF/, ''));
    if (!rows.length) return _siteUpdatesCache || [];
    const headers = rows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase());
    const col = {
      date: headers.indexOf('date'),
      heading: headers.indexOf('heading'),
      body: headers.indexOf('body'),
      attachments: headers.indexOf('attachments')
    };

    if (col.date < 0 || col.heading < 0 || col.body < 0) {
      console.error('[DLO] Updates sheet must include Date, Heading, and Body columns.');
      return _siteUpdatesCache || [];
    }
    if (rows.length < 2) {
      _siteUpdatesCache = [];
      return _siteUpdatesCache;
    }

    const parsed = rows.slice(1)
      .filter(r => r.some(c => String(c || '').trim() !== ''))
      .map(r => ({
        date: col.date > -1 ? (r[col.date] || '').trim() : '',
        heading: col.heading > -1 ? (r[col.heading] || '').trim() : '',
        body: col.body > -1 ? (r[col.body] || '').trim() : '',
        attachments: normalizeAttachments(col.attachments > -1 ? r[col.attachments] : '')
      }))
      .filter(u => u.heading); // a row with no heading isn't a usable update

    function dateValue(value) {
      const iso = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return Date.parse(value);
    }
    // Newest first. Dates should be entered as YYYY-MM-DD. Stable sorting
    // preserves sheet order when two updates share the same date.
    parsed.sort((a, b) => {
      const da = dateValue(a.date);
      const db = dateValue(b.date);
      const va = isNaN(da) ? -Infinity : da;
      const vb = isNaN(db) ? -Infinity : db;
      return vb - va;
    });

    _siteUpdatesCache = parsed;
    return parsed;
  }

  // ── Security: HTML escaping ──────────────────────────────────────────────
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Date helpers (IST) ───────────────────────────────────────────────────
  function nowIST() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  }

  function formatDDMMYYYY(d) {
    if (!d) return '—';
    if (typeof d === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.trim());
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const day = String(dt.getDate()).padStart(2, '0');
    const mon = String(dt.getMonth() + 1).padStart(2, '0');
    const yr = dt.getFullYear();
    return `${day}-${mon}-${yr}`;
  }

  function formatDateTimeIST(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  // ── Toast system ─────────────────────────────────────────────────────────
  let toastContainer = null;
  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'dlo-toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    Object.assign(toastContainer.style, {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: '99999',
      display: 'flex', flexDirection: 'column', gap: '10px',
      maxWidth: '360px', pointerEvents: 'none'
    });
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showToast(message, type = 'info', duration = 3800) {
    if (!(CFG.features && CFG.features.toasts)) return;
    const box = ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'dlo-toast dlo-toast--' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="dlo-toast__msg">${escapeHtml(message)}</span>`;
    Object.assign(el.style, {
      pointerEvents: 'auto', padding: '12px 16px', borderRadius: '10px',
      fontSize: '13px', fontWeight: '500', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      background: type === 'success' ? '#065f46' : type === 'error' ? '#7f1d1d' : type === 'warn' ? '#78350f' : '#1e293b',
      color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)',
      opacity: '0', transform: 'translateY(12px)', transition: 'opacity .25s, transform .25s'
    });
    box.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 280);
    }, duration);
  }

  // ── Theme persistence ────────────────────────────────────────────────────
  function getStoredTheme() {
    try {
      return localStorage.getItem((CFG.theme && CFG.theme.storageKey) || 'dlo-theme-mode');
    } catch (e) { return null; }
  }

  function setStoredTheme(mode) {
    try {
      localStorage.setItem((CFG.theme && CFG.theme.storageKey) || 'dlo-theme-mode', mode);
    } catch (e) {}
  }

  function applyTheme(mode) {
    const isLight = mode === 'light';
    const root = document.documentElement;
    const inApp = root.classList.contains('app-mode');
    if (document.body) {
      document.body.classList.toggle('light-mode', isLight);
    } else if (inApp) {
      // App only: this can run while <head> is still being parsed, before <body>
      // exists, so the saved theme used to reach <body> late and the page flashed
      // dark first. Apply it the instant <body> is created.
      const mo = new MutationObserver(() => {
        if (!document.body) return;
        document.body.classList.toggle('light-mode', isLight);
        mo.disconnect();
      });
      mo.observe(root, { childList: true });
    }
    root.setAttribute('data-theme', isLight ? 'light' : 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    // The app's header bar is navy in BOTH themes, so the status bar stays navy too
    // (it used to turn near-white in light mode above the navy header).
    if (meta) meta.content = inApp ? '#0B2545' : (isLight ? '#f8fafc' : '#020408');
    setStoredTheme(isLight ? 'light' : 'dark');
    // Keep every shared theme control in sync, including the menu popover.
    ['kToolbarTheme', 'kThemeToggle', 'appThemeToggle'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.replaceChildren(themeIconSvg(isLight));
      const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    });
    try { document.dispatchEvent(new CustomEvent('dlo:theme-changed', { detail: { mode: isLight ? 'light' : 'dark' } })); } catch (e) {}
  }

  function initTheme() {
    if (!(CFG.features && CFG.features.themeToggle)) return;
    const stored = getStoredTheme();
    const mode = stored || (CFG.theme && CFG.theme.defaultMode) || 'dark';
    applyTheme(mode);
  }

  function toggleTheme() {
    const next = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    applyTheme(next);
    showToast(next === 'light' ? 'Light theme activated' : 'Dark theme activated', 'info', 2000);
  }

  // ── Offline detection ────────────────────────────────────────────────────
  function initOfflineWatcher() {
    if (!(CFG.features && CFG.features.offlineToast)) return;
    window.addEventListener('offline', () => showToast('You are offline. Cached data may be shown.', 'warn', 5000));
    window.addEventListener('online', () => showToast('Back online. Refreshing data…', 'success', 3000));
  }

  // ── Skeleton helpers ─────────────────────────────────────────────────────
  function showSkeleton(container, rows = 6) {
    if (!container || !(CFG.features && CFG.features.skeletons)) return;
    container.setAttribute('aria-busy', 'true');
    let html = '<div class="dlo-skeleton-wrap">';
    for (let i = 0; i < rows; i++) {
      html += `<div class="dlo-skeleton-row"><div class="dlo-skeleton-bar" style="width:${70 + (i % 3) * 10}%"></div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function hideSkeleton(container) {
    if (!container) return;
    container.removeAttribute('aria-busy');
  }

  // ── Stats calculator (single source of truth for counters) ───────────────
  /**
   * @param {Array} rows – array of case objects
   * Expected fields (flexible): status, replyStatus, isExparte, nextHearing, court
   */
  function calculateStats(rows) {
    if (!Array.isArray(rows)) rows = [];
    const today = nowIST();
    today.setHours(0, 0, 0, 0);

    let total = rows.length;
    let active = 0, disposed = 0, replyFiled = 0, replyPending = 0, exparte = 0;
    let overdue = 0, hearingSoon = 0;
    const courts = new Set();
    const byType = {};
    const byCourt = {};

    rows.forEach(r => {
      const status = String(r.status || r.Status || '').toLowerCase();
      // fetchCaseDiary maps the column to r.reply; also accept legacy aliases.
      const replyRaw = String(r.reply || r.replyStatus || r.Reply || '').trim();
      const reply = replyRaw.toLowerCase();
      const court = r.court || r.Court || 'Unknown';
      const type = r.caseType || r.Type || r.type || 'Other';
      const nextH = r.nextHearing || r.NextHearing || r.hearingDate;

      courts.add(court);
      byType[type] = (byType[type] || 0) + 1;
      byCourt[court] = (byCourt[court] || 0) + 1;

      if (status.includes('dispos') || status === 'closed') disposed++;
      else active++;

      // ── Reply logic ────────────────────────────────────────────────────────
      // IMPORTANT: test "not filed" / "not" BEFORE testing "filed" so that
      // "Reply Not Filed" is never counted as filed (substring 'filed' matches
      // inside 'not filed'). Only count as pending when there is an explicit
      // negative/empty signal — do NOT count every blank as pending.
      if (reply === '' || reply === 'not filed' || reply === 'no' ||
          reply.startsWith('not') || reply.includes('pending') || reply.includes('pend')) {
        replyPending++;
      } else if (reply === 'filed' || reply === 'yes' || reply === 'done' ||
                 reply === 'reply filed' || reply.startsWith('filed') ||
                 reply.includes('filed')) {
        replyFiled++;
      }
      // Any other value (e.g. 'N/A', custom text) is not counted in either bucket.

      // ── Ex-parte ────────────────────────────────────────────────────────────
      // fetchCaseDiary maps r.exparte_status → r.exparte.
      // The DB stores the string "Ex-parte" (confirmed from causelist/hearings).
      // Also accept 'yes', 'true', 'ex parte', 'exparte' for robustness.
      const exparteVal = String(r.exparte || r.isExparte || r.Exparte || '').toLowerCase().trim();
      if (!exparteVal.includes('not') &&
          (exparteVal.includes('ex-parte') || exparteVal.includes('exparte') ||
           exparteVal.includes('ex parte') || exparteVal === 'yes' ||
           exparteVal === 'true' || exparteVal === '1')) {
        exparte++;
      }

      if (nextH) {
        const hd = new Date(nextH);
        if (!isNaN(hd.getTime())) {
          hd.setHours(0, 0, 0, 0);
          const diff = (hd - today) / 86400000;
          if (diff < 0 && !status.includes('dispos')) overdue++;
          else if (diff >= 0 && diff <= 7) hearingSoon++;
        }
      }
    });

    return {
      total, active, disposed,
      replyFiled, replyPending, exparte,
      overdue, hearingSoon,
      courtsCovered: courts.size,
      byType, byCourt,
      disposalRate: total ? Math.round((disposed / total) * 100) : 0
    };
  }

  // ── Shared Navigation: menu trigger + curtain + developer modal ──────────
  // Single source of truth for every page's destinations. Edit here only —
  // never re-type this list on an individual page.
  const MENU_ITEMS = [
    { href: 'search-filter-cases.html',    label: 'Case Search & Filter Cases' },
    { href: 'hearings.html',               label: 'Upcoming Hearings' },
    { href: 'causelist.html',              label: 'Daily Cause List' },
    { href: 'history.html',                label: 'Case History & Proceedings' },
    { href: 'performance.html',            label: 'Counsel Performance' },
    { href: 'statistics.html',             label: 'Live Statistics' },
    { href: 'analytics.html',              label: 'Analytics Dashboard' },
    { href: 'court-wise-distribution.html',label: 'Court-wise Distribution' },
    { href: 'areas-of-practice.html',      label: 'Areas of Legal Practice' },
    { href: 'latest-updates.html',         label: 'Latest Updates (Orders & Circulars)' },
    { href: 'our-officials.html',          label: 'Our Officials' },
    { href: 'public-enquiries.html',       label: 'Public Enquiries' },
    { href: 'contact.html',                label: 'Contact Us' },
    { href: 'about-office.html',           label: 'About the Office' },
    { href: 'department.html',             label: 'Departmental Login' },
    { href: 'operator.html',               label: 'Staff Login (Official 2FA)' }
  ];

  const DEV_INFO = {
    name: 'Tariq Ahmad Lone',
    role: 'Official of District Litigation Office Kupwara',
    desc: 'Designed & Developed the Case Management and Litigation Tracking Portal for DLO Kupwara.'
  };

  // ── Local Hindi / Urdu translation engine ─────────────────────────────
  // Translation is performed in-place. No Google proxy, no page navigation,
  // and no RTL layout switch are used.
  const TRANSLATION_SCRIPT = 'translations.js';
  const LANGUAGE_KEY = 'dlo-language';
  let _translationPromise = null;

  const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ur', label: 'Urdu', native: 'اردو' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' }
  ];

  function currentLanguage() {
    try { const x = localStorage.getItem(LANGUAGE_KEY); return ['en','hi','ur'].includes(x) ? x : 'en'; }
    catch (e) { return 'en'; }
  }

  function translationPageKey() {
    const file = currentPageFile();
    const map = {
      'index.html':'index','404.html':'404','about-office.html':'about-office',
      'areas-of-practice.html':'areas-of-practice','search-filter-cases.html':'search-filter-cases',
      'statistics.html':'statistics','analytics.html':'analytics',
      'court-wise-distribution.html':'court-wise-distribution','history.html':'history',
      'causelist.html':'causelist','public-enquiries.html':'public-enquiries',
      'latest-updates.html':'latest-updates','contact.html':'contact',
      'our-officials.html':'our-officials','offline.html':'offline','operator.html':'operator',
      'department.html':'department','performance.html':'performance','hearings.html':'hearings'
    };
    return map[file] || file.replace(/\\.html?$/i,'');
  }

  function translationLookup(key, page) {
    if (!window.DLO_TRANSLATIONS) return null;
    const clean = String(key || '').trim();
    // Normalize whitespace so punctuation/spacing differences still match
    const collapsed = clean.replace(/\s+/g, ' ').trim();
    const noEndPunct = collapsed.replace(/[.!?।]+$/u, '').trim();
    const variants = [];
    [clean, collapsed, noEndPunct].forEach(v => {
      if (v && variants.indexOf(v) === -1) variants.push(v);
    });
    const pd = page && window.DLO_TRANSLATIONS.pages && window.DLO_TRANSLATIONS.pages[page];
    const cd = window.DLO_TRANSLATIONS.common || {};
    for (const v of variants) {
      if (pd && pd[v]) return pd[v];
      if (cd[v]) return cd[v];
    }
    // Last resort: scan dictionaries with collapsed whitespace equality
    const matchCollapsed = (dict) => {
      if (!dict) return null;
      const keys = Object.keys(dict);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k.replace(/\s+/g, ' ').trim() === collapsed) return dict[k];
      }
      return null;
    };
    return matchCollapsed(pd) || matchCollapsed(cd) || null;
  }

  function translateKey(key, lang, page) {
    if (lang === 'en') return key;
    const entry = translationLookup(key, page);
    return entry && entry[lang] ? entry[lang] : key;
  }

  function loadTranslations() {
    if (window.DLO_TRANSLATIONS) return Promise.resolve(true);
    if (_translationPromise) return _translationPromise;
    _translationPromise = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = TRANSLATION_SCRIPT + '?v=20261006';
      s.onload = () => resolve(!!window.DLO_TRANSLATIONS);
      s.onerror = () => { console.error('[DLO] translations.js could not be loaded'); resolve(false); };
      document.head.appendChild(s);
    });
    return _translationPromise;
  }

  function restoreOriginalText(root) {
    root.querySelectorAll('[data-dlo-original-title-text]').forEach(el => {
      document.title = el.getAttribute('data-dlo-original-title-text');
      el.removeAttribute('data-dlo-original-title-text');
    });
    // Restore all saved attributes (stored as JSON map on the element)
    root.querySelectorAll('[data-dlo-original-attrs]').forEach(el => {
      try {
        const saved = JSON.parse(el.getAttribute('data-dlo-original-attrs'));
        Object.keys(saved).forEach(name => el.setAttribute(name, saved[name]));
      } catch (e) {}
      el.removeAttribute('data-dlo-original-attrs');
    });
    // Legacy single-attribute restore (backward compat)
    root.querySelectorAll('[data-dlo-original-attr]').forEach(el => {
      const name = el.getAttribute('data-dlo-original-attr-name');
      const value = el.getAttribute('data-dlo-original-attr');
      if (name) el.setAttribute(name, value);
      el.removeAttribute('data-dlo-original-attr');
      el.removeAttribute('data-dlo-original-attr-name');
    });
    root.querySelectorAll('*').forEach(el => {
      if (el.__dloOriginalTextNodes) {
        el.__dloOriginalTextNodes.forEach(pair => { if (pair[0]) pair[0].nodeValue = pair[1]; });
        el.__dloOriginalTextNodes = null;
      }
    });
  }

  function applyLanguage(lang, options) {
    if (!['en','hi','ur'].includes(lang)) lang = 'en';
    const root = document.body || document.documentElement;
    const page = translationPageKey();
    restoreOriginalText(root);

    // Always preserve the site's physical LTR layout, including Urdu.
    document.documentElement.dir = 'ltr';
    document.documentElement.style.direction = 'ltr';
    document.documentElement.style.writingMode = 'horizontal-tb';
    document.body.dir = 'ltr';
    document.body.style.direction = 'ltr';
    document.body.style.writingMode = 'horizontal-tb';

    if (lang !== 'en') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(node => {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|CODE|PRE)$/.test(parent.tagName)) return;
        if (parent.closest('[data-dlo-no-translate], script, style, noscript, template, code, pre')) return;
        const source = node.nodeValue;
        if (!source || !source.trim()) return;
        const key = source.trim();
        const translated = translateKey(key, lang, page);
        if (translated !== key) {
          parent.__dloOriginalTextNodes = parent.__dloOriginalTextNodes || [];
          parent.__dloOriginalTextNodes.push([node, source]);
          // Preserve leading/trailing whitespace; replace only the trimmed core once
          const leading = source.match(/^\s*/)[0];
          const trailing = source.match(/\s*$/)[0];
          node.nodeValue = leading + translated + trailing;
        }
      });

      // Save ALL translatable attributes per element in a single JSON blob,
      // so switching Urdu → Hindi → English restores correctly (no leakage).
      const ATTR_NAMES = ['title', 'placeholder', 'aria-label', 'alt', 'value', 'aria-description'];
      root.querySelectorAll(ATTR_NAMES.map(a => `[${a}]`).join(',')).forEach(el => {
        const saved = {};
        let anyTranslated = false;
        ATTR_NAMES.forEach(name => {
          if (!el.hasAttribute(name)) return;
          const source = el.getAttribute(name);
          if (!source || !source.trim()) return;
          const translated = translateKey(source.trim(), lang, page);
          if (translated !== source.trim()) {
            saved[name] = source;
            el.setAttribute(name, translated);
            anyTranslated = true;
          }
        });
        if (anyTranslated) {
          el.setAttribute('data-dlo-original-attrs', JSON.stringify(saved));
        }
      });

      const titleKey = document.title.trim();
      const titleTranslation = translateKey(titleKey, lang, page);
      if (titleTranslation !== titleKey) {
        document.documentElement.setAttribute('data-dlo-original-title-text', titleKey);
        document.title = titleTranslation;
      }
    }
    updateLanguageControls(lang);
    // Notify pages that language has been applied (e.g. carousel re-checks active slide)
    try { document.dispatchEvent(new CustomEvent('dlo:language-applied', { detail: { lang } })); } catch (e) {}
  }

  function updateLanguageControls(lang) {
    document.querySelectorAll('[data-dlo-language-option]').forEach(btn => {
      const active = btn.getAttribute('data-dlo-language-option') === lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function setLanguage(lang) {
    return loadTranslations().then(ok => {
      if (!ok) return false;
      try { localStorage.setItem(LANGUAGE_KEY, lang); } catch (e) {}
      applyLanguage(lang);
      return true;
    });
  }

  function reapplyLanguage() {
    applyLanguage(currentLanguage());
  }

  function initLanguage() {
    loadTranslations().then(ok => { if (ok) applyLanguage(currentLanguage(), {silent:true}); });
  }

  function initTranslationObserver() {
    const root = document.body;
    if (!root || root.__dloTranslationObserver) return;
    let running = false;
    const observer = new MutationObserver(() => {
      if (running || currentLanguage() === 'en') return;
      running = true;
      observer.disconnect();
      applyLanguage(currentLanguage(), {silent:true});
      observer.observe(root, {childList:true, subtree:true});
      running = false;
    });
    observer.observe(root, {childList:true, subtree:true});
    root.__dloTranslationObserver = observer;
  }

  const FONT_SIZES = [
    { key: 'small', label: 'Small', pct: 87.5 },
    { key: 'default', label: 'Default', pct: 100 },
    { key: 'medium', label: 'Medium', pct: 112.5 },
    { key: 'large', label: 'Large', pct: 125 }
  ];
  const FONT_SIZE_KEY = 'dlo-font-size';

  function getStoredFontSize() {
    try { return localStorage.getItem(FONT_SIZE_KEY) || 'default'; } catch (e) { return 'default'; }
  }
  function applyFontSize(key) {
    const entry = FONT_SIZES.find(s => s.key === key) || FONT_SIZES[1];
    document.documentElement.style.fontSize = entry.pct + '%';
    try { localStorage.setItem(FONT_SIZE_KEY, entry.key); } catch (e) {}
  }
  // Applied immediately (not gated behind DOMContentLoaded) so text doesn't
  // visibly jump size after first paint on a return visit.
  applyFontSize(getStoredFontSize());

  const APP_NAV_ITEMS = [
    { file: 'app.html', label: 'Home', icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
    { file: 'causelist.html', label: 'Cause List', icon: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h6"/>' },
    { file: 'search-filter-cases.html', label: 'Cases', icon: '<path d="M4 6h16M4 12h16M4 18h10"/>' },
    { file: 'hearings.html', label: 'Hearings', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/>' },
    { file: 'history.html', label: 'History', icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/>' },
    { action: 'more', label: 'More', icon: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>' }
  ];

  function appNavigationUrl(file) {
    const url = new URL(file, new URL('./', global.location.href));
    url.searchParams.set('app', '1');
    return url.href;
  }

  function initAppShellNavigation() {
    if (!document.documentElement.classList.contains('app-mode') || !document.body) return;
    document.body.classList.add('app-mode');
    const current = currentPageFile();
    let existing = document.getElementById('appTabbar');
    // Only the app home page (app.html, which contains #appHome) owns a hard-coded
    // tab bar. Sub-pages such as hearings.html and history.html still carry an old
    // website-era copy of it (Home · Cases · Hearings · History · Contact), which
    // used to take over and replace the app bar. Remove that stale copy so every
    // sub-page uses the one standard app bar built below. (App mode only: this
    // function returns early for normal website visits.)
    if (existing && !document.getElementById('appHome')) {
      existing.remove();
      existing = null;
    }
    if (existing) {
      if (!document.getElementById('appHome')) {
        document.body.classList.add('dlo-app-subpage');
      }
      existing.setAttribute('aria-hidden', 'false');
      existing.querySelectorAll('a').forEach(link => {
        const url = new URL(link.href, global.location.href);
        url.searchParams.set('app', '1');
        link.href = url.href;
        const active = url.pathname.split('/').pop() === current;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      const more = existing.querySelector('#appMoreTab');
      if (more && !more.dataset.bound) {
        more.dataset.bound = 'true';
        more.addEventListener('click', openAppMoreMenu);
      }
      return;
    }

    document.body.classList.add('dlo-app-subpage');
    if (document.querySelector('.dlo-app-bottom-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'dlo-app-bottom-nav';
    nav.setAttribute('aria-label', 'App navigation');
    APP_NAV_ITEMS.forEach(item => {
      const link = document.createElement(item.action === 'more' ? 'button' : 'a');
      if (item.action === 'more') {
        link.type = 'button';
        link.addEventListener('click', openAppMoreMenu);
      } else {
        link.href = appNavigationUrl(item.file);
      }
      link.className = item.file === current ? 'active' : '';
      link.setAttribute('aria-label', item.label);
      if (item.file === current) link.setAttribute('aria-current', 'page');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = item.icon;
      const text = document.createElement('span');
      text.textContent = item.label;
      link.append(svg, text);
      nav.appendChild(link);
    });
    document.body.appendChild(nav);
  }

  function openAppMoreMenu() {
    if (typeof global.DLOOpenMenu === 'function') global.DLOOpenMenu();
    else global.location.assign(appNavigationUrl('index.html'));
  }

  const _appPrefetchedPages = new Set();
  function primeAppPage(value) {
    if (!document.documentElement.classList.contains('app-mode')) return;
    try {
      const url = new URL(value, global.location.href);
      if (url.origin !== global.location.origin || !/\.html$/i.test(url.pathname)) return;
      if (/\b(operator|department)\.html$/i.test(url.pathname)) return;
      if (url.pathname === global.location.pathname) return;
      url.searchParams.set('app', '1');
      if (_appPrefetchedPages.has(url.href)) return;
      _appPrefetchedPages.add(url.href);
      const hint = document.createElement('link');
      hint.rel = 'prefetch';
      hint.as = 'document';
      hint.href = url.href;
      document.head.appendChild(hint);
    } catch (e) {}
  }

  function initAppNavigationSpeedups() {
    if (!document.documentElement.classList.contains('app-mode')) return;
    document.querySelectorAll('#appTabbar a, .dlo-app-bottom-nav a, .app-action-card[href]').forEach(link => primeAppPage(link.href));
    document.addEventListener('pointerover', event => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (link) primeAppPage(link.href);
    }, { passive: true });
    document.addEventListener('touchstart', event => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (link) primeAppPage(link.href);
    }, { passive: true });
    document.addEventListener('click', event => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download')) return;
      try {
        const url = new URL(link.href, global.location.href);
        if (url.origin !== global.location.origin || !/\.html$/i.test(url.pathname)) return;
        url.searchParams.set('app', '1');
        link.href = url.href;
        if (link.closest('#appTabbar, .dlo-app-bottom-nav') && url.pathname === global.location.pathname) {
          event.preventDefault();
          return;
        }
        document.documentElement.classList.add('app-navigating');
        if (link.closest('#appTabbar, .dlo-app-bottom-nav')) {
          event.preventDefault();
          global.location.assign(url.href);
        }
      } catch (e) {}
    }, true);
    global.addEventListener('pageshow', () => document.documentElement.classList.remove('app-navigating'));
    global.addEventListener('pagehide', () => document.documentElement.classList.remove('app-navigating'));
  }

  function currentPageFile() {
    const path = window.location.pathname;
    const last = path.substring(path.lastIndexOf('/') + 1);
    return last === '' ? 'index.html' : last;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(k => {
        if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }

  function themeIconSvg(isLight) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (isLight) {
      // Moon (switch TO dark)
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
      svg.appendChild(path);
    } else {
      // Sun (switch TO light)
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '4.2');
      svg.appendChild(c);
      [[12,2,12,4.5],[12,19.5,12,22],[2,12,4.5,12],[19.5,12,22,12],
       [4.9,4.9,6.6,6.6],[17.4,17.4,19.1,19.1],[4.9,19.1,6.6,17.4],[17.4,6.6,19.1,4.9]]
        .forEach(([x1,y1,x2,y2]) => {
          const l = document.createElementNS(ns, 'line');
          l.setAttribute('x1', x1); l.setAttribute('y1', y1);
          l.setAttribute('x2', x2); l.setAttribute('y2', y2);
          svg.appendChild(l);
        });
    }
    return svg;
  }

  function homeIconSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const p1 = document.createElementNS(ns, 'path');
    p1.setAttribute('d', 'M3 11l9-8 9 8');
    const p2 = document.createElementNS(ns, 'path');
    p2.setAttribute('d', 'M5 10v10h5v-6h4v6h5V10');
    svg.appendChild(p1); svg.appendChild(p2);
    return svg;
  }

  function searchIconSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '11'); c.setAttribute('cy', '11'); c.setAttribute('r', '7');
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', '21'); l.setAttribute('y1', '21'); l.setAttribute('x2', '16.65'); l.setAttribute('y2', '16.65');
    svg.appendChild(c); svg.appendChild(l);
    return svg;
  }

  function globeIconSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '9');
    const e1 = document.createElementNS(ns, 'ellipse');
    e1.setAttribute('cx', '12'); e1.setAttribute('cy', '12'); e1.setAttribute('rx', '4'); e1.setAttribute('ry', '9');
    const l1 = document.createElementNS(ns, 'line');
    l1.setAttribute('x1', '3'); l1.setAttribute('y1', '12'); l1.setAttribute('x2', '21'); l1.setAttribute('y2', '12');
    svg.appendChild(c); svg.appendChild(e1); svg.appendChild(l1);
    return svg;
  }

  function infoIconSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '9');
    const line1 = document.createElementNS(ns, 'line');
    line1.setAttribute('x1', '12'); line1.setAttribute('y1', '11');
    line1.setAttribute('x2', '12'); line1.setAttribute('y2', '16');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', '12'); dot.setAttribute('cy', '7.5'); dot.setAttribute('r', '0.6');
    dot.setAttribute('fill', 'currentColor');
    svg.appendChild(circle); svg.appendChild(line1); svg.appendChild(dot);
    return svg;
  }

  let menuInjected = false;

  function injectMenu() {
    // The menu is injected into <body>. If a page calls injectMenu() before
    // <body> exists, defer it until DOMContentLoaded instead of failing.
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', injectMenu, { once: true });
      return;
    }

    // Opt-out for security-sensitive, distraction-free surfaces (e.g. the
    // staff 2FA login page) — set before common.js runs:
    //   <script>window.DLO_NO_MENU = true;</script>
    if (global.DLO_NO_MENU) return;
    if (menuInjected || document.getElementById('kCurtain')) return;
    menuInjected = true;

    const currentFile = currentPageFile();
    const appActionSlot = document.documentElement.classList.contains('app-mode')
      ? document.querySelector('#appTopbar .at-actions')
      : null;

    // ── Trigger button ──
    const lines = el('span', { class: 'k-menu-lines' }, [
      el('span'), el('span'), el('span')
    ]);
    const trigger = el('button', {
      type: 'button', id: 'kMenuTrigger', class: 'k-menu-trigger',
      'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'kCurtain',
      'aria-label': 'Open menu'
    }, [lines, el('span', { class: 'k-menu-label', text: 'Menu' })]);

    // ── Search button — links straight to the case-search page ──
    const searchBtn = el('a', {
      href: 'search-filter-cases.html', class: 'k-toolbar-btn',
      'aria-label': 'Search cases', title: 'Search cases'
    }, [searchIconSvg()]);

    // ── Theme toggle in toolbar ──
    const toolbarThemeBtn = el('button', {
      type: 'button', id: 'kToolbarTheme', class: 'k-toolbar-btn',
      'aria-label': document.body.classList.contains('light-mode') ? 'Switch to dark theme' : 'Switch to light theme',
      title: document.body.classList.contains('light-mode') ? 'Switch to dark theme' : 'Switch to light theme',
      'aria-pressed': document.body.classList.contains('light-mode') ? 'true' : 'false'
    }, [themeIconSvg(document.body.classList.contains('light-mode'))]);
    toolbarThemeBtn.addEventListener('click', () => {
      toggleTheme();
    });

    // ── Generic small popover used by both Language and Size ──
    function buildPopoverButton(opts) {
      const btn = el('button', {
        type: 'button', class: 'k-toolbar-btn k-lang-btn', 'aria-haspopup': 'true',
        'aria-expanded': 'false', 'aria-label': opts.label, title: opts.label
      }, [opts.icon()]);
      const pop = el('div', { class: 'k-popover k-lang-popover', role: 'menu' });
      if (opts.markLanguage) pop.classList.add('k-lang-menu');
      const currentLang = currentLanguage();
      opts.items.forEach(item => {
        const isLangItem = !!(opts.markLanguage && item.code);
        const optBtn = el('button', {
          type: 'button',
          class: 'k-popover-item' + (isLangItem && item.code === currentLang ? ' active' : ''),
          role: isLangItem ? 'menuitemradio' : 'menuitem'
        }, [
          el('span', { class: 'k-popover-item-main', text: item.main }),
          item.sub ? el('span', { class: 'k-popover-item-sub', text: item.sub }) : el('span')
        ]);
        if (isLangItem) {
          optBtn.setAttribute('data-dlo-language-option', item.code);
          optBtn.setAttribute('aria-checked', item.code === currentLang ? 'true' : 'false');
        }
        optBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onSelect(item);
          if (isLangItem) {
            pop.querySelectorAll('[data-dlo-language-option]').forEach(b => {
              const on = b.getAttribute('data-dlo-language-option') === item.code;
              b.classList.toggle('active', on);
              b.setAttribute('aria-checked', on ? 'true' : 'false');
            });
            // Show active language code on the toolbar button title
            btn.title = 'Language: ' + item.main;
            btn.setAttribute('aria-label', 'Language: ' + item.main);
          }
          closePop();
        });
        pop.appendChild(optBtn);
      });
      if (opts.markLanguage) {
        const cur = LANGUAGES.find(l => l.code === currentLang);
        if (cur) {
          btn.title = 'Language: ' + cur.native;
          btn.setAttribute('aria-label', 'Language: ' + cur.native);
        }
      }
      function openPop() {
        document.querySelectorAll('.k-popover.open').forEach(p => { if (p !== pop) p.classList.remove('open'); });
        pop.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        // Pause carousel while popover is open
        if (typeof global.slideTimerPause === 'function') global.slideTimerPause();
      }
      function closePop() {
        pop.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        // Resume carousel when popover closes (only if menu is also closed)
        const curtainOpen = document.getElementById('kCurtain') &&
                            document.getElementById('kCurtain').classList.contains('open');
        if (!curtainOpen && typeof global.slideTimerResume === 'function') global.slideTimerResume();
      }
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        pop.classList.contains('open') ? closePop() : openPop();
      });
      document.addEventListener('click', (e) => {
        if (!pop.contains(e.target) && e.target !== btn) closePop();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
      return { btn, pop };
    }

    const langWidget = buildPopoverButton({
      label: 'Language / भाषा / زبان',
      icon: globeIconSvg,
      items: LANGUAGES.map(l => ({
        main: l.native,
        sub: l.code === 'en' ? 'Default' : l.label,
        code: l.code,
        isLang: true
      })),
      onSelect: (item) => { setLanguage(item.code); },
      markLanguage: true
    });

    const sizeWidget = buildPopoverButton({
      label: 'Text size',
      icon: () => el('span', { class: 'k-size-icon', text: 'A' }),
      items: FONT_SIZES.map(s => ({ main: s.label, sub: '', key: s.key })),
      onSelect: (item) => applyFontSize(item.key)
    });

    const langWrap = el('div', { class: 'k-toolbar-item' }, [langWidget.btn, langWidget.pop]);
    const sizeWrap = el('div', { class: 'k-toolbar-item' }, [sizeWidget.btn, sizeWidget.pop]);

    // ── Home button — shown on every page except index.html ──
    const isHomePage = (currentFile === 'index.html' || currentFile === '');
    const homeBtn = el('a', {
      href: 'index.html', class: 'k-toolbar-btn',
      'aria-label': 'Home', title: 'Home'
    }, [homeIconSvg()]);

    // Order: [home?] search language text-size theme menu
    const toolbarChildren = appActionSlot
      ? [searchBtn, langWrap, sizeWrap, toolbarThemeBtn]
      : isHomePage
        ? [searchBtn, langWrap, sizeWrap, toolbarThemeBtn, trigger]
        : [homeBtn, searchBtn, langWrap, sizeWrap, toolbarThemeBtn, trigger];

    const toolbar = el('div', { class: 'k-toolbar' }, toolbarChildren);

    // ── Grouped menu links ──
    // Four groups: Casework | Performance & Data | Office & Public | Secure Access
    const NAV_GROUPS = [
      {
        label: 'Casework',
        items: [
          { href: 'search-filter-cases.html',  label: 'Search Cases' },
          { href: 'hearings.html',             label: 'Upcoming Hearings' },
          { href: 'causelist.html',            label: 'Daily Cause List' },
          { href: 'history.html',              label: 'Case History & Proceedings' },
          { href: 'latest-updates.html',       label: 'Latest Updates (Orders & Circulars)' }
        ]
      },
      {
        label: 'Performance & Data',
        items: [
          { href: 'performance.html',            label: 'Counsel Performance' },
          { href: 'statistics.html',             label: 'Live Statistics' },
          { href: 'analytics.html',              label: 'Analytics Dashboard' },
          { href: 'court-wise-distribution.html',label: 'Court-wise Distribution' }
        ]
      },
      {
        label: 'Office & Public Information',
        items: [
          { href: 'areas-of-practice.html',  label: 'Areas of Legal Practice' },
          { href: 'our-officials.html',       label: 'Our Officials' },
          { href: 'public-enquiries.html',    label: 'Public Enquiries' },
          { href: 'contact.html',             label: 'Contact Us' },
          { href: 'about-office.html',        label: 'About the Office' }
        ]
      },
      {
        label: 'Secure Access',
        items: [
          { href: 'department.html', label: 'Departmental Login' },
          { href: 'operator.html',   label: 'Staff Login (Official 2FA)' }
        ]
      }
    ];

    // Build body: grid of group columns
    const bodyChildren = [];
    NAV_GROUPS.forEach(group => {
      const list = el('ul', { class: 'k-curtain-list' });
      group.items.forEach(item => {
        const isCurrent = item.href === currentFile;
        const link = el('a', {
          class: 'k-curtain-link',
          href: item.href
        }, [el('span', { text: item.label })]);
        if (isCurrent) {
          link.setAttribute('aria-current', 'page');
          link.removeAttribute('href');
          link.setAttribute('role', 'link');
          link.setAttribute('aria-disabled', 'true');
          link.setAttribute('tabindex', '-1');
        }
        list.appendChild(el('li', { class: 'k-curtain-item' }, [link]));
      });

      // Fallback click handler for touch/PWA browsers
      list.addEventListener('click', (e) => {
        const link = e.target.closest('.k-curtain-link');
        if (!link || link.getAttribute('aria-disabled') === 'true') return;
        const href = link.getAttribute('href');
        if (!href) return;
        if (e.defaultPrevented) {
          e.stopPropagation();
          window.location.assign(href);
        }
      }, true);

      const groupEl = el('div', { class: 'k-nav-group' }, [
        el('span', { class: 'k-nav-group-label', text: group.label }),
        list
      ]);
      bodyChildren.push(groupEl);
    });

    const body = el('div', { class: 'k-curtain-body' }, bodyChildren);

    // ── Install App button (inside curtain footer) ──
    const installBtnIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/></svg>`;
    const installBtn = el('button', {
      type: 'button', id: 'kMenuInstallBtn', class: 'k-curtain-install-btn',
      'aria-label': 'Install DLO Kupwara Web App'
    });
    installBtn.innerHTML = installBtnIcon + '<span id="kMenuInstallLabel">Install App</span>';

    // ── Developer info icon (in footer) ──
    const devIcon = el('button', {
      type: 'button', class: 'k-dev-icon', id: 'kDevIcon',
      'aria-label': 'About the developer', title: 'About the developer'
    }, [infoIconSvg()]);

    const footer = el('div', { class: 'k-curtain-footer' }, [devIcon, installBtn]);

    const closeBtn = el('button', {
      type: 'button', class: 'k-curtain-close', id: 'kCurtainClose'
    }, [document.createTextNode('Close')]);

    const menuThemeIsLight = document.body.classList.contains('light-mode');
    const themeBtn = el('button', {
      type: 'button', class: 'k-theme-toggle', id: 'kThemeToggle',
      'aria-label': menuThemeIsLight ? 'Switch to dark theme' : 'Switch to light theme',
      title: menuThemeIsLight ? 'Switch to dark theme' : 'Switch to light theme',
      'aria-pressed': menuThemeIsLight ? 'true' : 'false'
    }, [themeIconSvg(menuThemeIsLight)]);

    const topbar = el('div', { class: 'k-curtain-topbar' }, [
      el('span', { class: 'k-curtain-brand', text: 'DLO Kupwara' }),
      el('div', { class: 'k-curtain-topbar-actions' }, [themeBtn, closeBtn])
    ]);

    const curtain = el('div', {
      id: 'kCurtain', class: 'k-curtain', role: 'dialog',
      'aria-modal': 'true', 'aria-label': 'Site menu'
    }, [topbar, body, footer]);

    // ── Developer modal ──
    const modalClose = el('button', { type: 'button', class: 'k-modal-close', 'aria-label': 'Close' }, [document.createTextNode('✕')]);
    const modalCard = el('div', { class: 'k-modal-card' }, [
      modalClose,
      el('div', { class: 'k-dev-eyebrow', text: 'Developer Information' }),
      el('h3', { class: 'k-dev-name', text: DEV_INFO.name }),
      el('p', { class: 'k-dev-role', text: DEV_INFO.role }),
      el('p', { class: 'k-dev-desc', text: DEV_INFO.desc })
    ]);
    const modal = el('div', {
      id: 'kDevModal', class: 'k-modal-overlay', role: 'dialog',
      'aria-modal': 'true', 'aria-label': 'About the developer'
    }, [modalCard]);

    if (appActionSlot) {
      // On the installed home screen, share the same working toolbar controls
      // inside the branded app header instead of layering two button rows.
      appActionSlot.classList.add('k-toolbar');
      appActionSlot.replaceChildren(...toolbarChildren);
    } else {
      // The public homepage uses a full-height editorial hero. Keep its tools
      // inside the dark text panel so they do not create a separate header row.
      // Other pages retain the shared toolbar at the top of the document.
      const homePanel = isHomePage && document.querySelector('#editorialPanel');
      if (homePanel) {
        homePanel.prepend(toolbar);
      } else if (isHomePage) {
        // index.html invokes this component while the parser is still building
        // the page, so the hero panel may not exist yet. Place the toolbar as
        // soon as the page structure is ready instead of leaving it in a row.
        document.body.insertBefore(toolbar, document.body.firstChild);
        const moveToolbarToHero = () => {
          const panel = document.querySelector('#editorialPanel');
          if (panel && toolbar.isConnected) panel.prepend(toolbar);
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', moveToolbarToHero, { once: true });
        } else {
          moveToolbarToHero();
        }
      } else {
        document.body.insertBefore(toolbar, document.body.firstChild);
      }
    }
    document.body.appendChild(curtain);
    try { injectSiteChrome(); } catch (e) {}

    document.body.appendChild(modal);

    // ── Curtain open/close with focus management and carousel pause ──
    function openCurtain() {
      curtain.classList.add('open');
      trigger.classList.add('is-active');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      document.documentElement.classList.add('menu-open');
      document.body.classList.add('menu-open');
      // Focus first link in curtain
      const firstLink = curtain.querySelector('.k-curtain-link:not([aria-disabled="true"])');
      if (firstLink) { setTimeout(() => firstLink.focus(), 60); }
      // Pause homepage carousel if present
      if (typeof global.slideTimerPause === 'function') global.slideTimerPause();
      document.dispatchEvent(new CustomEvent('dlo:menu-open'));
    }
    function closeCurtain() {
      curtain.classList.remove('open');
      trigger.classList.remove('is-active');
      trigger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      document.documentElement.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      // Return focus to the trigger button
      trigger.focus();
      // Resume homepage carousel
      if (typeof global.slideTimerResume === 'function') global.slideTimerResume();
      document.dispatchEvent(new CustomEvent('dlo:menu-close'));
    }
    function toggleCurtainFn() {
      if (curtain.classList.contains('open')) closeCurtain(); else openCurtain();
    }
    function openDevModal() { modal.classList.add('open'); }
    function closeDevModal() { modal.classList.remove('open'); }

    trigger.addEventListener('click', toggleCurtainFn);
    global.DLOOpenMenu = toggleCurtainFn;
    closeBtn.addEventListener('click', closeCurtain);
    themeBtn.addEventListener('click', () => {
      toggleTheme();
      // The editorial menu remains white in both themes by design. Close it
      // after switching so the visitor immediately sees the changed page.
      closeCurtain();
    });
    devIcon.addEventListener('click', openDevModal);
    modalClose.addEventListener('click', closeDevModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeDevModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (modal.classList.contains('open')) closeDevModal();
      else if (curtain.classList.contains('open')) closeCurtain();
    });
    // Trap Tab inside curtain when open
    curtain.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !curtain.classList.contains('open')) return;
      const focusable = Array.from(curtain.querySelectorAll(
        'a[href]:not([aria-disabled="true"]), button:not([disabled]), [tabindex="0"]'
      )).filter(el => !el.closest('[aria-hidden="true"]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // ── PWA install button inside curtain ──
    (function wireInstallBtn() {
      function isStandalone() {
        try {
          if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
          if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
          if (navigator.standalone === true) return true;
          if (/(?:\?|&)app=1(?:&|$)/.test(location.search || '')) return true;
          if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
        } catch(e) {}
        return false;
      }
      if (isStandalone()) return;

      const label = document.getElementById('kMenuInstallLabel');
      let deferredPrompt = null;
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');

      function showInstallBtn(text) {
        if (text && label) label.textContent = text;
        installBtn.classList.add('k-install-visible');
      }

      // Keep the install action in the menu on every browser. If the browser
      // does not provide a native install prompt, its click handler explains
      // the manual install steps instead.
      showInstallBtn(isIOS ? 'Add to Home Screen' : 'Install App');

      window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBtn('Install App');
      });
      window.addEventListener('appinstalled', function() {
        deferredPrompt = null;
        installBtn.classList.remove('k-install-visible');
      });

      installBtn.addEventListener('click', function() {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function(choice) {
            if (choice && choice.outcome === 'accepted') {
              installBtn.classList.remove('k-install-visible');
            }
            deferredPrompt = null;
          }).catch(function() { deferredPrompt = null; });
          return;
        }
        if (isIOS) {
          if (window.DLO && DLO.showToast) DLO.showToast('Share → Add to Home Screen', 'info', 6000);
          return;
        }
        const isAndroid = /android/i.test(navigator.userAgent || '');
        const msg = isAndroid
          ? 'Open the Chrome menu (⋮) → "Install app" or "Add to Home screen".'
          : 'Open the browser menu → "Install app".';
        if (window.DLO && DLO.showToast) DLO.showToast(msg, 'info', 7000);
      });
    })();

    // Exposed for any legacy inline handlers left on a page during migration.
    global.toggleCurtain = toggleCurtainFn;
    global.openDeveloperModal = openDevModal;
    global.closeDeveloperModal = closeDevModal;
  }

  // ── Service Worker registration helper ───────────────────────────────────
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
      let reloadedForUpdate = false;
      const formStateAtLoad = Array.from(document.querySelectorAll(
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select'
      )).map(field => ({
        field,
        value: field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value
      }));

      function isAppWindow() {
        return document.documentElement.classList.contains('app-mode') ||
          Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          navigator.standalone === true;
      }

      function hasUnsubmittedDraft() {
        return formStateAtLoad.some(({ field, value }) => {
          const current = field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value;
          return current !== value;
        });
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadControllerAtStart) return;
        if (isAppWindow() && !hasUnsubmittedDraft() && !reloadedForUpdate) {
          reloadedForUpdate = true;
          window.location.reload();
          return;
        }
        showToast(
          isAppWindow()
            ? 'A new version is ready. Finish your entry, then reopen the app.'
            : 'This page has updated. Reload it to see the latest version.',
          'info',
          7000
        );
      }, { once: true });

      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
        // Check for the latest worker whenever the page opens; an active app
        // window refreshes itself after takeover only when no form draft is at risk.
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────

  // ── Site chrome: skip link, policy footer, floating “up” policy panel ──
  function injectSiteChrome() {
    if (typeof document === 'undefined' || !document.body) {
      document.addEventListener('DOMContentLoaded', injectSiteChrome, { once: true });
      return;
    }
    if (document.getElementById('dlo-site-chrome-style')) return;

    const style = document.createElement('style');
    style.id = 'dlo-site-chrome-style';
    style.textContent = `
      .dlo-skip-link{
        position:absolute;left:-9999px;top:0;z-index:100000;
        background:#0B2545;color:#fff;padding:10px 16px;font-weight:700;
        font-family:system-ui,sans-serif;font-size:14px;text-decoration:none;
        border-radius:0 0 8px 0;
      }
      .dlo-skip-link:focus{
        left:0;outline:3px solid #C9A84C;outline-offset:2px;
      }
      footer .footer-inner.dlo-footer-enhanced{
        display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center;
      }
      .dlo-footer-owner{
        font-size:12px;line-height:1.55;opacity:.9;max-width:720px;
      }
      .dlo-footer-policies{
        display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;
        font-size:12px;
      }
      .dlo-footer-policies a{
        color:inherit;text-decoration:underline;text-underline-offset:2px;opacity:.92;
      }
      .dlo-footer-policies a:hover{opacity:1}

      /* Centered floating policies control */
      #dlo-fab-wrap{
        position:fixed;left:50%;bottom:22px;z-index:9990;
        transform:translateX(-50%);
        display:flex;flex-direction:column;align-items:center;gap:12px;
        font-family:system-ui,-apple-system,sans-serif;
        pointer-events:none;
      }
      #dlo-fab-wrap > *{pointer-events:auto}
      #dlo-fab-panel{
        width:min(300px,calc(100vw - 32px));
        background:linear-gradient(165deg,#0B2545 0%,#0a1c34 100%);
        color:#f1f5f9;border:1px solid rgba(201,168,76,.45);
        border-radius:16px;padding:14px 12px 12px;
        box-shadow:0 18px 48px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.04) inset;
        opacity:0;visibility:hidden;
        transform:translateY(16px) scale(0.94);
        transition:opacity .28s ease,transform .32s cubic-bezier(.16,1,.3,1),visibility .28s;
        transform-origin:bottom center;
      }
      #dlo-fab-panel.open{
        opacity:1;visibility:visible;
        transform:translateY(0) scale(1);
      }
      #dlo-fab-panel h4{
        margin:0 0 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
        color:#E0C083;font-weight:700;text-align:center;
      }
      #dlo-fab-panel a{
        display:block;padding:9px 12px;margin:3px 0;border-radius:10px;
        color:#e8eef7;text-decoration:none;font-size:13px;font-weight:600;
        opacity:0;transform:translateY(8px);
        transition:background .18s ease,color .18s ease,opacity .25s ease,transform .28s cubic-bezier(.16,1,.3,1);
      }
      #dlo-fab-panel.open a{
        opacity:1;transform:translateY(0);
      }
      #dlo-fab-panel.open a:nth-child(2){transition-delay:.04s}
      #dlo-fab-panel.open a:nth-child(3){transition-delay:.07s}
      #dlo-fab-panel.open a:nth-child(4){transition-delay:.1s}
      #dlo-fab-panel.open a:nth-child(5){transition-delay:.13s}
      #dlo-fab-panel.open a:nth-child(6){transition-delay:.16s}
      #dlo-fab-panel.open a:nth-child(7){transition-delay:.19s}
      #dlo-fab-panel.open a:nth-child(8){transition-delay:.22s}
      #dlo-fab-panel.open a:nth-child(9){transition-delay:.25s}
      #dlo-fab-panel.open a:nth-child(10){transition-delay:.28s}
      #dlo-fab-panel.open a:nth-child(11){transition-delay:.31s}
      #dlo-fab-panel a:hover{background:rgba(201,168,76,.18);color:#fff}
      #dlo-fab-toggle{
        position:relative;
        width:54px;height:54px;border-radius:50%;border:2px solid #C9A84C;
        background:linear-gradient(145deg,#123059 0%,#0B2545 55%,#071a32 100%);
        color:#E0C083;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 0 rgba(201,168,76,.35);
        font-size:22px;line-height:1;
        transition:transform .25s cubic-bezier(.16,1,.3,1),background .2s ease,box-shadow .25s ease,border-color .2s ease;
        animation:dloFabFloat 2.8s ease-in-out infinite,dloFabPulse 2.8s ease-in-out infinite;
      }
      #dlo-fab-toggle::before{
        content:"";position:absolute;inset:-6px;border-radius:50%;
        border:1px solid rgba(201,168,76,.35);
        animation:dloFabRing 2.8s ease-out infinite;
        pointer-events:none;
      }
      #dlo-fab-toggle:hover{
        background:linear-gradient(145deg,#1a3d6e 0%,#123059 100%);
        transform:translateY(-4px) scale(1.06);
        box-shadow:0 14px 32px rgba(0,0,0,.4),0 0 20px rgba(201,168,76,.25);
        animation:none;
      }
      #dlo-fab-toggle[aria-expanded="true"]{
        background:linear-gradient(145deg,#1a3d6e 0%,#0B2545 100%);
        transform:rotate(180deg) scale(1.05);
        animation:none;
        box-shadow:0 12px 28px rgba(0,0,0,.4),0 0 16px rgba(201,168,76,.3);
      }
      #dlo-fab-toggle[aria-expanded="true"]::before{animation:none;opacity:.5}
      @keyframes dloFabFloat{
        0%,100%{transform:translateY(0)}
        50%{transform:translateY(-6px)}
      }
      @keyframes dloFabPulse{
        0%,100%{box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 0 rgba(201,168,76,.4)}
        50%{box-shadow:0 12px 28px rgba(0,0,0,.35),0 0 0 8px rgba(201,168,76,0)}
      }
      @keyframes dloFabRing{
        0%{transform:scale(.85);opacity:.7}
        100%{transform:scale(1.35);opacity:0}
      }
      @media (prefers-reduced-motion:reduce){
        #dlo-fab-toggle,#dlo-fab-toggle::before,#dlo-fab-panel,#dlo-fab-panel a{animation:none!important;transition:none!important}
        #dlo-fab-panel{transform:none}
        #dlo-fab-panel.open{transform:none}
      }
      html.app-mode #dlo-fab-wrap{bottom:96px}
    `;
    document.head.appendChild(style);

    // Skip link
    if (!document.getElementById('dlo-skip-link')) {
      const skip = document.createElement('a');
      skip.id = 'dlo-skip-link';
      skip.className = 'dlo-skip-link';
      skip.href = '#main-content';
      skip.textContent = 'Skip to main content';
      skip.addEventListener('click', function (e) {
        const target = document.getElementById('main-content') || document.querySelector('main');
        if (target) {
          e.preventDefault();
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: false });
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      document.body.insertBefore(skip, document.body.firstChild);
    }

    // Ensure main landmark id
    let main = document.getElementById('main-content') || document.querySelector('main');
    if (main && !main.id) main.id = 'main-content';
    if (!main) {
      // soft landmark: first section after topbar
      const sec = document.querySelector('section, .container, .hero-minimal');
      if (sec && !sec.id) sec.id = 'main-content';
    }

    // Enhance existing footer(s)
    document.querySelectorAll('footer').forEach(function (ft) {
      if (ft.getAttribute('data-dlo-footer') === '1') return;
      ft.setAttribute('data-dlo-footer', '1');
      let inner = ft.querySelector('.footer-inner');
      if (!inner) {
        inner = document.createElement('div');
        inner.className = 'footer-inner';
        while (ft.firstChild) inner.appendChild(ft.firstChild);
        ft.appendChild(inner);
      }
      inner.classList.add('dlo-footer-enhanced');
      if (!inner.querySelector('.dlo-footer-owner')) {
        const owner = document.createElement('div');
        owner.className = 'dlo-footer-owner';
        owner.innerHTML = 'Content owned and maintained by the <strong>District Litigation Office, Kupwara</strong>, Department of Law, Justice &amp; Parliamentary Affairs, Government of Jammu &amp; Kashmir.<br>Last reviewed: <time datetime="2026-10">October 2026</time>';
        inner.appendChild(owner);
      }
      if (!inner.querySelector('.dlo-footer-policies')) {
        const pol = document.createElement('div');
        pol.className = 'dlo-footer-policies';
        pol.setAttribute('aria-label', 'Website policies');
        const links = [
          ['website-policies.html', 'Website Policies'],
          ['privacy-policy.html', 'Privacy Policy'],
          ['terms.html', 'Terms'],
          ['copyright-policy.html', 'Copyright'],
          ['accessibility-statement.html', 'Accessibility'],
          ['faq.html', 'Help & FAQ'],
          ['contact.html', 'Contact']
        ];
        links.forEach(function (pair) {
          const a = document.createElement('a');
          a.href = pair[0];
          a.textContent = pair[1];
          pol.appendChild(a);
        });
        inner.appendChild(pol);
      }
    });

    // Floating up-arrow panel
    if (!document.getElementById('dlo-fab-wrap')) {
      const wrap = document.createElement('div');
      wrap.id = 'dlo-fab-wrap';
      const panel = document.createElement('div');
      panel.id = 'dlo-fab-panel';
      panel.setAttribute('role', 'navigation');
      panel.setAttribute('aria-label', 'Policies and site links');
      panel.innerHTML = '<h4>Policies &amp; links</h4>';
      const items = [
        ['website-policies.html', 'Website Policies'],
        ['privacy-policy.html', 'Privacy Policy'],
        ['terms.html', 'Terms & Conditions'],
        ['hyperlinking-policy.html', 'Hyperlinking Policy'],
        ['copyright-policy.html', 'Copyright Policy'],
        ['accessibility-statement.html', 'Accessibility Statement'],
        ['faq.html', 'Help & FAQ'],
        ['contact.html', 'Contact Us'],
        ['public-enquiries.html', 'Public Enquiries / Feedback'],
        ['about-office.html', 'About the Office'],
        ['our-officials.html', 'Our Officials']
      ];
      items.forEach(function (pair) {
        const a = document.createElement('a');
        a.href = pair[0];
        a.textContent = pair[1];
        panel.appendChild(a);
      });
      const topLink = document.createElement('a');
      topLink.href = '#';
      topLink.textContent = '↑ Back to top';
      topLink.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
      panel.appendChild(topLink);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'dlo-fab-toggle';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'dlo-fab-panel');
      btn.setAttribute('aria-label', 'Open policies and page links');
      btn.title = 'Policies & links';
      btn.textContent = '↑';
      btn.addEventListener('click', function () {
        const open = !panel.classList.contains('open');
        panel.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Close policies and page links' : 'Open policies and page links');
        // Keep ↑ glyph; CSS rotates it when expanded
        btn.textContent = '↑';
      });
      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) {
          panel.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = '↑';
        }
      });
      wrap.appendChild(panel);
      wrap.appendChild(btn);
      document.body.appendChild(wrap);
    }
  }

  global.DLO = {
    escapeHtml,
    nowIST,
    formatDDMMYYYY,
    formatDateTimeIST,
    showToast,
    initTheme,
    toggleTheme,
    applyTheme,
    initOfflineWatcher,
    showSkeleton,
    hideSkeleton,
    calculateStats,
    registerSW,
    injectMenu,
    injectSiteChrome,
    getSupabaseClient,
    fetchCaseDiary,
    searchCases,
    getDistinctFilterValues,
    getCaseDiaryError: () => _caseDiaryLastError,
    fetchSiteUpdates,
    setLanguage,
    reapplyLanguage,
    applyLanguage,
    currentLanguage,
    config: CFG
  };

  // Auto-init safe parts
  if (document.readyState === 'loading') {
    // Set the page theme before first paint. Existing saved choices are
    // preserved; a new visitor starts in the configured dark theme.
    initTheme();
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initOfflineWatcher();
      injectMenu();
      try { injectSiteChrome(); } catch (e) {}
      initAppShellNavigation();
      initAppNavigationSpeedups();
    });
  } else {
    initTheme();
    initOfflineWatcher();
    injectMenu();
    try { injectSiteChrome(); } catch (e) {}
    initAppShellNavigation();
    initAppNavigationSpeedups();
  }

  // Initialize saved language after the page has loaded its DOM.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { initLanguage(); initTranslationObserver(); }, { once:true });
  else { initLanguage(); initTranslationObserver(); }

})(window);
