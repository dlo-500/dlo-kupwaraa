DLO Kupwara — split into separate pages
========================================

STRUCTURE
  index.html          Home
  about.html           About + Services
  cases.html           Case Filter ("Cases" button)
  hearings.html        Upcoming Hearings
  courts.html          Court-wise Cases
  analytics.html       Analytics
  monthly-board.html   Monthly Board
  performance.html     Standing Counsel Performance
  causelist.html       Daily Cause List
  calendar.html        Hearing Calendar
  updates.html         Updates & Notices
  history.html         Case History
  team.html            Team
  contact.html         Contact
  assets/style.css     all original CSS, unchanged, now shared via <link>
  assets/common.js     code shared by every page (nav, popups, PWA install,
                        ticker, Supabase fetch, urgent-hearing banner, etc.)
  assets/<page>.js      the code specific to that one page only

WHAT YOU STILL NEED TO COPY IN
  logo.png, manifest.json, operator.html, sw.js — these were referenced by
  the original file but weren't part of it, so drop them in this same
  folder as before.

THE TWO PLACES CODE WAS ACTUALLY CHANGED
  You asked for true separate pages, which needed two small adaptations
  (everything else is the original code, just filed under the section it
  belongs to):
  1. The "search" box on the home page used to scroll down to the Cases
     section on the same page. Since Cases is now its own page, it
     redirects to cases.html?q=... instead, and cases.html picks the
     search term up from the URL.
  2. The bottom tab bar used to highlight the current tab by checking your
     scroll position against in-page section IDs. Since there's no more
     scrolling between sections, each page just marks its own tab active
     directly.

A pre-existing quirk in the original file (a stray nested <script> tag
in the Cloudflare Analytics snippet in <head>) was left exactly as-is on
every page, per your "don't change anything" instruction.
