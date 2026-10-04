/**
 * DLO Design ↔ Legal Assistant bridge
 * Place this file in the repo root next to assistant.js.
 *
 * Load order (near end of <body> on app.html / index.html):
 *   1. config.js
 *   2. supabase-js UMD
 *   3. common.js
 *   4. assistant-bridge.js   ← this file
 *   5. assistant.js
 *
 * Behaviour:
 *  - Prefer live rows already loaded by the site (DLO.fetchCaseDiary → ALL_ROWS)
 *  - Also expose the shared Supabase client as window.sb
 *  - Pass page link map for the new architecture
 *  - If the page has no data, assistant.js still searches independently
 *    via its built-in Supabase REST fallback (same project as config.js)
 */
(function () {
  'use strict';

  var CFG = window.DLO_CONFIG || {};
  var sbCfg = CFG.supabase || {};

  window.DLO_ASSISTANT_CONFIG = Object.assign({}, window.DLO_ASSISTANT_CONFIG || {}, {
    supabaseUrl: sbCfg.url || '',
    supabaseKey: sbCfg.anonKey || '',
    table: 'case_diary',
    maxRows: 5000,
    refreshMs: 300000,
    staffPageSize: 6,
    publicPageSize: 1,
    pages: {
      home:        { url: 'index.html',                 text: 'Go to Home' },
      hearings:    { url: 'hearings.html',              text: 'View Upcoming Hearings' },
      history:     { url: 'history.html',               text: 'Open Case History' },
      causelist:   { url: 'causelist.html',             text: 'Open Cause List' },
      performance: { url: 'performance.html',           text: 'Open Performance Dashboard' },
      operator:    { url: 'operator.html',              text: 'Go to Staff Login' },
      contact:     { url: 'contact.html',               text: 'Open Contact / Enquiry' },
      search:      { url: 'search-filter-cases.html',   text: 'Search & Filter Cases' },
      analytics:   { url: 'analytics.html',             text: 'Open Analytics' },
      about:       { url: 'our-officials.html',         text: 'Officials & Team' },
      calendar:    { url: 'causelist.html',             text: 'Open Hearing Calendar' },
      updates:     { url: 'latest-updates.html',        text: 'Orders, Notices & Circulars' }
    }
  });

  function toLegacyRow(r) {
    if (!r || typeof r !== 'object') return r;
    var next = r.nextHearing || r.next_hearing_date || r.nextDate || null;
    if (next && !(next instanceof Date)) {
      var s = String(next).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) next = new Date(s.slice(0, 10) + 'T00:00:00');
      else {
        var d = new Date(s);
        next = isNaN(d.getTime()) ? null : d;
      }
    }
    return {
      caseNo:      r.cnrCaseNo || r.caseNo || r.cnr_case_no || '',
      title:       r.caseTitle || r.title || r.case_title || '',
      subject:     r.subjectMatter || r.subject || r.subject_matter || '',
      dept:        r.department || r.dept || '',
      court:       r.court || r.court_name || '',
      lastProc:    r.lastProceedings || r.lastProc || r.last_proceedings || '',
      nextHearing: next,
      reply:       r.reply || r.reply_status || '',
      status:      r.status || r.case_status || '',
      type:        r.type || r.case_type || '',
      counsel:     r.advocateName || r.counsel || r.advocate_name || '',
      exparte:     r.exparte || r.exparte_status || ''
    };
  }

  function publishRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    window.ALL_ROWS = rows.map(toLegacyRow);
  }

  function wireSiteData() {
    if (window.DLO && typeof window.DLO.getSupabaseClient === 'function') {
      try {
        var client = window.DLO.getSupabaseClient();
        if (client) window.sb = client;
      } catch (e) { /* ignore */ }
    }

    if (window.DLO && typeof window.DLO.fetchCaseDiary === 'function') {
      window.DLO.fetchCaseDiary(false).then(publishRows).catch(function () {});
      document.addEventListener('dlo:case-diary-updated', function (ev) {
        if (ev && ev.detail && Array.isArray(ev.detail.rows)) {
          publishRows(ev.detail.rows);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSiteData);
  } else {
    wireSiteData();
  }
})();
