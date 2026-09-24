/*!
 * DLO Kupwara Assistant · NK.2.1 — dlokupwara.in
 *
 * NEW IN NK.2.0
 *  - Searches every case TITLE word (plus case no., subject, department, court, counsel)
 *    with typo + phonetic matching: "yakub", "yaqoob", "yaqub" all find Yaqoob Khan.
 *  - Reads live rows from Supabase (no more DOM scraping / hardcoded stats).
 *  - Understands dates ("hearings tomorrow", "cases on 15 Oct", "next 3 days", Roman Urdu "kal").
 *  - Filters: court + department + case type + flags (overdue, ex-parte, reply pending, missing reply).
 *  - Follow-ups: "and its court?", "what about revenue?".
 *  - Public visitors see matches one at a time (cascading); staff see up to 6 per page.
 *  - Case cards with highlighted title words, Add-to-Calendar, WhatsApp share, Copy.
 *  - LAW DESK (NK.2.1): civil-procedure Q&A — CPC, plaint, written statement, caveat, ex parte, restoration,
 *    condonation of delay, limitation, appeals, execution, contempt, S.80 notice, consumer/MACT and more.
 *    Understands section/order references ("s148a", "order 21 rule 32"), typos, Roman Urdu, and
 *    "difference between X and Y". Answers stream in like a chat model; typing shows topic suggestions.
 *
 * SETUP: paste your Supabase URL + anon key into the two constants near the top of this file.
 * (Optional per-page override, BEFORE this script tag:)
 *   <script>
 *     window.DLO_ASSISTANT_CONFIG = {
 *       supabaseUrl: "https://YOUR-PROJECT.supabase.co",
 *       supabaseKey: "YOUR-ANON-KEY",          // the same public anon key your pages already use
 *       table: "case_diary"                    // optional, default case_diary
 *       // client: yourSupabaseClient,        // optional: lets the bot detect a staff login
 *       // isStaff: () => true,               // optional override for staff mode
 *       // logTable: "assistant_misses",      // optional: logs question SHAPES only (never names)
 *       // pages: { contact: {url:"index.html#contact", text:"Open Contact / Enquiry"} }
 *     };
 *   </script>
 *   <script src="dlo-assistant.js" defer></script>
 *
 * NOTE: the case table is anon-readable, so public/staff mode here is a presentation rule
 * (cascading results, hidden counsel/last-proceeding), not a security boundary.
 * Enforce real limits with RLS / a public view.
 */
(function () {
  "use strict";

  const W = typeof window !== "undefined" ? window : {};
  const HAS_DOM = typeof document !== "undefined";
  if (W.__DLO_ASSISTANT_MOUNTED) return;
  W.__DLO_ASSISTANT_MOUNTED = true;

  const VERSION = "NK.2.1";
  // ▼▼ PASTE YOUR TWO VALUES HERE (once). Use the public ANON key only — never the service_role key. ▼▼
  const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";       // e.g. https://abcdxyz.supabase.co
  const SUPABASE_ANON_KEY = "PASTE_ANON_KEY_HERE";      // the same anon key already used by your pages
  // ▲▲ nothing else needs configuring; DLO_ASSISTANT_CONFIG on a page is now optional ▲▲
  const CFG = Object.assign(
    { supabaseUrl: /^PASTE_/.test(SUPABASE_URL) ? "" : SUPABASE_URL, supabaseKey: /^PASTE_/.test(SUPABASE_ANON_KEY) ? "" : SUPABASE_ANON_KEY, table: "case_diary", client: null, maxRows: 5000,
      refreshMs: 300000, staffPageSize: 6, publicPageSize: 1, isStaff: null, logTable: "", pages: {} },
    W.DLO_ASSISTANT_CONFIG || {}
  );

  const S = { staff: false, last: null, lastFilter: null, pager: null, partial: null };
  const DATA = { rows: [], source: "none", at: 0, loading: null };
  let TITLE_VOCAB = Object.create(null);

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const set = (s) => { const o = Object.create(null); s.split(/\s+/).forEach((w) => { if (w) o[w] = 1; }); return o; };
  const dict = (o) => Object.assign(Object.create(null), o);
  const trunc = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1).trim() + "…" : String(s));

  /* ───────────── 1. OFFICE KNOWLEDGE ───────────── */
  const COURTS = [
    { id: "cjm_handwara", name: "CJM/SUB JUDGE HANDWARA", short: "CJM / Sub Judge Handwara", aliases: ["cjm", "cjm handwara", "sub judge handwara", "subjudge handwara", "chief judicial magistrate handwara", "chief judicial magistrate", "cjm court handwara", "cjm/sub judge handwara", "cjm sub judge", "handwara cjm", "jmfc handwara"] },
    { id: "dist_sessions", name: "PR. DISTRICT AND SESSIONS COURT KUPWARA", short: "Sessions Court Kupwara", aliases: ["sessions", "dist sessions", "pr district", "district court kupwara", "principal district and sessions", "sessions kupwara", "pdj kupwara", "pdj", "principal district", "sessions court", "district and sessions", "pr. district", "district sessions kupwara", "sessions judge kupwara"] },
    { id: "sub_kupwara", name: "Sub Judge Kupwara", short: "Sub Judge Kupwara", aliases: ["sub judge kupwara", "subjudge kupwara", "senior civil judge kupwara", "sub-judge kupwara", "scj kupwara", "civil judge senior division kupwara"] },
    { id: "addl_handwara", name: "ADDITIONAL DISTRICT AND SESSIONS COURT HANDWARA", short: "Addl. Sessions Handwara", aliases: ["additional sessions", "addl sessions", "addl handwara", "ad&sj handwara", "additional district court handwara", "additional district and sessions", "adsj handwara", "addj handwara", "addl. sessions", "additional sessions handwara"] },
    { id: "consumer", name: "CONSUMER COURT KUPWARA", short: "Consumer Court Kupwara", aliases: ["consumer", "consumer court", "dcdrc", "consumer commission", "consumer forum", "district consumer", "consumer disputes", "dcdrc kupwara"] },
    { id: "munsiff_kralpora", name: "Munsiff Kralpora", short: "Munsiff Kralpora", aliases: ["kralpora", "munsiff kralpora", "court kralpora", "munsif kralpora", "civil judge kralpora", "kralpora court"] },
    { id: "munsiff_kupwara", name: "MUNSIFF KUPWARA", short: "Munsiff Kupwara", aliases: ["munsiff kupwara", "munsif kupwara", "civil judge kupwara", "court of munsiff kupwara", "munsiff court kupwara"] },
    { id: "labour", name: "LABOUR COURT KUPWARA", short: "Labour Court Kupwara", aliases: ["labour court", "labor court", "industrial tribunal", "wage authority", "labour officer court", "labour tribunal"] },
    { id: "munsiff_sogam", name: "MUNSIFF SOGAM", short: "Munsiff Sogam", aliases: ["sogam", "munsiff sogam", "munsif sogam", "lolab court", "munsiff lolab", "court sogam", "sogam court", "lolab"] },
    { id: "sub_trehgam", name: "SUB JUDGE TREHGAM", short: "Sub Judge Trehgam", aliases: ["trehgam", "sub judge trehgam", "subjudge trehgam", "munsiff trehgam", "court trehgam", "trehgam court"] },
    { id: "munsiff_handwara", name: "MUNSIFF HANDWARA", short: "Munsiff Handwara", aliases: ["munsiff handwara", "munsif handwara", "court munsiff handwara", "civil judge handwara"] },
    { id: "mact", name: "MACT KUPWARA", short: "MACT Kupwara", aliases: ["mact", "accident claim", "motor accident", "mact tribunal", "claims tribunal", "motor accident claims", "maact", "accident tribunal"] }
  ];

  const DEPT_ALIASES = {
    "pmgsy": "R&b", "pwd": "R&b", "r&b": "R&b", "r and b": "R&b", "roads": "R&b", "bridges": "R&b", "public works": "R&b", "highways": "R&b", "rb": "R&b", "rnb": "R&b",
    "pdd": "PDD", "kpdcl": "PDD", "power": "PDD", "electricity": "PDD", "electric": "PDD", "power development": "PDD", "pdd kpdcl": "PDD",
    "jal shakti": "PHE/JAL SHAKTI", "phe": "PHE/JAL SHAKTI", "water": "PHE/JAL SHAKTI", "drinking water": "PHE/JAL SHAKTI", "jalshakti": "PHE/JAL SHAKTI", "phe jal shakti": "PHE/JAL SHAKTI",
    "i&fc": "I&FC", "ifc": "I&FC", "irrigation": "I&FC", "flood control": "I&FC", "i and fc": "I&FC",
    "ulb": "URBAN LOCAL BODIES", "urban local bodies": "URBAN LOCAL BODIES", "municipality": "URBAN LOCAL BODIES", "mc kupwara": "URBAN LOCAL BODIES", "mc handwara": "URBAN LOCAL BODIES", "municipal council": "URBAN LOCAL BODIES", "municipal committee": "URBAN LOCAL BODIES", "sanitation": "URBAN LOCAL BODIES", "urban": "URBAN LOCAL BODIES", "langate": "URBAN LOCAL BODIES",
    "revenue": "Revenue", "patwari": "Revenue", "tehsildar": "Revenue", "naib tehsildar": "Revenue", "girdawar": "Revenue", "land": "Revenue", "mutation": "Revenue", "demarcation": "Revenue", "kahcharai": "Revenue", "state land": "Revenue", "evacuee": "Revenue", "nazool": "Revenue", "collector": "Revenue", "land acquisition": "Revenue",
    "rdd": "RDD", "rural development": "RDD", "bdo": "RDD", "panchayat": "RDD", "vlw": "RDD", "acd": "RDD",
    "education": "EDUCATION", "school": "EDUCATION", "teacher": "EDUCATION", "ceo kupwara": "EDUCATION", "zep": "EDUCATION", "zeo": "EDUCATION", "ceo": "EDUCATION",
    "samagra": "SMAGRA SHIKSHA", "smagra shiksha": "SMAGRA SHIKSHA", "samagra shiksha": "SMAGRA SHIKSHA",
    "health": "HEALTH AND MEDICAL EDUCATION", "hospital": "HEALTH AND MEDICAL EDUCATION", "doctor": "HEALTH AND MEDICAL EDUCATION", "medical": "HEALTH AND MEDICAL EDUCATION", "cmo kupwara": "HEALTH AND MEDICAL EDUCATION", "bmo": "HEALTH AND MEDICAL EDUCATION", "cmo": "HEALTH AND MEDICAL EDUCATION", "h&me": "HEALTH AND MEDICAL EDUCATION",
    "social welfare": "SOCIAL WELFARE", "icds": "SOCIAL WELFARE", "anganwadi": "SOCIAL WELFARE", "pension": "SOCIAL WELFARE", "dsw": "SOCIAL WELFARE",
    "forest": "FOREST", "jungle": "FOREST", "wildlife": "FOREST", "dfo": "FOREST", "timber": "FOREST", "sfc": "FOREST", "range officer": "FOREST",
    "home": "HOME", "police": "HOME", "fir": "HOME", "ssp kupwara": "HOME", "sho": "HOME", "thana": "HOME", "ssp": "HOME",
    "fcs&ca": "FCS&CA", "capd": "FCS&CA", "ration": "FCS&CA", "food supplies": "FCS&CA", "fcsca": "FCS&CA",
    "food safety": "Food Safety officer", "fso": "Food Safety officer", "food safety officer": "Food Safety officer",
    "horticulture": "HORTICULTURE", "fruit": "HORTICULTURE", "apple": "HORTICULTURE",
    "agriculture": "AGRICULTURE", "kissan": "AGRICULTURE", "kisan": "AGRICULTURE",
    "animal husbandary": "ANIMAL HUSBANDARY", "animal husbandry": "ANIMAL HUSBANDARY", "veterinary": "ANIMAL HUSBANDARY", "aho": "ANIMAL HUSBANDARY",
    "sheep": "SHEEP HUSBANDRY", "sheep husbandry": "SHEEP HUSBANDRY",
    "jkedi": "JKEDI", "edi": "JKEDI",
    "industries": "INDUSTRIES AND COMMERCE", "commerce": "INDUSTRIES AND COMMERCE", "dic": "INDUSTRIES AND COMMERCE",
    "geology": "GEOLOGY AND MINING", "mining": "GEOLOGY AND MINING",
    "transport": "TRANSPORT", "rto": "TRANSPORT", "arvo": "TRANSPORT",
    "skill": "SKILL DEVELOPMENT", "iti": "SKILL DEVELOPMENT", "skill development": "SKILL DEVELOPMENT",
    "defence estates": "DEFENCE ESTATES", "army land": "DEFENCE ESTATES", "deo": "DEFENCE ESTATES",
    "uoi": "UOI", "union of india": "UOI", "union india": "UOI",
    "sports": "YOUTH SERVICES AND SPORTS", "youth": "YOUTH SERVICES AND SPORTS", "yss": "YOUTH SERVICES AND SPORTS",
    "culture": "CULTURE", "science": "SCIENCE AND TECHNOLOGY", "science and technology": "SCIENCE AND TECHNOLOGY",
    "relief": "RELIEF", "disaster": "RELIEF", "jkrlm": "JKRLM", "nrlm": "JKRLM", "umed": "JKRLM",
    "information": "INFORMATION", "dipr": "INFORMATION", "information department": "INFORMATION"
  };

  const OFFICE = {
    name: "District Litigation Office Kupwara",
    parent: "Department of Law, Justice & Parliamentary Affairs, Government of Jammu & Kashmir",
    address: "1st Floor, DC Office Complex, Kupwara, UT of J&K — 193222",
    hours: "10:00 AM – 5:00 PM, Monday to Saturday",
    closed: "Sundays and public holidays",
    email: "districtlitigationofficekupwar@gmail.com",
    dlo: "Ishfaq Ahmad Khan",
    counsel: ["Adv. Zubair Ahmad Wani", "Adv. Wasim Nazir Khan"],
    developer: "Tariq Ahmad Lone",
    portalVersion: "NK.1.0",
    disclaimer: "The information on this portal is intended solely to keep employees of stakeholder departments aware of statistics and developments of cases handled by DLO Kupwara. It cannot be made the basis of any litigation, legal proceeding, claim, or action. For official case records, contact DLO Kupwara directly."
  };

  const PAGES = Object.assign({
    home: { url: "index.html", text: "Open Homepage" },
    hearings: { url: "hearings.html", text: "View Upcoming Hearings" },
    history: { url: "history.html", text: "Open Case History Tracker" },
    causelist: { url: "causelist.html", text: "Open Cause List Explorer" },
    performance: { url: "performance.html", text: "Open Performance Dashboard" },
    operator: { url: "operator.html", text: "Go to Staff Login" },
    contact: { url: "index.html#contact", text: "Open Contact / Enquiry" },
    search: { url: "search.html", text: "Search & Filter Cases" },
    analytics: { url: "analytics.html", text: "Open Analytics" },
    about: { url: "about.html", text: "About & Officials" },
    calendar: { url: "index.html#calendar", text: "Open Hearing Calendar" },
    updates: { url: "index.html#updates", text: "Orders, Notices & Circulars" }
  }, CFG.pages || {});

  const TYPES = [["contempt", "Contempt Petition"], ["execution", "Execution Petition"], ["wage", "Wage Claim"], ["consumer", "Consumer Matter"], ["restoration", "Restoration Application"], ["civil suit", "Civil Suit"], ["appeal", "Appeal"], ["mact", "MACT Case"], ["pauper", "Pauper Suit"], ["revision", "Revision"], ["review", "Review"], ["criminal", "Criminal Complaint"], ["condonation", "Condonation of Delay"], ["transfer", "Transfer Application"]];

  /* ───────────── 2. LANGUAGE TOOLS ───────────── */
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "").replace(/[\/_\-]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  const normKey = (s) => norm(s).replace(/ /g, "");
  const tokenize = (s) => norm(s).split(" ").filter((w) => w && (w.length > 1 || /\d/.test(w)) && w !== "vs");

  // Roman-Urdu / Hindi / Urdu-script keywords → English
  const SYN = dict({
    aaj: "today", aj: "today", "आज": "today", "آج": "today", kal: "tomorrow", "कल": "tomorrow", "کل": "tomorrow", parso: "day after tomorrow",
    tareekh: "date", tarikh: "date", "तारीख": "date", "تاریخ": "date", sunwai: "hearing", sunvai: "hearing", "सुनवाई": "hearing", "سماعت": "hearing",
    adalat: "court", "अदालत": "court", "عدالت": "court", muqadma: "case", mukadma: "case", mukaddama: "case", "मुकदमा": "case", "مقدمہ": "case",
    kitne: "how many", kitna: "how many", kitni: "how many", "कितने": "how many", kab: "when", "कब": "when",
    daftar: "office", "दफ्तर": "office", "دفتر": "office", kahan: "where", kaha: "where", "कहाँ": "where", "کہاں": "where",
    waqt: "timing", "समय": "timing", "وقت": "timing", dikhao: "show", dikhaiye: "show", "दिखाओ": "show",
    shukriya: "thanks", shukria: "thanks", "شکریہ": "thanks", "धन्यवाद": "thanks", "नमस्ते": "hello", "سلام": "salam"
  });
  const translate = (q) => q.split(" ").map((w, i, a) => (SYN[w] != null && !(w === "adalat" && a[i - 1] === "lok") ? SYN[w] : w)).join(" ").replace(/\s+/g, " ").trim();

  const NOISE = set(`a an the in of for to is are was were be please kindly can could would you i we me my our at on by with from or and do does did any all this that there their
    how what which who where when why give tell show list open see view get find check search look lookup know want need about regarding related details detail info information data
    status next date hearing hearings case cases matter matters court courts dept department departments today tomorrow yesterday week month days day total count number many much
    active disposed pending reply replies filed exparte ex parte overdue listed schedule scheduled cause board versus vs v s soon urgent asap immediately
    hai hain ka ki ke ko kya kaun konse ye wo aur mein me se par pe wala wali hum tum mera meri mere batao bataiye btao dijiye plz pls sir madam ji jee also more
    its it iska uska iski uski same above upcoming next new latest current currently now
    stat stats statistics summary overview dashboard disposal rate type types kinds stakeholder stakeholders distribution wise most highest maximum largest top busiest worst zyada sabse has have
    petition petitions application applications suit suits`);

  const PH_ALIAS = dict({ mohammad: "mohd", mohammed: "mohd", muhammad: "mohd", muhammed: "mohd", mohamad: "mohd", mohamed: "mohd", mohmmad: "mohd", md: "mohd", ahmed: "ahmad", ahmid: "ahmad", butt: "bhat", bhatt: "bhat", ganai: "gani", ganaie: "gani", ganie: "gani", sofi: "sufi" });
  function phon(w) {
    if (PH_ALIAS[w]) w = PH_ALIAS[w];
    return w.replace(/ph/g, "f").replace(/gh/g, "g").replace(/kh/g, "k").replace(/sh/g, "s").replace(/th/g, "t").replace(/dh/g, "d")
      .replace(/ck/g, "k").replace(/q/g, "k").replace(/w/g, "v").replace(/x/g, "ks")
      .replace(/oo|ou/g, "u").replace(/au|aw|ow/g, "o").replace(/ai|ei|ay|ey/g, "e").replace(/ee|ea|ie/g, "i").replace(/aa/g, "a")
      .replace(/(?!^)y/g, "i").replace(/([a-z])\1+/g, "$1").replace(/([aeiou])h$/, "$1");
  }
  const skel = (p) => p.charAt(0) + p.slice(1).replace(/[aeiou]/g, "");
  function mk(t) {
    if (/^\d+$/.test(t)) t = t.replace(/^0+(?=\d)/, "");
    const p = phon(t);
    return { t, ph: p, sk: skel(p), num: /\d/.test(t) };
  }
  function lev(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev = [], cur = [];
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i; let rowMin = i;
      for (let j = 1; j <= lb; j++) {
        cur[j] = a.charAt(i - 1) === b.charAt(j - 1) ? prev[j - 1] : Math.min(prev[j - 1], prev[j], cur[j - 1]) + 1;
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      const t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }
  const MATCH_MIN = 0.6;
  // similarity of a query token to a document token (0..1)
  function simTok(q, d) {
    if (q.t === d.t) return 1;
    if (q.num || d.num) return 0;
    const ql = q.t.length;
    if (ql >= 3 && d.t.startsWith(q.t)) return 0.92;
    if (q.ph.length >= 3 && q.ph === d.ph) return 0.88;
    if (ql >= 4 && d.t.indexOf(q.t) !== -1) return 0.78;
    if (q.ph.length >= 4 && d.ph.startsWith(q.ph)) return 0.8;
    const m = ql >= 8 ? 2 : ql >= 4 ? 1 : 0;
    if (m) {
      const dd = Math.min(lev(q.t, d.t, m), lev(q.ph, d.ph, m));
      if (dd <= m) return 0.75 - 0.07 * dd;
    }
    if (q.sk.length >= 3 && q.sk === d.sk) return 0.62;
    return 0;
  }

  const VOCAB = ("hearing hearings tomorrow yesterday pending replies department departments statistics disposed overdue contempt standing counsel advocate calendar circular circulars address location timing timings sessions munsiff consumer handwara kupwara kralpora trehgam revenue education forest health transport agriculture horticulture irrigation police holiday sunday saturday performance procedure download appeals petition execution restoration disposal missing upcoming courts cases").split(" ");
  const VOCABSET = set(VOCAB.join(" "));
  function fixTypos(q) {
    return q.split(" ").map((w) => {
      if (w.length < 6 || VOCABSET[w] || NOISE[w] || TITLE_VOCAB[w] || SYN[w] != null) return w;
      for (let i = 0; i < VOCAB.length; i++) { const v = VOCAB[i]; if (Math.abs(v.length - w.length) <= 1 && lev(w, v, 1) <= 1) return v; }
      return w;
    }).join(" ");
  }

  /* ───────────── 3. ENTITY RESOLUTION ───────────── */
  const ALIAS_N = Object.create(null);
  Object.keys(DEPT_ALIASES).forEach((a) => { ALIAS_N[norm(a)] = DEPT_ALIASES[a]; });
  const CANON = Object.keys(DEPT_ALIASES).map((a) => DEPT_ALIASES[a]).filter((v, i, a) => a.indexOf(v) === i);
  CANON.forEach((c) => { ALIAS_N[norm(c)] = c; });
  const DEPT_KEYS = Object.keys(ALIAS_N).filter((k) => k !== "information").sort((a, b) => b.length - a.length);

  const COURT_KEYS = [];
  COURTS.forEach((c) => [c.name, c.short].concat(c.aliases).forEach((a) => { const n = norm(a); if (n) COURT_KEYS.push({ n, k: normKey(a), c }); }));
  COURT_KEYS.sort((a, b) => b.n.length - a.n.length);
  const courtById = {}; COURTS.forEach((c) => { courtById[c.id] = c; });

  function findPhrase(q, keys) {
    const padded = " " + q + " ";
    for (let i = 0; i < keys.length; i++) if (keys[i].length >= 2 && padded.indexOf(" " + keys[i] + " ") !== -1) return keys[i];
    return null;
  }
  function findCourt(q) {
    const padded = " " + q + " ";
    for (let i = 0; i < COURT_KEYS.length; i++) if (padded.indexOf(" " + COURT_KEYS[i].n + " ") !== -1) return { court: COURT_KEYS[i].c, phrase: COURT_KEYS[i].n };
    return null;
  }
  function findDept(q) { const k = findPhrase(q, DEPT_KEYS); return k ? { name: ALIAS_N[k], phrase: k } : null; }
  function findType(q) {
    for (let i = 0; i < TYPES.length; i++) {
      const m = new RegExp("\\b" + TYPES[i][0] + "\\w*").exec(q);
      if (m) return { name: TYPES[i][1], kw: normKey(TYPES[i][0]), phrase: m[0] };
    }
    return null;
  }
  function resolveCourt(s) {
    const nk = normKey(s); if (!nk) return "";
    let best = "", bl = 0;
    COURT_KEYS.forEach((e) => { if ((nk === e.k || (e.k.length >= 8 && nk.indexOf(e.k) !== -1)) && e.k.length > bl) { best = e.c.id; bl = e.k.length; } });
    return best;
  }
  function resolveDept(s) {
    const n = norm(s); if (!n) return "";
    if (ALIAS_N[n]) return ALIAS_N[n];
    const nk = n.replace(/ /g, "");
    for (let i = 0; i < CANON.length; i++) { const ck = normKey(CANON[i]); if (ck === nk || (ck.length >= 4 && nk.indexOf(ck) !== -1)) return CANON[i]; }
    const toks = n.split(" ");
    for (let i = 0; i < toks.length; i++) if (toks[i].length >= 3 && ALIAS_N[toks[i]]) return ALIAS_N[toks[i]];
    return String(s).trim();
  }

  const FLAGS = [
    ["exparte", /\bex ?parte\b/],
    ["missing", /\b(missing|no|not|without) (a )?repl(y|ies)\b|\brepl(y|ies) (not filed|missing)\b|\bunfiled\b/],
    ["pending", /\brepl(y|ies) pend\w*|\bpend\w* repl(y|ies)|\brepl(y|ies) due\b/],
    ["filed", /\brepl(y|ies) filed\b|\bfiled repl(y|ies)\b/],
    ["overdue", /\boverdue\b|\bdate passed\b|\blapsed\b|\bdelayed\b|\bexpired\b/],
    ["disposed", /\bdispos\w*|\bdismissed\b|\bdecided\b|\bclosed\b/],
    ["active", /\bactive\b|\bongoing\b|\bpending cases?\b/]
  ];
  const FLAGLABEL = { exparte: "Ex-parte", missing: "Reply missing, hearing within 7 days", pending: "Reply pending", filed: "Reply filed", overdue: "Overdue (date passed)", disposed: "Disposed", active: "Active" };
  const findFlag = (q) => { for (let i = 0; i < FLAGS.length; i++) if (FLAGS[i][1].test(q)) return FLAGS[i][0]; return null; };

  /* ───────────── 4. DATES ───────────── */
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONKEY = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const todayD = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysFrom = (d) => Math.round((d - todayD()) / 86400000);
  const fmtDate = (d) => DOW[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
  const shortDate = (d) => d.getDate() + " " + MON[d.getMonth()];
  function rel(d) {
    const n = daysFrom(d);
    if (n === 0) return "today"; if (n === 1) return "tomorrow"; if (n === -1) return "yesterday";
    return n > 1 ? "in " + n + " days" : Math.abs(n) + " days ago";
  }
  function mkDate(y, m, d) { const x = new Date(y, m, d); return x.getMonth() === m && x.getDate() === d ? x : null; }
  function parseDateStr(s) {
    if (!s) return null; s = String(s).trim(); let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return mkDate(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s))) return mkDate(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    if ((m = /^(\d{1,2})[\s\-\/,]*([A-Za-z]{3})[a-z]*[\s\-\/,]*(\d{2,4})/.exec(s)) && has(MONKEY, m[2].toLowerCase())) return mkDate(+m[3] < 100 ? 2000 + +m[3] : +m[3], MONKEY[m[2].toLowerCase()], +m[1]);
    return null;
  }
  function parseWhen(q) {
    const t = todayD(); let m;
    const out = (from, to, label) => ({ from, to, label, q: q.replace(m[0], " ").replace(/\s+/g, " ").trim() });
    if ((m = /\bday after tomorrow\b/.exec(q))) return out(addDays(t, 2), addDays(t, 2), "day after tomorrow");
    if ((m = /\btomorrow\b/.exec(q))) return out(addDays(t, 1), addDays(t, 1), "tomorrow");
    if ((m = /\btoday\b/.exec(q))) return out(t, t, "today");
    if ((m = /\byesterday\b/.exec(q))) return out(addDays(t, -1), addDays(t, -1), "yesterday");
    if ((m = /\b(?:next|within|in) (\d{1,2}) days?\b/.exec(q))) return out(t, addDays(t, +m[1]), "next " + m[1] + " days");
    if ((m = /\bthis week\b/.exec(q))) return out(t, addDays(t, (6 - t.getDay() + 7) % 7), "this week");
    if ((m = /\bnext week\b/.exec(q))) { const f = addDays(t, 7 - ((t.getDay() + 6) % 7)); return out(f, addDays(f, 5), "next week"); }
    if ((m = /\bthis month\b/.exec(q))) return out(t, new Date(t.getFullYear(), t.getMonth() + 1, 0), "this month");
    if ((m = /\bnext month\b/.exec(q))) return out(new Date(t.getFullYear(), t.getMonth() + 1, 1), new Date(t.getFullYear(), t.getMonth() + 2, 0), "next month");
    let d = null;
    if ((m = /\b(\d{1,2})(?:st|nd|rd|th)? ?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?: (\d{4}))?\b/.exec(q))) d = { d: +m[1], mo: MONKEY[m[2]], y: m[3] ? +m[3] : null };
    else if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?\b/.exec(q))) d = { d: +m[2], mo: MONKEY[m[1]], y: m[3] ? +m[3] : null };
    else if ((m = /\b(\d{1,2}) (\d{1,2}) (\d{4}|\d{2})\b/.exec(q))) d = { d: +m[1], mo: +m[2] - 1, y: +m[3] < 100 ? 2000 + +m[3] : +m[3] };
    if (d) {
      let x = mkDate(d.y || t.getFullYear(), d.mo, d.d);
      if (x && !d.y && x < addDays(t, -30)) x = mkDate(t.getFullYear() + 1, d.mo, d.d);
      if (x) return out(x, x, "on " + fmtDate(x));
    }
    return null;
  }

  /* ───────────── 5. DATA LAYER ───────────── */
  const K = {
    title: ["title", "casetitle", "causetitle", "parties", "partynames", "casename"],
    number: ["casenumber", "caseno", "cnr", "cnrno", "cnrcaseno", "casenocnr", "number"],
    subject: ["subject", "subjectmatter", "matter"],
    dept: ["dept", "department", "departmentname"],
    court: ["court", "courtname", "forum"],
    last: ["lastproceeding", "lastproc", "lastproceedings", "proceedings", "lastorder"],
    next: ["nexthearing", "nextdate", "hearingdate", "nexthearingdate"],
    reply: ["replystatus", "reply"],
    status: ["casestatus", "status"],
    type: ["casetype", "type"],
    counsel: ["standingcounsel", "advocate", "counsel", "assignedadvocate", "assignedcounsel"],
    exparte: ["exparte", "isexparte", "exparteflag"]
  };
  function toRow(raw) {
    const lk = {};
    Object.keys(raw).forEach((k) => { lk[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = raw[k]; });
    const g = (keys) => { for (let i = 0; i < keys.length; i++) { const v = lk[keys[i]]; if (v != null) { const s = String(v).trim(); if (s && s !== "—" && s !== "-") return s; } } return ""; };
    const r = { title: g(K.title), number: g(K.number), subject: g(K.subject), dept: g(K.dept), court: g(K.court), last: g(K.last), nextRaw: g(K.next), status: g(K.status), reply: g(K.reply), type: g(K.type), counsel: g(K.counsel) };
    const ex = g(K.exparte);
    r.next = parseDateStr(r.nextRaw);
    r.disposed = /dispos|decided|dismiss|closed|withdrawn|struck/i.test(r.status);
    const rp = r.reply.toLowerCase();
    r.replyState = /not\s*filed|pend|await|\bnil\b|\bno\b/.test(rp) ? "pending" : /filed|submit|done|yes/.test(rp) ? "filed" : "";
    r.exparte = /^(true|yes|y|1)$/i.test(ex) || /ex.?parte/i.test(ex + " " + r.status);
    r.courtId = resolveCourt(r.court);
    r.deptCanon = resolveDept(r.dept);
    return r;
  }
  const courtLabel = (r) => (r.courtId ? courtById[r.courtId].short : r.court || "Court not set");
  const deptLabel = (r) => r.deptCanon || r.dept || "Department not set";
  function tokenizeRow(r) {
    const out = [];
    [[r.title, 3], [r.number, 3], [r.subject, 1.4], [deptLabel(r), 1], [courtLabel(r), 1], [r.type, 0.8]].forEach((f) => {
      tokenize(f[0]).forEach((t) => { const o = mk(t); o.w = f[1]; out.push(o); });
    });
    return out;
  }
  function setRows(list) {
    const seen = Object.create(null), rows = [];
    (list || []).forEach((raw) => {
      if (!raw || typeof raw !== "object") return;
      const r = toRow(raw); if (!r.title) return;
      const k = r.title + "|" + r.number + "|" + r.court; if (seen[k]) return; seen[k] = 1; rows.push(r);
    });
    TITLE_VOCAB = Object.create(null);
    rows.forEach((r) => { r._tok = tokenizeRow(r); r._tok.forEach((t) => { TITLE_VOCAB[t.t] = 1; }); });
    DATA.rows = rows;
  }
  const hasData = () => DATA.rows.length > 0;

  const FIXED_COLS = ["#", "caseno", "title", "subject", "dept", "court", "lastproc", "nexthearing", "replystatus", "casestatus", "type", "standingcounsel", "exparte"];
  function scrapeTables() {
    const out = [];
    document.querySelectorAll("table").forEach((tb) => {
      const heads = Array.prototype.map.call(tb.querySelectorAll("thead th"), (th) => th.textContent.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const keys = heads.length >= 8 ? heads : FIXED_COLS;
      tb.querySelectorAll("tbody tr").forEach((tr) => {
        const tds = tr.querySelectorAll("td"); if (tds.length < 8) return;
        const o = {}; for (let i = 0; i < tds.length; i++) o[keys[i] || "c" + i] = tds[i].textContent.trim();
        out.push(o);
      });
    });
    return out;
  }
  function getClient() {
    const c = CFG.client || W.supabaseClient || W.sb || W._sb || W.sbClient || null;
    return c && typeof c.from === "function" ? c : null;
  }
  async function fetchRows() {
    if (CFG.supabaseUrl && CFG.supabaseKey && typeof fetch === "function") {
      try {
        let all = [];
        for (let from = 0; from < CFG.maxRows; from += 1000) {
          const res = await fetch(CFG.supabaseUrl + "/rest/v1/" + encodeURIComponent(CFG.table) + "?select=*", {
            headers: { apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey, Range: from + "-" + (from + 999), "Range-Unit": "items" }
          });
          if (!res.ok) break;
          const part = await res.json(); if (!Array.isArray(part)) break;
          all = all.concat(part); if (part.length < 1000) break;
        }
        if (all.length) return { list: all, source: "supabase" };
      } catch (e) { /* try next source */ }
    }
    const cl = getClient();
    if (cl) {
      try {
        let all = [];
        for (let from = 0; from < CFG.maxRows; from += 1000) {
          const r = await cl.from(CFG.table).select("*").range(from, from + 999);
          if (r.error || !r.data) break;
          all = all.concat(r.data); if (r.data.length < 1000) break;
        }
        if (all.length) return { list: all, source: "supabase-client" };
      } catch (e) { /* next */ }
    }
    for (const n of ["allCases", "cases", "casesData", "DLO_CASES", "ALL_ROWS"]) if (Array.isArray(W[n]) && W[n].length && typeof W[n][0] === "object") return { list: W[n], source: "page" };
    if (HAS_DOM) { const t = scrapeTables(); if (t.length) return { list: t, source: "page-table" }; }
    return { list: [], source: "none" };
  }
  function ensureData(force) {
    if (DATA.loading) return DATA.loading;
    if (!force && DATA.at && Date.now() - DATA.at < CFG.refreshMs) return Promise.resolve();
    const timeout = new Promise((res) => setTimeout(() => res({ list: [], source: "timeout" }), 9000));
    DATA.loading = Promise.race([fetchRows(), timeout])
      .then((res) => { if (res.list.length) { setRows(res.list); DATA.source = res.source; } })
      .catch(() => {})
      .then(() => { DATA.at = Date.now(); DATA.loading = null; });
    return DATA.loading;
  }
  function detectStaff() {
    const v = typeof CFG.isStaff === "function" ? CFG.isStaff() : CFG.isStaff;
    if (typeof v === "boolean") { S.staff = v; return Promise.resolve(); }
    const cl = getClient();
    if (cl && cl.auth && typeof cl.auth.getSession === "function") return cl.auth.getSession().then((r) => { S.staff = !!(r && r.data && r.data.session); }).catch(() => {});
    return Promise.resolve();
  }
  function logMiss(q) {
    if (!CFG.logTable || !CFG.supabaseUrl || !CFG.supabaseKey || typeof fetch !== "function") return;
    const shape = q.split(" ").filter((w) => NOISE[w] || VOCABSET[w]).join(" ");   // question shape only, never names
    if (!shape) return;
    try {
      fetch(CFG.supabaseUrl + "/rest/v1/" + encodeURIComponent(CFG.logTable), {
        method: "POST",
        headers: { apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ shape, page: (W.location && W.location.pathname) || "", v: VERSION })
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  /* ───────────── 6. SEARCH & FILTER ENGINE ───────────── */
  const orderKey = (r) => { if (r.disposed) return 1e9; if (!r.next) return 5e8; const n = daysFrom(r.next); return n >= 0 ? n : 1e6 - n; };
  const byOrder = (a, b) => orderKey(a) - orderKey(b);

  function rowPass(r, f) {
    if (f.court && r.courtId !== f.court.id) return false;
    if (f.dept && r.deptCanon !== f.dept.name) return false;
    if (f.type && normKey(r.type).indexOf(f.type.kw) === -1) return false;
    if (f.flag) {
      const soon = r.next ? daysFrom(r.next) : null;
      switch (f.flag) {
        case "exparte": if (!(r.exparte && !r.disposed)) return false; break;
        case "overdue": if (!(!r.disposed && soon !== null && soon < 0)) return false; break;
        case "missing": if (!(!r.disposed && r.replyState === "pending" && soon !== null && soon >= 0 && soon <= 7)) return false; break;
        case "pending": if (!(!r.disposed && r.replyState === "pending")) return false; break;
        case "filed": if (r.replyState !== "filed") return false; break;
        case "disposed": if (!r.disposed) return false; break;
        case "active": if (r.disposed) return false; break;
      }
    }
    if (f.when) { if (r.disposed || !r.next || r.next < f.when.from || r.next > f.when.to) return false; }
    return true;
  }
  function scoreAll(qs, pool) {
    const exact = [], partial = [];
    pool.forEach((r) => {
      let score = 0, hit = 0, fuzzy = false, inTitle = 0, strong = 0;
      qs.forEach((q) => {
        let best = 0, bestSim = 0, bestW = 0;
        for (let i = 0; i < r._tok.length; i++) {
          const d = r._tok[i], s = simTok(q, d);
          if (s < MATCH_MIN) continue;
          const sc = s * d.w; if (sc > best) { best = sc; bestSim = s; bestW = d.w; }
        }
        if (best) { hit++; score += best; if (bestSim < 0.85) fuzzy = true; if (bestW === 3) inTitle++; if (bestW >= 1.4) strong++; }
      });
      if (!hit || !strong) return;   // at least one word must hit the title, case no. or subject
      if (inTitle === qs.length) score += 1;
      const item = { row: r, score, fuzzy };
      if (hit === qs.length) exact.push(item); else if (qs.length > 1 && hit * 2 >= qs.length) partial.push(item);
    });
    const cmp = (a, b) => b.score - a.score || byOrder(a.row, b.row);
    exact.sort(cmp); partial.sort(cmp);
    return { exact, partial, fuzzy: exact.some((x) => x.fuzzy) };
  }
  function runSearch(rem, ent) {
    const qs = rem.map(mk);
    const filt = ent && (ent.court || ent.dept || ent.type || ent.flag || ent.when);
    let res = scoreAll(qs, filt ? DATA.rows.filter((r) => rowPass(r, ent)) : DATA.rows);
    if (!res.exact.length && filt) res = scoreAll(qs, DATA.rows);   // soft filters: retry without them
    res.qs = qs;
    return res;
  }
  function computeStats(rows) {
    const s = { total: rows.length, active: 0, disposed: 0, replyPending: 0, replyFiled: 0, exparte: 0 };
    rows.forEach((r) => {
      if (r.disposed) s.disposed++; else { s.active++; if (r.replyState === "pending") s.replyPending++; if (r.exparte) s.exparte++; }
      if (r.replyState === "filed") s.replyFiled++;
    });
    s.rate = s.total ? Math.round((s.disposed / s.total) * 100) + "%" : "0%";
    return s;
  }
  function group(rows, fn) {
    const m = Object.create(null);
    rows.forEach((r) => { const k = fn(r) || "Unspecified"; (m[k] = m[k] || { k, n: 0, rows: [] }).n++; m[k].rows.push(r); });
    return Object.keys(m).map((k) => m[k]).sort((a, b) => b.n - a.n);
  }
  function snapshot() {
    if (!hasData()) return null;
    const act = DATA.rows.filter((r) => !r.disposed && r.next);
    const d = (r) => daysFrom(r.next);
    return {
      today: act.filter((r) => d(r) === 0).length,
      week: act.filter((r) => d(r) >= 0 && d(r) <= 7).length,
      overdue: act.filter((r) => d(r) < 0).length,
      missing: DATA.rows.filter((r) => rowPass(r, { flag: "missing" })).length
    };
  }

  /* ───────────── 7. REPLIES ───────────── */
  const R = (text, o) => { o = o || {}; return { text, cards: o.cards || null, link: o.link || null, chips: o.chips || null, hl: o.hl || null, stream: !!o.stream, foot: o.foot || null }; };
  const C = (label, q) => ({ label, q });
  const MENU = C("« Main menu", "menu");
  const MAIN_CHIPS = [C("Today's hearings", "hearings today"), C("Hearings tomorrow", "hearings tomorrow"), C("Missing replies", "missing reply hearing soon"), C("Overdue cases", "overdue cases"), C("Statistics", "statistics"), C("Departments", "all departments"), C("Courts", "all courts"), C("Law desk", "law desk"), C("Office info", "office hours and address")];

  function noData() {
    return R("I can't reach the live case registry from this page right now, so I can't search or count cases.\n\nOffice information still works — or use the portal's own search.", { link: PAGES.search, chips: [C("Office info", "office hours and address"), MENU] });
  }
  function openingReply() {
    const s = snapshot();
    let t = "Welcome to the " + OFFICE.name + " legal desk.\n\n";
    t += s ? "**Today:** " + s.today + " hearing(s) · **Next 7 days:** " + s.week + "\n**Overdue:** " + s.overdue + " · **Reply missing (hearing within 7 days):** " + s.missing + "\n\n"
           : "The live registry isn't reachable from this page, so case search and counts are unavailable right now.\n\n";
    t += "Type a litigant name or any word from a case title, a case number, a court, a department, a date, or a civil-procedure question (caveat, execution, contempt, condonation of delay — for example “yaqoob khan”, “hearings tomorrow”, “PMGSY pending replies”.";
    return R(t, { chips: MAIN_CHIPS });
  }
  function askParty() { return R("Which case? Type a litigant name, a word from the case title, or a case number / CNR — for example “next date of Yaqoob Khan”.", { chips: [MENU] }); }
  function fallback(text, q) {
    logMiss(q);
    return R("I couldn't match “" + trunc(text, 60) + "”. Try one of these:\n\n• A litigant name or a word from a case title — “yaqoob”, “land acquisition”\n• A court or department — “Sub Judge Kupwara”, “PMGSY pending replies”\n• A date — “hearings tomorrow”, “cases on 15 Oct”\n• Office & process — “office hours”, “who is the DLO”, “parawise SOP”", { chips: MAIN_CHIPS });
  }

  // paging (cards or lines)
  function cardsReply(first) {
    const p = S.pager, from = p.i, slice = p.items.slice(from, from + p.size); p.i += slice.length;
    let t;
    if (first) {
      t = p.head;
      if (!S.staff && p.items.length > 1) t += "\nShowing one at a time — tap Next for the others.";
      if (p.note) t += "\n" + p.note;
    } else t = S.staff ? "Cases " + (from + 1) + "–" + p.i + " of " + p.items.length + ":" : "Match " + (from + 1) + " of " + p.items.length + ":";
    S.last = slice[0] || S.last;
    const left = p.items.length - p.i, chips = [];
    if (left > 0) chips.push(C(S.staff ? "Show " + Math.min(left, p.size) + " more ›" : "Next match (" + (p.i + 1) + " of " + p.items.length + ") ›", "__more"));
    chips.push(MENU);
    return R(t, { cards: slice, chips, hl: p.hl });
  }
  const lineFor = (r, showCourt) => trunc(r.title, 58) + " — " + (r.next ? shortDate(r.next) + " (" + rel(r.next) + ")" : "date awaited") + (showCourt ? " · " + courtLabel(r) : "") + (!r.disposed && r.replyState === "pending" ? " · reply pending" : "");
  function linesReply(first) {
    const p = S.pager, from = p.i, slice = p.items.slice(from, from + p.size); p.i += slice.length;
    const body = slice.map((r, k) => (from + k + 1) + ". " + lineFor(r, p.showCourt)).join("\n");
    const t = first ? p.head + "\n\n" + body : "Cases " + (from + 1) + "–" + p.i + " of " + p.items.length + ":\n\n" + body;
    const left = p.items.length - p.i, chips = [];
    if (left > 0) chips.push(C("Show " + Math.min(left, p.size) + " more ›", "__more"));
    return R(t, { chips: chips.concat(p.chips || [MENU]), link: p.link });
  }
  function moreReply() {
    const p = S.pager;
    if (!p || p.i >= p.items.length) return R("That's everything for this list.", { chips: [MENU] });
    return p.kind === "cards" ? cardsReply(false) : linesReply(false);
  }

  function casesReply(res, rem, partial) {
    const rows = (partial ? res.partial : res.exact).map((x) => x.row), n = rows.length, qtxt = rem.join(" ");
    const head = partial
      ? "I couldn't find every word together — closest matches for “" + qtxt + "” (" + n + "):"
      : "Found " + n + " case" + (n > 1 ? "s" : "") + " matching “" + qtxt + "”:";
    S.pager = { kind: "cards", items: rows, size: S.staff ? CFG.staffPageSize : CFG.publicPageSize, i: 0, head, note: res.fuzzy || partial ? "Matched by similar spelling — please verify the title." : "", hl: res.qs };
    return cardsReply(true);
  }
  function notFound(res, rem) {
    S.partial = res.partial.length ? { res, rem } : null;
    const chips = []; if (S.partial) chips.push(C("Show closest matches (" + res.partial.length + ")", "__partial")); chips.push(MENU);
    return R("I couldn't find a registered case matching “" + rem.join(" ") + "”.\n\nTry another spelling, fewer words, a word from the title, or the case number / CNR.", { link: PAGES.search, chips });
  }
  function byNumber(id) {
    if (!hasData()) return noData();
    const k = normKey(id), rows = DATA.rows.filter((r) => r.number && normKey(r.number).indexOf(k) !== -1);
    if (!rows.length) return R("Case / CNR “" + id + "” was not found in the registry.\n\nCheck the number, or use Search & Filter Cases.", { link: PAGES.search, chips: [MENU] });
    S.pager = { kind: "cards", items: rows, size: S.staff ? CFG.staffPageSize : CFG.publicPageSize, i: 0, head: "Record found for " + id + ":", note: "", hl: [] };
    return cardsReply(true);
  }

  const entityQ = (f) => [f.dept && f.dept.name, f.court && f.court.short, f.type && f.type.name].filter(Boolean).join(" ");
  function filterReply(f, wantList) {
    if (!hasData()) return noData();
    S.lastFilter = f;
    const base = DATA.rows.filter((r) => rowPass(r, { court: f.court, dept: f.dept, type: f.type }));
    const st = computeStats(base), eq = entityQ(f);
    const title = [f.dept && f.dept.name, f.court && f.court.short, f.type && f.type.name].filter(Boolean).join(" · ") || "DLO Kupwara";
    const noEnt = !(f.court || f.dept || f.type);
    let head = "**" + title + "**\nTotal " + st.total + " · Active " + st.active + " · Disposed " + st.disposed + (st.total ? " (" + st.rate + ")" : "") + "\nReplies pending " + st.replyPending + " · Filed " + st.replyFiled + " · Ex-parte " + st.exparte;
    if (!st.total) return R("No registered cases found for " + title + ".", { chips: [MENU] });
    const listFlags = { exparte: 1, overdue: 1, missing: 1 };
    const listy = f.when || (f.flag && (listFlags[f.flag] || wantList));
    if (!listy) {
      const cnt = f.flag ? base.filter((r) => rowPass(r, { flag: f.flag })).length : null;
      if (cnt !== null) head = "**" + FLAGLABEL[f.flag] + ": " + cnt + "**\n" + head;
      const q2 = (x) => (x + " " + eq).trim();
      const tchips = [];
      if (f.phrase) { const tr = runSearch(f.phrase.split(" "), null); if (tr.exact.length) tchips.push(C("Cases with “" + f.phrase + "” in the title (" + tr.exact.length + ")", "__title " + f.phrase)); }
      return R(head, { chips: tchips.concat([C("Hearings this week", q2("hearings this week")), C("Overdue", q2("overdue")), C("Reply missing", q2("missing reply")), C("Ex-parte", q2("ex parte")), C("List active", q2("list active"))].concat(lawChipFor(f.type) ? [lawChipFor(f.type)] : [], [MENU])) });
    }
    const sel = base.filter((r) => rowPass(r, { flag: f.flag, when: f.when })).sort(byOrder);
    const label = [f.flag && FLAGLABEL[f.flag], f.when && "Hearings " + f.when.label].filter(Boolean).join(" · ");
    let t = (noEnt ? "" : head + "\n\n") + "**" + label + ": " + sel.length + "**";
    if (f.when && !f.court && sel.length) t += "\nBy court: " + group(sel, courtLabel).slice(0, 6).map((g) => g.k + " " + g.n).join(" · ");
    if (f.flag === "exparte") t += "\n\nDepartments should file restoration applications or parawise objections through standing counsel to avoid adverse ex-parte decrees.";
    if (f.type && f.type.kw === "contempt") t += "\n\nATRs must reach the DLO at least 48 hours before the hearing to prevent personal appearance.";
    if (!sel.length) return R(t + "\n\nNo cases match.", { chips: [MENU] });
    S.pager = { kind: "lines", items: sel, size: 8, i: 0, head: t, showCourt: !f.court, chips: [MENU], link: f.when ? PAGES.hearings : PAGES.search };
    return linesReply(true);
  }

  // general (entity-less) data answers
  function generalData(q) {
    if (!/\b(courts?|dept|department|departments|repl(y|ies)|pending|cases|types?|stat|stats|statistics|summary|overview|dashboard|total|how many|disposal|stakeholders?)\b/.test(q)) return null;
    if (!hasData()) return noData();
    const rows = DATA.rows, rank = /\b(most|highest|maximum|largest|top|busiest|worst|zyada|sabse)\b/.test(q);
    if (rank && /\bcourts?\b/.test(q)) {
      const g = group(rows, courtLabel).slice(0, 5), ex = group(rows.filter((r) => r.exparte && !r.disposed), courtLabel).slice(0, 3);
      return R("**Highest caseload by court**\n" + g.map((x, i) => (i + 1) + ". " + x.k + " — " + x.n + " cases").join("\n") + (ex.length ? "\n\n**Most ex-parte:** " + ex.map((x) => x.k + " (" + x.n + ")").join(", ") : ""), { chips: [C("All courts", "all courts"), MENU] });
    }
    if (rank && /(dept|department|repl|pend)/.test(q)) {
      const g = group(rows.filter((r) => !r.disposed && r.replyState === "pending"), deptLabel).slice(0, 7);
      return R("**Most replies pending (active cases)**\n" + g.map((x, i) => (i + 1) + ". " + x.k + " — " + x.n).join("\n"), { link: PAGES.performance, chips: [C("Department overview", "all departments"), MENU] });
    }
    if (/\b(all courts|court (distribution|wise|list)|how many courts|courts covered)\b/.test(q)) {
      const g = group(rows, courtLabel);
      return R("**Court-wise distribution (" + g.length + " courts)**\n" + g.map((x, i) => (i + 1) + ". " + x.k + " — " + x.n + " (active " + x.rows.filter((r) => !r.disposed).length + ")").join("\n"), { link: PAGES.analytics, chips: [MENU] });
    }
    if (/\b(all departments|dept (list|wise)|department (list|wise|overview)|how many departments|stakeholders?)\b/.test(q)) {
      const g = group(rows, deptLabel);
      return R("**Departments (" + g.length + ") — top 10 by cases**\n" + g.slice(0, 10).map((x) => x.k + " — " + x.n + " · replies pending " + x.rows.filter((r) => !r.disposed && r.replyState === "pending").length).join("\n") + "\n\nAsk “<department name>” for any one department.", { link: PAGES.analytics, chips: [C("Most pending replies", "which department has most pending replies"), MENU] });
    }
    if (/\b(case types?|types of cases?|kinds of cases?)\b/.test(q)) {
      const g = group(rows, (r) => r.type).slice(0, 12);
      return R("**Case types**\n" + g.map((x) => x.k + " — " + x.n).join("\n"), { chips: [C("Contempt cases", "contempt petitions"), MENU] });
    }
    if (/\b(stat|stats|statistics|summary|overview|dashboard|total|how many|disposal)\b/.test(q)) {
      const st = computeStats(rows), sn = snapshot();
      return R("**DLO Kupwara — live registry**\nTotal " + st.total + " · Active " + st.active + " · Disposed " + st.disposed + " (" + st.rate + ")\nReplies pending " + st.replyPending + " · Filed " + st.replyFiled + " · Ex-parte " + st.exparte + "\n\nHearings today " + sn.today + " · next 7 days " + sn.week + "\nOverdue " + sn.overdue + " · Reply missing (≤ 7 days) " + sn.missing, { link: PAGES.analytics, chips: [C("Overdue cases", "overdue cases"), C("Missing replies", "missing reply hearing soon"), C("Top courts", "which court has most cases"), MENU] });
    }
    return null;
  }

  // static knowledge intents  [id, regex, keywords, run, skipIfEntity]
  const kwset = (s) => set(s);
  const INTENTS = [
    { id: "office", re: /\b(timings?|hours|address|location|pin ?code|email|e mail|phone|mobile|contact|where|sunday|holiday|walk ?in)\b|\b(office|dlo)\b.*\b(open|closed?|located)\b|\b(open|closed?)\b.*\b(office|dlo)\b/,
      kw: kwset("office dlo timing timings hours open close closed address location pin pincode code email e mail phone mobile contact where sunday saturday holiday walk in visit located when"),
      run: (q) => {
        const pre = /\bsunday\b/.test(q) ? "No — the office is closed on Sundays and public holidays.\n\n" : /\bsaturday\b/.test(q) ? "Yes — the office is open on Saturdays.\n\n" : "";
        return R(pre + "**" + OFFICE.name + "**\n" + OFFICE.address + "\n\nHours: " + OFFICE.hours + "\nClosed: " + OFFICE.closed + "\nEmail: " + OFFICE.email + "\n\nBring the case number / CNR and hearing date when you visit.", { link: PAGES.contact, chips: [C("Send an enquiry", "enquiry"), MENU] });
      } },
    { id: "perf", re: /\b(performance|attendance|counsel log)\b/, kw: kwset("performance attendance counsel log standing"),
      run: () => R("The Performance dashboard shows department-wise reply timeliness and standing-counsel activity. Full counsel details and exports are available to staff after login.", { link: PAGES.performance, chips: [MENU] }) },
    { id: "counsel", re: /\b(standing counsel|counsel|lawyer|advocate|adv|zubair|wasim|vakil)\b/, kw: kwset("standing counsel lawyer advocate adv zubair wasim vakil who"),
      run: () => {
        let t = "**Standing counsel**\n" + OFFICE.counsel.join("\n");
        if (S.staff && hasData()) t += "\n\nMatters assigned: " + OFFICE.counsel.map((n, i) => { const k = i === 0 ? /zubair/i : /wasim/i; return n.replace("Adv. ", "") + " " + DATA.rows.filter((r) => k.test(r.counsel)).length; }).join(" · ");
        return R(t, { link: PAGES.about, chips: [MENU] });
      } },
    { id: "dlo", re: /\b(dlo|ishfaq|litigation officer|incharge|in charge|heads?)\b/, kw: kwset("dlo ishfaq ahmad khan litigation officer incharge in charge head heads who district"),
      run: () => R("**District Litigation Officer**\n" + OFFICE.dlo + "\n" + OFFICE.parent + ".\nOffice: " + OFFICE.address, { link: PAGES.about, chips: [MENU] }) },
    { id: "developer", re: /\b(developer|who (built|made|created|designed)|tariq|version)\b/, kw: kwset("developer built made created designed tariq version who"),
      run: () => R("Designed and developed by " + OFFICE.developer + " for " + OFFICE.name + ", " + OFFICE.parent + ".\n\nPortal " + OFFICE.portalVersion + " (PWA enabled) · Assistant " + VERSION + ".", { chips: [MENU] }) },
    { id: "sop", re: /\b(sop|parawise|para wise|vetting|scrutiny|how to (submit|file) (a )?repl(y|ies)|submit repl(y|ies))\b/, kw: kwset("sop parawise para wise vetting scrutiny how to submit file reply replies"),
      run: () => R("**Parawise reply SOP**\n1. Draft the parawise reply within the 3-day window.\n2. Send it to the DLO scrutiny desk for vetting.\n3. Finalise with standing counsel and file before the hearing.\n\nIn contempt matters, furnish the Action Taken Report (ATR) at least 48 hours before the hearing to prevent personal appearance.", { link: PAGES.contact, chips: [C("Missing replies", "missing reply hearing soon"), MENU] }) },
    { id: "contempt", re: /\b(contempt|atr|action taken|personal appearance|compliance)\b/, kw: kwset("contempt atr action taken personal appearance compliance petition petitions what is"), skipIfEntity: true,
      run: () => {
        const n = hasData() ? DATA.rows.filter((r) => !r.disposed && normKey(r.type).indexOf("contempt") !== -1).length : null;
        return R("**Contempt petitions & compliance**" + (n !== null ? "\n" + n + " active contempt petition(s) are monitored." : "") + "\nHeads of Department must submit the ATR and verified compliance at least 48 hours before the hearing. Coordinate with the DLO scrutiny desk to avert personal appearance orders.", { chips: n ? [C("List contempt cases", "list contempt petitions"), MENU] : [MENU] });
      } },
    { id: "pwa", re: /\b(app|install|pwa|apk|add to home)\b/, kw: kwset("app install pwa apk add to home screen download"),
      run: () => R("The portal is a PWA: open dlokupwara.in in Chrome or Safari and choose “Install app” / “Add to Home Screen”.", { chips: [MENU] }) },
    { id: "operator", re: /\b(login|log in|operator|staff portal|admin|password|otp)\b/, kw: kwset("login log in operator staff portal admin password otp"),
      run: () => R("Staff (court operators and the DLO) sign in on the operator portal to add and update case records. Public visitors don't need to log in.", { link: PAGES.operator, chips: [MENU] }) },
    { id: "disclaimer", re: /\b(disclaimer|legal proceeding|official record|is this official|valid in court|use in court)\b/, kw: kwset("disclaimer legal proceeding official record is this valid in court use"),
      run: () => R("**Disclaimer**\n" + OFFICE.disclaimer, { chips: [MENU] }) },
    { id: "enquiry", re: /\b(enquir\w*|inquir\w*|complaint form|send (a )?message|feedback|suggestion)\b/, kw: kwset("enquiry enquiries inquiry complaint form send message feedback suggestion"),
      run: () => R("Use the contact form for enquiries, feedback or corrections to a case record. Include the case number so the office can trace it quickly.", { link: PAGES.contact, chips: [MENU] }) },
    { id: "history", re: /\b(case history|history|audit trail|timeline|tracker)\b/, kw: kwset("case history audit trail timeline tracker"),
      run: () => R("The Case History tracker shows every change to a case — hearing dates, status and reply updates — with timestamps.", { link: PAGES.history, chips: [MENU] }) },
    { id: "calendar", re: /\bcalendar\b/, kw: kwset("calendar hearing"), run: () => R("The hearing calendar shows every listed date month by month.", { link: PAGES.calendar, chips: [MENU] }) },
    { id: "updates", re: /\b(circulars?|notices?|updates|notifications?)\b/, kw: kwset("circular circulars notice notices updates notification notifications orders"), run: () => R("Orders, notices and circulars are published on the Updates section.", { link: PAGES.updates, chips: [MENU] }) },
    { id: "practice", re: /\b(practice|mission|what do you do|dlsa|services|about (the )?(dlo|office))\b/, kw: kwset("practice mission what do you do dlsa services about the dlo office"),
      run: () => R(OFFICE.name + " manages civil litigation for Government departments in Kupwara — reply scrutiny, standing-counsel coordination and hearing tracking across 12 courts.", { link: PAGES.about, chips: [MENU] }) },
    { id: "exports", re: /\b(excel|pdf|whatsapp|print|export|csv)\b/, kw: kwset("excel pdf whatsapp print export csv download report"),
      run: () => R("**Exports on the portal**\n• Search / Filter — Excel, PDF, Print\n• Hearings — Excel, PDF, WhatsApp\n• Cause list — Print, WhatsApp, Excel\n\nWhatsApp sharing is meant for internal departmental circulation. On any case card here you can also copy it or share it on WhatsApp.", { link: PAGES.hearings, chips: [MENU] }) }
  ];
  const matchIntent = (q) => { for (let i = 0; i < INTENTS.length; i++) if (INTENTS[i].re.test(q)) return INTENTS[i]; return null; };

  /* ───────────── 7b. LAW DESK — civil-procedure knowledge base + retrieval ─────────────
   * Edit or extend the topics below (KT("id","Title",{...})). General information only; verify against current statutes. */
  const KB = [];
  const KT = (id, title, o) => { KB.push(Object.assign({ id, title }, o)); };
  /* ── Topics. Fields: a=aliases  k=extra keywords  r=refs  b=basis  d=definition  p=steps  t=time limits  gr=grounds/defences  g=tip for departments  n=effects & notes  rel=related ── */
  KT("applicability", "Which procedural law applies in J&K", {
    a: ["which law applies", "which procedural law applies", "is cpc applicable in jammu and kashmir", "cpc applicable", "is cpc applicable", "cpc applicable in jk", "applicable law", "applicable law in jk", "code of civil procedure jammu kashmir"],
    k: "jammu kashmir ladakh applicability reorganisation central laws high court rules",
    d: "Civil litigation in the UT of Jammu & Kashmir follows the Code of Civil Procedure and the Limitation Act as applicable to the UT after the 2019 reorganisation, together with the High Court's rules and any local amendments.",
    n: "Section numbers and time limits in the Law Desk follow the central statutes. Always confirm the current text, amendments and High Court rules with standing counsel before acting.",
    b: "J&K Reorganisation Act 2019; CPC 1908; Limitation Act 1963", rel: ["cpc_overview"]
  });
  KT("cpc_overview", "Code of Civil Procedure (CPC)", {
    a: ["cpc", "code of civil procedure", "civil procedure code", "cpc 1908", "what is cpc", "structure of cpc", "sections and orders of cpc", "cpc kya hai"],
    k: "procedural law civil courts orders rules first schedule sections",
    d: "The Code of Civil Procedure, 1908 is the procedural law for civil courts. It has 158 Sections (principles such as jurisdiction, res judicata, appeals, execution) and 51 Orders with Rules in the First Schedule (the working steps: pleadings, summons, evidence, injunctions, execution).",
    p: ["Sections state the principle — e.g. S.9 jurisdiction, S.11 res judicata, S.96 appeal, S.115 revision", "Orders and Rules give the procedure — e.g. O.VII plaint, O.VIII written statement, O.XXI execution", "It is procedural: it says how to litigate, not what the substantive rights are"],
    b: "CPC 1908", rel: ["civil_suit", "limitation", "applicability"]
  });
  KT("civil_suit", "Civil suit process (stages)", {
    a: ["civil suit", "civil suit process", "civil suit procedure", "stages of a civil suit", "how a civil suit proceeds", "civil case process", "civil litigation process", "institution of suit", "filing a suit", "life cycle of a suit", "suit kaise chalta hai"],
    k: "suit plaint summons written statement issues evidence decree stages steps trial",
    r: ["s26", "o4"], b: "CPC S.26, Orders IV–XX",
    d: "A civil suit enforces a private civil right (money, property, injunction, declaration). It begins with a plaint and ends with a decree, which may then be appealed or executed.",
    p: ["Pre-suit: legal notice; for suits against Government a S.80 notice (two months) is mandatory", "Plaint filed with court fee, verification and list of documents (Order VII)", "Summons to the defendant (Order V) — 30 days to appear and answer", "Written statement (Order VIII) — 30 days, extendable to 90; counterclaim/set-off if any", "Admission/denial of documents and discovery (Orders XI–XIII)", "Framing of issues (Order XIV)", "Evidence: plaintiff first, then defendant; examination-in-chief by affidavit, then cross-examination (Order XVIII)", "Final arguments, judgment and decree (Order XX)", "Appeal, review or revision by the losing side; execution by the winner (Order XXI)"],
    t: "Written statement: 30 days from service (max 90). Appeal after decree: 30 days (District Court) or 90 days (High Court).",
    g: "On receiving a summons, send it to the DLO the same day with the plaint and documents so a parawise reply can be prepared and filed in time.",
    n: "Missing a timeline (especially the written statement) can close your right to defend.",
    rel: ["plaint", "summons", "written_statement", "issues", "evidence", "judgment_decree", "appeals", "execution"]
  });
  KT("plaint", "Plaint", {
    a: ["plaint", "contents of plaint", "what should a plaint contain", "filing a plaint", "draft a plaint", "plaint requirements", "order 7 plaint", "plaint kya hai"],
    k: "cause of action relief valuation verification court fee", r: ["o7", "o7r1", "o6r15"], b: "CPC Order VII; Order VI R.15",
    d: "A plaint is the written claim by which a civil suit is started. It must contain the particulars required by Order VII Rule 1.",
    p: ["Name of the court and names/addresses of the parties", "Facts showing the cause of action and when it arose", "Facts showing the court has jurisdiction", "Relief claimed, and the value of the subject-matter for jurisdiction and court fee", "Verification and signature (O.VI R.15); documents relied on listed and filed with it (O.VII R.14)"],
    g: "Read the plaint on receipt: note the cause of action, relief, valuation and documents. Your parawise reply must answer every paragraph.",
    rel: ["reject_plaint", "summons", "written_statement"]
  });
  KT("reject_plaint", "Rejection of plaint (Order VII Rule 11)", {
    a: ["rejection of plaint", "reject plaint", "order 7 rule 11", "plaint rejected", "suit not maintainable", "non maintainability of suit", "dismiss suit at threshold", "o7r11"],
    k: "maintainability barred by law cause of action undervalued insufficient stamp", r: ["o7r11"], b: "CPC Order VII Rule 11",
    d: "A court must reject a plaint at the threshold if it falls within Order VII Rule 11 — without waiting for trial.",
    gr: "Grounds: (a) no cause of action disclosed; (b) relief undervalued and not corrected in the time given; (c) insufficient court fee not made good in time; (d) suit appears from the plaint to be barred by law (e.g. limitation, no S.80 notice); (e) plaint not filed in duplicate; (f) non-compliance with Rule 9.",
    n: "Only the plaint and its documents are examined, not the defence. Rejection does not bar a fresh plaint on the same cause of action (R.13).",
    g: "A department can seek rejection of a clearly time-barred or legally barred plaint — raise it through counsel at the first opportunity, usually along with the written statement.",
    rel: ["plaint", "limitation", "s80_notice"]
  });
  KT("summons", "Summons and service", {
    a: ["summons", "service of summons", "summons to defendant", "order 5", "how is summons served", "substituted service", "summons received what to do"],
    k: "service notice appear registered post email affixation", r: ["o5", "o5r1", "o5r20"], b: "CPC Order V; Order XXVII R.4–5",
    d: "Summons is the court's notice calling the defendant to appear and answer the plaint (Order V).",
    p: ["Issued after the suit is instituted, with a copy of the plaint; the defendant must appear and file the written statement within 30 days of service (R.1)", "Service through the court, approved courier, registered post or e-mail as the court permits (R.9); if the defendant can't be found, affixation (R.17) or substituted service (R.20)", "Where the defendant is the Government, the Government pleader is the agent to receive process (O.XXVII R.4) and the court must allow reasonable time to communicate through the proper channel (R.5)", "If served but no one appears, the court may proceed ex parte (O.IX R.6)"],
    t: "The 30 days for the written statement run from the date of service.",
    g: "Send the summons and plaint to the DLO on the day of receipt — the clock runs from service, not from when the file reaches the office.",
    rel: ["written_statement", "exparte", "suits_govt"]
  });
  KT("written_statement", "Written statement (reply to plaint)", {
    a: ["written statement", "reply to plaint", "wsf", "reply to suit", "order 8", "how to file written statement", "parawise reply in civil suit", "counter claim reply", "defence in a suit"],
    k: "defence deny admit parawise counterclaim setoff replication delay extension not filed",
    r: ["o8", "o8r1", "o8r10"], b: "CPC Order VIII",
    d: "The written statement is the defendant's reply to the plaint. It must deal specifically with each allegation (Order VIII).",
    p: ["File within 30 days of service of summons; the court may extend it, up to 90 days, for reasons recorded (R.1)", "Admit or deny each paragraph specifically — evasive denial can be treated as admission (R.3–R.5)", "Take legal objections: limitation, jurisdiction, S.80 notice, non-joinder, maintainability", "Plead set-off (R.6) and counterclaim (R.6A) if any", "File the documents relied on with it (R.1A) and verify the pleading", "Plaintiff may file a replication; new grounds later need the court's leave"],
    t: "30 days from service; outer limit 90 days. In ordinary suits courts treat the 90 days as directory (extension only in exceptional cases, with costs); in commercial suits it is strict.",
    n: "If no written statement is filed, the court may pronounce judgment against the defendant or pass such order as it thinks fit (R.10) — this is why delay is dangerous.",
    g: "DLO practice: send parawise comments, documents and authorisation within the 3-day window; drafts go through the scrutiny desk and are finalised with standing counsel before filing.",
    rel: ["reject_plaint", "exparte", "condonation_delay"]
  });
  KT("issues", "Framing of issues", {
    a: ["issues", "framing of issues", "order 14", "how are issues framed", "preliminary issue", "burden of proof"],
    k: "disputed points fact law onus", r: ["o14"], b: "CPC Order XIV",
    d: "Issues are the disputed questions of fact or law that the court must decide, framed after reading the pleadings (Order XIV).",
    p: ["Court identifies propositions affirmed by one side and denied by the other (R.1)", "Issues of fact and of law are framed and the burden of proof is fixed", "An issue of law (e.g. jurisdiction, bar of limitation) may be tried first if it can dispose of the suit (R.2)", "Issues can be amended or added before the decree (R.5)"],
    rel: ["evidence", "civil_suit"]
  });
  KT("evidence", "Evidence in a civil suit", {
    a: ["evidence in civil suit", "order 18", "examination in chief", "cross examination", "affidavit evidence", "witness in civil case", "leading evidence", "exhibiting documents", "documentary evidence"],
    k: "witness affidavit exhibit cross examination summon witness", r: ["o18", "o16", "o13"], b: "CPC Orders XIII, XVI, XVIII",
    d: "After issues are framed each side proves its case with witnesses and documents (Orders XIII, XVI, XVIII).",
    p: ["The party with the burden of proof leads evidence first (O.XVIII R.1)", "Examination-in-chief is by affidavit; then cross-examination and re-examination (R.4)", "Documents are produced and marked as exhibits (Order XIII); originals should be available", "Witnesses are summoned through the court (Order XVI)", "The court can appoint commissioners to record evidence or inspect property (Order XXVI)", "Arguments follow the evidence"],
    n: "Adjournments during the hearing are limited to three per party, with costs (O.XVII R.1).",
    g: "Identify departmental witnesses early and keep original records ready; authorisation letters should name the officer who will depose.",
    rel: ["issues", "adjournments", "commission"]
  });
  KT("interim_injunction", "Temporary injunction / stay", {
    a: ["temporary injunction", "interim injunction", "injunction", "order 39", "ad interim injunction", "how to get stay", "status quo order", "injunction against government", "o39r1", "o39r2a"],
    k: "restrain stay status quo prima facie balance convenience irreparable disobedience",
    r: ["o39", "o39r1", "o39r2", "o39r2a", "s94", "s151"], b: "CPC Order XXXIX; S.94, S.151",
    d: "A temporary injunction restrains a party from an act (or directs status quo) until the suit is decided (Order XXXIX Rules 1–2).",
    p: ["Application filed with the plaint (or later) with an affidavit", "Court considers (i) a prima facie case, (ii) balance of convenience, (iii) irreparable injury if refused", "An ex parte order needs reasons recorded; the applicant must serve the papers at once (R.3) and the court should decide the application within 30 days (R.3A)", "The other side can apply to vary, discharge or set aside the order (R.4)"],
    n: "Disobedience of an injunction can lead to attachment of property and civil imprisonment up to three months (R.2A). Against Government, urgent relief without notice needs the court's leave (S.80(2)).",
    g: "If served with an injunction, comply first and take legal steps after; report it to the DLO the same day. If you expect a stay, ask the DLO about lodging a caveat.",
    rel: ["caveat", "s80_notice", "contempt"]
  });
  KT("s80_notice", "Section 80 notice (suits against Government)", {
    a: ["section 80 notice", "s80 notice", "notice before suing government", "two months notice", "notice to government before suit", "section 80 cpc", "s 80 cpc", "notice under section 80"],
    k: "government public officer official act two months notice urgent relief leave secretary collector", r: ["s80"], b: "CPC S.80; Limitation Act S.15(2)",
    d: "Section 80: a suit against the Government, or against a public officer for an official act, can be filed only after two months from a written notice.",
    p: ["Notice must state the plaintiff's name, description and residence, the cause of action and the relief claimed", "It is delivered to (or left at the office of) the authority named in S.80(1)", "Suit can be filed after two months if the claim isn't accepted", "In urgent cases the court can permit a suit without notice (S.80(2)), but must give the Government a chance to show cause before final relief", "A technical defect does not defeat the suit if the required particulars were given and the notice was delivered (S.80(3))"],
    t: "Two months from delivery of the notice; the notice period is excluded from limitation (S.15(2), Limitation Act).",
    g: "Treat every S.80 notice seriously: examine the claim, consult the DLO and reply in time. A considered reply or settlement can avoid litigation.",
    n: "Absence of a valid S.80 notice is a common maintainability objection.",
    rel: ["suits_govt", "reject_plaint"]
  });
  KT("suits_govt", "Suits by and against the Government", {
    a: ["suits against government", "suit by government", "government as defendant", "section 79 cpc", "order 27", "government pleader role", "how government is sued", "suit against department"],
    k: "government pleader public officer reasonable time proper channel", r: ["s79", "s82", "o27"], b: "CPC Ss.79–82; Order XXVII",
    d: "Suits by or against the Government are governed by Sections 79–82 and Order XXVII.",
    p: ["S.79: the Government is sued in the name prescribed by law, and the suit names the authority the law requires", "S.80: two-month notice before suit", "O.XXVII R.4: the Government pleader is the agent to receive process", "O.XXVII R.5: the court must allow reasonable time to communicate through the proper channel and get instructions", "S.82: execution against the Government only after the decree stays unsatisfied for three months"],
    g: "The DLO coordinates with the Government pleader; departments must supply parawise comments, documents and an authorised officer promptly.",
    rel: ["s80_notice", "exec_govt", "written_statement"]
  });
  KT("exparte", "Ex parte proceedings and setting aside ex parte orders", {
    a: ["ex parte", "exparte", "ex parte decree", "set aside ex parte decree", "order 9 rule 13", "exparte order", "ex parte against department", "o9r13", "o9r6", "o9r7", "ex parte proceedings"],
    k: "absence non appearance decree set aside good cause sufficient cause costs", r: ["o9", "o9r6", "o9r7", "o9r13"], b: "CPC Order IX; Limitation Act Art. 123",
    d: "Ex parte means decided in a party's absence. If a defendant is served but does not appear, the court may proceed ex parte (O.IX R.6).",
    p: ["Before an ex parte decree: apply under O.IX R.7 to set aside the order proceeding ex parte, showing good cause, and be ready to file the written statement (usually with costs)", "After an ex parte decree: apply under O.IX R.13 to set aside the decree — on proof that summons was not duly served, or that there was sufficient cause for absence", "Alternatively appeal against the ex parte decree (S.96(2))", "Court may set aside on terms, such as costs"],
    t: "R.13 application: 30 days from the decree (Art. 123), or from knowledge if summons was not duly served. Delay can be condoned under S.5.",
    g: "An ex parte order is urgent: tell the DLO immediately so standing counsel can move a set-aside/restoration application within 30 days.",
    rel: ["restoration", "condonation_delay", "written_statement"]
  });
  KT("restoration", "Restoration of a suit or appeal dismissed for default", {
    a: ["restoration", "restoration application", "restore suit", "suit dismissed for default", "dismissed in default", "order 9 rule 9", "restoration of appeal", "o9r9", "o9r4", "restoration petition"],
    k: "default non appearance dismissed revive sufficient cause", r: ["o9r4", "o9r9"], b: "CPC Order IX Rules 4, 9; Limitation Act Art. 122",
    d: "A restoration application asks the court to revive a suit, appeal or application dismissed for non-appearance or default.",
    p: ["File an application under O.IX R.9 (or R.4) with an affidavit explaining the absence", "Notice goes to the other side; the court may restore on terms such as costs", "If restoration is refused, an appeal lies under O.XLIII R.1(c)"],
    gr: "The applicant must show sufficient cause for non-appearance — genuine mishap, wrong date, illness, not mere negligence.",
    t: "30 days from the dismissal (Art. 122); delay condonable under S.5.",
    g: "Watch cause lists: if a matter is dismissed for default, inform the DLO the same day so a restoration application can be filed within time.",
    rel: ["exparte", "condonation_delay"]
  });
  KT("condonation_delay", "Condonation of delay (Section 5, Limitation Act)", {
    a: ["condonation of delay", "condone delay", "delay condonation", "section 5 limitation act", "s5 limitation", "application for condonation", "delay in filing appeal", "delay in filing", "condonation petition", "time barred appeal", "sufficient cause for delay", "condonation kya hai"],
    k: "limitation appeal application sufficient cause explain each day bureaucratic government delay late",
    r: ["s5", "s12", "s14"], b: "Limitation Act 1963 Ss.5, 12, 14; CPC O.XLI",
    d: "Under Section 5 of the Limitation Act, 1963 a court may admit an appeal or application filed after the limitation period if the applicant shows sufficient cause for the delay.",
    p: ["File the appeal/application together with an application under S.5, supported by an affidavit", "Explain the delay chronologically with dates and documents (receipt of judgment, file movement, illness, wrong advice etc.)", "Show diligence — no negligence or inaction on the applicant's part", "Court hears the other side and decides; it may allow on terms such as costs", "If allowed, the appeal/application is treated as filed in time"],
    gr: "Courts take a liberal view of genuine cause, but not of negligence or casual approach. Time to obtain certified copies is excluded (S.12); time spent bona fide in a wrong court is excluded (S.14).",
    t: "S.5 applies to appeals and applications (not to suits, and not to Order XXI applications). Typical periods: appeals 30/90 days, review 30 days, set-aside applications 30 days.",
    n: "The Supreme Court has repeatedly held that Government departments get no special latitude for bureaucratic delay (e.g. Postmaster General v. Living Media, 2012; State of M.P. v. Bherulal, 2020).",
    g: "Send the judgment or order to the DLO the day it is received, and keep a dated note of every step — the S.5 affidavit must explain the delay day by day.",
    rel: ["limitation", "appeals", "exparte", "restoration"]
  });
  KT("limitation", "Limitation periods (Limitation Act 1963)", {
    a: ["limitation", "limitation period", "limitation act", "limitation for suit", "limitation for filing", "time barred", "period of limitation", "limitation for appeal", "limitation for execution", "how many days to file", "limitation kitni hoti hai"],
    k: "article days years barred appeal review execution possession contract declaration government suit exclusion",
    r: ["a136", "a116", "a112", "s3", "s9", "s15"], b: "Limitation Act 1963 (Arts. 54, 58, 64–65, 112–113, 116, 120–124, 136; Ss.3, 5, 12, 14, 15)",
    d: "Limitation is the time within which a suit, appeal or application must be filed. It bars the remedy, not the right, and a court must dismiss a time-barred suit even if it is not pleaded (S.3).",
    t: "• Possession of immovable property: 12 years (Art. 64 prior possession; Art. 65 title)\n• Suit by the Government: 30 years (Art. 112)\n• Contract/money claims and residual suits: generally 3 years (Arts. 55, 113); declaration: 3 years (Art. 58); specific performance: 3 years (Art. 54)\n• Appeals under CPC: 90 days to the High Court, 30 days to any other court (Art. 116); review: 30 days (Art. 124)\n• Set aside dismissal for default: 30 days (Art. 122); set aside ex parte decree: 30 days (Art. 123)\n• Substitute legal representatives: 90 days (Art. 120); set aside abatement: 60 days (Art. 121)\n• Execution of a decree: 12 years (Art. 136)\n• Excluded from the period: time to obtain certified copies (S.12), time bona fide spent in a wrong court (S.14), the S.80 notice period (S.15(2))",
    n: "S.5 can condone delay in appeals and applications, never in suits. Confirm the exact article with counsel — the period depends on the cause of action.",
    rel: ["condonation_delay", "appeals", "execution"]
  });
  KT("caveat", "Caveat (Section 148A CPC)", {
    a: ["caveat", "caveat petition", "section 148a", "s148a", "how to file caveat", "caveat meaning", "lodge caveat", "caveat validity", "caveat kya hai", "caveat against stay", "file a caveat"],
    k: "anticipated application notice ex parte order caveator 90 days renewal", r: ["s148a"], b: "CPC S.148A",
    d: "A caveat is a precautionary notice lodged in court by a person who expects that someone will apply for an order in a suit or proceeding. The court must then give the caveator notice before passing any order on that application (S.148A).",
    p: ["Lodge the caveat in the court where the application is expected — in writing, with your name/address and details of the anticipated case", "Serve a copy on the person expected to apply, by registered post with acknowledgement due (S.148A(2))", "If an application is filed, the court must give the caveator notice, and the applicant must supply a copy of the application and papers", "The caveator appears and opposes; no ex parte order can be passed without hearing them"],
    t: "A caveat is valid for 90 days from lodging. To continue, lodge a fresh caveat before it lapses (S.148A(5)).",
    n: "It can be lodged for a suit or proceeding already instituted or about to be instituted. A caveat does not stop the case — it only guarantees you a hearing.",
    g: "If a department expects a stay or injunction (against demolition, a tender, a transfer or a recovery), ask the DLO to lodge a caveat in the likely court and diarise the 90-day renewal.",
    rel: ["interim_injunction", "exparte"]
  });
  KT("contempt", "Contempt petition — process", {
    a: ["contempt", "contempt petition", "contempt of court", "contempt of courts act", "contempt procedure", "how to file contempt", "contempt process", "contempt notice", "contempt case", "wilful disobedience", "willful disobedience of order", "contempt punishment", "personal appearance in contempt", "contempt kya hai"],
    k: "civil contempt disobedience order compliance atr officer notice punishment apology limitation appeal defence",
    r: ["s12", "s19", "s20", "a215"], b: "Contempt of Courts Act 1971 (Ss.2, 10, 12, 15, 19, 20); Art. 215",
    d: "Contempt of court means wilful disobedience of a court order (civil contempt) or conduct that scandalises or obstructs the court (criminal contempt) — Contempt of Courts Act, 1971 and Art. 215.",
    p: ["Petitioner shows the order, that the authority knew of it, and that it was not complied with wilfully", "Contempt of the High Court's or a subordinate court's order is dealt with by the High Court — petition is filed there", "Notice is issued to the alleged contemnor (usually the officer responsible) to file a reply/compliance", "Court examines whether the disobedience is wilful; if compliance is made, the notice is usually discharged", "If wilful: punishment or directions to comply (S.12); a bona fide apology may be accepted", "An order punishing for contempt is appealable (S.19)"],
    t: "Limitation: one year from the alleged contempt (S.20). Appeal against a punishment order: 30 days (S.19).",
    gr: "Defences: order not communicated or not clear; compliance impossible or already done; no wilfulness (bona fide belief, pending appeal with stay); alternative remedy. A contempt court does not re-decide the merits or add to the order.",
    n: "Punishment (S.12): simple imprisonment up to six months, or fine up to ₹2,000, or both; the court may discharge or remit on a bona fide apology. The officer responsible for compliance is usually the respondent.",
    g: "Treat every operative order as a compliance deadline: comply, or seek time or appeal with a stay before the date. Send the Action Taken Report (ATR) and verified compliance to the DLO at least 48 hours before the hearing to prevent personal-appearance orders. The Supreme Court has cautioned courts against routinely summoning officers; virtual appearance is preferred where possible.",
    rel: ["civil_contempt", "criminal_contempt", "execution", "interim_injunction"]
  });
  KT("civil_contempt", "Civil contempt", {
    a: ["civil contempt", "civil contempt meaning", "section 2b contempt", "what is civil contempt"], k: "wilful disobedience judgment decree order undertaking", r: ["s2b"], b: "Contempt of Courts Act S.2(b)",
    d: "Civil contempt is wilful disobedience of any judgment, decree, direction, order, writ or other process of a court, or wilful breach of an undertaking given to a court (S.2(b)).",
    rel: ["contempt", "criminal_contempt"]
  });
  KT("criminal_contempt", "Criminal contempt", {
    a: ["criminal contempt", "criminal contempt meaning", "section 2c contempt", "what is criminal contempt"], k: "scandalise lowers authority interferes judicial proceedings obstructs administration of justice", r: ["s2c"], b: "Contempt of Courts Act S.2(c)",
    d: "Criminal contempt is publication or any act that scandalises or lowers the authority of a court, prejudices or interferes with judicial proceedings, or obstructs the administration of justice (S.2(c)).",
    rel: ["contempt", "civil_contempt"]
  });
  KT("execution", "Execution petition — process", {
    a: ["execution", "execution petition", "execution of decree", "how to execute a decree", "execution application", "execution proceedings", "decree execution", "order 21", "section 36 to 74", "execution process", "execution kaise hota hai", "execution petition process"],
    k: "decree holder judgment debtor executing court attachment sale recover money possession transfer notice",
    r: ["o21", "s36", "s38", "s39", "s47", "s51", "a136"], b: "CPC Ss.36–74; Order XXI; Limitation Act Art. 136",
    d: "Execution is the process by which a decree-holder enforces a decree through the court (Sections 36–74 and Order XXI).",
    p: ["Application filed in the court that passed the decree (S.38); the decree can be transferred to another court to execute (S.39)", "It states the decree details, amount due and the mode of execution sought (O.XXI R.11)", "Notice to the judgment-debtor where required (O.XXI R.22)", "Court orders a mode of execution — attachment and sale, delivery of possession, arrest and detention, receiver or other (S.51)", "Attachment, proclamation and public auction; sale confirmed by the court (R.54, R.64–R.67, R.92)", "Payment to the decree-holder; execution recorded as satisfied (R.2)"],
    t: "A decree can be executed within 12 years (Art. 136, Limitation Act).",
    n: "Questions between the parties about execution, discharge or satisfaction are decided by the executing court under S.47 — not by a separate suit.",
    g: "On an execution notice: tell the DLO the same day. Objections (S.47, limitation, part-satisfaction, inexecutable decree) and a stay request must be raised through counsel on the first date. If the decree is against Government, see the S.82 three-month window.",
    rel: ["exec_modes", "attachment_sale", "civil_prison", "exec_objections", "exec_govt", "exec_stay", "exec_possession"]
  });
  KT("exec_modes", "Modes of execution (Section 51)", {
    a: ["modes of execution", "section 51 cpc", "ways to execute decree", "how can decree be enforced", "s51 cpc"], k: "delivery attachment sale arrest detention receiver", r: ["s51"], b: "CPC S.51",
    d: "Section 51 lets the court execute a decree in any of these ways.",
    p: ["Delivery of the property specifically decreed", "Attachment and sale (or sale without attachment) of the judgment-debtor's property", "Arrest and detention in civil prison — only where the debtor has means and wilfully refuses or neglects to pay (proviso to S.51)", "Appointment of a receiver", "Any other manner the relief requires — e.g. attachment or detention for injunction decrees (O.XXI R.32)"],
    rel: ["execution", "civil_prison", "attachment_sale"]
  });
  KT("attachment_sale", "Attachment and sale of property in execution", {
    a: ["attachment of property", "attachment in execution", "sale of attached property", "attachment of salary", "order 21 rule 54", "auction of property execution", "attachment of bank account", "garnishee", "set aside sale", "attachment sale"],
    k: "attach movable immovable debt proclamation auction confirmation exempt section 60 salary", r: ["o21r54", "o21r64", "o21r92", "s60"], b: "CPC Order XXI Rr.43–92; S.60",
    d: "Attachment freezes the judgment-debtor's property so it can be sold to satisfy the decree (Order XXI).",
    p: ["Decree-holder identifies property — movable, immovable, debts or salary", "Attachment: immovables by prohibitory order (R.54), movables by seizure (R.43), debts by prohibitory order to the debtor's debtor (R.46)", "Third-party claims and objections are decided under R.58", "Proclamation of sale with valuation, then public auction (R.64–R.67)", "Sale confirmed by the court (R.92) unless set aside on application within 60 days (R.89–R.91)", "Proceeds go to the decree-holder; any balance to the judgment-debtor"],
    gr: "Some property is exempt (S.60): e.g. necessary clothing and cooking vessels, artisans' tools, agriculturists' and labourers' dwellings, and a protected portion of salary, pension and wages.",
    rel: ["execution", "exec_objections"]
  });
  KT("civil_prison", "Arrest and detention in civil prison", {
    a: ["arrest in execution", "civil prison", "detention of judgment debtor", "section 58 cpc", "arrest of judgment debtor", "jail for non payment of decree", "arrest warrant execution"],
    k: "arrest detention imprisonment money decree means wilful refusal women", r: ["s55", "s56", "s58", "s59"], b: "CPC S.51(c), Ss.55–59; O.XXI R.37–40",
    d: "Arrest and detention in civil prison is a coercive mode of executing a money decree.",
    p: ["Allowed only where the debtor has, or has had, the means to pay and refuses or neglects to (proviso to S.51)", "Show-cause notice why the debtor should not be detained (O.XXI R.37)", "Detention up to 3 months where the decree exceeds ₹5,000; up to 6 weeks where it exceeds ₹2,000 but not ₹5,000; none for ₹2,000 or less (S.58)", "A woman cannot be arrested in execution of a money decree (S.56)", "Release doesn't discharge the debt (S.58(2)); release on payment or ill-health (S.59)"],
    rel: ["execution", "exec_modes"]
  });
  KT("exec_objections", "Objections in execution (Section 47, Order XXI)", {
    a: ["objection in execution", "section 47 cpc", "s47 cpc", "objection to execution petition", "judgment debtor objection", "execution objections", "decree not executable", "third party claim attachment", "obstruction to execution"],
    k: "executing court satisfaction discharge nullity limitation claim objection resistance", r: ["s47", "o21r2", "o21r58", "o21r97"], b: "CPC S.47; Order XXI Rr.2, 58, 97–101",
    d: "The judgment-debtor or a third party can object to execution. The executing court decides such objections under Section 47 and Order XXI — not a separate suit.",
    p: ["S.47: all questions between the parties relating to execution, discharge or satisfaction are decided by the executing court", "Common objections: decree is a nullity (no jurisdiction); already paid or adjusted (recorded under O.XXI R.2); decree not executable as framed; execution time-barred; wrong person", "Third-party claims to attached property: O.XXI R.58", "Resistance or obstruction to delivery of possession: O.XXI R.97–R.101", "A determination under S.47 is treated as a decree, so it is appealable"],
    g: "Raise objections through counsel on the first date of the execution hearing; keep proof of any payment or compliance ready.",
    rel: ["execution", "exec_stay"]
  });
  KT("exec_govt", "Execution against Government (Section 82)", {
    a: ["execution against government", "section 82 cpc", "s82 cpc", "decree against government", "three months decree government", "decree against department", "government decree satisfaction"],
    k: "government public officer three months unsatisfied decree department compliance funds", r: ["s82"], b: "CPC S.82",
    d: "A decree against the Government (or a public officer for an official act) cannot be executed until it has remained unsatisfied for three months from the date of the decree (S.82).",
    p: ["The decree copy must reach the department and the DLO immediately", "Within the three months decide: comply/pay, or appeal with a stay application", "Money decrees need funds and sanction — start the process early", "After three months the decree-holder may seek execution"],
    g: "Diary the date of the decree and send the copy to the DLO on receipt; the three months are for deciding appeal versus compliance, not for waiting.",
    rel: ["execution", "appeals", "suits_govt"]
  });
  KT("exec_possession", "Execution of possession and injunction decrees", {
    a: ["delivery of possession", "execution of injunction decree", "order 21 rule 32", "o21r32", "order 21 rule 35", "o21r35", "possession decree execution", "resistance to possession", "eviction decree execution"],
    k: "possession immovable property tenant injunction specific performance detention attachment obstruction", r: ["o21r32", "o21r35", "o21r36", "o21r97"], b: "CPC Order XXI Rr.32, 35, 36, 97–101",
    d: "Decrees for possession, injunction and specific performance are executed differently from money decrees.",
    p: ["Immovable property: possession delivered to the decree-holder, if necessary by removing any person bound by the decree (R.35)", "Property in a tenant's occupation: possession by affixing notice and giving delivery to the decree-holder (R.36)", "Injunction, specific performance, restitution of conjugal rights: enforced by detention or attachment of property (R.32); an act can be done at the debtor's cost", "Resistance or obstruction: application under R.97 and adjudication under R.98–R.101"],
    rel: ["execution", "exec_objections"]
  });
  KT("exec_stay", "Stay of execution", {
    a: ["stay of execution", "stay execution of decree", "order 41 rule 5", "o41r5", "order 21 rule 29", "stay pending appeal", "stay of decree", "stay of execution during appeal"],
    k: "appeal stay substantial loss security execution suspend", r: ["o41r5", "o21r26", "o21r29"], b: "CPC O.XLI R.5; O.XXI R.26, R.29",
    d: "Execution can be stayed while an appeal or another proceeding is pending.",
    p: ["Appeal doesn't itself stay the decree — apply for a stay under O.XLI R.5", "The court considers substantial loss, whether the application is made without delay, and requires security", "The executing court can stay for a reasonable time so the debtor can approach the appellate court (O.XXI R.26)", "While a suit between decree-holder and judgment-debtor is pending, the executing court can stay execution (O.XXI R.29)"],
    g: "File the appeal and the stay application together, as soon as the decree is received.",
    rel: ["appeals", "execution", "condonation_delay"]
  });
  KT("judgment_decree", "Judgment, decree and order", {
    a: ["judgment and decree", "difference between judgment decree and order", "what is a decree", "what is a judgment", "preliminary decree", "final decree", "order 20", "pronouncement of judgment", "decree drawn up", "section 2 cpc"],
    k: "judgment decree order preliminary final drawn pronounce thirty days", r: ["s2", "s33", "o20"], b: "CPC S.2(2), 2(9), 2(14), S.33; Order XX",
    d: "A judgment is the court's reasoned decision; a decree formally expresses the final determination of the parties' rights (S.2(2)); an order is any other formal decision (S.2(14)).",
    p: ["Judgment is pronounced in open court within 30 days of the end of the hearing (up to 60 days in exceptional cases) — O.XX R.1", "The decree follows the judgment and is drawn up by the court (O.XX R.6); its date is the date of the judgment", "A preliminary decree declares rights; a final decree works out the relief (e.g. partition, accounts)", "Costs and interest are dealt with under S.35 and S.34"],
    n: "Certified copies of the judgment and decree are needed for appeal and execution; the time taken to get them is excluded from limitation (S.12).",
    rel: ["appeals", "execution", "costs_interest"]
  });
  KT("appeals", "Appeals (first appeal, appealable orders)", {
    a: ["appeal", "first appeal", "how to file appeal", "appeal against decree", "section 96 cpc", "order 41", "appeal procedure", "appealable orders", "order 43", "appeal against order", "appeal kaise karte hain", "memorandum of appeal"],
    k: "appeal decree order district court high court memorandum stay deposit certified copy additional evidence",
    r: ["s96", "s104", "o41", "o43", "a116"], b: "CPC Ss.96, 104, 107; Orders XLI, XLIII; Limitation Act Art. 116",
    d: "An appeal asks a higher court to review a decree or order. A first appeal (S.96) lies on both facts and law.",
    p: ["Memorandum of appeal with grounds and certified copies of the judgment and decree (O.XLI R.1)", "Court fee paid; for money decrees the court may require deposit or security (O.XLI R.1(3))", "Stay of execution needs a separate application (O.XLI R.5)", "Notice to the respondent; the appellate court re-hears and may confirm, reverse, modify or remand (S.107)", "Additional evidence only in limited cases (O.XLI R.27)", "Appealable orders are listed in S.104 and O.XLIII R.1"],
    t: "30 days (to a court other than the High Court) or 90 days (to the High Court) from the decree/order, excluding time for certified copies (Art. 116; S.12).",
    n: "An appeal does not automatically stay the decree. Delay must be explained through an application under S.5.",
    g: "Send the judgment and decree to the DLO on the day of receipt; the DLO advises whether to appeal and who files it.",
    rel: ["second_appeal", "condonation_delay", "exec_stay", "revision", "review"]
  });
  KT("second_appeal", "Second appeal (Section 100)", {
    a: ["second appeal", "section 100 cpc", "s100 cpc", "substantial question of law", "second appeal high court", "rsa", "regular second appeal"],
    k: "high court substantial question of law findings of fact", r: ["s100", "s101"], b: "CPC Ss.100–101",
    d: "A second appeal lies to the High Court from an appellate decree only on a substantial question of law (S.100).",
    p: ["Memorandum must precisely state the substantial question of law", "The High Court formulates the question(s) and hears the appeal on them (S.100(4)–(5))", "The respondent may argue that the case does not involve such a question"],
    n: "Findings of fact are not reopened unless perverse. No second appeal lies on any other ground.",
    rel: ["appeals"]
  });
  KT("revision", "Revision (Section 115)", {
    a: ["revision", "revision petition", "civil revision", "section 115 cpc", "s115 cpc", "revisional jurisdiction", "revision high court"],
    k: "high court jurisdictional error material irregularity subordinate court", r: ["s115"], b: "CPC S.115",
    d: "The High Court can revise an order of a subordinate court where it exercised a jurisdiction not vested in it, failed to exercise one, or acted illegally or with material irregularity (S.115).",
    gr: "Revision lies only where the order, if decided the other way, would finally dispose of the suit or proceeding, or where the order would cause failure of justice or irreparable injury.",
    n: "It is not a second appeal on the merits. File promptly; confirm the applicable time limit with counsel.",
    rel: ["appeals", "review"]
  });
  KT("review", "Review (Section 114, Order XLVII)", {
    a: ["review", "review petition", "review of judgment", "order 47", "section 114 cpc", "review application", "o47"],
    k: "error apparent on record new evidence discovery same court", r: ["s114", "o47"], b: "CPC S.114; Order XLVII; Limitation Act Art. 124",
    d: "Review asks the same court to reconsider its decree or order (S.114, O.XLVII).",
    gr: "Grounds: discovery of new and important matter or evidence that could not be produced despite due diligence; a mistake or error apparent on the face of the record; or any other sufficient reason.",
    t: "30 days from the decree/order (Art. 124); delay condonable under S.5.",
    n: "Review is not an appeal in disguise — the court does not re-argue the merits.",
    rel: ["appeals", "revision"]
  });
  KT("inherent_powers", "Inherent powers and correction of mistakes (S.151, S.152)", {
    a: ["inherent powers", "section 151 cpc", "s151 cpc", "section 152 cpc", "correction of clerical mistake", "clerical error in decree", "amendment of judgment"],
    k: "inherent ends of justice abuse of process clerical arithmetical slip", r: ["s151", "s152", "s153"], b: "CPC Ss.151–153",
    d: "S.151 preserves the court's inherent power to do what is necessary for the ends of justice or to prevent abuse of its process. S.152 lets the court correct clerical or arithmetical mistakes and accidental slips in judgments, decrees or orders at any time.",
    n: "S.151 cannot be used where the Code has an express provision.",
    rel: ["review"]
  });
  KT("res_judicata", "Res judicata (Section 11)", {
    a: ["res judicata", "section 11 cpc", "s11 cpc", "constructive res judicata", "matter already decided", "res judicata meaning"],
    k: "previously decided same parties competent court finally decided", r: ["s11"], b: "CPC S.11",
    d: "A matter directly and substantially in issue that has been finally decided by a competent court between the same parties (or those claiming under them) cannot be tried again in a later suit (S.11).",
    n: "Issues that could and should have been raised earlier are also barred (constructive res judicata).",
    g: "A prior judgment between the same parties on the same issue is a strong defence — send the earlier judgment to the DLO.",
    rel: ["sub_judice"]
  });
  KT("sub_judice", "Res sub judice (Section 10)", {
    a: ["res sub judice", "sub judice", "section 10 cpc", "s10 cpc", "stay of later suit", "parallel suits"],
    k: "pending earlier suit same matter stay", r: ["s10"], b: "CPC S.10",
    d: "A court must stay a later suit if the matter in issue is directly and substantially in issue in an earlier pending suit between the same parties in a competent court (S.10).",
    rel: ["res_judicata"]
  });
  KT("jurisdiction", "Jurisdiction and place of suing", {
    a: ["jurisdiction", "territorial jurisdiction", "pecuniary jurisdiction", "place of suing", "section 9 cpc", "section 20 cpc", "which court to file suit", "subject matter jurisdiction", "objection to jurisdiction", "section 21 cpc"],
    k: "court competent immovable property residence cause of action valuation civil courts", r: ["s9", "s15", "s16", "s19", "s20", "s21"], b: "CPC Ss.9, 15–21",
    d: "Civil courts can try all suits of a civil nature unless barred (S.9). Which court hears a suit depends on subject-matter, value and place.",
    p: ["S.15: suit is filed in the lowest court competent to try it (by value)", "S.16: suits about immovable property are filed where the property is situated", "S.19: wrongs to person or movables — where the wrong was done or the defendant resides", "S.20: otherwise, where the defendant resides/works or the cause of action arose", "S.21: objections to territorial or pecuniary jurisdiction must be taken at the earliest opportunity (before issues are settled) — lack of subject-matter jurisdiction can be raised at any time"],
    rel: ["reject_plaint", "transfer_suit"]
  });
  KT("transfer_suit", "Transfer of suits", {
    a: ["transfer of suit", "transfer of case", "section 24 cpc", "s24 cpc", "transfer application", "transfer petition", "withdraw suit to another court"],
    k: "transfer high court district court convenience", r: ["s22", "s24", "s25"], b: "CPC Ss.22–25",
    d: "The High Court or District Court can transfer a suit, appeal or proceeding from one court to another (S.24); the Supreme Court can transfer between High Courts (S.25). A defendant may seek transfer under S.22 in certain cases.",
    rel: ["jurisdiction"]
  });
  KT("impleadment", "Adding or removing parties (Order I)", {
    a: ["impleadment", "implead party", "necessary party", "proper party", "order 1 rule 10", "misjoinder", "non joinder", "add party to suit", "o1r10"],
    k: "party added deleted struck out order 1", r: ["o1", "o1r10"], b: "CPC Order I",
    d: "Under Order I Rule 10(2) the court can at any stage add or strike out a party who is a necessary or proper party. A suit is not defeated by misjoinder or non-joinder of parties, but a necessary party must be joined (R.9).",
    rel: ["abatement_lr"]
  });
  KT("abatement_lr", "Death of a party, legal representatives and abatement", {
    a: ["abatement", "legal representatives", "death of party", "order 22", "substitution of legal heirs", "abatement of suit", "bring legal heirs", "lr on record", "set aside abatement"],
    k: "death substitution legal heirs abate 90 days", r: ["o22", "a120", "a121"], b: "CPC Order XXII; Limitation Act Arts. 120–121",
    d: "If a party dies and the right to sue survives, the legal representatives must be brought on record; otherwise the suit or appeal abates (Order XXII).",
    t: "Apply within 90 days of death (Art. 120). If abated, apply within 60 days to set aside abatement (Art. 121); delay condonable under S.5.",
    rel: ["impleadment", "condonation_delay"]
  });
  KT("amendment_pleadings", "Amendment of pleadings (Order VI Rule 17)", {
    a: ["amendment of pleadings", "amend plaint", "amend written statement", "order 6 rule 17", "o6r17", "amendment application"],
    k: "amend pleading due diligence trial commenced real controversy", r: ["o6r17"], b: "CPC Order VI Rules 17–18",
    d: "The court may allow amendment of pleadings at any stage to decide the real questions in controversy (O.VI R.17).",
    n: "After the trial has begun, amendment is allowed only if the party shows it could not have raised the matter earlier despite due diligence. An amendment must be carried out within the time allowed (R.18).",
    rel: ["plaint", "written_statement"]
  });
  KT("withdrawal_compromise", "Withdrawal and compromise (Order XXIII)", {
    a: ["withdrawal of suit", "compromise of suit", "settlement in suit", "order 23", "compromise decree", "withdraw suit", "order 23 rule 3", "amicable settlement"],
    k: "withdraw liberty fresh suit compromise decree settlement", r: ["o23", "o23r1", "o23r3"], b: "CPC Order XXIII",
    d: "A plaintiff may withdraw a suit (O.XXIII R.1); permission to file afresh is given only for a formal defect or other sufficient ground. A lawful compromise is recorded, and the court passes a decree in its terms (R.3).",
    n: "No separate suit lies to set aside a compromise decree on the ground that the compromise was unlawful (R.3A). A settlement by a Government department needs approval of the competent authority.",
    rel: ["adr"]
  });
  KT("adr", "Mediation, arbitration and Lok Adalat (Section 89)", {
    a: ["adr", "mediation", "arbitration", "lok adalat", "section 89 cpc", "settlement of disputes", "alternative dispute resolution", "order 10 rule 1a", "conciliation", "judicial settlement"],
    k: "settle mediation arbitration conciliation lok adalat refer", r: ["s89", "o10r1a"], b: "CPC S.89; Order X R.1A; Legal Services Authorities Act S.21",
    d: "Where elements of a settlement exist, the court can refer the parties to arbitration, conciliation, judicial settlement (including Lok Adalat) or mediation (S.89; O.X R.1A).",
    n: "A Lok Adalat award is treated as a civil court decree and is final — no appeal lies (S.21, Legal Services Authorities Act).",
    g: "Any settlement by a department must be approved by the competent authority before it is placed before the court.",
    rel: ["withdrawal_compromise"]
  });
  KT("summary_suit", "Summary suits (Order XXXVII)", {
    a: ["summary suit", "order 37", "leave to defend", "suit on promissory note", "summary procedure", "bill of exchange suit"],
    k: "negotiable instrument liquidated demand written contract leave defend ten days", r: ["o37"], b: "CPC Order XXXVII",
    d: "Order XXXVII gives a quick procedure for recovery on bills of exchange, promissory notes, written contracts and similar debts. The defendant does not file a written statement but applies for leave to defend.",
    t: "Application for leave to defend: within 10 days of service of summons for judgment (R.3(5)).",
    rel: ["civil_suit"]
  });
  KT("indigent_suit", "Suit by an indigent person (Order XXXIII)", {
    a: ["indigent person", "pauper suit", "order 33", "suit in forma pauperis", "sue as pauper", "court fee exemption suit"],
    k: "pauper indigent court fee unable to pay", r: ["o33"], b: "CPC Order XXXIII",
    d: "A person unable to pay the court fee can apply to sue as an indigent person (Order XXXIII). The court inquires into means; if allowed, the fee is recoverable later from the party the court directs.",
    n: "The Government pleader is given notice of the inquiry and can oppose.",
    rel: ["plaint"]
  });
  KT("pre_judgment_attachment", "Arrest or attachment before judgment (Order XXXVIII)", {
    a: ["attachment before judgment", "arrest before judgment", "order 38", "order 38 rule 5", "o38r5", "security for appearance", "attach property before decree"],
    k: "dispose property defeat decree security", r: ["o38", "o38r5"], b: "CPC Order XXXVIII",
    d: "Where a defendant is about to dispose of or remove property with intent to obstruct or delay a decree, the court can order the defendant to furnish security or attach the property before judgment (O.XXXVIII R.5); arrest before judgment is dealt with in R.1.",
    n: "The plaintiff must show a prima facie case and the defendant's intention; such orders are exceptional.",
    rel: ["interim_injunction", "attachment_sale"]
  });
  KT("commission", "Commissions (Order XXVI)", {
    a: ["commission", "court commissioner", "local commissioner", "order 26", "local investigation", "commission to record evidence", "commissioner report"],
    k: "commissioner local inspection accounts examination witness", r: ["o26"], b: "CPC Order XXVI",
    d: "The court can appoint a commissioner to examine a witness, make a local investigation or inspection, examine accounts or make a partition (Order XXVI). The report forms part of the evidence.",
    rel: ["evidence"]
  });
  KT("adjournments", "Adjournments (Order XVII)", {
    a: ["adjournment", "adjournments", "order 17", "how many adjournments", "next date given", "adjournment cost"],
    k: "adjourn hearing costs three times", r: ["o17", "o17r1"], b: "CPC Order XVII",
    d: "The court may adjourn a hearing for sufficient cause and on costs (O.XVII R.1). During the hearing of a suit a party can be granted no more than three adjournments.",
    rel: ["evidence"]
  });
  KT("costs_interest", "Costs and interest", {
    a: ["costs", "cost of suit", "section 35 cpc", "compensatory costs", "section 35a", "interest on decree", "section 34 cpc", "costs in civil suit", "post decree interest"],
    k: "costs follow the event interest six percent false vexatious", r: ["s34", "s35", "s35a", "s35b"], b: "CPC Ss.34, 35, 35A, 35B",
    d: "Costs generally follow the event, at the court's discretion (S.35). S.35A allows compensatory costs for false or vexatious claims or defences, and S.35B costs for causing delay. S.34 governs interest on the decretal amount.",
    n: "Where the liability arises from a commercial transaction, interest can run at the contractual or bank rate; otherwise the court sets a reasonable rate, not exceeding 6% a year.",
    rel: ["judgment_decree"]
  });
  KT("restitution", "Restitution (Section 144)", {
    a: ["restitution", "section 144 cpc", "s144 cpc", "refund after decree set aside", "restore benefit after appeal"],
    k: "restore reversed varied decree benefit", r: ["s144"], b: "CPC S.144",
    d: "When a decree is varied or reversed in appeal, revision or other proceeding, the court that passed it must, on application, restore the parties to the position they would have been in — including refund of money or property taken under the decree (S.144).",
    rel: ["appeals", "exec_stay"]
  });
  KT("consumer_process", "Consumer complaint (Consumer Protection Act 2019)", {
    a: ["consumer complaint", "consumer court process", "consumer protection act", "consumer case procedure", "how to file consumer complaint", "district consumer commission", "reply to consumer complaint", "consumer commission jurisdiction", "dcdrc process"],
    k: "consumer commission deficiency service defective goods version thirty days forty five days appeal", r: ["s38", "s41", "s69"], b: "Consumer Protection Act 2019 Ss.34–41, 69; Jurisdiction Rules 2021",
    d: "A consumer can complain of defective goods, deficient service or unfair trade practice. The District Commission hears complaints up to ₹50 lakh, the State Commission above ₹50 lakh up to ₹2 crore, and the National Commission above ₹2 crore (value of goods/services paid as consideration).",
    p: ["Complaint filed within 2 years of the cause of action (S.69); delay condonable for sufficient cause", "Notice to the opposite party, who must file its version within 30 days, extendable by up to 15 days (S.38)", "Evidence by affidavit, arguments and order", "Appeal from a District Commission order to the State Commission within 45 days (S.41)"],
    t: "Version: 30 days (+15 at most; the Supreme Court has held this outer limit is mandatory). Appeal: 45 days.",
    g: "When a department is the opposite party (electricity, health, telecom, etc.), send the notice to the DLO immediately — the 45-day outer limit for the reply cannot be extended.",
    rel: ["limitation"]
  });
  KT("mact", "Motor accident claims (MACT)", {
    a: ["mact", "motor accident claim", "mact process", "accident claim tribunal", "section 166 motor vehicles act", "mact appeal", "accident compensation"],
    k: "motor accident claims tribunal compensation insurer owner driver just compensation appeal high court", r: ["s166", "s168", "s173"], b: "Motor Vehicles Act 1988 Ss.166, 168, 173",
    d: "A claim for compensation for a motor accident is made to the Motor Accident Claims Tribunal by application under S.166 of the Motor Vehicles Act, 1988. The tribunal awards \"just compensation\" (S.168).",
    p: ["Claim application by the injured person or legal representatives", "Notice to the owner, driver and insurer, who file written statements", "Evidence and award by the tribunal", "Appeal to the High Court within 90 days of the award (S.173)"],
    t: "Appeal to the High Court within 90 days of the award (S.173). The six-month limit for claim applications was removed in 2019.",
    n: "The six-month limitation for claim applications was removed by the 2019 amendment. An owner or insurer appealing against a money award must deposit part of the amount as the Act requires.",
    g: "If a departmental vehicle is involved, forward the notice to the DLO on receipt; the insurer usually defends, but the department's position must be recorded.",
    rel: ["appeals"]
  });
  KT("legal_notice", "Legal notice", {
    a: ["legal notice", "notice before filing suit", "reply to legal notice", "how to reply legal notice", "legal notice format", "notice by advocate"],
    k: "demand notice pre litigation reply", b: "General practice; S.80 CPC for Government",
    d: "A legal notice is a formal written demand sent before filing a case. It is mandatory only where a statute requires it (for a suit against the Government, S.80 notice).",
    g: "Reply to every legal notice within the time it gives (usually 15–30 days) after consulting the DLO; an unanswered notice is often used against the department.",
    rel: ["s80_notice"]
  });
  KT("discovery_admissions", "Discovery, interrogatories and admissions", {
    a: ["discovery", "interrogatories", "order 11", "admission of documents", "order 12", "judgment on admission", "notice to admit", "inspection of documents", "order 12 rule 6"],
    k: "documents admit deny interrogate inspect", r: ["o11", "o12", "o12r6"], b: "CPC Orders XI, XII",
    d: "Order XI lets a party ask questions (interrogatories), seek disclosure and inspection of documents; Order XII lets a party call on the other to admit facts or documents. The court can pass judgment on admissions made in the pleadings or otherwise (O.XII R.6).",
    n: "Unexplained non-denial of a document can be treated as admission.",
    rel: ["evidence", "written_statement"]
  });

  /* Glossary */
  KT("g_plaintiff", "Plaintiff and defendant", { a: ["plaintiff", "defendant", "who is plaintiff", "who is defendant"], d: "The plaintiff is the person who files a suit; the defendant is the person against whom it is filed. In appeals they are called appellant and respondent." });
  KT("g_decree_holder", "Decree-holder and judgment-debtor", { a: ["decree holder", "judgment debtor", "who is decree holder", "who is judgment debtor"], d: "The decree-holder is the person in whose favour a decree is passed (S.2(3)); the judgment-debtor is the person against whom it is passed (S.2(10))." });
  KT("g_cause_of_action", "Cause of action", { a: ["cause of action", "meaning of cause of action"], d: "The bundle of facts that a plaintiff must prove to get relief — the reason the suit can be brought. A plaint without a cause of action is liable to be rejected." });
  KT("g_ad_interim", "Ad interim / interim order", { a: ["ad interim", "interim order", "interim relief"], d: "A temporary order that operates until a fuller hearing; an ex parte ad interim order is passed without hearing the other side and is subject to their objections." });
  KT("g_status_quo", "Status quo", { a: ["status quo", "status quo order"], d: "An order that the position as it exists on a stated date be maintained; neither side may change it until the court orders otherwise." });
  KT("g_stay", "Stay", { a: ["stay", "stay order", "stay of proceedings", "what is stay"], d: "An order suspending a proceeding, order or decree for the time stated or until further orders — e.g. stay of execution, stay of an order under challenge." });
  KT("g_injunction_types", "Temporary and permanent injunction", { a: ["permanent injunction", "types of injunction", "difference between temporary and permanent injunction", "perpetual injunction"], d: "A temporary injunction operates until the suit is decided (O.XXXIX); a permanent (perpetual) injunction is granted in the final decree and restrains the act for good." });
  KT("g_affidavit", "Affidavit and verification", { a: ["affidavit", "verification of pleadings", "what is affidavit"], d: "An affidavit is a sworn written statement of facts; pleadings are verified as true to the deponent's knowledge or belief (O.VI R.15), and evidence-in-chief is given by affidavit (O.XVIII R.4)." });
  KT("g_vakalatnama", "Vakalatnama", { a: ["vakalatnama", "power of attorney to advocate", "vakalat", "authority to counsel"], d: "The written authority by which a party appoints an advocate to appear and act for them (Order III). For the Government, the Government pleader/authorised counsel appears on the department's instructions." });
  KT("g_replication", "Replication and rejoinder", { a: ["replication", "rejoinder", "reply to written statement"], d: "A replication is the plaintiff's answer to the written statement; a rejoinder is the defendant's answer to it — each with the court's permission where the Code doesn't provide for it." });
  KT("g_counterclaim", "Counterclaim and set-off", { a: ["counterclaim", "counter claim", "set off", "setoff", "what is counterclaim"], d: "A counterclaim (O.VIII R.6A) is the defendant's own claim against the plaintiff, tried in the same suit like a cross-suit; a set-off (R.6) is a claim for a specific sum that the defendant asks the court to deduct from the plaintiff's demand." });
  KT("g_mesne_profits", "Mesne profits", { a: ["mesne profits", "mesne profit", "meaning of mesne profits"], d: "Profits that a person in wrongful possession of property actually received or might with ordinary diligence have received, together with interest (S.2(12)). The court can direct an inquiry into them in the decree." });
  KT("g_proclamation", "Proclamation of sale", { a: ["proclamation of sale", "sale proclamation", "auction notice execution"], d: "The court's public notice of an auction of attached property, stating the property, its valuation, the date and other particulars (O.XXI R.66)." });
  KT("g_receiver", "Receiver", { a: ["receiver", "appointment of receiver", "order 40"], d: "A person appointed by the court to take charge of and manage disputed property pending the suit or in execution (O.XL; S.51(d))." });
  KT("g_locus_standi", "Locus standi and maintainability", { a: ["locus standi", "maintainability", "standing to sue", "suit maintainable"], d: "Locus standi is a party's right to bring the case; maintainability asks whether the case is one the court can entertain at all (jurisdiction, limitation, notice, proper party)." });
  KT("g_cause_list", "Cause list and CNR", { a: ["cause list meaning", "what is cnr", "cnr number", "case number cnr", "cnr meaning"], d: "The cause list is the court's daily list of matters fixed for hearing. The CNR is a unique 16-character identifier given to each case on the eCourts system." });
  KT("g_certified_copy", "Certified copy", { a: ["certified copy", "certified copy of judgment", "how to get certified copy", "copying agency"], d: "An official copy of a judgment, decree or order, applied for from the court's copying section; the time taken to obtain it is excluded from limitation (S.12, Limitation Act)." });
  KT("g_sine_die", "Reserved for orders / adjourned sine die", { a: ["reserved for orders", "adjourned sine die", "sine die", "reserved for judgment"], d: "\"Reserved for orders/judgment\" means arguments are over and the court will pronounce its decision later. \"Adjourned sine die\" means adjourned without fixing a next date." });

  /* ── Retrieval engine ── */
  "process procedure procedural steps stages limitation grounds provision law legal cpc apply explain explanation meaning define definition section sec rule difference differences differ allowed power jurisdiction punishment penalty defence defense remedy remedies hota hoti hote karte karta karna karein kare kaise kese kaisay under work works simple words bare sir file lodge served serve received receive receiving".split(" ").forEach((w) => { NOISE[w] = 1; });
  Object.assign(SYN, { kaise: "how to", kese: "how to", kaisay: "how to", matlab: "meaning", "मतलब": "meaning", tareeka: "procedure", tarika: "procedure", tariqa: "procedure", qanoon: "law", kanoon: "law", dhara: "section", muddat: "limitation" });

  const KB_STOP = set("a an the of in for to is are was were be what whats how do does did can could i we it its and or on by with about your our their my me tell please explain explanation define definition meaning mean give any kya hai hain ka ki ke ko se par pe hota hoti hote karte karta karna karein kare batao bataiye file this that there work works simple words detail details bare sir law");
  const KB_SYN = dict({ execute: "execution", executing: "execution", executed: "execution", condone: "condonation", condoned: "condonation", condoning: "condonation", delayed: "delay", attach: "attachment", attaching: "attachment", attached: "attachment", disobey: "disobedience", disobeyed: "disobedience", restrain: "injunction", restraining: "injunction", punish: "punishment", punished: "punishment", punishable: "punishment", filing: "file", filed: "file", appealed: "appeal", appealing: "appeal", dismissed: "dismiss", stayed: "stay", limitations: "limitation", lodging: "lodge", lodged: "lodge", arrested: "arrest", arresting: "arrest", detained: "detention", detain: "detention", detaining: "detention", stayed: "stay", served: "serve", serving: "serve" });
  function kbStem(w) {
    if (KB_SYN[w]) return KB_SYN[w];
    if (w.length > 4 && w.slice(-3) === "ies") w = w.slice(0, -3) + "y";
    else if (w.length > 3 && w.slice(-1) === "s" && w.slice(-2) !== "ss" && w.slice(-2) !== "us") w = w.slice(0, -1);
    return KB_SYN[w] || w;
  }
  const KB_DROP = set("time limit day many long procedure procedural process step stage ground reason punishment penalty consequence effect cpc under");   // aspect words: handled separately, must not steer topic choice
  const KB_LOC = set("jammu kashmir jk ladakh");   // dropped from questions only
  const kbTok = (s, isQ) => {
    const t = norm(s).split(" ").filter(Boolean).map(kbStem).filter((w) => !KB_STOP[w] && (w.length > 1 || /\d/.test(w)));
    const f = t.filter((w) => !KB_DROP[w] && !(isQ && KB_LOC[w]));
    return f.length ? f : t;
  };
  const romanVal = (s) => { const v = { i: 1, v: 5, x: 10, l: 50, c: 100 }; let n = 0; for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n; };
  function kbRefs(q) {
    const n = norm(q), out = []; let m;
    const r1 = /\bs(?:ec|ection)? ?(\d+[a-z]?)\b/g; while ((m = r1.exec(n))) out.push("s" + m[1]);
    const r2 = /\bo(?:rder)? ?([ivxlc]{2,}|\d+)(?: ?r(?:ule)? ?(\d+[a-z]?))?\b/g;
    while ((m = r2.exec(n))) { const o = /^\d+$/.test(m[1]) ? +m[1] : romanVal(m[1]); if (o > 0 && o <= 51) { out.push("o" + o); if (m[2]) out.push("o" + o + "r" + m[2]); } }
    const r3 = /\bart(?:icle)? ?(\d+)\b/g; while ((m = r3.exec(n))) out.push("a" + m[1]);
    return out;
  }

  const KBN = KB.length, KBDF = Object.create(null), KBV = Object.create(null);
  const KBI = KB.map((t) => {
    const al = [t.title].concat(t.a || []).map((x) => kbTok(x)).filter((x) => x.length), tok = Object.create(null);
    al.forEach((a) => a.forEach((w) => { tok[w] = 1; }));
    kbTok(t.k || "").forEach((w) => { if (!tok[w]) tok[w] = 0.5; });
    Object.keys(tok).forEach((w) => { KBDF[w] = (KBDF[w] || 0) + 1; KBV[w] = 1; });
    kbTok([t.d || "", t.gr || "", t.t || "", t.n || ""].join(" ")).forEach((w) => { KBV[w] = 1; });
    return { t, al, tok };
  });
  const kbIdf = (w) => Math.log(1 + KBN / (KBDF[w] || 1));
  INTENTS.forEach((i) => Object.keys(i.kw).forEach((w) => { VOCABSET[w] = 1; }));   // words the office intents already know must never be "corrected" into legal terms
  Object.keys(KBDF).forEach((w) => { if (w.length >= 6 && !VOCABSET[w] && !/\d/.test(w)) { VOCAB.push(w); VOCABSET[w] = 1; } });   // teach the typo-fixer the legal vocabulary

  const LAW_MIN = 4, LAW_STRONG = 7;
  const LAWCUE = /\b(what is|what are|whats|meaning|define|definition|explain|explanation|process|procedure|procedural|how to|how do|how does|how can|how is|how are|how many days|how many months|how long|steps|stages|limitation|time ?limit|grounds|section|sec|order \d+|rule \d+|provision|law|legal|cpc|apply|application for|filing|effect of|difference|differ|when can|can i|can we|can a|is it|allowed|power|jurisdiction|punishment|penalty|defen[cs]e|remedy|remedies|what should|what to do|what next|what now|what happens|tell me about|kya hai)\b/;

  function kbRank(q, opts) {
    const qt = kbTok(q, true);
    if (opts && opts.prefix && qt.length) {
      const l = qt[qt.length - 1];
      if (l.length >= 3 && !KBDF[l]) { const c = Object.keys(KBDF).filter((k) => k.indexOf(l) === 0).sort((a, b) => KBDF[a] - KBDF[b])[0]; if (c) qt[qt.length - 1] = c; }
    }
    if (!qt.length) return [];
    const qset = Object.create(null); qt.forEach((w) => { qset[w] = 1; });
    const refs = kbRefs(q), out = [];
    KBI.forEach((x) => {
      let base = 0;
      Object.keys(qset).forEach((w) => { const wt = x.tok[w]; if (wt != null) base += kbIdf(w) * wt; });
      let bonus = 0;
      x.al.forEach((a) => {
        let tot = 0, got = 0;
        a.forEach((w) => { const i = kbIdf(w); tot += i; if (qset[w]) got += i; });
        if (!tot) return;
        const cov = got / tot;
        if (cov === 1) bonus = Math.max(bonus, tot * (a.length > 1 ? 1 : 0.7)); else if (cov >= 0.66) bonus = Math.max(bonus, tot * cov * 0.3);
      });
      let rb = 0;
      refs.forEach((r) => { if (x.t.r && x.t.r.indexOf(r) !== -1) rb = Math.max(rb, /r\d/.test(r) ? 25 : 12); });
      const score = base + bonus + rb;
      if (score > 0) out.push({ t: x.t, score });
    });
    return out.sort((a, b) => b.score - a.score);
  }
  function legalMatch(q) { const list = kbRank(q); return list.length ? { top: list[0], second: list[1] || null, list } : null; }

  const ASPECTS = [
    ["time", /\b(limitation|time ?limit|how (long|many days|many months|much time|soon)|within (how|what)|deadline|days|period|last date|muddat|validity|valid for|expire[sd]?|renew\w*)\b/],
    ["govt", /\b(department|government|govt|dlo|officer|what should (we|a|the)|what to do|our role|advice|advise)\b/],
    ["grounds", /\b(grounds|reasons|when can|defen[cs]e|valid|allowed|conditions|eligib|exceptions?|exempt)\b/],
    ["notes", /\b(punishment|penalty|sentence|fine|imprisonment|jail|consequences?|effects?|what happens|notes|caution|pitfall)\b/],
    ["steps", /\b(process|procedure|procedural|steps|stages|how to|how do|how does|how can|how is|how are|apply|method)\b/],
    ["what", /\b(what is|what are|whats|meaning|define|definition|explain|overview|about)\b/]
  ];
  const FACET = { steps: "p", time: "t", grounds: "gr", govt: "g", notes: "n" };
  const FACET_LABEL = { steps: "Steps", time: "Time limits", grounds: "Grounds & defences", govt: "For departments", notes: "Effects & notes" };
  const FACET_Q = { steps: "procedure", time: "time limit", grounds: "grounds", govt: "what should a department do", notes: "effects and notes" };
  const LAW_FOOT = "General procedural information for departmental awareness — not legal advice. Confirm with standing counsel and the current statute / High Court rules.";
  const numbered = (arr, max) => arr.slice(0, max).map((s, i) => (i + 1) + ". " + s).join("\n");

  function legalReply(m, q) {
    const t = m.top.t; let asp = null;
    for (let i = 0; i < ASPECTS.length; i++) if (ASPECTS[i][1].test(q)) { asp = ASPECTS[i][0]; break; }
    if (asp && asp !== "what" && !t[FACET[asp]]) asp = null;
    let out = "**" + t.title + "**\n";
    if (asp === "steps") out += (t.d ? t.d + "\n\n" : "") + "**Steps**\n" + numbered(t.p, 12);
    else if (asp === "time") out += "**Time limits**\n" + t.t;
    else if (asp === "grounds") out += "**Grounds & defences**\n" + t.gr;
    else if (asp === "govt") out += "**What a department should do**\n" + t.g;
    else if (asp === "notes") out += "**Effects & notes**\n" + t.n;
    else {
      out += t.d || "";
      if (asp !== "what" && t.p) out += "\n\n" + numbered(t.p, 6) + (t.p.length > 6 ? "\n… " + (t.p.length - 6) + " more step(s) — tap Steps" : "");
      if (asp === "what" && t.n) out += "\n\n" + t.n;
      else if (t.t) out += "\n\n**Time limits:** " + t.t;
    }
    if (t.b) out += "\n\nBasis: " + t.b;
    const chips = [];
    if (m.second && m.second.t.id !== t.id && m.second.score >= m.top.score * 0.85 && m.second.score >= LAW_MIN) chips.push(C("Did you mean: " + trunc(m.second.t.title, 28) + "?", "explain " + m.second.t.title));
    Object.keys(FACET).forEach((a) => { if (t[FACET[a]] && a !== asp) chips.push(C(FACET_LABEL[a], t.title + " " + FACET_Q[a])); });
    (t.rel || []).slice(0, 3).forEach((id) => { const r = KB.filter((x) => x.id === id)[0]; if (r) chips.push(C(trunc(r.title, 26), "explain " + r.title)); });
    chips.push(C("Law desk", "law desk"), MENU);
    return R(out, { chips: chips.slice(0, 9), stream: true, foot: LAW_FOOT });
  }
  function compareMatch(q) {
    const n = norm(q).replace(/\b(what is the|what is|what are the|whats|tell me|explain|the)\b/g, " ");
    const parts = n.split(/\b(?:and|vs|versus|v s|or|from|with)\b/).map((s) => s.replace(/\b(difference|differences|differ|compare|comparison|between)\b/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    if (parts.length !== 2) return null;
    const ta = kbTok(parts[0]), tb = kbTok(parts[1]);
    if (ta.length === 1 && tb.length >= 2) parts[0] += " " + tb[tb.length - 1];
    else if (tb.length === 1 && ta.length >= 2) parts[1] += " " + ta[ta.length - 1];
    const ra = kbRank(parts[0])[0], rb = kbRank(parts[1])[0];
    if (!ra || !rb || ra.t.id === rb.t.id || ra.score < LAW_MIN * 0.8 || rb.score < LAW_MIN * 0.8) return null;
    return [ra.t, rb.t];
  }
  function compareReply(pair) {
    const side = (t) => "**" + t.title + "**\n" + t.d + (t.t ? "\nTime limits: " + t.t : "") + (t.n ? "\n" + t.n : "");
    return R("**" + trunc(pair[0].title, 34) + " vs " + trunc(pair[1].title, 34) + "**\n\n" + side(pair[0]) + "\n\n" + side(pair[1]), {
      chips: [C(trunc(pair[0].title, 28), "explain " + pair[0].title), C(trunc(pair[1].title, 28), "explain " + pair[1].title), MENU], stream: true, foot: LAW_FOOT });
  }
  function legalOrCompare(m, q) {
    if (/\b(difference|differ|differences|versus|vs|compare|comparison)\b/.test(q)) { const p = compareMatch(q); if (p) return compareReply(p); }
    return legalReply(m, q);
  }
  function lawMenuReply() {
    const pick = (id) => KB.filter((x) => x.id === id)[0];
    const ids = ["civil_suit", "written_statement", "caveat", "condonation_delay", "exparte", "execution", "contempt", "appeals", "s80_notice", "limitation", "interim_injunction", "restoration"];
    return R("**Law desk** — civil procedure for departmental awareness.\n\nAsk in plain words, for example:\n• How does a caveat work?\n• What is the limitation for filing an appeal?\n• Process of an execution petition\n• Difference between civil and criminal contempt\n• What should a department do on an ex parte order?\n• Section 148A, Order XXI Rule 32, S.80 notice\n\nOr pick a topic:", {
      chips: ids.map((id) => C(trunc(pick(id).title.replace(/ \(.*\)/, ""), 26), "explain " + pick(id).title)).concat([MENU]), foot: LAW_FOOT });
  }
  function suggestLaw(v) { return kbRank(v, { prefix: true }).filter((x) => x.score >= 3).slice(0, 3).map((x) => x.t); }
  const LAWTYPE = { contempt: "contempt", execution: "execution", appeal: "appeals", restoration: "restoration", consumer: "consumer_process", mact: "mact", pauper: "indigent_suit", civilsuit: "civil_suit", review: "review", revision: "revision", condonation: "condonation_delay", transfer: "transfer_suit" };
  const lawChipFor = (typ) => { const id = typ && LAWTYPE[typ.kw]; const t = id && KB.filter((x) => x.id === id)[0]; return t ? C("Law: how does it work?", "explain " + t.title) : null; };

  /* ───────────── 8. THE BRAIN ───────────── */
  const PLACES = ["handwara", "kupwara"];
  function followUp(q, rem, ent) {
    if (rem.length) return null;
    if (S.lastFilter && ent && /^(and|what about|how about|aur|or)\b/.test(q))
      return filterReply({ court: ent.court || S.lastFilter.court, dept: ent.dept || S.lastFilter.dept, type: ent.type || S.lastFilter.type, flag: ent.flag || S.lastFilter.flag, when: ent.when || S.lastFilter.when });
    if (!S.last || ent || !/\b(its|it|this|that|iska|uska|iski|uski|same|above)\b|^(and|what about|also)\b/.test(q)) return null;
    const r = S.last, out = [];
    if (/\bcourt\b/.test(q)) out.push("Court: " + courtLabel(r));
    if (/\b(dept|department)\b/.test(q)) out.push("Department: " + deptLabel(r));
    if (/\brepl/.test(q)) out.push("Reply: " + (r.reply || "not recorded"));
    if (/\b(counsel|advocate|lawyer)\b/.test(q)) out.push(S.staff ? "Counsel: " + (r.counsel || "not assigned") : "Counsel details are shown to staff.");
    if (/\b(proceeding|last order)\b/.test(q)) out.push(S.staff ? "Last proceeding: " + (r.last || "not recorded") : "Proceeding details are shown to staff.");
    if (/\bstatus\b/.test(q)) out.push("Status: " + (r.status || (r.disposed ? "Disposed" : "Active")));
    if (/\b(hearing|date|when)\b/.test(q)) out.push("Next hearing: " + (r.next ? fmtDate(r.next) + " (" + rel(r.next) + ")" : "awaited"));
    if (/\btype\b/.test(q)) out.push("Type: " + (r.type || "not recorded"));
    return out.length ? R("**" + trunc(r.title, 70) + "**\n" + out.join("\n"), { chips: [MENU] }) : null;
  }

  function answer(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    if (text === "__more") return moreReply();
    if (text.indexOf("__title ") === 0) {
      if (!hasData()) return noData();
      const tk = tokenize(text.slice(8)), res = runSearch(tk, null);
      return res.exact.length ? casesReply(res, tk, false) : notFound(res, tk);
    }
    if (text === "__partial") return S.partial ? casesReply(S.partial.res, S.partial.rem, true) : moreReply();

    let q = fixTypos(translate(norm(text)));
    const qFull = q;
    const words = q.split(" ");
    if (words.length <= 4) {
      if (/^(hi+|hello|hey|salam|salaam|assalam\w*|asalam\w*|namaste|adaab|good (morning|afternoon|evening))\b/.test(q)) return R((/^a?salam|^assalam|^salaam/.test(q) ? "Wa-alaikum assalam. " : "Hello. ") + "Ask about a case, court, department, hearings or the office.", { chips: MAIN_CHIPS });
      if (/^(thanks?|thank you|thx|ok+|okay|great|nice|acha|theek)\b/.test(q)) return R("You're welcome. Ask another question whenever you need.", { chips: [MENU] });
      if (/^(menu|help|start|main menu|what can you do|examples?|options)$/.test(q)) return openingReply();
      if (/\blaw desk\b|^(legal help|legal questions?|law menu|cpc help|legal)$/.test(q)) return lawMenuReply();
    }
    const cnr = text.match(/\b(JK[A-Z]{2}\d{6,}|CASE-[A-Z0-9]{3,}|[A-Z]{2,6}[\/\-]\d{1,6}[\/\-]\d{2,4})\b/i);
    if (cnr) return byNumber(cnr[1]);

    let dt = parseWhen(q); if (dt) q = dt.q;
    const t0 = todayD();
    if (!dt && /\bcause list\b/.test(q)) dt = { from: t0, to: t0, label: "today", q, auto: true };
    else if (!dt && /\burgent\b/.test(q)) dt = { from: t0, to: addDays(t0, 2), label: "next 48 hours", q, auto: true };
    else if (!dt && /\b(hearings?|upcoming|listed)\b/.test(q) && !findFlag(q)) dt = { from: t0, to: addDays(t0, 7), label: "next 7 days", q, auto: true };

    const cf = findCourt(q), df = findDept(q), tf = findType(q), flag = findFlag(q);
    if (df) df.phrase = df.phrase;
    let qr = q; [cf && cf.phrase, df && df.phrase, tf && tf.phrase].forEach((p) => { if (p) qr = qr.replace(p, " "); });
    const rem = qr.split(" ").filter((w) => w && !NOISE[w] && (w.length > 1 || /\d/.test(w)));
    if (dt && dt.auto && rem.length) dt = null;   // a bare "hearing" word must not narrow a name search
    const ent = { court: cf && cf.court, dept: df, type: tf, flag, when: dt, phrase: df && !flag && !dt && !tf && !cf ? df.phrase : "" };
    const entity = !!(cf || df || tf || flag || dt);
    const wantList = /\b(list|show|which|display|all)\b/.test(q);
    const explicit = /\b(next date|hearing date|next hearing|date of|case of|status of|hearing of|vs|versus|v s)\b/.test(q);

    const kbm = legalMatch(qFull), lawCue = LAWCUE.test(qFull);
    const lf = () => (kbm && kbm.top.score >= LAW_MIN * 0.8 ? legalOrCompare(kbm, qFull) : fallback(text, q));
    const lawMin = lawCue ? 2.5 : LAW_MIN;
    if (kbm && kbm.top.score >= lawMin) {
      const resid = rem.filter((w) => !KBV[w] && !KBV[kbStem(w)] && !KB_DROP[w] && !KB_STOP[w]);
      const dataEntity = !!(cf || df || flag || (dt && !dt.auto));
      const lawLeft = rem.some((w) => KBV[w] || KBV[kbStem(w)]);
      const typeHasRows = !!(tf && DATA.rows.some((r) => normKey(r.type).indexOf(tf.kw) !== -1));
      const flagOnlyEmpty = !!(flag && !cf && !df && !(dt && !dt.auto) && !DATA.rows.some((r) => rowPass(r, { flag })));
      if (!resid.length && (lawCue || (kbm.top.score >= LAW_STRONG && !dataEntity && (!tf || lawLeft || !typeHasRows)) || (kbm.top.score >= LAW_STRONG && flagOnlyEmpty && (!tf || !typeHasRows))) || (tf && !typeHasRows && !dataEntity)) return legalOrCompare(kbm, qFull);
      if (lawCue && kbm.top.score >= LAW_STRONG * 1.6) return legalOrCompare(kbm, qFull);
    }

    const fu = followUp(q, rem, entity ? ent : null); if (fu) return fu;

    const it = matchIntent(q);
    const residual = it ? rem.filter((w) => !it.kw[w]) : rem;
    if (it && !explicit && !residual.length && !(it.skipIfEntity && entity)) return it.run(q);

    if (rem.length) {
      if (!hasData()) return noData();
      const soft = { court: ent.court, dept: ent.dept, type: ent.type, flag: ent.flag, when: dt && !dt.auto ? dt : null };
      const res = runSearch(rem, soft);
      if (res.exact.length) return casesReply(res, rem, false);
      if (explicit) return notFound(res, rem);
      if (it && !(it.skipIfEntity && entity)) return it.run(q);
      if (entity) return filterReply(ent, wantList);
      if (rem.every((w) => PLACES.indexOf(w) !== -1) && rem.length === 1) {
        const cs = COURTS.filter((c) => norm(c.short).indexOf(rem[0]) !== -1);
        return R("Several courts sit at " + rem[0][0].toUpperCase() + rem[0].slice(1) + " — pick one:", { chips: cs.map((c) => C(c.short, c.short)).concat([MENU]) });
      }
      if (res.partial.length) return notFound(res, rem);
      return lf();
    }
    if (it && !(it.skipIfEntity && entity)) return it.run(q);
    const g = !entity ? generalData(q) : null; if (g) return g;
    if (entity) return filterReply(ent, wantList);
    if (explicit) return askParty();
    return lf();
  }

  const CORE = { answer, load: setRows, S, DATA, norm, phon, simTok, mk, VERSION, KB, kbRank, legalMatch, suggestLaw, kbRefs, KBI };
  W.DLO_ASSISTANT = { version: VERSION, ask: answer, suggest: suggestLaw, reload: () => ensureData(true), setStaff: (v) => { S.staff = !!v; }, data: DATA };
  if (!HAS_DOM) { if (typeof module !== "undefined" && module.exports) module.exports = CORE; return; }

  /* ───────────── 9. UI ───────────── */
  const CSS = [
    "#dlo-chat-teaser{position:fixed;bottom:78px;left:24px;background:#fff;color:#0c2340;border:1px solid #cbd5e1;border-radius:10px;padding:7px 13px;font-size:12px;font-weight:600;box-shadow:0 4px 18px rgba(0,0,0,.12);z-index:9998;display:flex;align-items:center;gap:6px;cursor:pointer;animation:dloFloat 3s ease-in-out infinite}",
    "#dlo-chat-teaser::after{content:'';position:absolute;bottom:-6px;left:20px;border-width:6px 6px 0;border-style:solid;border-color:#fff transparent;display:block;width:0}",
    "@keyframes dloFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
    "#dlo-chat-trigger{position:fixed;bottom:24px;left:24px;background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:50px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(12,35,64,.35);z-index:9999;display:flex;align-items:center;gap:8px;transition:all .2s ease}",
    "#dlo-chat-trigger:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(12,35,64,.45)}",
    "#dlo-chat-trigger:focus-visible,.dlo-chip-btn:focus-visible,.dlo-mini:focus-visible,.dlo-action-btn:focus-visible,#dlo-send-btn:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}",
    "#dlo-chat-window{position:fixed;bottom:78px;left:24px;width:380px;max-width:calc(100vw - 36px);height:560px;max-height:min(560px,80vh);background:#fff;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 12px 35px rgba(0,0,0,.22);display:none;flex-direction:column;z-index:9999;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
    "#dlo-chat-header{background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}",
    ".dlo-header-left{display:flex;align-items:center;gap:8px}",
    ".dlo-status-dot{width:8px;height:8px;background:#10b981;border-radius:50%;box-shadow:0 0 6px #10b981}",
    ".dlo-status-dot.off{background:#f59e0b;box-shadow:0 0 6px #f59e0b}",
    ".dlo-header-title{font-weight:600;font-size:13.5px}.dlo-header-sub{font-size:10px;opacity:.8;margin-top:1px}",
    ".dlo-header-actions{display:flex;gap:10px;align-items:center}",
    ".dlo-action-btn{cursor:pointer;opacity:.85;font-size:15px;transition:opacity .15s;background:none;border:none;color:#fff;padding:2px 4px}.dlo-action-btn:hover{opacity:1}",
    "#dlo-chat-body{position:relative;padding:14px;overflow-y:auto;flex-grow:1;display:flex;flex-direction:column;gap:10px;background:#f8fafc;scroll-behavior:smooth}",
    ".dlo-msg-row{display:flex;width:100%}.dlo-msg-row.bot{justify-content:flex-start}.dlo-msg-row.user{justify-content:flex-end}",
    ".dlo-bubble{max-width:92%;padding:9px 12px;border-radius:12px;font-size:12px;line-height:1.45;word-break:break-word;white-space:pre-line;box-shadow:0 1px 3px rgba(0,0,0,.05)}",
    ".dlo-msg-row.bot .dlo-bubble{background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:3px}",
    ".dlo-msg-row.user .dlo-bubble{background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;border-bottom-right-radius:3px;max-width:85%}",
    ".dlo-bubble-action{display:inline-block;margin-top:6px;padding:5px 10px;background:#eff6ff;color:#1e3a8a;border-radius:6px;font-weight:600;text-decoration:none;font-size:11px;border:1px solid #bfdbfe}",
    ".dlo-card{white-space:normal;background:#f8fafc;border:1px solid #dbe4f0;border-left:3px solid #1e3a8a;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:11.5px;line-height:1.4}",
    ".dlo-card-title{font-weight:700;color:#0c2340;font-size:12.5px}",
    ".dlo-card-title mark{background:#fde68a;color:inherit;border-radius:2px;padding:0 1px}",
    ".dlo-card-sub{color:#64748b;font-size:10.5px;margin:1px 0 4px}",
    ".dlo-kv{display:flex;gap:8px;justify-content:space-between;border-top:1px dashed #e2e8f0;padding:3px 0}",
    ".dlo-kv span{color:#64748b;flex-shrink:0}.dlo-kv b{font-weight:600;color:#0f172a;text-align:right}",
    ".dlo-kv b.red{color:#b91c1c}.dlo-kv b.amber{color:#b45309}.dlo-kv b.green{color:#15803d}",
    ".dlo-pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}",
    ".dlo-pill{font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px;background:#e2e8f0;color:#334155}",
    ".dlo-pill.ok{background:#dcfce7;color:#166534}.dlo-pill.bad{background:#fee2e2;color:#991b1b}.dlo-pill.warn{background:#fef3c7;color:#92400e}",
    ".dlo-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}",
    ".dlo-mini{font-size:10.5px;border:1px solid #cbd5e1;background:#fff;color:#0c2340;border-radius:6px;padding:3px 8px;cursor:pointer;text-decoration:none;font-family:inherit}.dlo-mini:hover{background:#0c2340;color:#fff}",
    ".dlo-typing{display:inline-flex;gap:4px;align-items:center;padding:6px 10px}",
    ".dlo-typing span{width:5px;height:5px;background:#94a3b8;border-radius:50%;animation:dloBounce 1.2s infinite ease-in-out}.dlo-typing span:nth-child(2){animation-delay:.2s}.dlo-typing span:nth-child(3){animation-delay:.4s}",
    "@keyframes dloBounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}",
    ".dlo-foot{font-size:10px;color:#64748b;margin-top:8px;padding-top:6px;border-top:1px solid #eef2f7;line-height:1.35}",
    ".dlo-typing-label{font-size:11px;color:#64748b;margin-left:6px;white-space:nowrap}",
    "#dlo-chips-container{padding:8px 12px;background:#fff;border-top:1px solid #f1f5f9;display:flex;flex-wrap:wrap;gap:5px;max-height:104px;overflow-y:auto;flex-shrink:0}",
    ".dlo-chip-btn{background:#f8fafc;border:1px solid #cbd5e1;color:#0c2340;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease;font-family:inherit}.dlo-chip-btn:hover{background:#0c2340;color:#fff;border-color:#0c2340}",
    "#dlo-input-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#fff;border-top:1px solid #e2e8f0;flex-shrink:0}",
    "#dlo-user-input{flex-grow:1;border:1px solid #cbd5e1;border-radius:20px;padding:7px 12px;font-size:12px;outline:none;color:#0f172a;font-family:inherit}#dlo-user-input:focus{border-color:#1e3a8a}",
    "#dlo-send-btn{background:#0c2340;color:#fff;border:none;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;transition:background .15s;flex-shrink:0}#dlo-send-btn:hover{background:#1e3a8a}",
    "@media (max-width:480px){#dlo-chat-window{left:8px;right:8px;width:auto;bottom:70px;height:min(580px,82vh);border-radius:14px}#dlo-chat-trigger,#dlo-chat-teaser{left:12px}#dlo-chat-trigger{bottom:16px}#dlo-chat-teaser{bottom:70px}}",
    "@media (prefers-reduced-motion:reduce){#dlo-chat-teaser{animation:none}#dlo-chat-trigger:hover{transform:none}#dlo-chat-body{scroll-behavior:auto}}"
  ].join("\n");

  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rich(el, text) {
    String(text).split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) el.appendChild(h("strong", "", part.slice(2, -2)));
      else if (part) el.appendChild(document.createTextNode(part));
    });
  }
  function highlight(el, text, toks) {
    if (!toks || !toks.length) { el.textContent = text; return; }
    text.split(/(\s+)/).forEach((w) => {
      const n = norm(w);
      if (n && toks.some((q) => simTok(q, mk(n)) >= MATCH_MIN)) el.appendChild(h("mark", "", w)); else el.appendChild(document.createTextNode(w));
    });
  }
  function kv(card, k, v, cls) { const row = h("div", "dlo-kv"); row.appendChild(h("span", "", k)); row.appendChild(h("b", cls || "", v)); card.appendChild(row); }
  function cardText(r) {
    return ["Case: " + r.title, r.number && "No.: " + r.number, "Court: " + courtLabel(r), "Department: " + deptLabel(r),
      "Next hearing: " + (r.next ? fmtDate(r.next) : "awaited"), r.reply && "Reply: " + r.reply, "— " + OFFICE.name].filter(Boolean).join("\n");
  }
  function calLink(r) {
    const pad = (n) => (n < 10 ? "0" : "") + n, ymd = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Hearing: " + trunc(r.title, 80)) +
      "&dates=" + ymd(r.next) + "/" + ymd(addDays(r.next, 1)) + "&details=" + encodeURIComponent((r.number ? r.number + "\n" : "") + courtLabel(r) + "\n" + deptLabel(r)) + "&location=" + encodeURIComponent(courtLabel(r));
  }
  function buildCard(r, hl) {
    const c = h("div", "dlo-card"), t = h("div", "dlo-card-title"); highlight(t, r.title, hl); c.appendChild(t);
    if (r.number) c.appendChild(h("div", "dlo-card-sub", r.number));
    if (r.next) { const n = daysFrom(r.next); kv(c, "Next hearing", fmtDate(r.next) + " · " + rel(r.next), r.disposed ? "" : n < 0 ? "red" : n <= 3 ? "red" : n <= 7 ? "amber" : "green"); }
    else kv(c, "Next hearing", "Awaited");
    kv(c, "Court", courtLabel(r)); kv(c, "Department", deptLabel(r));
    if (r.type) kv(c, "Type", r.type);
    if (S.staff && r.counsel) kv(c, "Counsel", r.counsel);
    if (S.staff && r.last) kv(c, "Last proceeding", trunc(r.last, 140));
    const pills = h("div", "dlo-pills");
    pills.appendChild(h("span", "dlo-pill " + (r.disposed ? "" : "ok"), r.disposed ? "Disposed" : "Active"));
    if (!r.disposed && r.replyState === "pending") pills.appendChild(h("span", "dlo-pill bad", "Reply pending"));
    if (r.replyState === "filed") pills.appendChild(h("span", "dlo-pill ok", "Reply filed"));
    if (r.exparte && !r.disposed) pills.appendChild(h("span", "dlo-pill warn", "Ex-parte"));
    if (!r.disposed && r.next && daysFrom(r.next) < 0) pills.appendChild(h("span", "dlo-pill bad", "Overdue"));
    c.appendChild(pills);
    const act = h("div", "dlo-card-actions");
    if (r.next && !r.disposed) { const a = h("a", "dlo-mini", "Add to calendar"); a.href = calLink(r); a.target = "_blank"; a.rel = "noopener noreferrer"; act.appendChild(a); }
    const wa = h("a", "dlo-mini", "WhatsApp"); wa.href = "https://wa.me/?text=" + encodeURIComponent(cardText(r)); wa.target = "_blank"; wa.rel = "noopener noreferrer"; act.appendChild(wa);
    const cp = h("button", "dlo-mini", "Copy"); cp.type = "button";
    cp.addEventListener("click", () => {
      const done = () => { cp.textContent = "Copied"; setTimeout(() => { cp.textContent = "Copy"; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cardText(r)).then(done).catch(() => {});
    });
    act.appendChild(cp); c.appendChild(act);
    return c;
  }

  function mount() {
    const style = h("style"); style.textContent = CSS; document.head.appendChild(style);

    const teaser = h("div"); teaser.id = "dlo-chat-teaser"; teaser.setAttribute("role", "button"); teaser.appendChild(h("span", "", "💬 Search any case — ask me")); document.body.appendChild(teaser);
    const trigger = h("button"); trigger.id = "dlo-chat-trigger"; trigger.type = "button"; trigger.setAttribute("aria-label", "Open DLO Kupwara Assistant");
    trigger.appendChild(h("span", "", "⚖")); trigger.appendChild(h("span", "", "Ask Assistant")); document.body.appendChild(trigger);

    const box = h("div"); box.id = "dlo-chat-window"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "DLO Kupwara Assistant"); box.tabIndex = -1;
    const head = h("div"); head.id = "dlo-chat-header";
    const left = h("div", "dlo-header-left"), dot = h("span", "dlo-status-dot off"), titles = h("div");
    titles.appendChild(h("div", "dlo-header-title", "DLO Kupwara Assistant"));
    const sub = h("div", "dlo-header-sub", "Connecting to registry…"); titles.appendChild(sub);
    left.appendChild(dot); left.appendChild(titles);
    const acts = h("div", "dlo-header-actions");
    const clearBtn = h("button", "dlo-action-btn", "↺"); clearBtn.type = "button"; clearBtn.title = "New chat"; clearBtn.setAttribute("aria-label", "Start a new chat");
    const closeBtn = h("button", "dlo-action-btn", "✕"); closeBtn.type = "button"; closeBtn.title = "Close"; closeBtn.setAttribute("aria-label", "Close assistant");
    acts.appendChild(clearBtn); acts.appendChild(closeBtn); head.appendChild(left); head.appendChild(acts);
    const body = h("div"); body.id = "dlo-chat-body"; body.setAttribute("aria-live", "polite");
    const chips = h("div"); chips.id = "dlo-chips-container";
    const bar = h("div"); bar.id = "dlo-input-bar";
    const input = h("input"); input.id = "dlo-user-input"; input.type = "text"; input.maxLength = 200; input.autocomplete = "off"; input.placeholder = "Name, title word, case no., court, date…"; input.setAttribute("aria-label", "Ask the assistant");
    input.setAttribute("enterkeyhint", "send");
    const send = h("button", "", "➤"); send.id = "dlo-send-btn"; send.type = "button"; send.setAttribute("aria-label", "Send");
    bar.appendChild(input); bar.appendChild(send);
    [head, body, chips, bar].forEach((e) => box.appendChild(e)); document.body.appendChild(box);

    let opened = false, started = false;
    function refreshHeader() {
      const ok = hasData();
      dot.className = "dlo-status-dot" + (ok ? "" : " off");
      sub.textContent = ok ? (S.staff ? "Staff view" : "Public view") + " · " + DATA.rows.length + " cases live" : "Registry not reachable";
    }
    let lastChips = [], sugTimer = null;
    function renderChips(list, keep) {
      if (!keep) lastChips = list || [];
      chips.textContent = "";
      (list || []).forEach((c) => { const b = h("button", "dlo-chip-btn", c.label); b.type = "button"; b.addEventListener("click", () => ask(c.label, c.q)); chips.appendChild(b); });
    }
    function addUser(text) { const row = h("div", "dlo-msg-row user"); row.appendChild(h("div", "dlo-bubble", text)); body.appendChild(row); body.scrollTop = body.scrollHeight; }
    const reduceMotion = () => !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches);
    function streamRich(el, text, done) {   // types the answer out word by word, like a chat model; tap the bubble to skip
      const toks = [];
      String(text).split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
        if (!part) return;
        const bold = /^\*\*[^*]+\*\*$/.test(part), t = bold ? part.slice(2, -2) : part;
        t.split(/(\s+)/).forEach((w) => { if (w) toks.push({ w, b: bold }); });
      });
      let i = 0, cur = null, curBold = null, skip = false;
      const per = Math.max(1, Math.ceil(toks.length / 130));
      el.addEventListener("click", () => { skip = true; }, { once: true });
      const put = (t) => {
        if (!cur || curBold !== t.b) { cur = t.b ? h("strong") : document.createTextNode(""); curBold = t.b; el.appendChild(cur); }
        if (t.b) cur.textContent += t.w; else cur.data += t.w;
      };
      (function tick() {
        const n = skip ? toks.length : Math.min(toks.length, i + per);
        while (i < n) put(toks[i++]);
        body.scrollTop = body.scrollHeight;
        if (i < toks.length) setTimeout(tick, 18); else done();
      })();
    }
    function addBot(rep) {
      const row = h("div", "dlo-msg-row bot"), b = h("div", "dlo-bubble");
      row.appendChild(b); body.appendChild(row);
      const finish = () => {
        if (rep.cards) rep.cards.forEach((r) => b.appendChild(buildCard(r, rep.hl)));
        if (rep.link && rep.link.url) { b.appendChild(document.createElement("br")); const a = h("a", "dlo-bubble-action", (rep.link.text || "Open") + " →"); a.href = rep.link.url; b.appendChild(a); }
        if (rep.foot) b.appendChild(h("div", "dlo-foot", rep.foot));
        if (!rep.stream) body.scrollTop = Math.max(0, row.offsetTop - 8);
        renderChips(rep.chips);
      };
      if (rep.stream && !reduceMotion()) streamRich(b, rep.text, finish); else { rich(b, rep.text); finish(); }
    }
    function typing() { const row = h("div", "dlo-msg-row bot"), b = h("div", "dlo-bubble dlo-typing"); for (let i = 0; i < 3; i++) b.appendChild(h("span")); row.appendChild(b); body.appendChild(row); body.scrollTop = body.scrollHeight; return row; }
    function ask(label, q) {
      addUser(label); renderChips([]);
      const t = typing();
      ensureData().then(() => {
        let rep; try { rep = answer(q); } catch (e) { rep = R("Something went wrong while answering that. Please rephrase, or use Search & Filter Cases.", { link: PAGES.search, chips: [MENU] }); }
        rep = rep || askParty();
        if (rep.stream) t.firstChild.appendChild(h("span", "dlo-typing-label", "Reviewing the Code of Civil Procedure…"));
        setTimeout(() => { t.remove(); addBot(rep); refreshHeader(); }, rep.stream ? 650 : 160);
      });
    }
    function start() {
      body.textContent = ""; S.last = null; S.lastFilter = null; S.pager = null; renderChips([]);
      const t = typing();
      Promise.all([ensureData(), detectStaff()]).then(() => { t.remove(); addBot(openingReply()); refreshHeader(); });
    }
    function open() {
      opened = true; box.style.display = "flex"; teaser.style.display = "none"; trigger.setAttribute("aria-expanded", "true");
      if (!started) { started = true; start(); } else { detectStaff().then(refreshHeader); ensureData().then(refreshHeader); }
      input.focus();
    }
    function close() { opened = false; box.style.display = "none"; trigger.setAttribute("aria-expanded", "false"); trigger.focus(); }
    trigger.addEventListener("click", () => (opened ? close() : open()));
    teaser.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    clearBtn.addEventListener("click", start);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && opened) close(); });
    function submit() { const v = input.value.trim(); if (!v) return; input.value = ""; ask(v, v); }
    send.addEventListener("click", submit);
    input.addEventListener("input", () => {   // predictive suggestions: law topics for everyone, case titles for staff only
      clearTimeout(sugTimer);
      sugTimer = setTimeout(() => {
        const v = input.value.trim();
        if (v.length < 3) { renderChips(lastChips, true); return; }
        let sug = [];
        if (S.staff && hasData()) { const tk = tokenize(v); if (tk.length) sug = runSearch(tk, null).exact.slice(0, 2).map((x) => C("🔎 " + trunc(x.row.title, 34), "__title " + x.row.title)); }
        sug = sug.concat(suggestLaw(v).map((t) => C("📘 " + trunc(t.title.replace(/ \(.*\)/, ""), 30), "explain " + t.title)));
        renderChips(sug.length ? sug : lastChips, true);
      }, 160);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    setTimeout(() => { teaser.style.display = "none"; }, 12000);
    ensureData();   // warm the cache in the background
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
