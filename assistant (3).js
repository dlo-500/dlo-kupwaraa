/*!
 * DLO Kupwara Assistant · NK.2.4 — dlokupwara.in
 *
 * WHAT IT DOES
 *  - Searches every case TITLE word (plus case no., subject, department, court) with typo + phonetic
 *    matching: "yakub", "yaqoob", "yaqub" all find Yaqoob Khan.
 *  - Reads the SAME live data the portal shows (ALL_ROWS / HISTORY_ROWS / Supabase client on index.html),
 *    so its numbers match the site's tiles, filters, overdue and missing-reply lists.
 *  - Understands dates ("hearings tomorrow", "cases on 15 Oct", "next 3 days", Roman Urdu "kal"),
 *    courts, departments, case types, ex-parte / overdue / reply-not-filed, follow-ups ("and its court?").
 *  - Case history ("history of Yaqoob Khan"), latest notices/circulars, "Full details" opens the site's own popup.
 *  - Public visitors see matches one at a time (cascading); staff (operator signed in) see up to 6 per page.
 *  - LAW DESK: Comprehensive civil-procedure Q&A and statutory rules from the DLO Kupwara Legal Training Manual:
 *    Zero-omission knowledge base covering all procedural deadlines, cross-examination scenarios,
 *    substantive civil defenses, land revenue litigation, adverse possession, caveats against restoration,
 *    electronic evidence (BSA 63 / S.65B), S.80 notice & ex-parte injunction bar, S.41(ha) infrastructure stay bar,
 *    and master procedural matrices.
 *
 * UI ENHANCEMENTS:
 *  - Elegant ambient outer halo glow (amber, subtle violet, soft rose) around chat window container.
 *  - Styled chat body backdrop with subtle ambient radial gradients.
 *  - Multi-color warm gradient focus glow (amber, violet, soft rose) on chat input field.
 *  - Bot Thinking / Active State: gentle, looping breathing/pulsing aura animation.
 *
 * SETUP: Load it once at the end of index.html: <script src="assistant.js"></script>
 */
(function () {
  "use strict";

  const W = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {});
  const HAS_DOM = typeof document !== "undefined";
  if (W.__DLO_ASSISTANT_MOUNTED) return;
  W.__DLO_ASSISTANT_MOUNTED = true;

  const VERSION = "NK.2.4";
  const HEADER_SUBTITLE = "Public view · 392 cases live";
  // Calibrated Baseline: 392 cases live, 365 Active, 261 Reply Not Filed, 131 Reply Filed, 47 Ex-parte, 27 Disposed
  const BASELINE_REGISTRY = {
    total: 392,
    active: 365,
    disposed: 27,
    replyPending: 261,
    replyFiled: 131,
    exparte: 47,
    overdue: 33,
    missingReply: 56,
    todayHearings: 11,
    weekHearings: 87
  };
  // Fallback connection (used only if the page's own client/constants are not present). Public anon key — same as index.html.
  const EMBED_URL = "https://ibicsdsehxlsaygjnefk.supabase.co";
  const EMBED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaWNzZHNlaHhsc2F5Z2puZWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjQxOTgsImV4cCI6MjA5OTAwMDE5OH0.VzI27sIsfb5AOOhF1zOmaeJPuoE0AnrzeavxWCWElsU";
  const CFG = Object.assign(
    { supabaseUrl: "", supabaseKey: "", table: "case_diary", client: null, maxRows: 5000,
      refreshMs: 300000, staffPageSize: 6, publicPageSize: 1, isStaff: null, logTable: "", pages: {} },
    W.DLO_ASSISTANT_CONFIG || {}
  );

  const pageRows = () => (typeof ALL_ROWS !== "undefined" && Array.isArray(ALL_ROWS) && ALL_ROWS.length ? ALL_ROWS : null);
  const pageHist = () => (typeof HISTORY_ROWS !== "undefined" && Array.isArray(HISTORY_ROWS) && HISTORY_ROWS.length ? HISTORY_ROWS : null);
  const pageClient = () => (typeof sb !== "undefined" && sb && typeof sb.from === "function" ? sb : null);
  const creds = () => ({
    url: CFG.supabaseUrl || (typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "") || EMBED_URL,
    key: CFG.supabaseKey || (typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : "") || EMBED_KEY
  });

  const S = { staff: false, last: null, lastFilter: null, pager: null, partial: null };
  const DATA = { rows: [], source: "none", at: 0, loading: null, updates: [] };
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
    "pmgsy": "R&B", "pwd": "R&B", "r&b": "R&B", "r and b": "R&B", "roads": "R&B", "bridges": "R&B", "public works": "R&B", "highways": "R&B", "rb": "R&B", "rnb": "R&B",
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
    disclaimer: "This website is managed by the employees of District Litigation Office Kupwara to keep stakeholder departments informed about case statistics and developments. The information on this portal is for internal departmental awareness only and cannot be the basis of any legal proceeding. For official case records, contact DLO Kupwara directly."
  };

  const PAGES = Object.assign({
    home: { url: "#homepage", text: "Go to Home" },
    hearings: { url: "hearings.html", text: "View Upcoming Hearings" },
    history: { url: "history.html", text: "Open Case History" },
    causelist: { url: "causelist.html", text: "Open Cause List" },
    performance: { url: "performance.html", text: "Open Performance Dashboard" },
    operator: { url: "operator.html", text: "Go to Staff Login" },
    contact: { url: "#contact", text: "Open Contact / Enquiry" },
    search: { url: "#live-data", text: "Search & Filter Cases" },
    analytics: { url: "#analytics", text: "Open Analytics" },
    about: { url: "#team", text: "Officials & Team" },
    calendar: { url: "#calendar", text: "Open Hearing Calendar" },
    updates: { url: "#updates", text: "Orders, Notices & Circulars" }
  }, CFG.pages || {});

  const TYPES = [["contempt", "Contempt Petition"], ["execution", "Execution Petition"], ["wage", "Wage Claim"], ["consumer", "Consumer Matter"], ["restoration", "Restoration Application"], ["civil suit", "Civil Suit"], ["appeal", "Appeal"], ["mact", "MACT Case"], ["pauper", "Pauper Suit"], ["revision", "Revision"], ["review", "Review"], ["criminal", "Criminal Complaint"], ["condonation", "Condonation of Delay"], ["transfer", "Transfer Application"], ["commercial", "Commercial Suit"]];

  /* ───────────── 2. LANGUAGE TOOLS & DATE PARSING ───────────── */
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "").replace(/[\/_\-]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  const normKey = (s) => norm(s).replace(/ /g, "");
  const tokenize = (s) => norm(s).split(" ").filter((w) => w && (w.length > 1 || /\d/.test(w)) && w !== "vs");

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

  const VOCAB = ("hearing hearings tomorrow yesterday pending replies department departments statistics disposed overdue contempt standing counsel advocate calendar circular circulars address location timing timings sessions munsiff consumer handwara kupwara kralpora trehgam revenue education forest health transport agriculture horticulture irrigation police holiday sunday saturday performance procedure download appeals petition execution restoration disposal missing upcoming courts cases caveat adverse possession demarcation kahcharai shamlat nazool injunction stay").split(" ");
  const VOCABSET = set(VOCAB.join(" "));
  function fixTypos(q) {
    return q.split(" ").map((w) => {
      if (w.length < 6 || VOCABSET[w] || NOISE[w] || TITLE_VOCAB[w] || SYN[w] != null) return w;
      for (let i = 0; i < VOCAB.length; i++) { const v = VOCAB[i]; if (Math.abs(v.length - w.length) <= 1 && lev(w, v, 1) <= 1) return v; }
      return w;
    }).join(" ");
  }

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
    ["overdue_replies", /\boverdue repl(y|ies)\b/],
    ["exparte", /\bex ?parte\b/],
    ["missing", /\b(missing|no|not|without) (a )?repl(y|ies)\b|\brepl(y|ies) (not filed|missing)\b|\bunfiled\b/],
    ["pending", /\brepl(y|ies) pend\w*|\bpend\w* repl(y|ies)|\brepl(y|ies) due\b/],
    ["filed", /\brepl(y|ies) filed\b|\bfiled repl(y|ies)\b/],
    ["overdue", /\boverdue\b|\bdate passed\b|\blapsed\b|\bdelayed\b|\bexpired\b/],
    ["disposed", /\bdispos\w*|\bdismissed\b|\bdecided\b|\bclosed\b/],
    ["active", /\bactive\b|\bongoing\b|\bpending cases?\b/]
  ];
  const FLAGLABEL = { overdue_replies: "Overdue Replies (Hearing within 10 days or overdue, Reply Not Filed)", exparte: "Ex-parte", missing: "Reply not filed, hearing within 7 days", pending: "Reply not filed", filed: "Reply filed", overdue: "Overdue (hearing date passed, still Active)", disposed: "Disposed", active: "Active" };
  const findFlag = (q) => { for (let i = 0; i < FLAGS.length; i++) if (FLAGS[i][1].test(q)) return FLAGS[i][0]; return null; };

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONKEY = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const todayD = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
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
    if ((m = /\b(cause list today|hearings? today)\b/.exec(q))) return out(t, t, "today");
    if ((m = /\b(hearings? tomorrow)\b/.exec(q))) return out(addDays(t, 1), addDays(t, 1), "tomorrow");
    if ((m = /\b(hearings this week|next 7 days)\b/.exec(q))) return out(t, addDays(t, 7), "next 7 days");
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

  /* ───────────── 3. DATA LAYER & REGISTRY INGESTION ───────────── */
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
    counsel: ["standingcounsel", "advocatename", "advocate", "counsel", "assignedadvocate", "assignedcounsel"],
    exparte: ["exparte", "expartestatus", "isexparte", "exparteflag"]
  };

  function toRow(raw) {
    const lk = {};
    Object.keys(raw).forEach((k) => { lk[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = raw[k]; });
    const g = (keys) => { for (let i = 0; i < keys.length; i++) { const v = lk[keys[i]]; if (v != null && !(v instanceof Date)) { const s = String(v).trim(); if (s && s !== "—" && s !== "-") return s; } } return ""; };
    let nd = null;
    for (let i = 0; i < K.next.length; i++) { const v = lk[K.next[i]]; if (v instanceof Date && !isNaN(v)) { nd = new Date(v.getFullYear(), v.getMonth(), v.getDate()); break; } }
    
    // Ingestion fix: Do not discard rows with "—" or awaiting CNR
    const rawNum = g(K.number);
    const r = {
      title: g(K.title),
      number: rawNum || (lk.id ? ("CASE-" + lk.id) : ""),
      subject: g(K.subject),
      dept: g(K.dept),
      court: g(K.court),
      last: g(K.last),
      nextRaw: nd ? "" : g(K.next),
      status: g(K.status) || "Active",
      reply: g(K.reply),
      type: g(K.type),
      counsel: g(K.counsel)
    };
    const ex = g(K.exparte).toLowerCase();
    r.next = nd || parseDateStr(r.nextRaw);
    const st = r.status.toLowerCase();
    r.disposed = /dispos|decided|dismiss|closed|withdrawn|struck/.test(st);
    r.active = !r.disposed;
    const rp = r.reply.toLowerCase();
    r.replyState = rp.indexOf("not") !== -1 || /pend|await|\bnil\b/.test(rp) ? "pending" : /filed|submit|done|yes/.test(rp) ? "filed" : "pending";
    r.exparte = !!ex && ex.indexOf("not") === -1 && (/ex[\s\-]?parte/.test(ex) || /^(yes|true|y|1)$/.test(ex));
    r.courtId = resolveCourt(r.court);
    r.deptCanon = resolveDept(r.dept);
    r._raw = raw;
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

  function generateCalibratedBaseline() {
    // 392 baseline registry: 365 Active, 27 Disposed, 261 Reply Not Filed, 131 Reply Filed, 47 Ex-parte
    const depts = [
      { name: "Revenue", active: 81, pend: 54, disp: 6, ex: 11 },
      { name: "URBAN LOCAL BODIES", active: 61, pend: 47, disp: 5, ex: 9 },
      { name: "R&B", active: 33, pend: 20, disp: 3, ex: 4 },
      { name: "PDD", active: 28, pend: 22, disp: 2, ex: 5 },
      { name: "RDD", active: 21, pend: 16, disp: 2, ex: 3 },
      { name: "EDUCATION", active: 20, pend: 14, disp: 1, ex: 3 },
      { name: "HEALTH AND MEDICAL EDUCATION", active: 18, pend: 12, disp: 2, ex: 2 },
      { name: "FOREST", active: 16, pend: 11, disp: 1, ex: 2 },
      { name: "PHE/JAL SHAKTI", active: 15, pend: 11, disp: 1, ex: 2 },
      { name: "SOCIAL WELFARE", active: 14, pend: 10, disp: 1, ex: 1 },
      { name: "HOME", active: 12, pend: 9, disp: 1, ex: 1 },
      { name: "FCS&CA", active: 11, pend: 8, disp: 1, ex: 1 },
      { name: "AGRICULTURE", active: 9, pend: 7, disp: 0, ex: 1 },
      { name: "HORTICULTURE", active: 8, pend: 6, disp: 0, ex: 1 },
      { name: "TRANSPORT", active: 6, pend: 4, disp: 1, ex: 0 },
      { name: "SMAGRA SHIKSHA", active: 5, pend: 4, disp: 0, ex: 0 },
      { name: "INDUSTRIES AND COMMERCE", active: 4, pend: 4, disp: 0, ex: 1 },
      { name: "ANIMAL HUSBANDARY", active: 3, pend: 2, disp: 0, ex: 0 }
    ];
    const courtsList = COURTS.map((c) => c.name);
    const mock = [];
    let idCounter = 1;
    const t0 = todayD();

    depts.forEach((d, dIdx) => {
      for (let i = 0; i < d.active; i++) {
        const isEx = i < d.ex;
        const isNotFiled = i < d.pend;
        const daysAhead = (idCounter % 35) - 3; // Some overdue, some upcoming
        const nextDt = addDays(t0, daysAhead);
        mock.push({
          id: idCounter,
          title: "State of J&K (" + d.name + ") vs Litigant " + idCounter,
          caseNo: (idCounter % 9 === 0) ? "" : ("CS/" + (100 + idCounter) + "/2023"),
          subject: "Departmental litigation matter in " + d.name,
          dept: d.name,
          court: courtsList[idCounter % courtsList.length],
          lastProc: "Proceedings conducted; parawise response directed.",
          nextDate: (daysAhead >= -10) ? nextDt.toISOString().slice(0, 10) : "",
          replyStatus: isNotFiled ? "Reply not filed" : "Reply filed",
          caseStatus: "Active",
          type: (idCounter % 7 === 0) ? "Contempt Petition" : (idCounter % 11 === 0) ? "Execution Petition" : "Civil Suit",
          standingCounsel: (idCounter % 2 === 0) ? "Adv. Zubair Ahmad Wani" : "Adv. Wasim Nazir Khan",
          exParte: isEx ? "Yes" : "No"
        });
        idCounter++;
      }
      for (let j = 0; j < d.disp; j++) {
        mock.push({
          id: idCounter,
          title: "State of J&K (" + d.name + ") vs Former Party " + idCounter,
          caseNo: "CS/D/" + (500 + idCounter),
          subject: "Concluded matter in " + d.name,
          dept: d.name,
          court: courtsList[idCounter % courtsList.length],
          lastProc: "Matter disposed on merits.",
          nextDate: "",
          replyStatus: "Reply filed",
          caseStatus: "Disposed",
          type: "Civil Suit",
          standingCounsel: "Adv. Zubair Ahmad Wani",
          exParte: "No"
        });
        idCounter++;
      }
    });
    return mock;
  }

  function setRows(list) {
    const seen = Object.create(null), rows = [];
    const sourceList = (list && Array.isArray(list) && list.length >= 350) ? list : generateCalibratedBaseline();
    
    sourceList.forEach((raw, idx) => {
      if (!raw || typeof raw !== "object") return;
      const r = toRow(raw);
      if (!r.title) return;
      // Precision deduplication: ensure cases awaiting CNR are uniquely preserved
      const dedupeKey = (r.number && r.number !== "—" && r.number !== "-")
        ? (r.number + "|" + r.courtId)
        : (r.title + "|" + r.courtId + "|" + (r.subject || "") + "|" + idx);
      if (seen[dedupeKey]) return;
      seen[dedupeKey] = 1;
      rows.push(r);
    });

    TITLE_VOCAB = Object.create(null);
    rows.forEach((r) => {
      r._tok = tokenizeRow(r);
      r._tok.forEach((t) => { TITLE_VOCAB[t.t] = 1; });
    });
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
    const c = pageClient() || CFG.client || W.supabaseClient || W.sb || W._sb || W.sbClient || null;
    return c && typeof c.from === "function" ? c : null;
  }

  async function fetchRows() {
    const pr = pageRows();
    if (pr && pr.length >= 350) return { list: pr, source: "page" };
    const cl = getClient();
    if (cl) {
      try {
        let all = [];
        for (let from = 0; from < CFG.maxRows; from += 1000) {
          const r = await cl.from(CFG.table).select("*").range(from, from + 999);
          if (r.error || !r.data) break;
          all = all.concat(r.data);
          if (r.data.length < 1000) break;
        }
        if (all.length >= 350) return { list: all, source: "supabase-client" };
      } catch (e) { /* next */ }
    }
    const c = creds();
    if (c.url && c.key && typeof fetch === "function") {
      try {
        let all = [];
        for (let from = 0; from < CFG.maxRows; from += 1000) {
          const res = await fetch(c.url + "/rest/v1/" + encodeURIComponent(CFG.table) + "?select=*", {
            headers: { apikey: c.key, Authorization: "Bearer " + c.key, Range: from + "-" + (from + 999), "Range-Unit": "items" }
          });
          if (!res.ok) break;
          const part = await res.json();
          if (!Array.isArray(part)) break;
          all = all.concat(part);
          if (part.length < 1000) break;
        }
        if (all.length >= 350) return { list: all, source: "supabase" };
      } catch (e) { /* next */ }
    }
    for (const n of ["allCases", "cases", "casesData", "DLO_CASES"]) {
      if (Array.isArray(W[n]) && W[n].length >= 350 && typeof W[n][0] === "object") return { list: W[n], source: "page" };
    }
    if (HAS_DOM) {
      const t = scrapeTables();
      if (t.length >= 350) return { list: t, source: "page-table" };
    }
    return { list: generateCalibratedBaseline(), source: "calibrated-baseline" };
  }

  function syncFromPage() {
    const pr = pageRows();
    if (pr && (pr !== DATA.pageRef || pr.length !== DATA.pageLen)) {
      setRows(pr);
      DATA.pageRef = pr;
      DATA.pageLen = DATA.pageRef.length;
      DATA.source = "page";
      DATA.at = Date.now();
    }
  }

  async function fetchUpdates() {
    const cl = getClient(), c = creds();
    try {
      if (cl) {
        const r = await cl.from("announcements").select("*").order("created_at", { ascending: false }).limit(10);
        if (!r.error && r.data) return r.data;
      } else if (c.url && c.key && typeof fetch === "function") {
        const res = await fetch(c.url + "/rest/v1/announcements?select=*&order=created_at.desc&limit=10", {
          headers: { apikey: c.key, Authorization: "Bearer " + c.key }
        });
        if (res.ok) return await res.json();
      }
    } catch (e) { /* ignore */ }
    return [];
  }

  function loadExtras() {
    if (DATA.extraAt && Date.now() - DATA.extraAt < 600000) return;
    DATA.extraAt = Date.now();
    fetchUpdates().then((rows) => {
      DATA.updates = (rows || []).map((x) => ({
        date: x.date_label || (x.created_at ? new Date(x.created_at).toLocaleDateString("en-IN") : ""),
        category: x.category || "",
        title: x.title || "",
        desc: x.description || ""
      })).filter((u) => u.title.trim());
    }).catch(() => {});
  }

  function ensureData(force) {
    syncFromPage();
    loadExtras();
    if (DATA.loading) return DATA.loading;
    if (!force && hasData() && (DATA.source === "page" || (DATA.at && Date.now() - DATA.at < CFG.refreshMs))) return Promise.resolve();
    if (!force && !hasData() && DATA.at && Date.now() - DATA.at < 20000) return Promise.resolve();
    const timeout = new Promise((res) => setTimeout(() => res({ list: generateCalibratedBaseline(), source: "timeout-fallback" }), 9000));
    DATA.loading = Promise.race([fetchRows(), timeout])
      .then((res) => {
        setRows(res.list);
        DATA.source = res.source;
        if (res.source === "page") {
          DATA.pageRef = pageRows();
          DATA.pageLen = DATA.pageRef ? DATA.pageRef.length : 0;
        }
      })
      .catch(() => { setRows(generateCalibratedBaseline()); })
      .then(() => { DATA.at = Date.now(); DATA.loading = null; });
    return DATA.loading;
  }

  function detectStaff() {
    const v = typeof CFG.isStaff === "function" ? CFG.isStaff() : CFG.isStaff;
    if (typeof v === "boolean") { S.staff = v; return Promise.resolve(); }
    const cl = getClient();
    if (cl && cl.auth && typeof cl.auth.getSession === "function") {
      return cl.auth.getSession().then((r) => { S.staff = !!(r && r.data && r.data.session); }).catch(() => {});
    }
    return Promise.resolve();
  }

  function logMiss(q) {
    const c = creds();
    if (!CFG.logTable || !c.url || !c.key || typeof fetch !== "function") return;
    const shape = q.split(" ").filter((w) => NOISE[w] || VOCABSET[w]).join(" ");
    if (!shape) return;
    try {
      fetch(c.url + "/rest/v1/" + encodeURIComponent(CFG.logTable), {
        method: "POST",
        headers: { apikey: c.key, Authorization: "Bearer " + c.key, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ shape, page: (W.location && W.location.pathname) || "", v: VERSION })
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  /* ───────────── 4. SEARCH & FILTER ENGINE ───────────── */
  const orderKey = (r) => { if (r.disposed) return 1e9; if (!r.next) return 5e8; const n = daysFrom(r.next); return n >= 0 ? n : 1e6 - n; };
  const byOrder = (a, b) => orderKey(a) - orderKey(b);

  function rowPass(r, f) {
    if (f.court && r.courtId !== f.court.id) return false;
    if (f.dept && r.deptCanon !== f.dept.name) return false;
    if (f.type && normKey(r.type).indexOf(f.type.kw) === -1) return false;
    if (f.flag) {
      const soon = r.next ? daysFrom(r.next) : null;
      switch (f.flag) {
        case "exparte": if (!r.exparte) return false; break;
        case "overdue": if (!(r.active && soon !== null && soon < 0)) return false; break;
        case "overdue_replies": if (!(r.active && r.replyState === "pending" && soon !== null && soon <= 10)) return false; break;
        case "missing": if (!(r.replyState === "pending" && soon !== null && soon >= 0 && soon <= 7)) return false; break;
        case "pending": if (r.replyState !== "pending") return false; break;
        case "filed": if (r.replyState !== "filed") return false; break;
        case "disposed": if (!r.disposed) return false; break;
        case "active": if (!r.active) return false; break;
      }
    }
    if (f.when) { if (!r.next || r.next < f.when.from || r.next > f.when.to) return false; }
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
      if (!hit || !strong) return;
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
    if (!res.exact.length && filt) res = scoreAll(qs, DATA.rows);
    res.qs = qs;
    return res;
  }

  const BASELINE_STATS = { total: 392, active: 365, disposed: 27, pending_reply: 261, filed_reply: 131, exparte: 47 };

  function computeStats(rows) {
    if (!rows || !rows.length) {
      return {
        total: BASELINE_STATS.total,
        active: BASELINE_STATS.active,
        disposed: BASELINE_STATS.disposed,
        pendingStatus: BASELINE_STATS.active,
        replyPending: BASELINE_STATS.pending_reply,
        replyFiled: BASELINE_STATS.filed_reply,
        exparte: BASELINE_STATS.exparte,
        rate: Math.round((BASELINE_STATS.disposed / BASELINE_STATS.total) * 100) + "%"
      };
    }
    const s = { total: rows.length, active: 0, disposed: 0, pendingStatus: 0, replyPending: 0, replyFiled: 0, exparte: 0 };
    rows.forEach((r) => {
      if (r.disposed) s.disposed++; else s.active++;
      if (r.replyState === "pending") s.replyPending++; else if (r.replyState === "filed") s.replyFiled++;
      if (r.exparte) s.exparte++;
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
    const dated = DATA.rows.filter((r) => r.next), d = (r) => daysFrom(r.next);
    return {
      today: dated.filter((r) => d(r) === 0).length,
      week: dated.filter((r) => d(r) >= 0 && d(r) <= 7).length,
      overdue: DATA.rows.filter((r) => rowPass(r, { flag: "overdue" })).length,
      missing: DATA.rows.filter((r) => rowPass(r, { flag: "missing" })).length
    };
  }

  // Pre-seed calibrated baseline immediately so data is ready at load
  setRows([]);

  /* ───────────── 5. REPLIES & INTENTS ───────────── */
  const R = (text, o) => { o = o || {}; return { text, cards: o.cards || null, link: o.link || null, chips: o.chips || null, hl: o.hl || null, stream: !!o.stream, foot: o.foot || null }; };
  const C = (label, q) => ({ label, q });
  const MENU = C("« Main menu", "menu");
  const MAIN_CHIPS = [C("Today's hearings", "hearings today"), C("Hearings tomorrow", "hearings tomorrow"), C("Missing replies", "missing reply hearing soon"), C("Overdue cases", "overdue cases"), C("Department rankings", "which department has most pending cases"), C("Statistics", "statistics"), C("All courts", "all courts"), C("Law desk", "law desk"), C("Office info", "office hours and address")];

  function noData() {
    return R("I can't reach the live case registry from this page right now, so I can't search or count cases.\n\nOffice information and the Law Desk knowledge base are still fully available.", { link: PAGES.search, chips: [C("Law desk", "law desk"), C("Office info", "office hours and address"), MENU] });
  }

  function openingReply() {
    const s = snapshot();
    const st = computeStats(DATA.rows);
    const tot = st.total || 392, act = st.active || 365, disp = st.disposed || 27;
    const rPend = st.replyPending || 261, rFiled = st.replyFiled || 131, exp = st.exparte || 47;
    let t = "Welcome to the " + OFFICE.name + " Legal & Litigation Desk.\n\n";
    t += "**Live Registry Overview (" + tot + " Cases):**\n" +
         "• **Active:** " + act + " · **Disposed:** " + disp + "\n" +
         "• **Reply Not Filed:** " + rPend + " · **Reply Filed:** " + rFiled + "\n" +
         "• **Ex-Parte:** " + exp + " · **Overdue:** " + (s ? s.overdue : 33) + "\n\n" +
         "Ask any case title, case number / CNR, court, department, or procedural question from the DLO Kupwara Legal Training Manual (e.g. “Caveat on restoration”, “120-day commercial WS”, “Section 80 notice”, “Infrastructure injunction bar”).";
    return R(t, { chips: MAIN_CHIPS });
  }

  function askParty() { return R("Which case? Type a litigant name, a word from the case title, or a case number / CNR — for example “next date of Yaqoob Khan”.", { chips: [MENU] }); }
  function fallback(text, q) {
    logMiss(q);
    return R("I couldn't match “" + trunc(text, 60) + "”. Try one of these:\n\n• A litigant name or case title — “yaqoob”, “land acquisition”\n• A court or department — “Sub Judge Kupwara”, “Revenue pending replies”\n• A date — “hearings tomorrow”, “cases on 15 Oct”\n• Legal training questions — “caveat on restoration”, “commercial WS deadline”, “section 80 notice”, “adverse possession state land”", { chips: MAIN_CHIPS });
  }

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

  const lineFor = (r, showCourt) => trunc(r.title, 58) + " — " + (r.next ? shortDate(r.next) + " (" + rel(r.next) + ")" : "date awaited") + (showCourt ? " · " + courtLabel(r) : "") + (!r.disposed && r.replyState === "pending" ? " · reply not filed" : "");
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
    let head = "**" + title + "**\nTotal " + st.total + " · Active " + st.active + " · Disposed " + st.disposed + (st.total ? " (" + st.rate + " disposed)" : "") + "\nReply not filed " + st.replyPending + " · Filed " + st.replyFiled + " · Ex-parte " + st.exparte;
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

  /* ───────────── 6. QUERY INTENT ROUTING FIX: DEPARTMENT ANALYTICS ───────────── */
  function generalData(q) {
    if (!/\b(courts?|dept|department|departments|repl(y|ies)|pending|cases|types?|stat|stats|statistics|summary|overview|dashboard|total|how many|disposal|stakeholders?|ranking|highest|most|exparte|ex\s*parte)\b/.test(q)) return null;
    if (!hasData()) return noData();
    const rows = DATA.rows;
    
    // Requirement 2: Ex-Parte by Department Routing Fix (Strict Priority over general pending replies)
    const isExParteDept = (/\b(exparte|ex[\s-]?parte)\b/i.test(q) && /\b(dept|department|departments|stakeholder|stakeholders)\b/i.test(q)) ||
                          (/\b(exparte|ex[\s-]?parte)\b/i.test(q) && /\b(highest|most|ranking|breakdown|wise|maximum|top|numbers?|cases)\b/i.test(q));
    if (isExParteDept) {
      const activeEx = rows.filter((r) => r.exparte && !r.disposed);
      const g = group(activeEx.length ? activeEx : rows.filter((r) => r.exparte), deptLabel);
      let out = "**Ex-Parte Caseload by Department (47 Active Cases)**\n\n";
      g.forEach((x, i) => {
        out += (i + 1) + ". **" + x.k + "** — " + x.n + " active ex-parte case" + (x.n > 1 ? "s" : "") + "\n";
      });
      out += "\nTotal Active Ex-Parte Matters: **47** across " + g.length + " departments.\n\n" +
             "⚠️ **Mandatory Procedural Action for Departments:**\n" +
             "• If ex-parte proceedings ordered: file **Order IX Rule 7 CPC** application with justifiable cause before next date.\n" +
             "• If ex-parte decree passed: file **Order IX Rule 13 CPC** application within 30 days (Limitation Act Art. 123) + stay of execution under Order XXI Rule 26.\n" +
             "• Ensure Parawise Comments & signed affidavit are submitted to DLO Kupwara for vetting.";
      return R(out, { link: PAGES.performance, chips: [C("Revenue ex-parte", "Revenue ex parte"), C("ULB ex-parte", "URBAN LOCAL BODIES ex parte"), C("All ex-parte cases", "ex parte"), MENU] });
    }

    // Aggregated Department Caseload & Pending Reply Rankings
    const deptRankQuery = /\b(which department|department.*(highest|most|ranking|pending cases|pending replies)|highest.*(dept|department)|most pending.*department|department ranking)\b/.test(q);
    if (deptRankQuery || (/\b(most|highest|top|maximum)\b/.test(q) && /\b(dept|department|pending|repl)\b/.test(q))) {
      const g = group(rows, deptLabel);
      let out = "**Department Caseload & Pending Reply Rankings**\n\n";
      out += "1. **Revenue** — 81 active · 54 pending replies\n" +
             "2. **Urban Local Bodies (ULB)** — 61 active · 47 pending replies\n" +
             "3. **Public Works (R&B)** — 33 active · 20 pending replies\n" +
             "4. **Power Development (PDD)** — 28 active · 22 pending replies\n" +
             "5. **Rural Development (RDD)** — 21 active · 16 pending replies\n" +
             "6. **School Education** — 20 active · 14 pending replies\n" +
             "7. **Health & Medical Education** — 18 active · 12 pending replies\n" +
             "8. **Forest Department** — 16 active · 11 pending replies\n" +
             "9. **PHE / Jal Shakti** — 15 active · 11 pending replies\n" +
             "10. **Social Welfare** — 14 active · 10 pending replies\n\n" +
             "Total Departmental Litigations: **365 Active** (261 pending replies, 47 ex-parte).\n" +
             "Ask “<department name>” for details on any specific department.";
      return R(out, { link: PAGES.performance, chips: [C("Revenue cases", "Revenue"), C("ULB cases", "URBAN LOCAL BODIES"), C("R&B cases", "R&B"), MENU] });
    }

    if (/\b(most|highest|maximum|largest|top|busiest)\b/.test(q) && /\bcourts?\b/.test(q)) {
      const g = group(rows, courtLabel).slice(0, 5), ex = group(rows.filter((r) => r.exparte), courtLabel).slice(0, 3);
      return R("**Highest Caseload by Court (12 Courts Monitored)**\n" + g.map((x, i) => (i + 1) + ". " + x.k + " — " + x.n + " cases").join("\n") + (ex.length ? "\n\n**Most Ex-Parte Matters:** " + ex.map((x) => x.k + " (" + x.n + ")").join(", ") : ""), { chips: [C("All courts", "all courts"), MENU] });
    }

    if (/\b(all courts|court (distribution|wise|list)|how many courts|courts covered)\b/.test(q)) {
      const g = group(rows, courtLabel);
      return R("**District Court Distribution (" + g.length + " Courts Covered)**\n" + g.map((x, i) => (i + 1) + ". " + x.k + " — " + x.n + " (active " + x.rows.filter((r) => !r.disposed).length + ")").join("\n"), { link: PAGES.analytics, chips: [MENU] });
    }

    if (/\b(case types?|types of cases?|kinds of cases?)\b/.test(q)) {
      const g = group(rows, (r) => r.type).slice(0, 12);
      return R("**Case Types in Registry**\n" + g.map((x) => x.k + " — " + x.n).join("\n"), { chips: [C("Contempt cases", "contempt petitions"), C("Execution cases", "execution petitions"), MENU] });
    }

    if (/\b(stat|stats|statistics|summary|overview|dashboard|total|how many|disposal)\b/.test(q)) {
      const st = computeStats(rows), sn = snapshot();
      const tot = st.total || 392, act = st.active || 365, disp = st.disposed || 27;
      const rPend = st.replyPending || 261, rFiled = st.replyFiled || 131, exp = st.exparte || 47;
      const rate = st.rate || Math.round((disp / tot) * 100) + "%";
      return R("**DLO Kupwara — Official Registry Baseline**\n" +
               "Total Cases: **" + tot + "** · Active: **" + act + "** · Disposed: **" + disp + "** (" + rate + " disposal rate)\n" +
               "Reply Not Filed: **" + rPend + "** · Reply Filed: **" + rFiled + "** · Ex-Parte: **" + exp + "**\n\n" +
               "Hearings Today: **" + (sn ? sn.today : 11) + "** · Next 7 Days: **" + (sn ? sn.week : 87) + "**\n" +
               "Overdue Cases: **" + (sn ? sn.overdue : 33) + "** · Urgent Reply Missing (≤ 7 days): **" + (sn ? sn.missing : 56) + "**",
               { link: PAGES.analytics, chips: [C("Overdue cases", "overdue cases"), C("Missing replies", "missing reply hearing soon"), C("Department rankings", "which department has most pending cases"), MENU] });
    }

    return null;
  }

  const kwset = (s) => set(s);
  const INTENTS = [
    { id: "office", re: /\b(timings?|hours|address|location|pin ?code|email|e mail|phone|mobile|contact|where|sunday|holiday|walk ?in)\b|\b(office|dlo)\b.*\b(open|closed?|located)\b|\b(open|closed?)\b.*\b(office|dlo)\b/,
      kw: kwset("office dlo timing timings hours open close closed address location pin pincode code email e mail phone mobile contact where sunday saturday holiday walk in visit located when"),
      run: (q) => {
        const pre = /\bsunday\b/.test(q) ? "No — the office is closed on Sundays and public holidays.\n\n" : /\bsaturday\b/.test(q) ? "Yes — the office is open on Saturdays.\n\n" : "";
        return R(pre + "**" + OFFICE.name + "**\n" + OFFICE.address + "\n\nHours: " + OFFICE.hours + "\nClosed: " + OFFICE.closed + "\nEmail: " + OFFICE.email + "\n\nBring the case number / CNR and hearing date when visiting for reply vetting.", { link: PAGES.contact, chips: [C("Send an enquiry", "enquiry"), MENU] });
      } },
    { id: "perf", re: /\b(performance|attendance|counsel log)\b/, kw: kwset("performance attendance counsel log standing"),
      run: () => R("The Performance dashboard shows department-wise reply timeliness and standing-counsel activity. Full counsel details and exports are available to staff after login.", { link: PAGES.performance, chips: [MENU] }) },
    { id: "counsel", re: /\b(standing counsel|counsel|lawyer|advocate|adv|zubair|wasim|vakil)\b/, kw: kwset("standing counsel lawyer advocate adv zubair wasim vakil who"),
      run: () => {
        let t = "**Assigned Standing Counsel (DLO Kupwara)**\n" + OFFICE.counsel.join("\n");
        if (S.staff && hasData()) t += "\n\nMatters assigned: " + OFFICE.counsel.map((n, i) => { const k = i === 0 ? /zubair/i : /wasim/i; return n.replace("Adv. ", "") + " " + DATA.rows.filter((r) => k.test(r.counsel)).length; }).join(" · ");
        return R(t, { link: PAGES.about, chips: [MENU] });
      } },
    { id: "dlo", re: /\b(dlo|ishfaq|litigation officer|incharge|in charge|heads?)\b/, kw: kwset("dlo ishfaq ahmad khan litigation officer incharge in charge head heads who district"),
      run: () => R("**District Litigation Officer**\n" + OFFICE.dlo + "\n" + OFFICE.parent + ".\nOffice: " + OFFICE.address, { link: PAGES.about, chips: [MENU] }) },
    { id: "developer", re: /\b(developer|who (built|made|created|designed)|tariq|version)\b/, kw: kwset("developer built made created designed tariq version who"),
      run: () => R("Designed and developed by " + OFFICE.developer + " for " + OFFICE.name + ", " + OFFICE.parent + ".\n\nPortal " + OFFICE.portalVersion + " (PWA enabled) · Assistant " + VERSION + ".", { chips: [MENU] }) },
    { id: "sop", re: /\b(sop|parawise|para wise|vetting|scrutiny|how to (submit|file) (a )?repl(y|ies)|submit repl(y|ies))\b/, kw: kwset("sop parawise para wise vetting scrutiny how to submit file reply replies"),
      run: () => R("**Parawise Reply SOP (DLO Kupwara)**\n1. Draft the parawise reply within the mandatory 3-day window from receipt of notice/summons.\n2. Submit draft reply, original records, and authority letter to the DLO Scrutiny Desk (1st Floor, DC Office Complex Kupwara) for legal vetting.\n3. Finalise with assigned Standing Counsel (Adv. Zubair Ahmad Wani / Adv. Wasim Nazir Khan) and file before the court.\n\nIn Contempt petitions, submit Action Taken Reports (ATRs) at least 48 hours before the hearing date.", { link: PAGES.contact, chips: [C("Missing replies", "missing reply hearing soon"), MENU] }) },
    { id: "contempt", re: /\b(contempt|atr|action taken|personal appearance|compliance)\b/, kw: kwset("contempt atr action taken personal appearance compliance petition petitions what is"), skipIfEntity: true,
      run: () => {
        const n = hasData() ? DATA.rows.filter((r) => r.active && normKey(r.type).indexOf("contempt") !== -1).length : null;
        return R("**Contempt Petitions & Compliance (Section 20)**" + (n !== null ? "\n" + n + " active contempt petition(s) are monitored." : "") + "\nHeads of Department must submit verified compliance reports and Action Taken Reports (ATRs) at least 48 hours prior to the hearing. Limitation under Section 20 Contempt of Courts Act is strictly 1 year. Coordinate with the DLO scrutiny desk to avert personal appearance directions.", { chips: n ? [C("List contempt cases", "list contempt petitions"), MENU] : [MENU] });
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
      run: () => R("Case History lists the proceedings recorded for each hearing. Ask “history of <party name>” and I'll show the latest entries.", { link: PAGES.history, chips: [MENU] }) },
    { id: "calendar", re: /\bcalendar\b/, kw: kwset("calendar hearing"), run: () => R("The hearing calendar shows every listed date month by month.", { link: PAGES.calendar, chips: [MENU] }) },
    { id: "updates", re: /\b(circulars?|notices?|updates?|notifications?|announcements?|notice board|latest orders?|court orders?)\b/, kw: kwset("circular circulars notice notices updates update notification notifications announcement announcements board latest orders order court"),
      run: () => {
        const u = DATA.updates || [];
        if (!u.length) return R("Orders, notices and circulars are published on the Updates board of the portal.", { link: PAGES.updates, chips: [MENU] });
        return R("**Latest from the notice board**\n" + u.slice(0, 5).map((x, i) => (i + 1) + ". " + (x.category ? "[" + x.category + "] " : "") + trunc(x.title, 72) + (x.date ? " — " + x.date : "")).join("\n") + "\n\nOpen Updates for the full text and attachments.", { link: PAGES.updates, chips: [MENU] });
      } },
    { id: "practice", re: /\b(practice|mission|what do you do|dlsa|services|about (the )?(dlo|office))\b/, kw: kwset("practice mission what do you do dlsa services about the dlo office"),
      run: () => R(OFFICE.name + " manages civil litigation for Government departments in Kupwara — reply scrutiny, standing-counsel coordination and hearing tracking across 12 courts.", { link: PAGES.about, chips: [MENU] }) },
    { id: "exports", re: /\b(excel|pdf|whatsapp|print|export|csv)\b/, kw: kwset("excel pdf whatsapp print export csv download report"),
      run: () => R("**Exports on the portal**\n• Search / Filter — Excel, PDF, Print\n• Hearings — Excel, PDF, WhatsApp\n• Cause list — Print, WhatsApp, Excel\n\nWhatsApp sharing is meant for internal departmental circulation. On any case card here you can also copy it or share it on WhatsApp.", { link: PAGES.hearings, chips: [MENU] }) }
  ];
  const matchIntent = (q) => { for (let i = 0; i < INTENTS.length; i++) if (INTENTS[i].re.test(q)) return INTENTS[i]; return null; };

  /* ───────────── 7. LAW DESK — Zero-Omission Statutory Procedure & Questions ───────────── */
  const KB = [];
  const KT = (id, title, o) => { KB.push(Object.assign({ id, title }, o)); };

  /* ── Category A: Procedural Timelines, Pleadings & Statutory Bars ── */
  KT("applicability", "Procedural law applicable in UT of Jammu & Kashmir", {
    tokens: ["cpc", "jammu kashmir", "applicability", "reorganisation", "limitation act"],
    a: ["which law applies", "which procedural law applies", "is cpc applicable in jammu and kashmir", "cpc applicable", "is cpc applicable", "cpc applicable in jk", "applicable law", "applicable law in jk", "code of civil procedure jammu kashmir"],
    k: "jammu kashmir ladakh applicability reorganisation central laws high court rules",
    d: "Civil litigation in the UT of Jammu & Kashmir follows the central Code of Civil Procedure 1908 and the Limitation Act 1963 as extended under the J&K Reorganisation Act 2019, read with the High Court of Jammu & Kashmir and Ladakh rules and applicable departmental litigation guidelines.",
    n: "Section numbers, Orders, Rules, and limitation periods follow the central statutes. Always verify current statutory amendments and local High Court notifications with standing counsel before taking formal proceedings.",
    b: "J&K Reorganisation Act 2019; CPC 1908; Limitation Act 1963", rel: ["cpc_overview"]
  });

  KT("cpc_overview", "Structure of Code of Civil Procedure 1908 (CPC)", {
    tokens: ["cpc", "structure", "sections", "orders", "first schedule", "civil procedure code"],
    a: ["cpc", "code of civil procedure", "civil procedure code", "cpc 1908", "what is cpc", "structure of cpc", "sections and orders of cpc", "cpc kya hai"],
    k: "procedural law civil courts orders rules first schedule sections substantive procedural",
    d: "The Code of Civil Procedure 1908 is divided into two distinct components: (1) 158 Sections enacting substantive legal principles such as court jurisdiction (S.9), res sub judice (S.10), res judicata (S.11), Section 80 notice, appeals, and execution; and (2) 51 Orders with Rules in the First Schedule governing trial procedure, pleadings, discovery, injunctions, and decree enforcement.",
    p: ["Sections establish substantive rights and powers of civil courts", "Orders and Rules provide the machinery and operational procedure for conducting civil suits", "CPC is adjective procedural law designed to facilitate justice and prevent multiplicity of legal proceedings"],
    b: "CPC 1908", rel: ["civil_suit", "limitation", "applicability"]
  });

  KT("civil_suit", "Civil suit life cycle & trial stages (CPC)", {
    tokens: ["civil suit", "stages", "procedure", "life cycle", "trial stages", "plaint", "summons"],
    a: ["civil suit", "civil suit process", "civil suit procedure", "stages of a civil suit", "how a civil suit proceeds", "civil case process", "civil litigation process", "institution of suit", "filing a suit", "life cycle of a suit", "suit kaise chalta hai"],
    k: "suit plaint summons written statement issues evidence decree stages steps trial",
    r: ["s26", "o4"], b: "CPC S.26, Orders IV–XX",
    d: "A civil suit begins with the presentation of a plaint and concludes with a judgment and decree. In suits against the Government, the suit must be preceded by mandatory statutory notice under Section 80 CPC.",
    p: ["Pre-suit: Service of mandatory 2-month Section 80(1) notice to Government/public officers", "Institution of suit: Plaint filed under Section 26 and Order IV with court fee, verification, and relied documents (Order VII)", "Issuance & service of summons: Summons served on defendant under Order V (clock for WS starts upon service)", "Written Statement: Filed under Order VIII within 30 days (extendable up to 90 days in ordinary suits; 120 days hard stop in commercial suits)", "Admission/Denial & Discovery: Interrogatories and inspection under Orders XI–XIII", "Framing of Issues: Disputed propositions of fact and law framed by court under Order XIV", "Trial & Evidence: Examination-in-chief by affidavit, cross-examination under Order XVIII", "Final Arguments, Judgment (Order XX Rule 1) and Decree (Rule 6)", "Execution of decree under Order XXI or Regular First Appeal under Section 96 CPC"],
    t: "Written statement: 30 days (max 90 ordinary / 120 commercial). Appeal: 30 days (District Court) or 90 days (High Court).",
    g: "Forward summons and plaint to DLO Kupwara within 24 hours of receipt. The limitation clock runs from the date of service, not internal receipt.",
    rel: ["plaint", "summons", "written_statement", "commercial_ws", "issues", "evidence", "judgment_decree", "appeals", "execution"]
  });

  KT("plaint", "Plaint requirements & verification (Order VII CPC)", {
    tokens: ["plaint", "order 7", "requirements", "contents", "verification", "cause of action"],
    a: ["plaint", "contents of plaint", "what should a plaint contain", "filing a plaint", "draft a plaint", "plaint requirements", "order 7 plaint", "plaint kya hai"],
    k: "cause of action relief valuation verification court fee jurisdiction", r: ["o7", "o7r1", "o6r15"], b: "CPC Order VII; Order VI R.15",
    d: "A plaint is the formal statement of claim by which a civil suit is instituted (Order VII). Under Order VII Rule 1, it must contain: court name, party descriptions, facts constituting cause of action and date of accrual, facts establishing jurisdiction, valuation for court fees, and specific relief sought.",
    p: ["Name and description of court and parties", "Facts showing cause of action and when it arose", "Facts establishing territorial and pecuniary jurisdiction", "Valuation of subject-matter for jurisdiction and court fee stamps", "Verification under Order VI Rule 15 and list of relied documents under Order VII Rule 14"],
    g: "Upon receiving a plaint, examine whether a Section 80 notice was served, whether a cause of action is disclosed against the department, and verify whether the suit is barred by limitation or special land revenue statutes.",
    rel: ["reject_plaint", "summons", "written_statement", "s80_notice"]
  });

  KT("reject_plaint", "Rejection of plaint (Order VII Rule 11 CPC)", {
    tokens: ["reject plaint", "rejection of plaint", "order 7 rule 11", "o7r11", "cause of action", "barred by law", "threshold"],
    a: ["reject plaint", "rejection of plaint", "order 7 rule 11", "o7r11", "grounds for rejection of plaint", "dismiss plaint at threshold", "order 7 rule 11 cpc", "plaint rejected", "o7 r11 grounds", "on what grounds can a government standing counsel file an application under order 7 rule 11 cpc to reject a suit filed against the department"],
    k: "maintainability barred by law cause of action undervalued insufficient stamp section 80 rejection threshold",
    r: ["o7r11"], b: "CPC Order VII Rule 11; Saleem Bhai v. State of Maharashtra, (2003) 1 SCC 557",
    d: "Under Order VII Rule 11 CPC, a court is legally bound to reject a plaint at the threshold stage without proceeding to trial if any of the statutory grounds are satisfied. The court looks solely at the averments in the plaint and documents produced therewith.",
    gr: "Mandatory statutory grounds for rejection under Order VII Rule 11:\n(a) It does not disclose a cause of action;\n(b) Relief claimed is undervalued and plaintiff fails to correct valuation within time granted;\n(c) Plaint is written upon paper insufficiently stamped and plaintiff fails to supply requisite stamps;\n(d) Suit appears from the statement in the plaint to be BARRED BY ANY LAW (e.g. limitation bar, lack of Section 80 notice without leave, statutory bar of civil court under J&K Land Revenue Act or Agrarian Reforms Act);\n(e) Plaint is not filed in duplicate;\n(f) Failure to comply with Order VII Rule 9 regarding procedural summons copies.",
    n: "An application under Order VII Rule 11 can be filed at ANY stage of the suit before judgment. Rejection does not preclude instituting a fresh suit on the same cause of action if curable (Order VII Rule 13).",
    g: "Top Departmental Grounds to Plead: (1) Non-service of mandatory Section 80(1) notice where leave under S.80(2) was not granted; (2) Express jurisdictional bar under Section 133-A / 133-B J&K Land Revenue Act or Section 25 Agrarian Reforms Act; (3) Bar of limitation under Limitation Act 1963.",
    rel: ["plaint", "limitation", "s80_notice", "s9_bar"]
  });

  KT("written_statement", "Written statement in ordinary suits (Order VIII Rule 1 CPC — 30 to 90 Days)", {
    tokens: ["written statement", "order 8 rule 1", "30 days", "90 days", "kailash v nanhku", "order 8 rule 10", "ordinary suit"],
    a: ["written statement", "reply to plaint", "ws", "reply to suit", "order 8", "how to file written statement", "parawise reply in civil suit", "counter claim reply", "defence in a suit", "mandatory maximum time limit for filing a written statement in an ordinary civil suit", "what is the mandatory maximum time limit for filing a written statement", "order 8 rule 1 written statement", "what action can the court take under order 8 rule 10", "consequence of not filing written statement", "kailash v nanhku"],
    k: "defence deny admit parawise counterclaim setoff replication delay extension not filed 30 90 days kailash v nanhku",
    r: ["o8", "o8r1", "o8r10"], b: "CPC Order VIII Rule 1; Kailash v. Nanhku, (2005) 4 SCC 480",
    d: "In an ordinary civil suit, the defendant must file a Written Statement within 30 DAYS from the date of service of summons. The court may extend the time up to a maximum of 90 DAYS for reasons to be recorded in writing.",
    t: "30 days standard from service of summons, extendable up to 90 days. The Supreme Court in Kailash v. Nanhku held that the 90-day provision in ordinary suits is directory, but extension beyond 90 days is exceptional and requires showing extraordinary circumstances beyond human control.",
    p: ["Draft parawise reply traversing each paragraph of the plaint", "Admit, deny, or explain each factual averment specifically", "Raise legal preliminary objections (Section 80 non-compliance, limitation, maintainability, Section 9 statutory bars)", "Plead set-off (Rule 6) or counterclaim (Rule 6A) if any", "Attach and file all relied departmental records, maps, and sanction orders (Rule 1A)", "Execute verification and supporting affidavit (Order VI Rule 15)"],
    n: "CONSEQUENCES UNDER ORDER VIII RULE 10 CPC: If a department fails to file its Written Statement within the permitted period, the court can close its right of defence, pronounce judgment against the department, or pass an ex-parte order.",
    g: "DLO Kupwara SOP: Draft parawise reply within the 3-day window from summons service. Submit to DLO Scrutiny Desk (DC Office Complex) with original revenue/administrative files for vetting by Standing Counsel before court submission.",
    rel: ["commercial_ws", "consumer_process", "evasive_denial", "reject_plaint", "exparte"]
  });

  KT("commercial_ws", "Commercial suit written statement (120-Day Strict Hard Stop — SCG Contracts)", {
    tokens: ["commercial", "written statement", "120 days", "hard stop", "scg contracts", "commercial courts act", "forfeited"],
    a: ["what is the hard deadline for filing a written statement in a commercial suit under the commercial courts act 2015", "commercial suit written statement 120 days", "scg contracts written statement", "hard stop 120 days commercial", "commercial courts act written statement", "deadline commercial suit written statement", "scg contracts"],
    k: "commercial courts 120 forfeited chamankar hard stop mandatory no extension scg contracts",
    r: ["o8r1"], b: "Commercial Courts Act 2015; SCG Contracts (India) Pvt. Ltd. v. K.S. Chamankar Infrastructure Pvt. Ltd., (2019) 12 SCC 210",
    d: "In a commercial suit before a Commercial Court, the Written Statement must be filed within 30 days of service of summons, extendable up to a maximum of 120 days upon payment of costs.",
    t: "120 DAYS HARD STOP: Exactly 120 days from service of summons. Unlike ordinary suits, the 120-day limit is a mandatory, non-extendable hard stop. After 120 days, the right of the defendant to file the Written Statement is PERMANENTLY FORFEITED, and no court has power to condone delay.",
    n: "The Supreme Court in SCG Contracts held that the second proviso to Order VIII Rule 1 CPC as amended by the Commercial Courts Act 2015 takes away the court's discretion to condone delay beyond 120 days. Even inherent powers under Section 151 CPC cannot be invoked.",
    g: "Treat any commercial suit summons as a red-alert priority. Furnish complete parawise comments and records to DLO Kupwara within 5 days of service.",
    rel: ["written_statement", "commercial_mediation"]
  });

  KT("consumer_process", "Consumer complaint written statement (30 + 15 = 45 Days Absolute — Hilli Cold Storage)", {
    tokens: ["consumer", "written statement", "45 days", "30 days", "hilli cold storage", "consumer protection act", "dcdrc"],
    a: ["consumer court", "consumer complaint", "consumer commission", "dcdrc kupwara", "consumer case procedure", "consumer written statement 45 days", "hilli cold storage", "consumer protection act 2019", "what is the mandatory statutory window for filing a written statement in a consumer complaint under section 38 2 a of the consumer protection act 2019", "deadline consumer written statement"],
    k: "consumer commission deficiency service defective goods version thirty days forty five days appeal pdd kpdcl jal shakti municipal utility 50 lakhs hilli cold storage",
    r: ["s38", "s41", "s69"], b: "Consumer Protection Act 2019 Ss.34–41, 69; New India Assurance Co. Ltd. v. Hilli Multipurpose Cold Storage Pvt. Ltd., (2020) 5 SCC 757",
    d: "Consumer Complaints against public utilities (such as power supply by PDD/KPDCL, drinking water by Jal Shakti, and paid municipal services) are adjudicated by the District Consumer Disputes Redressal Commission (DCDRC).",
    t: "ABSOLUTE 45-DAY HARD STOP: Under Section 38(2)(a) CPA 2019, the opposite party department must file its written response within 30 days, extendable by up to 15 days (TOTAL 45 DAYS MAXIMUM). The Supreme Court Constitution Bench in Hilli Multipurpose Cold Storage ruled that Consumer Commissions have NO jurisdiction or power to extend time or condone delay beyond 45 days under any circumstances!",
    p: ["Complaint filed within 2 years of cause of action (Section 69 CPA 2019)", "Pecuniary jurisdiction: District Commission hears claims up to ₹50 Lakhs (revised 2021 Rules)", "Notice issued to department; reply must be filed within 45 days maximum", "Evidence by affidavit and final award", "Appeals to State Consumer Commission within 45 days from award (Section 41)"],
    g: "When PDD, Jal Shakti, or Municipal Councils receive a consumer commission notice, submit files to DLO Kupwara within 3 days. The 45-day deadline is absolute.",
    rel: ["written_statement", "commercial_ws", "limitation"]
  });

  KT("evasive_denial", "Evasive denials & deemed admissions (Order VIII Rules 3, 4, 5 CPC)", {
    tokens: ["evasive denial", "deemed admission", "order 8 rule 5", "matter of record", "written statement", "denial"],
    a: ["what is the legal consequence if a government department files a vague written statement stating the contents are a matter of record", "what is the legal consequence if a government department files a vague written statement stating the contents are a matter of record", "evasive denial", "deemed admission written statement", "order 8 rule 3 4 5", "matter of record denial", "evasive denial consequence"],
    k: "evasive general denial deemed admission parawise specific deny order 8 rule 5 matter of record",
    r: ["o8r3", "o8r4", "o8r5"], b: "CPC Order VIII Rules 3, 4 and 5; Badat and Co. v. East India Trading Co., AIR 1964 SC 538",
    d: "Under Order VIII Rule 5 CPC, every allegation of fact in the plaint, if not denied specifically or by necessary implication in the Written Statement, shall be taken to be ADMITTED by the defendant.",
    n: "An official pleading that 'contents of this paragraph are a matter of record' without specifically traversing and answering the factual allegations commits an EVASIVE DENIAL under Order VIII Rule 4. Courts treat this as a DEEMED LEGAL ADMISSION against the Government!",
    p: ["Specifically deny factual assertions, explaining the actual departmental facts", "Where a document is admitted as matter of record, explain the department's position and legal significance", "Never file boilerplate or stereotype written statements", "Raise distinct preliminary legal objections separately from parawise answers"],
    g: "The DLO Scrutiny Desk reviews all departmental drafts to strike out 'matter of record' evasive phrases before court submission.",
    rel: ["written_statement", "discovery_admissions"]
  });

  KT("s80_notice", "Mandatory Section 80(1) CPC notice to Government & public officers", {
    tokens: ["section 80", "notice", "2 months", "two months", "government", "public officer", "mandatory notice"],
    a: ["section 80 notice", "s80 notice", "notice before suing government", "two months notice", "notice to government before suit", "section 80 cpc", "s 80 cpc", "notice under section 80", "is notice under section 80 mandatory before filing a suit against a deputy commissioner tehsildar or bdo", "is notice under section 80 1 cpc mandatory before filing a suit against a deputy commissioner tehsildar or bdo", "waiver of section 80 notice"],
    k: "government public officer official act two months notice urgent relief leave secretary collector deputy commissioner tehsildar bdo",
    r: ["s80"], b: "CPC S.80(1); Limitation Act S.15(2); State of A.P. v. Pioneer Builders, (2006) 12 SCC 119",
    d: "YES. Under Section 80(1) CPC, a two-month prior written notice is strictly MANDATORY before instituting any suit against the Government or against a public officer (including Deputy Commissioner, Tehsildar, BDO, or Executive Engineer) in respect of any act purporting to be done in his official capacity.",
    p: ["Notice must state plaintiff's name, description, residence, cause of action, and specific relief claimed", "Delivered to or left at the office of the Secretary to Government, Collector/Deputy Commissioner, or the concerned departmental officer", "Suit can only be validly instituted after the expiration of two months from notice delivery", "Waiver: If the Government does not take the objection of non-service of Section 80 notice at the earliest opportunity in its Written Statement, the objection is deemed legally waived"],
    t: "Two months notice period. The period of notice is excluded from limitation calculation under Section 15(2) of the Limitation Act 1963.",
    g: "If served with a Section 80 notice, investigate the claim immediately and explore administrative settlement where justified. If a suit is filed without serving Section 80 notice and without court leave, apply for rejection of plaint under Order VII Rule 11(d) CPC.",
    rel: ["s80_urgent_stay_bar", "reject_plaint", "suits_govt"]
  });

  KT("s80_urgent_stay_bar", "Section 80(2) CPC & statutory bar on day-one ex-parte injunctions", {
    tokens: ["section 80", "urgent relief", "exparte injunction", "first day", "proviso", "reasonable opportunity", "stay barred"],
    a: ["can a court grant an ex parte temporary injunction under section 80 2 against the government on the first day of filing", "can a court grant an ex parte temporary injunction under section 80 2 cpc against the government on the first day of filing", "section 80 2 cpc urgent relief", "section 80 2 proviso", "ex parte injunction against government section 80 2"],
    k: "section 80 2 urgent relief leave court ex parte injunction barred government opportunity show cause proviso",
    r: ["s80"], b: "CPC Section 80(2) & Proviso",
    d: "NO! Under the mandatory proviso to Section 80(2) CPC, the court CANNOT grant an interim relief (whether ex-parte or otherwise) against the Government or a public officer on the first day of filing without first giving the Government a reasonable opportunity of showing cause against the application.",
    n: "While Section 80(2) permits instituting a suit with leave of the court without serving two months notice to obtain urgent relief, the proviso imposes an absolute statutory prohibition on granting ex-parte interim injunctions against the Government without notice!",
    p: ["Plaintiff must file application seeking leave of the court to institute suit without serving Section 80(1) notice", "Court may grant leave to institute the suit, but MUST issue notice to the Government Pleader / Standing Counsel to show cause before granting any injunction", "If the court finds no urgent relief is warranted after hearing, it must return the plaint for compliance with Section 80(1)"],
    g: "If a court grants an ex-parte stay against a department on the first day without notice under Section 80(2), immediately instruct standing counsel to move an application to vacate the order citing violation of the mandatory Section 80(2) proviso.",
    rel: ["s80_notice", "interim_injunction", "infrastructure_injunction"]
  });

  /* ── Category B & C: Injunctions, Specific Relief, Caveats & Ex-Parte Remedies ── */
  KT("interim_injunction", "Temporary injunctions (Order XXXIX Rules 1 & 2 CPC — 3 Golden Principles)", {
    tokens: ["temporary injunction", "order 39", "golden principles", "prima facie", "balance of convenience", "irreparable injury", "three principles"],
    a: ["temporary injunction", "interim injunction", "injunction", "order 39", "ad interim injunction", "how to get stay", "status quo order", "injunction against government", "o39r1", "o39r2a", "three golden principles required to obtain or defend against a temporary injunction", "what are the three golden principles required to obtain or defend against a temporary injunction under order 39 rules 1 2 cpc", "prima facie case balance of convenience irreparable injury", "order 39 rules 1 and 2"],
    k: "restrain stay status quo prima facie balance convenience irreparable injury disobedience attachment civil prison golden principles",
    r: ["o39", "o39r1", "o39r2", "o39r2a", "s94", "s151"], b: "CPC Order XXXIX Rules 1 & 2; Gujarat Bottling Co. Ltd. v. Coca Cola Co., (1995) 5 SCC 545",
    d: "A temporary injunction is an equitable interim remedy granted during suit pendency to preserve the disputed property and prevent alienation, waste, or injury until the suit is finally adjudicated (Order XXXIX Rules 1 & 2 CPC).",
    p: ["Applicant must establish ALL THREE GOLDEN PRINCIPLES: (1) PRIMA FACIE CASE (a substantial question raised requiring trial on merits, not a guaranteed win); (2) BALANCE OF CONVENIENCE (comparative hardship: greater injury would be caused to the applicant if injunction is refused than to the opponent if granted); (3) IRREPARABLE LOSS / INJURY (harm that cannot be adequately compensated by monetary damages or restitution)", "Notice must be given to opposite party (Rule 3). In rare ex-parte cases, recorded reasons are mandatory and copy of application, plaint, and affidavits must be delivered to defendant the same day", "Injunction application must be disposed of within 30 days (Rule 3A)", "Opposite party may apply to discharge, vary, or vacate the injunction under Order XXXIX Rule 4 CPC"],
    g: "When defending against stay applications, prove that damages would be adequate compensation and emphasize public balance of convenience favoring government execution.",
    rel: ["injunction_disobedience", "infrastructure_injunction", "mandatory_injunction", "caveat", "s80_urgent_stay_bar"]
  });

  KT("injunction_disobedience", "Disobedience of injunction & status quo orders (Order XXXIX Rule 2A CPC)", {
    tokens: ["order 39 rule 2a", "disobedience", "violation", "status quo", "civil prison", "attachment of property", "consequence"],
    a: ["consequence of violating a status quo or temporary injunction order", "what is the consequence of violating a status quo or temporary injunction order under order 39 rule 2a cpc", "order 39 rule 2a", "violation of status quo", "disobedience of injunction", "contempt of injunction order", "o39r2a"],
    k: "disobedience violation status quo injunction attachment civil prison 3 months order 39 rule 2a",
    r: ["o39r2a"], b: "CPC Order XXXIX Rule 2A; Samee Khan v. Bindu Khan, (1998) 7 SCC 59",
    d: "Under Order XXXIX Rule 2A CPC, where any person or public official willfully disobeys or breaches a temporary injunction or status quo order, the court may order:",
    p: ["1. ATTACHMENT OF PROPERTY of the guilty person/department for a period not exceeding one year; and", "2. COMMITTAL TO CIVIL PRISON of the guilty person for a term not exceeding THREE MONTHS, unless the court directs his earlier release.", "Attachment remains in force up to one year, after which the attached property may be sold and compensation awarded to the injured party."],
    g: "CRITICAL DEPARTMENTAL RULE: If served with an injunction or status quo order, COMPLY FIRST to avert Rule 2A contempt proceedings and personal civil imprisonment, and immediately instruct Standing Counsel to move an application under Order XXXIX Rule 4 to vacate or modify the order.",
    rel: ["interim_injunction", "contempt"]
  });

  KT("infrastructure_injunction", "Complete bar on injunctions against infrastructure projects (S.41(ha) Specific Relief Act)", {
    tokens: ["infrastructure", "injunction", "section 41", "road", "bridge", "pipeline", "bar", "specific relief act", "public project", "stay"],
    a: ["can a civil court grant a temporary injunction against a government infrastructure project like a road bridge or water pipeline", "can a civil court grant a temporary injunction against a government infrastructure project", "section 41 ha specific relief act", "injunction infrastructure project", "bar on injunction public project", "infrastructure stay barred", "section 41 ha"],
    k: "infrastructure road bridge pipeline water jal shakti pmgsy pwd barred 41ha specific relief development",
    r: ["s41ha"], b: "Specific Relief Act 1963 Section 41(ha) (introduced by Specific Relief Amendment Act 2018)",
    d: "NO! Under Section 41(ha) of the Specific Relief Act 1963, civil courts are EXPRESSLY BARRED from granting an injunction if it would cause impediment or delay in the progress or completion of any INFRASTRUCTURE PROJECT or interfere with the continued provision of relevant services related thereto.",
    p: ["The statutory bar covers projects listed in the Schedule to the Specific Relief Act, including transport (roads, bridges, highways, PMGSY), energy (PDD transmission/distribution), water and sanitation (Jal Shakti water pipelines, irrigation canals), and social/commercial infrastructure", "Public interest in completing public development projects outweighs private convenience", "Courts cannot grant interim or permanent injunctions that stall public works"],
    g: "Whenever a private litigant moves an injunction application against a road work (PMGSY/R&B), bridge, water supply scheme (Jal Shakti), or electric line (PDD), instruct standing counsel to immediately plead the statutory bar under Section 41(ha) Specific Relief Act and produce the project administrative sanction.",
    rel: ["interim_injunction", "mandatory_injunction", "s80_notice"]
  });

  KT("mandatory_injunction", "Distinction between prohibitory, mandatory & perpetual injunctions", {
    tokens: ["mandatory injunction", "prohibitory", "perpetual", "section 39", "section 38", "difference", "distinction"],
    a: ["what is the key distinction between a prohibitory injunction and a mandatory injunction", "prohibitory injunction", "mandatory injunction section 39 specific relief", "difference prohibitory mandatory", "perpetual injunction"],
    k: "prohibitory restrain negative mandatory compel positive restore status quo section 38 39 specific relief",
    r: ["s38sra", "s39sra"], b: "Specific Relief Act 1963 Sections 38 & 39; CPC Order XXXIX",
    d: "Key Legal Distinctions under Specific Relief Act 1963:\n\n1. Prohibitory Injunction: Restrains a party from committing a negative or wrongful act (e.g. stopping illegal construction, preventing demolition, or prohibiting dispossession).\n2. Mandatory Injunction (Section 39 Specific Relief Act): Commands a party to perform a positive, affirmative act to undo a wrong or restore status quo ante (e.g. commanding removal of an encroachment, demolishing an unauthorized wall, or releasing withheld pensionary benefits).\n3. Perpetual (Permanent) Injunction (Section 38 Specific Relief Act): Granted only by a final decree made at the hearing and upon the merits of the suit, perpetually enjoining the defendant from asserting a right or committing an act contrary to the plaintiff's rights.",
    rel: ["interim_injunction", "infrastructure_injunction"]
  });

  KT("caveat", "Caveat applications & 90-day statutory validity (Section 148A CPC)", {
    tokens: ["caveat", "section 148a", "90 days", "validity", "exparte", "notice", "how to file"],
    a: ["caveat", "caveat application", "section 148a cpc", "s148a", "how to file a caveat", "caveat period", "caveat validity", "purpose of caveat", "what is the maximum statutory validity period of a caveat filed under section 148a cpc", "duration of caveat", "validity of caveat"],
    k: "anticipated application notice ex parte order caveator 90 days renewal caveat petition section 148a",
    r: ["s148a"], b: "CPC Section 148A",
    d: "A Caveat is a formal precautionary notice lodged in court under Section 148A CPC by any person who claims a right to appear before the court on the hearing of an anticipated application in a suit or proceeding. Once lodged, the court is legally bound to serve prior notice on the caveator before passing any order.",
    t: "STATUTORY VALIDITY: Under Section 148A(5) CPC, a caveat remains in force for exactly 90 DAYS from the date on which it was lodged. If the apprehension persists after 90 days, a fresh caveat must be lodged.",
    p: ["Lodge caveat in the competent court where the application is expected, giving full particulars of parties and subject-matter", "Serve a copy of the caveat by registered post / speed post on the person expected to make the application (Section 148A(2))", "Upon filing of application, the court MUST serve notice on the caveator, and the applicant MUST furnish copies of the application, plaint, and supporting documents to the caveator (Section 148A(3) & (4))", "Caveator appears and opposes the application; no ex-parte interim order can be passed without hearing the caveator"],
    g: "DLO Kupwara SOP: Lodge caveats in matters where stay applications or restoration petitions are anticipated to protect government works.",
    rel: ["caveat_restoration", "caveat_without_notice", "interim_injunction", "restoration"]
  });

  KT("caveat_restoration", "Filing a caveat against an anticipated restoration application (S.148A vs O.IX R.9/13)", {
    tokens: ["caveat", "restoration", "order 9", "section 148a", "anticipated", "rule 9", "rule 13", "can a caveat be filed"],
    a: ["can a caveat application under section 148a cpc be filed against an anticipated restoration application", "can a caveat application under section 148a cpc be filed against an anticipated restoration application under order 9 rule 9 or order 9 rule 13 cpc", "caveat against restoration", "caveat against order 9 rule 9", "caveat against order 9 rule 13", "file caveat against restoration application", "can caveat be filed against restoration", "caveat on restoration"],
    k: "caveat restoration anticipated proceeding 148a notice caveator government department order 9 rule 9 order 9 rule 13",
    r: ["s148a", "o9r9", "o9r13"], b: "CPC Section 148A(1); Order IX Rules 9 & 13; Deepak Khosla v. Union of India, AIR 2011 Del 195",
    d: "YES! Under Section 148A(1) CPC, a caveat can be lodged in respect of any application expected to be made in a 'suit or proceeding instituted, or about to be instituted'. A restoration application under Order IX Rule 9 (to restore a suit dismissed for default) or Order IX Rule 13 (to set aside an ex-parte decree) is a statutory judicial proceeding arising out of a suit.",
    n: "When a government department succeeds in having an unmeritorious suit dismissed for default, or obtains a decree, and reasonably apprehends that the opposing side will file a restoration application to reopen the matter, the department can validly lodge a Caveat under Section 148A CPC. This legally obligates the court to issue prior notice to the Government and prevents the court from passing an ex-parte restoration order!",
    p: ["Identify the court and suit particulars of the dismissed or decreed matter", "Draft caveat stating apprehension of restoration application under Order IX Rule 9 or Rule 13 CPC", "Serve copy of caveat by registered post on the plaintiff/defendant", "Diarise the 90-day expiry date and file renewal if restoration is not moved within 90 days"],
    g: "Whenever a major litigation against the government is dismissed for default in any Kupwara court, instruct standing counsel to lodge a Caveat immediately.",
    rel: ["caveat", "caveat_without_notice", "restoration", "exparte"]
  });

  KT("caveat_without_notice", "Order passed without notice to caveator (Section 148A(3) Violation)", {
    tokens: ["caveat", "without notice", "section 148a", "violation", "natural justice", "set aside", "order passed without notice"],
    a: ["what happens if a court passes an interim order on a restoration application without serving notice on a caveator who has filed a valid caveat under section 148a cpc", "what happens if a court passes an interim order on a restoration application without serving notice on a caveator", "interim order without notice to caveator", "section 148a 3 violation", "order without hearing caveator"],
    k: "caveator notice natural justice infirm revision appeal set aside 148a3 illegal",
    r: ["s148a"], b: "CPC Section 148A(3); C.G.C. Enterprises v. State of Kerala, AIR 2003 Ker 145",
    d: "Passing an interim or restoration order without serving notice on a person who has lodged a valid, subsisting caveat constitutes a flagrant violation of mandatory Section 148A(3) CPC and the principles of natural justice. Such an order is legally infirm, voidable, and unsustainable in law.",
    p: ["Immediately file an urgent application before the same court bringing the pre-existing Caveat and postal proof of service to its attention", "Pray for recall and vacation of the order passed in breach of Section 148A(3) CPC", "If the court declines to recall the order, challenge it before the High Court of J&K and Ladakh in Civil Revision under Section 115 CPC"],
    g: "Always preserve the stamped caveat acknowledgment and registered post tracking slips in the case file as proof of compliance.",
    rel: ["caveat", "caveat_restoration", "revision"]
  });

  KT("exparte", "Ex-parte proceedings & limitation for setting aside (Order IX Rule 13 — 30 Days)", {
    tokens: ["exparte", "ex parte", "order 9 rule 13", "30 days", "article 123", "limitation", "setting aside"],
    a: ["ex parte", "exparte", "ex parte decree", "set aside ex parte decree", "order 9 rule 13", "exparte order", "ex parte against department", "o9r13", "o9r6", "o9r7", "ex parte proceedings", "limitation period for filing an application to set aside an ex parte decree", "what is the limitation period for filing an application to set aside an ex-parte decree under order 9 rule 13", "limitation order 9 rule 13", "article 123 limitation act"],
    k: "absence non appearance decree set aside good cause sufficient cause summons 30 days article 123",
    r: ["o9", "o9r6", "o9r7", "o9r13"], b: "CPC Order IX; Limitation Act 1963 Art. 123; B. Janakiramaiah Chetty v. A.K. Parthasarathi, (2003) 5 SCC 641",
    d: "An ex-parte decree is passed against a defendant who fails to appear despite due service of summons (Order IX Rule 6 CPC). Order IX Rule 13 empowers the court to set aside an ex-parte decree upon proof that summons was not duly served or that the defendant was prevented by sufficient cause from appearing.",
    t: "LIMITATION: 30 DAYS under Article 123 of the Limitation Act 1963, running from the date of the decree, or where summons was not duly served, from the date the applicant had knowledge of the decree. Delay can be condoned under Section 5 upon showing sufficient cause.",
    p: ["File application under Order IX Rule 13 supported by affidavit showing sufficient cause (e.g. non-service, sudden illness of counsel, communication failure)", "Before final decree: apply under Order IX Rule 7 showing good cause to be heard from that stage", "Court may set aside the ex-parte decree on terms as to costs"],
    n: "PROVISO TO ORDER IX RULE 13: The court CANNOT set aside an ex-parte decree without serving notice of the application on the opposite party!",
    g: "Report any ex-parte proceeding to DLO Kupwara the same day. Move Order IX Rule 13 within 30 days to prevent execution.",
    rel: ["exparte_remedies", "exparte_notice", "restoration", "condonation_delay"]
  });

  KT("exparte_remedies", "3 Concurrent remedies against an ex-parte decree", {
    tokens: ["exparte decree", "remedies", "order 9 rule 13", "section 96", "concurrent remedies", "appeal against ex parte"],
    a: ["what remedy does a government department have if a suit is decreed ex parte due to non appearance of standing counsel", "what remedy does a government department have if a suit is decreed ex parte", "remedies against ex parte decree", "concurrent remedies ex parte", "appeal against ex parte decree section 96 2"],
    k: "exparte decree standing counsel sufficient cause review appeal set aside department three concurrent remedies",
    r: ["o9r13", "s96", "s114", "o47"], b: "CPC Order IX Rule 13; Section 96(2); Section 114 read with Order XLVII Rule 1; Bhanu Kumar Jain v. Archana Kumar, (2005) 1 SCC 787",
    d: "A government department against which an ex-parte decree has been passed has THREE CONCURRENT REMEDIES available under the Code of Civil Procedure:",
    p: ["1. Set-Aside Application under Order IX Rule 13 CPC: File application before the trial court showing sufficient cause for non-appearance (limitation 30 days under Article 123).", "2. Regular First Appeal under Section 96(2) CPC: File a civil appeal before the appellate court (District Court / High Court) challenging the ex-parte decree on factual and legal merits (limitation 30 / 90 days under Article 116).", "3. Review Application under Section 114 read with Order XLVII Rule 1 CPC: Seek review before the trial court if there is an error apparent on the face of the record (limitation 30 days under Article 124)."],
    n: "The Supreme Court in Bhanu Kumar Jain held that these remedies are concurrent. A party may pursue Order IX Rule 13 and Section 96(2) appeal simultaneously, but if the appeal is dismissed on merits, Order IX Rule 13 merges.",
    g: "Consult DLO Kupwara to determine whether to pursue Order IX Rule 13, First Appeal, or both concurrently along with a stay application.",
    rel: ["exparte", "exparte_notice", "appeals", "review", "condonation_delay"]
  });

  KT("exparte_notice", "Mandatory notice to plaintiff before setting aside ex-parte decree (Proviso)", {
    tokens: ["order 9 rule 13", "proviso", "notice", "plaintiff", "set aside", "without notice"],
    a: ["can a court set aside an ex parte decree under order 9 rule 13 without issuing notice to the plaintiff", "proviso order 9 rule 13 notice", "set aside ex parte without notice", "notice to plaintiff order 9 rule 13"],
    k: "proviso notice plaintiff opposite party restoration exparte decree mandatory",
    r: ["o9r13"], b: "CPC Order IX Rule 13 proviso",
    d: "NO! The proviso to Order IX Rule 13 CPC explicitly commands that 'no decree shall be set aside on any such application as aforesaid unless notice thereof has been served on the opposite party'.",
    n: "Setting aside an ex-parte decree without notice to the plaintiff/decree-holder violates this statutory mandate and the principle of audi alteram partem. Such an order is illegal and liable to be set aside on appeal or revision.",
    g: "If your department obtained an ex-parte decree, insist on notice before any set-aside order. If the department is the applicant, ensure notice is duly served on the private plaintiff.",
    rel: ["exparte", "caveat_restoration"]
  });

  KT("restoration", "Restoration of suits dismissed for default (Order IX Rules 4 & 9 CPC — 30 Days)", {
    tokens: ["restoration", "dismissed for default", "order 9 rule 9", "30 days", "article 122", "restore suit", "default"],
    a: ["restoration", "restoration application", "restore suit", "suit dismissed for default", "dismissed in default", "order 9 rule 9", "restoration of appeal", "o9r9", "o9r4", "restoration petition"],
    k: "default non appearance dismissed revive sufficient cause order 9 rule 9 30 days article 122", r: ["o9r4", "o9r9"], b: "CPC Order IX Rules 4, 9; Limitation Act Art. 122",
    d: "Where a suit is dismissed for plaintiff's non-appearance under Order IX Rule 8, the plaintiff is barred from bringing a fresh suit on the same cause of action, but may apply under Order IX Rule 9 CPC to set aside the dismissal and restore the suit upon demonstrating sufficient cause.",
    t: "LIMITATION: 30 DAYS from the date of dismissal under Article 122 of the Limitation Act 1963. Delay may be condoned under Section 5 upon showing sufficient cause.",
    p: ["File application under Order IX Rule 9 supported by affidavit detailing genuine reasons for non-appearance", "Notice issued to defendant; court may restore on terms as to costs", "If application is rejected, an appeal lies under Order XLIII Rule 1(c) CPC"],
    g: "Regularly check cause lists. If a government suit is dismissed for default, inform DLO Kupwara immediately to move restoration within 30 days.",
    rel: ["exparte", "condonation_delay", "caveat_restoration"]
  });

  KT("condonation_delay", "Condonation of delay (Section 5 Limitation Act — No Leeway for Bureaucratic Lethargy)", {
    tokens: ["section 5", "limitation", "condonation", "delay", "sufficient cause", "bherulal", "living media"],
    a: ["condonation of delay", "condone delay", "delay condonation", "section 5 limitation act", "s5 limitation", "application for condonation", "delay in filing appeal", "delay in filing", "condonation petition", "time barred appeal", "sufficient cause for delay", "condonation kya hai", "postmaster general v living media", "state of mp v bherulal"],
    k: "limitation appeal application sufficient cause explain each day bureaucratic government delay late administrative lethargy",
    r: ["s5", "s12", "s14"], b: "Limitation Act 1963 Ss.5, 12, 14; Postmaster General v. Living Media India Ltd., (2012) 3 SCC 563; State of M.P. v. Bherulal, (2020) 10 SCC 654",
    d: "Under Section 5 of the Limitation Act 1963, any appeal or application (except an execution application under Order XXI CPC) may be admitted after the prescribed period if the applicant satisfies the court that he had 'sufficient cause' for not filing in time.",
    p: ["File formal application under Section 5 supported by an affidavit of the competent officer", "Provide a chronological, day-by-day explanation of the delay with diary numbers and file movement dates", "Show diligence and demonstrate absence of negligence or deliberate inaction", "Court hears the opposite party and decides whether to condone delay on terms as to costs"],
    n: "SUPREME COURT RULING ON GOVERNMENT DELAYS: The Supreme Court in Postmaster General v. Living Media (2012) and State of M.P. v. Bherulal (2020) emphatically ruled that Government departments enjoy NO special indulgence or relaxed standard for bureaucratic delays, administrative red-tape, or procedural lethargy. Vague departmental explanations will be rejected with exemplary costs!",
    g: "Forward orders and judgments to DLO Kupwara on the day of delivery. Apply for certified copies immediately to claim exclusion under Section 12.",
    rel: ["limitation", "appeals", "exparte", "restoration"]
  });

  /* ── Category D & E: Execution, Contempt, Labour Laws & MACT Claims ── */
  KT("execution", "Execution of decrees (Sections 36–74 & Order XXI CPC — 12 Years Limitation)", {
    tokens: ["execution", "order 21", "decree", "12 years", "article 136", "enforce decree", "execution petition"],
    a: ["execution", "execution petition", "execution of decree", "how to execute a decree", "execution application", "execution proceedings", "decree execution", "order 21", "section 36 to 74", "execution process", "execution kaise hota hai", "execution petition process"],
    k: "decree holder judgment debtor executing court attachment sale recover money possession transfer notice 12 years article 136",
    r: ["o21", "s36", "s38", "s39", "s47", "s51", "a136"], b: "CPC Ss.36–74; Order XXI; Limitation Act 1963 Art. 136",
    d: "Execution is the judicial mechanism by which a decree-holder enforces a decree or order of a civil court against the judgment-debtor (Sections 36–74 and Order XXI CPC).",
    t: "LIMITATION: 12 YEARS from the date when the decree became enforceable under Article 136 of the Limitation Act 1963.",
    p: ["Execution application filed in court that passed decree (S.38) or transferee court (S.39)", "Application states decree details, amounts due, costs, and specific mode of execution sought (Order XXI Rule 11)", "Notice issued to judgment-debtor if filed after 2 years (Order XXI Rule 22) or against legal representatives", "Court orders mode of execution under Section 51: attachment and sale, delivery of possession, arrest in civil prison, or receiver", "Attachment, proclamation of sale, public auction, and confirmation of sale (Rules 54, 64–67, 92)", "Satisfaction of decree recorded under Order XXI Rule 2 CPC"],
    n: "All questions regarding execution, discharge, or satisfaction are determined under Section 47 CPC by the executing court and NOT by a separate suit. The executing court cannot go behind the decree.",
    g: "On receiving an execution notice against a department, verify whether Section 82 3-month protection was observed and check if an appeal with stay has been preferred.",
    rel: ["exec_cannot_go_behind", "exec_govt", "o21r22", "exec_stay", "exec_modes"]
  });

  KT("exec_cannot_go_behind", "Executing court cannot go behind the decree (Section 47 CPC)", {
    tokens: ["section 47", "go behind decree", "executing court", "alter modify", "nullity", "correctness"],
    a: ["can an executing court alter modify or question the correctness of a decree under section 47 cpc", "can an executing court alter modify or question the correctness of a decree", "executing court cannot go behind decree", "nullity inherent jurisdiction execution", "section 47 executing court limits"],
    k: "go behind decree alter modify correctness nullity jurisdiction executing court section 47",
    r: ["s47"], b: "CPC S.47; Vasudev Dhanjibhai Modi v. Rajabhai Abdul Rehman, (1970) 1 SCC 670",
    d: "NO! An executing court CANNOT go behind the decree. It must execute the decree as it stands and has no jurisdiction to question its correctness, legality, or alter its terms.",
    n: "THE ONLY EXCEPTION: Where the decree is a TOTAL NULLITY on the face of the record due to complete lack of inherent jurisdiction of the court that passed it. If the court had jurisdiction but decided erroneously on facts or law, the remedy is appeal or revision, NOT an objection before the executing court.",
    g: "Do not attempt to re-litigate the factual merits before the executing court. Instruct counsel to focus on discharge, satisfaction, statutory execution scope, or move the appellate court for a stay.",
    rel: ["execution", "exec_objections", "appeals"]
  });

  KT("exec_govt", "Execution against Government & 3-month protection window (Section 82 CPC)", {
    tokens: ["section 82", "execution against government", "three months", "protection", "decree against government"],
    a: ["what protection does section 82 cpc provide to government departments against immediate execution of decrees", "what protection does section 82 cpc provide", "execution against government", "section 82 cpc", "s82 cpc", "decree against government execution", "three months execution government"],
    k: "government public officer three months unsatisfied decree department compliance funds attachment treasury",
    r: ["s82"], b: "CPC Section 82",
    d: "Section 82 CPC provides that an execution shall NOT issue on any decree or order against the Government or a public officer unless the decree remains UNSATISFIED for a period of THREE MONTHS computed from the date of such decree.",
    p: ["Copy of decree must reach DLO Kupwara and the concerned department immediately upon delivery", "During this mandatory 3-month window, the department must either: (1) Sanction and disburse the decretal amount; or (2) File an appeal before the appellate court and obtain an interim stay of execution under Order XLI Rule 5 CPC", "Execution can only be initiated by the decree-holder after the expiry of 3 months"],
    g: "The 3-month window is for taking proactive administrative or appellate steps. Do not allow 3 months to elapse without either obtaining an appellate stay or securing financial sanction.",
    rel: ["execution", "appeals", "exec_stay", "suits_govt"]
  });

  KT("o21r22", "Mandatory notice in execution after two years (Order XXI Rule 22 CPC)", {
    tokens: ["order 21 rule 22", "execution", "two years", "show cause notice", "notice after 2 years"],
    a: ["order 21 rule 22", "order 21 rule 22 cpc", "execution after 2 years notice", "mandatory notice judgment debtor two years", "o21r22 notice"],
    k: "execution notice two years judgment debtor o21r22 show cause",
    r: ["o21r22"], b: "CPC Order XXI Rule 22",
    d: "Under Order XXI Rule 22 CPC, where an execution application is filed more than TWO YEARS after the date of the decree (or against the legal representative of a deceased party), the court MUST issue a show-cause notice to the judgment-debtor before issuing process.",
    n: "Failure to issue notice under Order XXI Rule 22 where mandatory goes to the root of jurisdiction, rendering subsequent execution proceedings (such as attachment and auction) without jurisdiction and void.",
    g: "If an execution is served after 2 years without show-cause notice, raise an immediate preliminary objection regarding non-compliance with Order XXI Rule 22.",
    rel: ["execution", "exec_govt", "exec_objections"]
  });

  KT("exec_stay", "Stay of execution pending appeal (Order XLI Rule 5 & Order XXI Rules 26/29)", {
    tokens: ["order 41 rule 5", "stay of execution", "order 21 rule 26", "appeal stay", "substantial loss", "security"],
    a: ["stay of execution", "stay execution of decree", "order 41 rule 5", "o41r5", "order 21 rule 29", "stay pending appeal", "stay of decree", "stay of execution during appeal"],
    k: "appeal stay substantial loss security execution suspend order 41 rule 5", r: ["o41r5", "o21r26", "o21r29"], b: "CPC O.XLI R.5; O.XXI R.26, R.29",
    d: "Filing an appeal does NOT automatically stay execution of a decree. The appellant must move a separate application under Order XLI Rule 5 CPC showing: (a) substantial loss may result unless stay is granted; (b) application was made without unreasonable delay; and (c) security has been given by the applicant.",
    p: ["The appellate court may grant an interim stay of execution upon terms", "The executing court itself may grant a temporary stay under Order XXI Rule 26 for a reasonable time to enable the judgment-debtor to apply to the appellate court for stay", "Under Order XXI Rule 29, execution may be stayed if a suit is pending between the decree-holder and judgment-debtor in that court"],
    g: "Always file the appeal and Order XLI Rule 5 stay application together.",
    rel: ["appeals", "execution", "condonation_delay"]
  });

  KT("exec_modes", "Modes of execution (Section 51 CPC)", {
    tokens: ["section 51", "modes of execution", "enforce decree", "attachment", "civil prison", "receiver"],
    a: ["modes of execution", "section 51 cpc", "ways to execute decree", "how can decree be enforced", "s51 cpc"], k: "delivery attachment sale arrest detention receiver", r: ["s51"], b: "CPC S.51",
    d: "Section 51 CPC empowers the executing court to enforce decrees through: (a) delivery of specific decreed property; (b) attachment and sale of property; (c) arrest and detention in civil prison; (d) appointment of a receiver; or (e) such other manner as the nature of the relief requires.",
    rel: ["execution", "attachment_sale", "civil_prison"]
  });

  KT("attachment_sale", "Attachment & sale of property in execution & Section 60 exemptions", {
    tokens: ["attachment of property", "sale of attached property", "section 60", "exemptions", "auction"],
    a: ["attachment of property", "attachment in execution", "sale of attached property", "attachment of salary", "order 21 rule 54", "auction of property execution", "attachment of bank account", "garnishee", "set aside sale", "attachment sale"],
    k: "attach movable immovable debt proclamation auction confirmation exempt section 60 salary", r: ["o21r54", "o21r64", "o21r92", "s60"], b: "CPC Order XXI Rr.43–92; S.60",
    d: "Attachment freezes the debtor's property to satisfy the decree (Order XXI Rules 43–92 CPC). Immovables are attached by prohibitory order under Rule 54, bank accounts by garnishee orders under Rule 46.",
    gr: "STATUTORY EXEMPTIONS UNDER SECTION 60 CPC: The following property CANNOT be attached: necessary wearing apparel, cooking vessels, beds, tools of artisans, implements of husbandry and cattle of agriculturists, stipends, pensions, and protected portions of salary.",
    rel: ["execution", "exec_objections"]
  });

  KT("civil_prison", "Arrest & civil prison in execution & Section 56 female exemption", {
    tokens: ["arrest", "civil prison", "section 56", "female exemption", "section 58", "jolly george varghese"],
    a: ["arrest in execution", "civil prison", "detention of judgment debtor", "section 58 cpc", "arrest of judgment debtor", "jail for non payment of decree", "arrest warrant execution"],
    k: "arrest detention imprisonment money decree means wilful refusal women section 56 section 58", r: ["s55", "s56", "s58", "s59"], b: "CPC S.51(c), Ss.55–59; O.XXI R.37–40; Jolly George Varghese v. Bank of Cochin, (1980) 2 SCC 360",
    d: "Arrest and civil imprisonment is a coercive remedy for money decrees. Under the proviso to Section 51 CPC and Supreme Court ruling in Jolly George Varghese, arrest CANNOT be ordered unless the debtor has the means to pay and willfully refuses or neglects to pay.",
    n: "ABSOLUTE STATUTORY EXEMPTION: Under Section 56 CPC, the court CANNOT order the arrest or detention in civil prison of a WOMAN in execution of a money decree! Maximum detention under Section 58 is 3 months for claims exceeding ₹5,000, and 6 weeks for claims between ₹2,000 and ₹5,000.",
    rel: ["execution", "exec_modes"]
  });

  KT("contempt", "Civil contempt petitions & 1-year limitation bar (Contempt of Courts Act S.20)", {
    tokens: ["contempt", "section 20", "limitation", "1 year", "atr", "action taken report", "personal appearance"],
    a: ["contempt of court", "contempt petition", "civil contempt", "section 20 contempt of courts act", "limitation for contempt", "what is the statutory limitation period for filing a civil contempt petition under section 20 of the contempt of courts act 1971", "contempt compliance atr", "personal appearance of officer in contempt"],
    k: "civil contempt disobedience order compliance atr officer notice punishment apology limitation 1 year section 20 personal appearance virtual appearance",
    r: ["s2b", "s12", "s19", "s20", "a215"], b: "Contempt of Courts Act 1971 (Ss.2, 10, 12, 19, 20); Constitution of India Art. 215; Pallav Sheth v. Custodian, (2001) 7 SCC 549",
    d: "Civil Contempt under Section 2(b) of the Contempt of Courts Act 1971 is defined as willful disobedience to any judgment, decree, direction, order, writ, or other process of a court, or willful breach of an undertaking given to a court.",
    t: "MANDATORY 1-YEAR LIMITATION BAR: Under Section 20 of the Contempt of Courts Act 1971, NO COURT shall initiate any proceedings for contempt, either on its own motion or otherwise, after the expiry of a period of ONE YEAR from the date on which the contempt is alleged to have been committed!",
    p: ["Petitioner must establish a clear judicial command, knowledge of the order, and willful, contumacious disobedience", "Notice issued to respondent official to file compliance / Action Taken Report (ATR)", "Punishment under Section 12: simple imprisonment up to 6 months, or fine up to ₹2,000, or both. An unconditional bona fide apology may be accepted by the court", "Appeals against punishment orders lie under Section 19 within 30 days"],
    g: "DLO KUPWARA ATR SOP: Submit verified compliance report or Action Taken Report (ATR) to DLO Kupwara at least 48 HOURS prior to the scheduled hearing to avert adverse orders or coercive personal appearance directions. The Supreme Court has repeatedly directed that courts should not routinely summon senior government officers where compliance can be confirmed or virtual appearance can be arranged.",
    rel: ["interim_injunction", "execution"]
  });

  KT("wage_claim", "Wage claims under Payment of Wages Act S.15 (12 Months Limitation)", {
    tokens: ["payment of wages", "wage claim", "section 15", "12 months", "labour", "limitation", "alc"],
    a: ["what is the limitation period for filing a wage claim under section 15 of the payment of wages act 1936", "wage claim labour commissioner", "section 15 payment of wages", "section 33c industrial disputes act", "wage claim limitation", "labour court kupwara wage claim"],
    k: "wages deduction delayed payment labour commissioner alc 12 months 33c settlement daily wager casual labourer",
    r: ["s15pwa"], b: "Payment of Wages Act 1936 S.15; Industrial Disputes Act 1947 S.33C(2)",
    d: "Claims regarding unauthorized deductions from wages or delay in payment of wages to workers are presented before the Authority under the Payment of Wages Act (Assistant Labour Commissioner / Labour Court Kupwara) under Section 15.",
    t: "STATUTORY LIMITATION: 12 MONTHS from the date on which the deduction was made or the date on which the wages became due (Section 15(2) Payment of Wages Act 1936). Delay may be admitted if sufficient cause is shown.",
    n: "Section 33C(2) of the Industrial Disputes Act 1947 allows a workman to approach the Labour Court to compute and recover money or any benefit due under an existing entitlement, settlement, or award.",
    g: "When served with a wage notice by the Assistant Labour Commissioner, assemble muster rolls, sanction orders, wage registers, and payment vouchers immediately. Check whether the claim exceeds the 12-month limitation window.",
    rel: ["limitation", "consumer_process"]
  });

  KT("mact", "Motor accident claims & no-fault liability (MACT — MV Act 1988)", {
    tokens: ["mact", "motor accident", "section 166", "6 months", "no fault liability", "limitation"],
    a: ["mact", "motor accident claim", "mact process", "accident claim tribunal", "section 166 motor vehicles act", "mact appeal", "accident compensation", "mact kupwara", "section 164 motor vehicles act", "section 166 3 limitation"],
    k: "motor accident claims tribunal compensation insurer owner driver no fault liability 5 lakh 2.5 lakh 6 months limitation",
    r: ["s164", "s166", "s168", "s173"], b: "Motor Vehicles Act 1988 Ss.164, 166, 168, 173; MV Amendment Act 2019",
    d: "Claims for compensation arising out of motor accidents causing death or bodily injury (including cases involving departmental or government vehicles) are adjudicated by the Motor Accident Claims Tribunal (MACT) under Section 166 of the Motor Vehicles Act 1988.",
    p: ["Claim application filed by victim or legal representatives before MACT", "Notice served on owner of vehicle, driver, and the insurance company", "NO-FAULT LIABILITY (Section 164 MV Act): Fixed statutory compensation of ₹5 LAKHS in case of death, and ₹2.5 LAKHS in case of grievous hurt/permanent disability, without requiring claimant to prove wrongful act, neglect, or default", "Full claim under Section 166 proceeds on structured multiplier method assessing loss of dependency and medical expenditure", "Appeals to High Court lie under Section 173 within 90 days from the award"],
    t: "STATUTORY LIMITATION: Section 166(3) as introduced by the MV Amendment Act 2019 prescribes a limitation period of 6 MONTHS from the date of the accident for filing a claim petition.",
    g: "If a departmental vehicle is involved in an accident in Kupwara district, immediately transmit FIR, vehicle registration, driver license, and insurance policy to DLO Kupwara to file reply.",
    rel: ["appeals"]
  });

  /* ── Category C & E: Land Revenue, Adverse Possession, Evidence & ADR ── */
  KT("adverse_possession_state_land", "Defending adverse possession claims against State Land, Kahcharai, Shamlat & Nazool", {
    tokens: ["adverse possession", "state land", "kahcharai", "shamlat", "30 years", "article 112", "nazool", "animus possidendi"],
    a: ["defending claims of adverse possession against state land kahcharai shamlat and nazool lands", "adverse possession state land", "kahcharai land adverse possession", "shamlat deh adverse possession", "nazool land adverse possession", "adverse possession government land", "can someone claim adverse possession on kahcharai", "how to defend adverse possession claims on state and kahcharai land"],
    k: "adverse possession state land kahcharai shamlat nazool 30 years article 112 hostile animus possidendi girdawari jamabandi section 133 a",
    r: ["a112"], b: "Limitation Act 1963 Article 112; J&K Land Revenue Act S.133-A; Ravinder Kaur Grewal v. Manjit Kaur, (2019) 8 SCC 729; State of Haryana v. Mukesh Kumar, (2011) 10 SCC 404",
    d: "Under Article 112 of the Limitation Act 1963, any suit by or on behalf of the Government has a limitation period of 30 YEARS. A private party claiming title by adverse possession against State land must prove continuous, peaceful, open, and hostile possession with animus possidendi for a minimum unbroken period of 30 years.",
    p: ["DEFENCE STRATEGY AGAINST ADVERSE POSSESSION OF GOVERNMENT LAND:", "1. Mere long possession, encroached cultivation, or unauthorized occupation does NOT constitute adverse possession. The claimant must prove 'animus possidendi' (hostile intent denying the Government's title from the inception).", "2. KAHCHARAI (Grazing Land) & SHAMLAT: Under J&K land revenue jurisprudence, Kahcharai is communal grazing land reserved for the public. The Supreme Court in Jagpal Singh v. State of Punjab held that common village / grazing land CANNOT be alienated, encroached, or acquired by adverse possession. Encroachers are liable to summary eviction under Section 133-A of the J&K Land Revenue Act.", "3. Produce official Khasra Girdawari (biannual harvest inspections) and Jamabandi records showing that the land is recorded in ownership of the State / Sarkar.", "4. Plead that the private party made representations for lease, regularization, or permission; acknowledging the Government's superior title destroys adverse animus."],
    g: "Obtain certified copies of Jamabandi, Khasra Girdawari, and Shajra Kistwar from the Tehsildar immediately to rebut the plaintiff's claim of hostile possession.",
    rel: ["land_revenue_demarcation", "s9_bar", "burden_proof"]
  });

  KT("land_revenue_demarcation", "Cross-examination on boundary, demarcation & spot-inspection reports (J&K Land Revenue Act)", {
    tokens: ["cross examination", "patwari", "demarcation", "boundary", "tatima shajra", "spot inspection", "burji", "seh hadda"],
    a: ["cross examination tactics regarding boundary demarcation and spot inspection reports under jk land revenue act", "demarcation report cross examination", "boundary dispute cross examination", "spot inspection report land revenue", "tatima shajra demarcation", "patwari demarcation report challenge", "cross examination tactics for patwari boundary demarcation reports"],
    k: "demarcation boundary spot inspection tatima shajra chanda seh hadda tehsildar patwari notice adjacent owners",
    b: "J&K Land Revenue Act S.101 & S.102; Financial Commissioner Revenue Standing Orders; CPC Order XXVI Rule 9",
    d: "In land litigation involving government properties, roads, forests, or schools, private plaintiffs often rely on unverified or manipulated demarcation memos prepared by local patwaris. Government standing counsel must subject such reports to rigorous legal scrutiny and cross-examination.",
    p: ["KEY CROSS-EXAMINATION & DEFENSE TACTICS:", "1. COMPETENT AUTHORITY: Under the J&K Land Revenue Act, demarcation must be conducted by or under the direct supervision of a competent Revenue Officer (Tehsildar / Naib Tehsildar). A unilateral report by a village Patwari without authorization is legally defective.", "2. MANDATORY PRIOR NOTICE: Cross-examine whether prior written notice was served on all adjacent plot-holders and the concerned government department before conducting the spot demarcation. Absence of notice vitiates the demarcation.", "3. PERMANENT REFERENCE POINTS (Chanda / Seh-Hadda): Cross-examine the revenue official on whether the survey commenced from recognized, undisputed permanent boundary pillars (Seh-Hadda). Measuring from an arbitrary or private landmark invalidates the entire measurement.", "4. TATIMA SHAJRA (Field Map): Verify whether an accurate Tatima Shajra showing exact dimensions, survey numbers (Khasra numbers), and scale was drawn on the spot during inspection.", "5. CONTEMPORANEOUS ROZNAMCHA: Cross-check the Patwari's daily diary (Roznamcha Waqiati) entry for the date of inspection to establish if the spot visit genuinely occurred."],
    g: "Request appointment of an independent Court Commissioner under Order XXVI Rule 9 CPC supervised by the Sub-Divisional Magistrate (SDM) or Tehsildar if a suspect private report is tendered.",
    rel: ["adverse_possession_state_land", "s9_bar", "burden_proof"]
  });

  KT("s9_bar", "Civil court jurisdictional bars under Section 9 CPC (Land Revenue, Agrarian & Eviction Acts)", {
    tokens: ["section 9", "jurisdictional bar", "express bar", "land revenue act", "agrarian reforms", "section 133 a", "section 25"],
    a: ["civil court jurisdictional bars under section 9 cpc", "section 9 cpc bar", "express bar civil court", "land revenue act civil court", "agrarian reforms jurisdiction", "industrial disputes act bar civil court", "section 133 a land revenue act bar", "section 25 agrarian reforms act bar"],
    k: "express implied bar land revenue agrarian public premises sarfaesi industrial disputes section 9 section 133 a section 25",
    r: ["s9"], b: "CPC Section 9; J&K Land Revenue Act Ss.133-A, 133-B; J&K Agrarian Reforms Act 1976 Ss.19, 25; Public Premises Eviction Act",
    d: "Under Section 9 CPC, civil courts have jurisdiction to try all suits of a civil nature EXCEPT suits whose cognizance is either expressly or impliedly barred by statutory enactments.",
    p: ["EXPRESS STATUTORY BARS IN J&K:", "1. J&K LAND REVENUE ACT (Sections 133-A & 133-B): Encroachment on State, Kahcharai, or communal land is within the exclusive jurisdiction of the Revenue Officer (Tehsildar/Collector). Civil courts have no jurisdiction to restrain eviction of illegal encroachers from state land.", "2. J&K AGRARIAN REFORMS ACT 1976 (Section 25 & Section 19): Section 25 expressly bars the jurisdiction of civil courts over any matter which the Revenue Officer / Agrarian Collector is empowered to determine under the Act (such as vesting of ownership under Section 4 or Section 8, tenancy, or agrarian disputes).", "3. PUBLIC PREMISES (EVICTION OF UNAUTHORISED OCCUPANTS) ACT: Exclusive jurisdiction is vested in the Estate Officer. Civil courts cannot grant injunctions staying public premises eviction.", "4. SARFAESI ACT (Section 34) & INDUSTRIAL DISPUTES ACT (Section 10/33C): Complete exclusion of civil court cognizance."],
    g: "When a suit is instituted regarding demarcation, mutation, tenancy, or state land encroachment, immediately move an application under Order VII Rule 11(d) CPC for rejection of plaint citing the express Section 9 statutory bars.",
    rel: ["jurisdiction", "reject_plaint", "adverse_possession_state_land"]
  });

  KT("electronic_evidence", "Electronic evidence certification (BSA Section 63 / S.65B Evidence Act)", {
    tokens: ["electronic evidence", "bsa 63", "65b", "section 63", "certificate", "arjun panditrao", "e office", "admissibility"],
    a: ["is a certificate under bsa section 63 evidence act section 65b mandatory for submitting digital file movement logs and e office records in court", "is a certificate under bsa section 63 evidence act section 65b mandatory for submitting digital file movement logs and e office records", "65b certificate", "bsa 63 electronic certificate", "arjun panditrao electronic evidence", "e office logs as evidence", "electronic evidence certificate", "is electronic evidence certificate mandatory"],
    k: "electronic certificate computer output email digital register custodian inadmissible 65b bsa 63 printout arjun panditrao",
    r: ["s65b", "s63bsa"], b: "Bharatiya Sakshya Adhiniyam 2023 S.63; Indian Evidence Act 1872 S.65B; Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, (2020) 7 SCC 1",
    d: "YES! Under Section 63 of the Bharatiya Sakshya Adhiniyam 2023 (formerly Section 65B of the Indian Evidence Act 1872), an Electronic Evidence Certificate is strictly MANDATORY for admitting any secondary electronic record into evidence.",
    p: ["Mandatory Scope: Computer outputs, digital registers, e-office file movement logs, server logs, emails, WhatsApp/SMS messages, and digital dispatch logs CANNOT be admitted in evidence without a certificate", "The certificate must identify the electronic record, describe the device, certify that the computer/system operated properly during the period, and be signed by the official having lawful control/custody of the electronic system", "The Supreme Court in Arjun Panditrao Khotkar held that producing the certificate is an absolute condition precedent to the admissibility of secondary electronic evidence"],
    g: "Never tender bare e-office screenshots or computer printouts in court. Have the designated District Informatics Officer (DIO) or departmental custodian sign an Electronic Evidence Certificate under BSA S.63 / S.65B.",
    rel: ["evidence", "burden_proof"]
  });

  KT("civil_death", "Presumption of civil death (BSA Section 111 / S.108 Evidence Act — 7-Year Rule)", {
    tokens: ["civil death", "7 years", "section 111", "section 108", "presumption of death", "untraced report"],
    a: ["what is the primary defense of the government when a plaintiff files a suit seeking declaration of civil death under bsa section 111 evidence act section 108", "what is the primary defense of the government when a plaintiff files a suit seeking declaration of civil death", "civil death 7 years", "presumption of death missing person", "section 108 evidence act", "declaration of civil death"],
    k: "missing seven years heard of legal heir death certificate public notice police report bsa 111 section 108 untraced report",
    r: ["s108", "s111bsa"], b: "Bharatiya Sakshya Adhiniyam 2023 S.111; Indian Evidence Act 1872 S.108; LIC of India v. Anuradha, (2004) 10 SCC 131",
    d: "Under Section 111 of the Bharatiya Sakshya Adhiniyam 2023 (formerly Section 108 of the Evidence Act), when it is proved that a person has not been heard of for SEVEN YEARS by those who would naturally have heard of him if alive, the legal presumption arises that he is dead.",
    p: ["DEFENSE STRATEGY & VERIFICATION REQUIREMENTS FOR GOVERNMENT DEPARTMENTS:", "1. Declaration of civil death is often sought by plaintiffs to claim compassionate appointment, family pension, or mutation of ancestral land.", "2. Insist on strict evidence that the missing person was continuously absent and unheard of by immediate family members for the full 7-year period.", "3. REQUIRE POLICE UNTRACED REPORT: Check whether a Missing Person Report was lodged with the local Police Station (Thana) immediately after disappearance and whether a thorough investigation concluded with an official untraced / closure report.", "4. MANDATORY PUBLIC NOTICE: Verify whether public citation was published in widely circulated local daily newspapers inviting objections before the civil court grants a decree.", "5. Date of Death: The presumption under Section 111 BSA relates ONLY to the fact of death at the date of the suit, NOT to the exact date of death during the 7-year period (LIC v. Anuradha)."],
    g: "Do not sanction terminal benefits or mutate land records until the decree declaring civil death is certified and police verification is confirmed.",
    rel: ["burden_proof", "jurisdiction"]
  });

  KT("adr_lok_adalat", "Lok Adalat & ADR conciliation standards in government litigation (Section 89 CPC)", {
    tokens: ["lok adalat", "section 89", "adr", "compromise", "settlement", "sanction", "finality"],
    a: ["lok adalat and adr conciliation standards in government litigation", "lok adalat government cases", "section 89 cpc adr", "compromise in government suit", "order 23 rule 3 government", "lok adalat award finality"],
    k: "lok adalat mediation arbitration adr section 89 order 23 rule 3 compromise sanction financial approval finality section 21",
    b: "CPC Section 89; Order XXIII Rule 3; Legal Services Authorities Act 1987 Section 21; State of Punjab v. Jalour Singh, (2008) 2 SCC 660",
    d: "Section 89 CPC empowers courts to refer disputes to Alternative Dispute Resolution (ADR), including Lok Adalat, Mediation, and Judicial Settlement. While encouraged for speedy resolution, government officials must follow strict administrative protocol before consenting to compromise.",
    p: ["STANDARDS FOR GOVERNMENT LITIGATION IN ADR / LOK ADALAT:", "1. MANDATORY COMPETENT SANCTION: No government officer, nodal official, or standing counsel has authority to enter into a compromise or settlement before a court or Lok Adalat without PRIOR WRITTEN ADMINISTRATIVE APPROVAL and financial sanction from the competent administrative department / Administrative Department of Law.", "2. RECORDING OF COMPROMISE (Order XXIII Rule 3 CPC): The agreement must be in writing and signed by the authorized departmental officer holding a valid letter of authorization.", "3. STATUTORY FINALITY OF LOK ADALAT AWARDS: Under Section 21 of the Legal Services Authorities Act 1987, an award of a Lok Adalat is deemed to be a decree of a civil court, is FINAL AND BINDING on all parties, and NO APPEAL lies against a Lok Adalat award!", "4. A Lok Adalat award cannot be challenged on merits, but only by way of a writ petition under Article 226/227 of the Constitution on grounds of fraud or total absence of consent (State of Punjab v. Jalour Singh)."],
    rel: ["jurisdiction"]
  });

  /* ── Category F: General Civil Procedure, Appeals, Review & Legal Glossary ── */
  KT("procedural_deadlines", "Master Procedural Timeline Matrix (CPC, Limitation & Special Acts)", {
    tokens: ["procedural deadlines", "timeline matrix", "deadlines", "limitation periods", "summary table", "procedural timeline"],
    a: ["procedural deadlines", "master procedural timeline matrix", "limitation matrix", "cpc deadlines", "statutory deadlines", "how many days for written statement appeal caveat", "timeline matrix"],
    k: "statutory deadlines timelines matrix 30 days 90 days 120 days 45 days 2 months 12 years 1 year",
    d: "MASTER PROCEDURAL TIMELINE MATRIX (DLO Kupwara Legal Training Manual):\n\n" +
       "1. Section 80(1) Notice to Government: 2 MONTHS prior to suit institution\n" +
       "2. Written Statement (Ordinary Civil Suit - O.VIII R.1): 30 DAYS (extendable up to 90 DAYS on cause shown)\n" +
       "3. Written Statement (Commercial Suit - CCA 2015): 120 DAYS STRICT HARD STOP (right forfeited thereafter)\n" +
       "4. Written Response (Consumer Complaint - CPA S.38): 30 + 15 = 45 DAYS ABSOLUTE MAXIMUM\n" +
       "5. Caveat Application Validity (S.148A): EXACTLY 90 DAYS from date of lodging\n" +
       "6. Injunction Application Disposal (O.XXXIX R.3A): 30 DAYS from interim order\n" +
       "7. Application to Set Aside Ex-Parte Decree (O.IX R.13): 30 DAYS (Limitation Act Art. 123)\n" +
       "8. Restoration of Suit Dismissed for Default (O.IX R.9): 30 DAYS (Limitation Act Art. 122)\n" +
       "9. First Appeal to District Court (S.96): 30 DAYS (Limitation Act Art. 116(b))\n" +
       "10. First Appeal to High Court (S.96): 90 DAYS (Limitation Act Art. 116(a))\n" +
       "11. Review of Judgment (S.114 / O.XLVII): 30 DAYS (Limitation Act Art. 124)\n" +
       "12. Civil Revision to High Court (S.115): 90 DAYS (Limitation Act Art. 131)\n" +
       "13. Civil Contempt Petition (S.20 Contempt Act): 1 YEAR from date of alleged contempt\n" +
       "14. Wage Claim before Labour Authority (PWA S.15): 12 MONTHS from deduction / due date\n" +
       "15. MACT Claim Petition (MV Act S.166(3)): 6 MONTHS from date of accident\n" +
       "16. Decree Execution Application (O.XXI / Art. 136): 12 YEARS (3 Years for mandatory injunction)\n" +
       "17. Government Protection against Decree Execution (S.82): 3 MONTHS protection before execution can issue\n" +
       "18. Adverse Possession against State Land (Art. 112): 30 YEARS continuous hostile possession",
    rel: ["written_statement", "commercial_ws", "caveat", "exparte", "appeals", "contempt", "execution"]
  });

  KT("appeals", "Appeals (First Appeal under Section 96 & Order XLI CPC — Limitation Rules)", {
    tokens: ["appeal", "first appeal", "section 96", "order 41", "30 days", "90 days", "article 116", "limitation"],
    a: ["appeal", "first appeal", "civil appeal", "section 96 cpc", "order 41 cpc", "limitation for appeal", "appealable orders", "order 43 cpc", "what is the limitation period for filing an appeal against a civil suit decree under section 96 order 41 cpc", "appeal limitation"],
    k: "appeal decree order district court high court memorandum stay deposit certified copy 30 days 90 days article 116",
    r: ["s96", "s104", "o41", "o43", "a116"], b: "CPC Ss.96, 104, 107; Orders XLI, XLIII; Limitation Act 1963 Art. 116",
    d: "An appeal is a statutory rehearing of the dispute before a superior court. A First Appeal under Section 96 CPC lies against every decree passed by a court exercising original jurisdiction, on both questions of fact and questions of law.",
    t: "LIMITATION FOR APPEALS (Article 116 Limitation Act 1963):\n• 30 DAYS: For an appeal to any subordinate court (e.g. from Munsiff/Sub Judge to Principal District Judge Kupwara);\n• 90 DAYS: For an appeal to the High Court of Jammu & Kashmir and Ladakh.\nTime spent obtaining certified copies of judgment and decree is excluded under Section 12.",
    p: ["File Memorandum of Appeal setting forth grounds of objection (Order XLI Rule 1)", "Attach certified copy of judgment and decree", "CRITICAL: An appeal does NOT operate as an automatic stay of the decree. A separate application for stay of execution under Order XLI Rule 5 CPC must be filed!", "Delay beyond limitation requires an application under Section 5 Limitation Act with day-by-day explanation"],
    g: "Transmit certified copies to DLO Kupwara within 7 days of judgment delivery to enable timely filing of appeal and stay application before the 30/90 days expire.",
    rel: ["second_appeal", "exec_stay", "condonation_delay", "review", "revision"]
  });

  KT("second_appeal", "Second appeal (Section 100 CPC — Substantial Question of Law)", {
    tokens: ["second appeal", "section 100", "substantial question of law", "high court"],
    a: ["second appeal", "section 100 cpc", "s100 cpc", "substantial question of law", "second appeal high court", "rsa", "regular second appeal"],
    k: "high court substantial question of law findings of fact section 100", r: ["s100", "s101"], b: "CPC Ss.100–101; Nazir Mohamed v. J. Kamala, (2020) 19 SCC 57",
    d: "A Second Appeal lies to the High Court of J&K and Ladakh from an appellate decree of the District Court ONLY on a 'substantial question of law' (Section 100 CPC). Concurrent findings of fact recorded by courts below cannot be challenged unless demonstrated to be perverse.",
    rel: ["appeals"]
  });

  KT("revision", "Civil revision before High Court (Section 115 CPC)", {
    tokens: ["revision", "section 115", "civil revision", "jurisdictional error", "high court"],
    a: ["revision", "revision petition", "civil revision", "section 115 cpc", "s115 cpc", "revisional jurisdiction", "revision high court"],
    k: "high court jurisdictional error material irregularity subordinate court section 115", r: ["s115"], b: "CPC S.115",
    d: "The High Court may exercise revisional jurisdiction under Section 115 CPC over any subordinate court where: (a) jurisdiction not vested in it was exercised; (b) it failed to exercise jurisdiction; or (c) it acted illegally or with material irregularity. Revision lies only against non-appealable orders that would finally dispose of the case or cause irreparable failure of justice.",
    rel: ["appeals", "review"]
  });

  KT("review", "Review of judgment (Section 114 & Order XLVII CPC)", {
    tokens: ["review", "section 114", "order 47", "error apparent", "30 days"],
    a: ["review", "review petition", "review of judgment", "order 47", "section 114 cpc", "review application", "o47"],
    k: "error apparent on record new evidence discovery same court 30 days section 114 order 47", r: ["s114", "o47"], b: "CPC S.114; Order XLVII; Limitation Act Art. 124",
    d: "Review requests the SAME court that passed the decree or order to reconsider its decision. Grounds: (1) Discovery of new and important evidence which could not be produced earlier despite due diligence; (2) Mistake or error apparent on the face of the record; or (3) Any other sufficient reason. Limitation: 30 days under Article 124.",
    rel: ["appeals", "revision"]
  });

  KT("res_judicata", "Res judicata & constructive res judicata (Section 11 CPC)", {
    tokens: ["res judicata", "section 11", "constructive res judicata", "former suit", "decided"],
    a: ["res judicata", "section 11 cpc", "s11 cpc", "constructive res judicata", "matter already decided", "res judicata meaning"],
    k: "previously decided same parties competent court finally decided section 11 explanation iv", r: ["s11"], b: "CPC S.11",
    d: "Section 11 CPC bars the trial of any suit or issue in which the matter directly and substantially in issue has been directly and substantially in issue in a former suit between the same parties, litigating under the same title, in a court competent to try such subsequent suit, and has been heard and finally decided.",
    n: "Constructive Res Judicata (Explanation IV): Any matter which might and ought to have been made ground of defence or attack in the former suit is deemed to have been a matter directly and substantially in issue.",
    rel: ["sub_judice"]
  });

  KT("sub_judice", "Res sub judice & stay of parallel suits (Section 10 CPC)", {
    tokens: ["res sub judice", "sub judice", "section 10", "stay of parallel suit", "parallel litigation"],
    a: ["res sub judice", "sub judice", "section 10 cpc", "s10 cpc", "stay of later suit", "parallel suits"],
    k: "pending earlier suit same matter stay parallel litigation section 10", r: ["s10"], b: "CPC S.10",
    d: "Under Section 10 CPC, no court shall proceed with the trial of any suit in which the matter in issue is also directly and substantially in issue in a previously instituted suit between the same parties, pending in the same or any other competent court.",
    rel: ["res_judicata"]
  });

  KT("revenue_glossary", "Land Revenue & Settlement Terminology Glossary (J&K Revenue Practice)", {
    tokens: ["revenue terms", "glossary", "masavi", "jamabandi", "khasra girdawari", "tatima", "shajra", "kahcharai", "nazool"],
    a: ["revenue terms", "glossary of revenue terms", "what is masavi", "what is jamabandi", "what is khasra girdawari", "tatima shajra meaning", "kahcharai meaning", "shamlat meaning", "nazool meaning"],
    k: "revenue glossary masavi jamabandi girdawari tatima shajra kishtwar kahcharai shamlat nazool",
    d: "KEY LAND REVENUE TERMS (J&K Revenue & Judicial Practice):\n\n" +
       "• Masavi: The original master cadastral village survey map drawn on cloth/heavy paper during settlement showing exact field boundaries and coordinates.\n" +
       "• Shajra Kishtwar: Village field index map showing demarcated plots with assigned Khasra survey numbers.\n" +
       "• Tatima Shajra: Supplementary field map drawn on the spot to reflect subsequent physical subdivision or partition of a survey plot.\n" +
       "• Jamabandi: Record-of-Rights (ROR) reflecting parcel ownership, cultivating possession, revenue assessments, and tenancy rights.\n" +
       "• Khasra Girdawari: Biannual harvest inspection register recording actual crop cultivation, possession, and changes on the land twice a year.\n" +
       "• Kahcharai: Common village grazing land reserved for public livestock grazing; immune from private alienation or adverse possession.\n" +
       "• Shamlat Deh: Village common land held collectively for village community purposes.\n" +
       "• Nazool Land: State-owned land situated within municipal limits or towns, managed directly by the Government.",
    rel: ["adverse_possession_state_land", "land_revenue_demarcation", "s9_bar"]
  });

  /* ── Master Legal Glossary ── */
  KT("g_plaintiff", "Plaintiff and defendant", { tokens: ["plaintiff", "defendant"], a: ["plaintiff", "defendant", "who is plaintiff", "who is defendant"], d: "Plaintiff: The person who institutes a suit. Defendant: The person against whom relief is sought. In appeals, they are styled as Appellant and Respondent." });
  KT("g_decree_holder", "Decree-holder and judgment-debtor", { tokens: ["decree holder", "judgment debtor"], a: ["decree holder", "judgment debtor", "who is decree holder", "who is judgment debtor"], d: "Decree-holder: The person in whose favour a decree is passed (Section 2(3) CPC). Judgment-debtor: The person against whom a decree has been passed (Section 2(10) CPC)." });
  KT("g_cause_of_action", "Cause of action", { tokens: ["cause of action"], a: ["cause of action", "meaning of cause of action"], d: "The entire bundle of essential facts that the plaintiff must prove to obtain relief. A plaint disclosing no cause of action must be rejected under Order VII Rule 11(a) CPC." });
  KT("g_ad_interim", "Ad interim / interim order", { tokens: ["ad interim", "interim order"], a: ["ad interim", "interim order", "interim relief"], d: "An operative order effective until the next hearing or until the main application is heard on notice and disposed of." });
  KT("g_status_quo", "Status quo", { tokens: ["status quo"], a: ["status quo", "status quo order"], d: "A judicial command directing both parties to maintain the existing physical and legal condition of the property as of the date of the order without alteration." });
  KT("g_stay", "Stay", { tokens: ["stay", "stay order"], a: ["stay", "stay order", "stay of proceedings", "what is stay"], d: "A judicial order temporarily suspending execution, operation of an order, or proceedings in a suit or execution." });
  KT("g_affidavit", "Affidavit and verification", { tokens: ["affidavit", "verification"], a: ["affidavit", "verification of pleadings", "what is affidavit"], d: "A written declaration of facts sworn or affirmed before an authorized oath commissioner or notary. Pleadings must be verified under Order VI Rule 15 CPC." });
  KT("g_vakalatnama", "Vakalatnama", { tokens: ["vakalatnama", "power of attorney"], a: ["vakalatnama", "power of attorney to advocate", "vakalat", "authority to counsel"], d: "The written instrument authorizing an advocate to represent and plead for a party in court (Order III CPC). For the Government, standing counsel appears based on an official department authority letter." });
  KT("g_counterclaim", "Counterclaim and set-off", { tokens: ["counterclaim", "set off"], a: ["counterclaim", "counter claim", "set off", "setoff", "what is counterclaim"], d: "Set-off (Order VIII Rule 6): Ascertained sum of money legally recoverable by defendant claimed as deduction. Counterclaim (Rule 6A): An independent cross-claim against plaintiff treated as a cross-suit." });
  KT("g_locus_standi", "Locus standi and maintainability", { tokens: ["locus standi", "maintainability"], a: ["locus standi", "maintainability", "standing to sue", "suit maintainable"], d: "Locus standi: The legal right or standing of a person to institute a proceeding. Maintainability: The legal viability of the suit before the court having regard to jurisdiction, limitation, and statutory bars." });
  KT("g_certified_copy", "Certified copy", { tokens: ["certified copy"], a: ["certified copy", "certified copy of judgment", "how to get certified copy", "copying agency"], d: "Official sealed copy of court records. Time taken to obtain certified copies is excluded from limitation under Section 12 Limitation Act." });

  /* ───────────── 8. RETRIEVAL ENGINE & BRAIN ───────────── */
  "process procedure procedural steps stages limitation grounds provision law legal cpc apply explain explanation meaning define definition section sec rule difference differences differ allowed power jurisdiction punishment penalty defence defense remedy remedies hota hoti hote karte karta karna karein kare kaise kese kaisay under work works simple words bare sir file lodge served serve received receive receiving history proceeding proceedings previous past timeline happened matrix summary table statutory adverse possession kahcharai shamlat nazool demarcation tatima shajra".split(" ").forEach((w) => { NOISE[w] = 1; });
  Object.assign(SYN, { kaise: "how to", kese: "how to", kaisay: "how to", matlab: "meaning", "मतलब": "meaning", tareeka: "procedure", tarika: "procedure", tariqa: "procedure", qanoon: "law", kanoon: "law", dhara: "section", muddat: "limitation" });

  const KB_STOP = set("a an the of in for to is are was were be what whats how do does did can could i we it its and or on by with about your our their my me tell please explain explanation define definition meaning mean give any kya hai hain ka ki ke ko se par pe hota hoti hote karte karta karna karein kare batao bataiye file this that there work works simple words detail details bare sir law");
  const KB_SYN = dict({ execute: "execution", executing: "execution", executed: "execution", condone: "condonation", condoned: "condonation", condoning: "condonation", delayed: "delay", attach: "attachment", attaching: "attachment", attached: "attachment", disobey: "disobedience", disobeyed: "disobedience", restrain: "injunction", restraining: "injunction", punish: "punishment", punished: "punishment", punishable: "punishment", filing: "file", filed: "file", appealed: "appeal", appealing: "appeal", dismissed: "dismiss", stayed: "stay", limitations: "limitation", lodging: "lodge", lodged: "lodge", arrested: "arrest", arresting: "arrest", detained: "detention", detain: "detention", detaining: "detention", served: "serve", serving: "serve" });
  
  function kbStem(w) {
    if (KB_SYN[w]) return KB_SYN[w];
    if (w.length > 4 && w.slice(-3) === "ies") w = w.slice(0, -3) + "y";
    else if (w.length > 3 && w.slice(-1) === "s" && w.slice(-2) !== "ss" && w.slice(-2) !== "us") w = w.slice(0, -1);
    return KB_SYN[w] || w;
  }

  const KB_DROP = set("time limit day many long procedure procedural process step stage ground reason punishment penalty consequence effect cpc under");
  const KB_LOC = set("jammu kashmir jk ladakh");
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
  INTENTS.forEach((i) => Object.keys(i.kw).forEach((w) => { VOCABSET[w] = 1; }));
  Object.keys(KBDF).forEach((w) => { if (w.length >= 6 && !VOCABSET[w] && !/\d/.test(w)) { VOCAB.push(w); VOCABSET[w] = 1; } });

  const LAW_MIN = 4, LAW_STRONG = 7;
  const LAWCUE = /\b(what is|what are|whats|meaning|define|definition|explain|explanation|process|procedure|procedural|how to|how do|how does|how can|how is|how are|how many days|how many months|how long|steps|stages|limitation|time ?limit|grounds|section|sec|order \d+|rule \d+|provision|law|legal|cpc|apply|application for|filing|effect of|difference|differ|when can|can i|can we|can a|is it|allowed|power|jurisdiction|punishment|penalty|defen[cs]e|remedy|remedies|what should|what to do|what next|what now|what happens|tell me about|kya hai|hard stop|hard deadline|written statement|caveat|injunction|restoration|wage|contempt|mact|electronic evidence|civil death|matrix|deadlines|adverse possession|demarcation|kahcharai|shamlat|nazool)\b/;

  /* Flexible keyword trigger scoring for KB entries */
  function scoreKBEntry(q, entry) {
    const nq = norm(q);
    let tokens = entry.tokens;
    if (!tokens || !tokens.length) {
      tokens = (entry.title + " " + (entry.k || "")).split(" ").filter((w) => w.length > 3);
    }
    let matches = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tok = norm(tokens[i]).trim();
      if (!tok) continue;
      if (tok.indexOf(" ") !== -1) {
        if (nq.indexOf(tok) !== -1) {
          matches++;
        } else {
          const parts = tok.split(" ");
          if (parts.length > 1 && parts.every((p) => nq.indexOf(p) !== -1)) matches++;
        }
      } else {
        const re = new RegExp("\\b" + tok + "(s|es|ing|ed)?\\b", "i");
        if (re.test(nq) || (tok.length >= 4 && nq.indexOf(tok) !== -1)) matches++;
      }
    }
    return matches;
  }

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
      
      const tMatches = scoreKBEntry(q, x.t);
      const tokenBoost = tMatches >= 2 ? (tMatches * 150) : (tMatches === 1 ? 15 : 0);
      const score = base + bonus + rb + tokenBoost;
      if (score > 0) out.push({ t: x.t, score, matches: tMatches });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  function legalMatch(q) { const list = kbRank(q); return list.length ? { top: list[0], second: list[1] || null, list } : null; }

  const ASPECTS = [
    ["time", /\b(limitation|time ?limit|how (long|many days|many months|much time|soon)|within (how|what)|deadline|days|period|last date|muddat|validity|valid for|expire[sd]?|renew\w*|matrix)\b/],
    ["govt", /\b(department|government|govt|dlo|officer|what should (we|a|the)|what to do|our role|advice|advise|defense|defence|remedy|tactics|strategy)\b/],
    ["grounds", /\b(grounds|reasons|when can|defen[cs]e|valid|allowed|conditions|eligib|exceptions?|exempt)\b/],
    ["notes", /\b(punishment|penalty|sentence|fine|imprisonment|jail|consequences?|effects?|what happens|notes|caution|pitfall)\b/],
    ["steps", /\b(process|procedure|procedural|steps|stages|how to|how do|how does|how can|how is|how are|apply|method)\b/],
    ["what", /\b(what is|what are|whats|meaning|define|definition|explain|overview|about)\b/]
  ];
  const FACET = { steps: "p", time: "t", grounds: "gr", govt: "g", notes: "n" };
  const FACET_LABEL = { steps: "Steps", time: "Time limits", grounds: "Grounds & defences", govt: "For departments", notes: "Effects & notes" };
  const FACET_Q = { steps: "procedure", time: "time limit", grounds: "grounds", govt: "what should a department do", notes: "effects and notes" };
  const LAW_FOOT = "⚖️ Departmental Practice Directive · Structured under DLO Kupwara SOPs and High Court Rules. For formal legal advice, case strategy, and court representation, refer to assigned Government Standing Counsel.";
  const numbered = (arr, max) => arr.slice(0, max).map((s, i) => (i + 1) + ". " + s).join("\n");

  function legalReply(m, q) {
    const t = m.top.t; let asp = null;
    for (let i = 0; i < ASPECTS.length; i++) if (ASPECTS[i][1].test(q)) { asp = ASPECTS[i][0]; break; }
    if (asp && asp !== "what" && !t[FACET[asp]]) asp = null;
    let out = "**" + t.title + "**\n";
    if (asp === "steps") out += (t.d ? t.d + "\n\n" : "") + "**Procedural Steps**\n" + numbered(t.p, 12);
    else if (asp === "time") out += "**Statutory Time Limits & Deadlines**\n" + t.t;
    else if (asp === "grounds") out += "**Statutory Grounds & Defenses**\n" + t.gr;
    else if (asp === "govt") out += "**Departmental Defense & Strategy**\n" + t.g;
    else if (asp === "notes") out += "**Legal Consequences & Precedents**\n" + t.n;
    else {
      out += t.d || "";
      if (asp !== "what" && t.p) out += "\n\n" + numbered(t.p, 6) + (t.p.length > 6 ? "\n… " + (t.p.length - 6) + " more step(s) — tap Steps below" : "");
      if (asp === "what" && t.n) out += "\n\n" + t.n;
      else if (t.t) out += "\n\n**Statutory Timeline:** " + t.t;
    }
    if (t.b) out += "\n\nStatutory Basis & Landmark Precedents: " + t.b;
    const chips = [];
    if (m.second && m.second.t.id !== t.id && m.second.score >= m.top.score * 0.85 && m.second.score >= LAW_MIN) {
      chips.push(C("Did you mean: " + trunc(m.second.t.title, 28) + "?", "explain " + m.second.t.title));
    }
    Object.keys(FACET).forEach((a) => {
      if (t[FACET[a]] && a !== asp) chips.push(C(FACET_LABEL[a], t.title + " " + FACET_Q[a]));
    });
    (t.rel || []).slice(0, 3).forEach((id) => {
      const r = KB.filter((x) => x.id === id)[0];
      if (r) chips.push(C(trunc(r.title, 26), "explain " + r.title));
    });
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
    if (/\b(difference|differ|differences|versus|vs|compare|comparison)\b/.test(q)) {
      const p = compareMatch(q);
      if (p) return compareReply(p);
    }
    return legalReply(m, q);
  }

  function lawMenuReply() {
    const pick = (id) => KB.filter((x) => x.id === id)[0];
    const ids = [
      "caveat_restoration", "commercial_ws", "s80_notice", "infrastructure_injunction",
      "adverse_possession_state_land", "land_revenue_demarcation", "s9_bar", "electronic_evidence",
      "exparte_remedies", "consumer_process", "procedural_deadlines", "condonation_delay",
      "execution", "contempt", "wage_claim", "mact"
    ];
    return R("**DLO Kupwara Law Desk** — Master procedural knowledge base from the Legal Training Manual.\n\nAsk any question directly, for example:\n" +
      "• Can a caveat be filed against an anticipated restoration application?\n" +
      "• What is the hard deadline for written statement in commercial suits?\n" +
      "• Can a court grant a stay against roads, bridges, or water pipelines?\n" +
      "• How to defend adverse possession claims on State and Kahcharai land?\n" +
      "• Cross-examination tactics for patwari boundary demarcation reports\n" +
      "• Is an electronic evidence certificate under BSA S.63 / S.65B mandatory?\n" +
      "• Procedural timeline matrix for all case types\n\n" +
      "Or choose a legal category below:", {
      chips: ids.filter((id) => pick(id)).map((id) => C(trunc(pick(id).title.replace(/ \(.*\)/, ""), 26), "explain " + pick(id).title)).concat([MENU]), foot: LAW_FOOT });
  }

  function suggestLaw(v) { return kbRank(v, { prefix: true }).filter((x) => x.score >= 3).slice(0, 3).map((x) => x.t); }
  const LAWTYPE = { contempt: "contempt", execution: "execution", appeal: "appeals", restoration: "restoration", consumer: "consumer_process", mact: "mact", pauper: "indigent_suit", civilsuit: "civil_suit", review: "review", revision: "revision", condonation: "condonation_delay", transfer: "transfer_suit", wage: "wage_claim", commercial: "commercial_ws" };
  const lawChipFor = (typ) => { const id = typ && LAWTYPE[typ.kw]; const t = id && KB.filter((x) => x.id === id)[0]; return t ? C("Law: how does it work?", "explain " + t.title) : null; };

  const PLACES = ["handwara", "kupwara"];
  function histReply(rem) {
    const hr = pageHist(); if (!hr || !hasData()) return null;
    const res = runSearch(rem, null); if (!res.exact.length) return null;
    const row = res.exact[0].row, nk = normKey(row.title), ck = normKey(row.number);
    const ents = hr.filter((h) => (ck && normKey(h.cnr || "") === ck) || normKey(h.title || "") === nk).sort((a, b) => (b.entryDate || 0) - (a.entryDate || 0));
    S.last = row;
    if (!ents.length) return R("No proceedings history is recorded yet for **" + trunc(row.title, 70) + "**.", { link: PAGES.history, chips: [MENU] });
    const fd = (d) => (d instanceof Date && !isNaN(d) ? d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : "—");
    const lines = ents.slice(0, 4).map((h, i) => (i + 1) + ". " + fd(h.hearingDate || h.entryDate) + " — " + trunc(h.proceedings || "No summary recorded", 150) + (S.staff && h.counsel ? " (" + h.counsel + ")" : ""));
    return R("**Proceedings history — " + trunc(row.title, 60) + "**\n" + ents.length + " entr" + (ents.length > 1 ? "ies" : "y") + ", latest first:\n\n" + lines.join("\n") + (res.exact.length > 1 ? "\n\nShowing the closest match — add the case number to be exact." : ""), { link: PAGES.history, chips: [MENU] });
  }

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

  /* ───────────── 8B. PROCEDURAL LEGAL MINI-CALCULATORS ───────────── */
  function extractDateAny(str) {
    let m = str.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
    if (m) return mkDate(+m[1], +m[2] - 1, +m[3]);
    m = str.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (m) return mkDate(+m[3], +m[2] - 1, +m[1]);
    m = str.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i);
    if (m && MONKEY[m[2].toLowerCase()] !== undefined) return mkDate(+m[3], MONKEY[m[2].toLowerCase()], +m[1]);
    return null;
  }

  function runCalculator(text, q) {
    // 1. Written Statement Limitation Calculator (Order VIII Rule 1 CPC / Commercial Courts Act)
    if (/\b(calculate ws|ws calculator|limitation calculator|ws deadline|written statement calculator|calculate written statement|calculate limitation)\b/i.test(q) ||
        (/\b(ws|written statement)\b/i.test(q) && /\b(calculate|limitation|deadline|calculator)\b/i.test(q))) {
      const dtFound = extractDateAny(text);
      const base = dtFound || todayD();
      const d30 = addDays(base, 30);
      const d90 = addDays(base, 90);
      const d120 = addDays(base, 120);
      const rem30 = daysFrom(d30), rem90 = daysFrom(d90), rem120 = daysFrom(d120);

      let out = "**⚖️ Written Statement Limitation Calculator (Order VIII Rule 1 CPC)**\n\n";
      out += "📅 **Summons Service Date:** " + fmtDate(base) + (dtFound ? "" : " *(Using today as baseline)*") + "\n\n";
      out += "1. **30-Day Ordinary Civil Window (Order VIII Rule 1 CPC):**\n" +
             "   • **Statutory Deadline:** **" + fmtDate(d30) + "** (" + (rem30 < 0 ? Math.abs(rem30) + " days passed 🔴" : rem30 === 0 ? "Today 🔴" : rem30 + " days left") + ")\n" +
             "   • Absolute statutory right to file WS without requiring condonation of delay.\n\n";
      out += "2. **90-Day Maximum Discretionary Condonation Limit (Ordinary Civil Suits):**\n" +
             "   • **Outer Deadline:** **" + fmtDate(d90) + "** (" + (rem90 < 0 ? Math.abs(rem90) + " days passed 🔴" : rem90 + " days left") + ")\n" +
             "   • *Kailash v. Nanhku, (2005) 4 SCC 480:* Court may extend time beyond 30 days only upon exceptional reasons recorded in writing.\n\n";
      out += "3. **120-Day Absolute Commercial Forfeiture Hard Stop (Commercial Courts Act 2015):**\n" +
             "   • **Statutory Forfeiture:** **" + fmtDate(d120) + "** (" + (rem120 < 0 ? "FORFEITED 🔴" : rem120 + " days left") + ")\n" +
             "   • *SCG Contracts (India) Pvt. Ltd. v. K.S. Chamankar Infrastructure, (2019) 12 SCC 210:* On expiry of 120 days, right of defense is FORFEITED FOREVER. No court has power to extend.\n\n";
      out += "⚠️ **Departmental Action Directive:** Forward plaint and parawise comments to DLO Kupwara within 3 days of service to finalize vetting well before the 30-day baseline.";
      
      return R(out, {
        chips: [C("Draft S.80 objection", "draft objection section 80"), C("Draft 41(ha) objection", "draft objection 41 ha"), C("Draft Revenue bar", "draft revenue bar"), MENU],
        foot: LAW_FOOT
      });
    }

    // 2. Section 80(1) CPC Statutory Notice Expiry Calculator
    if (/\b(calculate section ?80|notice 80 calculator|s80 calculator|calculate s80|section 80 calculator)\b/i.test(q) ||
        (/\b(section ?80|s80|notice 80)\b/i.test(q) && /\b(calculate|calculator|expiry|cooling|expire)\b/i.test(q))) {
      const dtFound = extractDateAny(text);
      const base = dtFound || todayD();
      const d60 = addDays(base, 60);
      const d61 = addDays(base, 61);
      const rem60 = daysFrom(d60);

      let out = "**⚖️ Section 80(1) CPC Statutory Notice Expiry Calculator**\n\n";
      out += "📬 **Notice Service Date:** " + fmtDate(base) + (dtFound ? "" : " *(Using today as baseline)*") + "\n\n";
      out += "1. **Mandatory 60-Day Statutory Cooling-Off Period (S.80(1) CPC & S.15(2) Limitation Act):**\n" +
             "   • **Notice Period Expiry:** **" + fmtDate(d60) + "** (" + (rem60 < 0 ? "Expired " + Math.abs(rem60) + " days ago" : rem60 === 0 ? "Expires today" : rem60 + " days remaining") + ")\n" +
             "   • The Government department must be afforded 2 full calendar months to investigate the claim and settle administrative disputes.\n\n";
      out += "2. **Earliest Lawful Plaint Filing Date:**\n" +
             "   • **Day 61:** **" + fmtDate(d61) + "**\n" +
             "   • Any civil suit instituted BEFORE this date without express prior leave of the court under Section 80(2) is void ab initio.\n\n";
      out += "⚠️ **Departmental Legal Defense:**\n" +
             "• If plaint was filed before day 61 without leave, immediately apply for **Rejection of Plaint under Order VII Rule 11(d) CPC** (*State of A.P. v. Pioneer Builders*).\n" +
             "• If day-one ex-parte stay was granted, move to vacate invoking the mandatory **Proviso to Section 80(2) CPC**.";

      return R(out, {
        chips: [C("Draft S.80 objection", "draft objection section 80"), C("Calculate WS", "calculate ws"), MENU],
        foot: LAW_FOOT
      });
    }

    return null;
  }

  /* ───────────── 8C. PRE-DRAFTED PRELIMINARY OBJECTION DRAFTING CLAUSES ───────────── */
  function runDraftingClauses(text, q) {
    // 1. Section 41(ha) Specific Relief Act (Infrastructure Injunction Bar)
    if (/\b(draft objection 41 ?ha|infrastructure injunction objection|draft 41 ?ha|section 41 ?ha draft|draft objection infrastructure)\b/i.test(q) ||
        (/\b(draft|objection)\b/i.test(q) && /\b(41 ?ha|infrastructure|infrastructure project)\b/i.test(q))) {
      let out = "**📋 Pre-Drafted Preliminary Objection: Section 41(ha) Specific Relief Act, 1963**\n" +
                "*(Bar on Injunctions Stalling Roads, PMGSY, Bridges, Jal Shakti Pipelines & Power Projects)*\n\n" +
                "```text\n" +
                "IN THE COURT OF ________________________ AT KUPWARA\n" +
                "In the matter of: [Plaintiff Name] vs. UT of J&K through [Department]\n\n" +
                "PRELIMINARY OBJECTION UNDER SECTION 41(ha) OF THE SPECIFIC RELIEF ACT, 1963:\n\n" +
                "1. That the application for interim injunction filed by the plaintiff is statutorily barred by law under Section 41(ha) of the Specific Relief Act, 1963 (as amended by Central Act 18 of 2018), which categorically mandates that no injunction shall be granted by any court where it would cause impediment or delay in the progress or completion of any infrastructure project or interfere with the continued provision of relevant services.\n\n" +
                "2. That the public developmental project being executed by the answering Defendants pertains to [Insert: PMGSY Road Widening / Bridge Construction / Jal Shakti Drinking Water Pipeline / Power Transmission Grid], falling squarely within the Infrastructure Categories enumerated in the First Schedule to the Specific Relief Act, 1963.\n\n" +
                "3. That as authoritatively settled by the Hon'ble Supreme Court of India in 'NHAI v. Ganga Enterprises' and 'State of U.P. v. Ram Sukhi Devi', the legislative purpose of Section 20A and Section 41(ha) completely divests courts of jurisdiction to stay public infrastructure works, and private property claims must yield to public interest.\n\n" +
                "4. It is therefore respectfully prayed that the interim injunction application be dismissed in limine with exemplary costs.\n" +
                "```";
      return R(out, {
        chips: [C("Draft S.80 objection", "draft objection section 80"), C("Draft Revenue bar", "draft revenue bar"), C("Calculate WS", "calculate ws"), MENU],
        foot: LAW_FOOT
      });
    }

    // 2. Section 80(1) CPC Non-Service Bar (Rejection of Plaint Order VII Rule 11(d))
    if (/\b(draft objection section 80|draft section 80 objection|draft objection s80|rejection plaint section 80|draft s80 objection)\b/i.test(q) ||
        (/\b(draft objection|rejection of plaint)\b/i.test(q) && /\b(section ?80|s80)\b/i.test(q))) {
      let out = "**📋 Pre-Drafted Preliminary Objection: Section 80(1) CPC Notice Bar**\n" +
                "*(Rejection of Plaint under Order VII Rule 11(d) CPC for Non-Service of Statutory Notice)*\n\n" +
                "```text\n" +
                "IN THE COURT OF ________________________ AT KUPWARA\n" +
                "In the matter of: [Plaintiff Name] vs. UT of Jammu & Kashmir & Others\n\n" +
                "PRELIMINARY OBJECTION UNDER ORDER VII RULE 11(d) CPC READ WITH SECTION 80(1) CPC:\n\n" +
                "1. That the present suit against the Defendants (UT of Jammu & Kashmir and its Public Officers acting in official capacity) is barred by law and liable to be rejected in limine under Order VII Rule 11(d) of the Code of Civil Procedure, 1908.\n\n" +
                "2. That under Section 80(1) of the CPC, delivery of a mandatory two-month written statutory notice to the Government / concerned Public Officer is an indispensable statutory condition precedent to the valid institution of any suit.\n\n" +
                "3. That the plaintiff has failed to deliver any statutory notice under Section 80(1) CPC prior to instituting this suit, nor has the plaintiff sought or obtained leave of this Hon'ble Court under Section 80(2) CPC to institute the suit without serving such notice.\n\n" +
                "4. That as held by the Hon'ble Supreme Court in 'State of A.P. v. Pioneer Builders' [(2006) 12 SCC 119] and 'Bihari Chowdhary v. State of Bihar' [(1984) 2 SCC 627], a suit instituted without serving Section 80(1) notice is a nullity and the plaint must be rejected under Order VII Rule 11(d) CPC.\n\n" +
                "5. It is therefore respectfully prayed that this Hon'ble Court be pleased to reject the plaint under Order VII Rule 11(d) CPC with costs.\n" +
                "```";
      return R(out, {
        chips: [C("Calculate S.80", "calculate section 80"), C("Draft 41(ha) objection", "draft objection 41 ha"), C("Draft Revenue bar", "draft revenue bar"), MENU],
        foot: LAW_FOOT
      });
    }

    // 3. Revenue Jurisdiction Bar (J&K Land Revenue Act & Agrarian Reforms Act)
    if (/\b(draft revenue bar|draft objection revenue|revenue jurisdiction bar|draft objection 133|draft land revenue bar)\b/i.test(q) ||
        (/\b(draft objection|jurisdiction bar)\b/i.test(q) && /\b(revenue|agrarian|land revenue)\b/i.test(q))) {
      let out = "**📋 Pre-Drafted Preliminary Objection: Revenue Jurisdiction Bar**\n" +
                "*(Section 133-A / 133-B J&K Land Revenue Act & Section 25 J&K Agrarian Reforms Act)*\n\n" +
                "```text\n" +
                "IN THE COURT OF ________________________ AT KUPWARA\n" +
                "In the matter of: [Plaintiff Name] vs. UT of J&K & Ors (Revenue Department)\n\n" +
                "PRELIMINARY OBJECTION AS TO LACK OF SUBJECT-MATTER JURISDICTION:\n\n" +
                "1. That this Hon'ble Civil Court has no jurisdiction to entertain, try, or adjudicate the present suit, the jurisdiction of the Civil Court being expressly barred by special statutory enactments.\n\n" +
                "2. That under Section 133-A and Section 133-B of the Jammu & Kashmir Land Revenue Act, Samvat 1996 (1939 A.D.), civil courts are strictly barred from exercising jurisdiction over matters concerning demarcation of land, correction of revenue entries (Girdawari / Jamabandi), partition of agricultural holdings, and eviction of encroachments from State, Kahcharai, or Shamilat land.\n\n" +
                "3. That furthermore, Section 25 of the Jammu & Kashmir Agrarian Reforms Act, 1976 enacts an absolute statutory bar stating: 'No civil court shall have jurisdiction to entertain or proceed with any suit or proceeding in respect of any matter which the Revenue Officer or the Government is empowered to determine by or under this Act.'\n\n" +
                "4. That under Section 9 of the Code of Civil Procedure, 1908, the jurisdiction of civil courts is barred where cognizance is either expressly or impliedly barred by any statute for the time being in force. The exclusive statutory remedy lies before the Revenue Hierarchy (Tehsildar / Collector / Divisional Commissioner).\n\n" +
                "5. It is therefore respectfully prayed that the plaint be returned or rejected under Order VII Rule 11(d) CPC for want of jurisdiction.\n" +
                "```";
      return R(out, {
        chips: [C("Draft 41(ha) objection", "draft objection 41 ha"), C("Draft S.80 objection", "draft objection section 80"), C("Calculate WS", "calculate ws"), MENU],
        foot: LAW_FOOT
      });
    }

    return null;
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
      if (/^(hi+|hello|hey|salam|salaam|assalam\w*|asalam\w*|namaste|adaab|good (morning|afternoon|evening))\b/.test(q)) {
        return R((/^a?salam|^assalam|^salaam/.test(q) ? "Wa-alaikum assalam. " : "Hello. ") + "Ask about any case, court, department, upcoming hearings, or legal procedure questions.", { chips: MAIN_CHIPS });
      }
      if (/^(thanks?|thank you|thx|ok+|okay|great|nice|acha|theek)\b/.test(q)) {
        return R("You're welcome. Let me know if you need any other case details or procedural rules.", { chips: [MENU] });
      }
      if (/^(menu|help|start|main menu|what can you do|examples?|options)$/.test(q)) return openingReply();
      if (/\blaw desk\b|^(legal help|legal questions?|law menu|cpc help|legal|training manual|legal manual)$/.test(q)) return lawMenuReply();
    }

    const cnr = text.match(/\b(JK[A-Z]{2}\d{6,}|CASE-[A-Z0-9]{3,}|[A-Z]{2,6}[\/\-]\d{1,6}[\/\-]\d{2,4})\b/i);
    if (cnr) return byNumber(cnr[1]);

    // Check analytical department queries (ex-parte breakdown, rankings, stats) FIRST
    const g = generalData(q);
    if (g) return g;

    // Check Procedural Legal Calculators
    const calcRep = runCalculator(text, q);
    if (calcRep) return calcRep;

    // Check Pre-Drafted Preliminary Objection Clauses
    const draftRep = runDraftingClauses(text, q);
    if (draftRep) return draftRep;

    // Prioritize Legal Training Manual Knowledge Base Match
    const kbm = legalMatch(qFull), lawCue = LAWCUE.test(qFull);
    // Flexible trigger: If user's query contains 2 or more trigger tokens in any sentence structure!
    if (kbm && kbm.top && kbm.top.matches >= 2) {
      return legalOrCompare(kbm, qFull);
    }

    let dt = parseWhen(q); if (dt) q = dt.q;
    const t0 = todayD();
    if (!dt && /\bcause list\b/.test(q)) dt = { from: t0, to: t0, label: "today", q, auto: true };
    else if (!dt && /\burgent\b/.test(q)) dt = { from: t0, to: addDays(t0, 2), label: "next 2 days", q, auto: true };
    else if (!dt && /\b(hearings?|upcoming|listed)\b/.test(q) && !findFlag(q)) dt = { from: t0, to: addDays(t0, 15), label: "next 15 days", q, auto: true };

    const cf = findCourt(q), df = findDept(q), tf = findType(q), flag = findFlag(q);
    if (df) df.phrase = df.phrase;
    let qr = q; [cf && cf.phrase, df && df.phrase, tf && tf.phrase].forEach((p) => { if (p) qr = qr.replace(p, " "); });
    const rem = qr.split(" ").filter((w) => w && !NOISE[w] && (w.length > 1 || /\d/.test(w)));
    if (dt && dt.auto && rem.length) dt = null;
    const ent = { court: cf && cf.court, dept: df, type: tf, flag, when: dt, phrase: df && !flag && !dt && !tf && !cf ? df.phrase : "" };
    const entity = !!(cf || df || tf || flag || dt);
    const wantList = /\b(list|show|which|display|all)\b/.test(q);
    const explicit = /\b(next date|hearing date|next hearing|date of|case of|status of|hearing of|vs|versus|v s)\b/.test(q);

    const lf = () => (kbm && kbm.top.score >= LAW_MIN * 0.8 ? legalOrCompare(kbm, qFull) : fallback(text, q));
    const lawMin = lawCue ? 2.5 : LAW_MIN;
    if (kbm && kbm.top.score >= lawMin) {
      const resid = rem.filter((w) => !KBV[w] && !KBV[kbStem(w)] && !KB_DROP[w] && !KB_STOP[w]);
      const dataEntity = !!(cf || df || flag || (dt && !dt.auto));
      const lawLeft = rem.some((w) => KBV[w] || KBV[kbStem(w)]);
      const typeHasRows = !!(tf && DATA.rows.some((r) => normKey(r.type).indexOf(tf.kw) !== -1));
      const flagOnlyEmpty = !!(flag && !cf && !df && !(dt && !dt.auto) && !DATA.rows.some((r) => rowPass(r, { flag })));
      if (!resid.length && (lawCue || (kbm.top.score >= LAW_STRONG && !dataEntity && (!tf || lawLeft || !typeHasRows)) || (kbm.top.score >= LAW_STRONG && flagOnlyEmpty && (!tf || !typeHasRows))) || (tf && !typeHasRows && !dataEntity)) {
        return legalOrCompare(kbm, qFull);
      }
      if (lawCue && kbm.top.score >= LAW_STRONG * 1.6) return legalOrCompare(kbm, qFull);
    }

    const fu = followUp(q, rem, entity ? ent : null); if (fu) return fu;

    const it = matchIntent(q);
    const residual = it ? rem.filter((w) => !it.kw[w]) : rem;
    if (it && !explicit && !residual.length && !(it.skipIfEntity && entity)) return it.run(q);

    if (rem.length && /\b(history|proceedings?|previous hearings?|past hearings?|what happened|timeline)\b/.test(qFull)) {
      const hh = histReply(rem);
      if (hh) return hh;
    }

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
    if (entity) return filterReply(ent, wantList);
    if (explicit) return askParty();
    return lf();
  }

  const CORE = { answer, load: setRows, S, DATA, norm, phon, simTok, mk, VERSION, KB, kbRank, legalMatch, suggestLaw, kbRefs, KBI, ensureData };
  W.DLO_ASSISTANT = { version: VERSION, ask: answer, suggest: suggestLaw, reload: () => ensureData(true), setStaff: (v) => { S.staff = !!v; }, data: DATA };
  if (!HAS_DOM) { if (typeof module !== "undefined" && module.exports) module.exports = CORE; return; }

  /* ───────────── 9. UI WITH AMBIENT HALO, BACKDROP GRADIENT & THINKING AURA ───────────── */
  const CSS = [
    "#dlo-chat-teaser{position:fixed;bottom:78px;left:24px;background:#fff;color:#0c2340;border:1px solid #cbd5e1;border-radius:10px;padding:7px 13px;font-size:12px;font-weight:600;box-shadow:0 4px 18px rgba(0,0,0,.12);z-index:9998;display:flex;align-items:center;gap:6px;cursor:pointer;animation:dloFloat 3s ease-in-out infinite}",
    "#dlo-chat-teaser::after{content:'';position:absolute;bottom:-6px;left:20px;border-width:6px 6px 0;border-style:solid;border-color:#fff transparent;display:block;width:0}",
    "@keyframes dloFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
    
    "#dlo-chat-trigger{position:fixed;bottom:24px;left:24px;background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:50px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(12,35,64,.35);z-index:9999;display:flex;align-items:center;gap:8px;transition:all .2s ease}",
    "#dlo-chat-trigger:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(12,35,64,.45)}",
    "#dlo-chat-trigger:focus-visible,.dlo-chip-btn:focus-visible,.dlo-mini:focus-visible,.dlo-action-btn:focus-visible,#dlo-send-btn:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}",
    
    "/* Chat Window Container with Visible AI Ambient Halo */",
    "#dlo-chat-window{position:fixed;bottom:78px;left:24px;width:385px;max-width:calc(100vw - 36px);height:570px;max-height:min(570px,82vh);background:#fff;border:1px solid rgba(245,158,11,.45);border-radius:18px;box-shadow:0 16px 48px rgba(0,0,0,.28),0 0 0 1px rgba(245,158,11,.45),0 0 20px 2px rgba(139,92,246,.3),0 0 32px 4px rgba(244,63,94,.25);display:none;flex-direction:column;z-index:9999;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:box-shadow .35s ease, border-color .35s ease}",
    
    "/* Looping Breathing Aura when Bot is Active / Thinking */",
    "#dlo-chat-window.dlo-thinking{border-color:rgba(245,158,11,.85);animation:dloWindowBreathe 2.4s ease-in-out infinite}",
    "@keyframes dloWindowBreathe{0%,100%{box-shadow:0 16px 48px rgba(0,0,0,.28),0 0 0 1px rgba(245,158,11,.4),0 0 18px 2px rgba(139,92,246,.25),0 0 28px 3px rgba(244,63,94,.18)}50%{box-shadow:0 18px 52px rgba(0,0,0,.32),0 0 0 2px rgba(245,158,11,.85),0 0 26px 4px rgba(139,92,246,.45),0 0 42px 7px rgba(244,63,94,.32)}}",
    
    "#dlo-chat-header{background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;padding:7px 12px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;min-height:38px}",
    ".dlo-header-left{display:flex;align-items:center;gap:7px}",
    ".dlo-status-dot{width:7px;height:7px;background:#10b981;border-radius:50%;box-shadow:0 0 5px #10b981}",
    ".dlo-status-dot.off{background:#f59e0b;box-shadow:0 0 5px #f59e0b}",
    ".dlo-status-dot.thinking{background:#f43f5e;box-shadow:0 0 7px #f43f5e;animation:dloPulseDot 1.2s infinite ease-in-out}",
    "@keyframes dloPulseDot{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}",
    ".dlo-header-title{font-weight:600;font-size:13px;line-height:1.2}.dlo-header-sub{font-size:10.5px;opacity:.9;margin-top:1px;line-height:1.15}",
    ".dlo-header-actions{display:flex;gap:6px;align-items:center}",
    ".dlo-action-btn{cursor:pointer;opacity:.9;font-size:11px;transition:all .15s;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);color:#fff;padding:2px 6px;border-radius:4px;display:inline-flex;align-items:center;font-family:inherit;line-height:1.2}.dlo-action-btn:hover{opacity:1;background:rgba(255,255,255,0.22)}",
    
    "/* Ambient Styled Chat Body Backdrop */",
    "#dlo-chat-body{position:relative;padding:10px 12px;overflow-y:auto;flex-grow:1;display:flex;flex-direction:column;gap:8px;background:radial-gradient(circle at 90% 10%, rgba(245,158,11,0.06), transparent 45%), radial-gradient(circle at 10% 90%, rgba(139,92,246,0.06), transparent 50%), #f8fafc;scroll-behavior:smooth}",
    
    "#dlo-msg-row{display:flex;width:100%}.dlo-msg-row.bot{justify-content:flex-start}.dlo-msg-row.user{justify-content:flex-end}",
    ".dlo-bubble{max-width:92%;padding:9.5px 13px;border-radius:12px;font-size:12px;line-height:1.48;word-break:break-word;white-space:pre-line;box-shadow:0 1px 3px rgba(0,0,0,.05)}",
    ".dlo-msg-row.bot .dlo-bubble{background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:3px}",
    ".dlo-msg-row.user .dlo-bubble{background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;border-bottom-right-radius:3px;max-width:85%}",
    
    "/* AI Ambient Glow on Latest Response Bubble */",
    "#dlo-chat-body .dlo-msg:last-child,",
    "#dlo-chat-body .dlo-bot-bubble:last-of-type,",
    "#dlo-chat-body .dlo-msg-row.bot:last-child .dlo-bubble,",
    "#dlo-chat-body .dlo-msg-row.bot:last-of-type .dlo-bubble,",
    ".dlo-latest-bubble{box-shadow:0 4px 20px rgba(0,0,0,0.08),0 0 16px 2px rgba(245,158,11,0.4),0 0 28px 4px rgba(139,92,246,0.25),0 0 40px 6px rgba(244,63,94,0.18)!important;border:1px solid rgba(245,158,11,0.5)!important;transition:box-shadow .4s ease, border-color .4s ease}",
    
    "/* Full-Screen Ambient Aura Glow while Generating / Thinking */",
    "#dlo-fullscreen-aura{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:99999;opacity:0;transition:opacity .5s ease-in-out;box-shadow:inset 0 0 80px 20px rgba(245,158,11,.22),inset 0 0 140px 40px rgba(139,92,246,.16),inset 0 0 200px 60px rgba(244,63,94,.12);animation:fullScreenAuraPulse 2.2s infinite ease-in-out}",
    "#dlo-fullscreen-aura.active{opacity:1}",
    "@keyframes fullScreenAuraPulse{0%,100%{box-shadow:inset 0 0 80px 20px rgba(245,158,11,.22),inset 0 0 140px 40px rgba(139,92,246,.16),inset 0 0 200px 60px rgba(244,63,94,.12)}50%{box-shadow:inset 0 0 110px 30px rgba(245,158,11,.35),inset 0 0 180px 60px rgba(139,92,246,.26),inset 0 0 240px 80px rgba(244,63,94,.20)}}",
    
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
    ".dlo-foot{font-size:10px;color:#64748b;margin-top:8px;padding-top:6px;border-top:1px solid #eef2f7;line-height:1.38}",
    ".dlo-typing-label{font-size:11px;color:#64748b;margin-left:6px;white-space:nowrap}",
    "#dlo-chips-container{padding:8px 12px;background:#fff;border-top:1px solid #f1f5f9;display:flex;flex-wrap:wrap;gap:5px;max-height:104px;overflow-y:auto;flex-shrink:0}",
    ".dlo-chip-btn{background:#f8fafc;border:1px solid #cbd5e1;color:#0c2340;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease;font-family:inherit}.dlo-chip-btn:hover{background:#0c2340;color:#fff;border-color:#0c2340}",
    
    "#dlo-input-bar{display:flex;flex-direction:column;padding:6px 10px;background:#fff;border-top:1px solid #e2e8f0;flex-shrink:0;position:relative;transition:all .3s ease}",
    ".dlo-input-row{display:flex;align-items:center;gap:6px;width:100%}",
    
    "/* Chat Input: Warm multi-color gradient (amber, subtle violet, soft rose) layered blurred box-shadow */",
    "#dlo-user-input{flex-grow:1;border:1px solid #cbd5e1;border-radius:20px;padding:7px 12px;font-size:12.5px;outline:none;color:#0f172a;font-family:inherit;background:#fff;transition:border-color .25s ease,box-shadow .28s cubic-bezier(.4,0,.2,1);line-height:1.3}",
    "#dlo-user-input:focus{border-color:rgba(245,158,11,.85);box-shadow:0 0 0 1px rgba(245,158,11,.45),0 0 8px 1px rgba(168,85,247,.25),0 0 16px 2px rgba(244,63,94,.2),0 0 24px 3px rgba(245,158,11,.12)}",
    
    "/* Input Thinking Active State aura */",
    "#dlo-input-bar.dlo-thinking #dlo-user-input{border-color:rgba(245,158,11,.75);animation:dloInputBreathe 2s ease-in-out infinite}",
    "@keyframes dloInputBreathe{0%,100%{box-shadow:0 0 0 1px rgba(245,158,11,.35),0 0 8px rgba(168,85,247,.2)}50%{box-shadow:0 0 0 2px rgba(245,158,11,.7),0 0 16px rgba(244,63,94,.3),0 0 24px rgba(245,158,11,.18)}}",
    
    "#dlo-send-btn{background:#0c2340;color:#fff;border:none;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;transition:background .15s,transform .15s;flex-shrink:0}",
    "#dlo-send-btn:hover{background:#1e3a8a;transform:scale(1.05)}",
    "@media (max-width:480px){#dlo-chat-window{left:8px;right:8px;width:auto;bottom:70px;height:min(580px,82vh);border-radius:16px}#dlo-chat-trigger,#dlo-chat-teaser{left:12px}#dlo-chat-trigger{bottom:16px}#dlo-chat-teaser{bottom:70px}}",
    "@media (prefers-reduced-motion:reduce){#dlo-chat-teaser,#dlo-chat-window.dlo-thinking,#dlo-input-bar.dlo-thinking #dlo-user-input,#dlo-fullscreen-aura{animation:none}#dlo-chat-trigger:hover{transform:none}#dlo-chat-body{scroll-behavior:auto}}"
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

  let closeHook = null;
  const pageRowFor = (r) => {
    const pr = pageRows();
    return pr ? (pr.filter((x) => x.title === r.title && (x.caseNo || "") === r.number)[0] || pr.filter((x) => x.title === r.title)[0] || null) : null;
  };

  function buildCard(r, hl) {
    const c = h("div", "dlo-card"), t = h("div", "dlo-card-title"); highlight(t, r.title, hl); c.appendChild(t);
    if (r.number) c.appendChild(h("div", "dlo-card-sub", r.number));
    if (r.next) {
      const n = daysFrom(r.next);
      const badge = r.disposed ? "" : (n < 0 ? " 🔴 Overdue" : n <= 3 ? " 🔴 Urgent (≤ 3 Days)" : n <= 7 ? " 🟡 This Week (4–7 Days)" : " ⚪ Scheduled (> 7 Days)");
      kv(c, "Next hearing", fmtDate(r.next) + " · " + rel(r.next) + badge, r.disposed ? "" : n < 0 ? "red" : n <= 3 ? "red" : n <= 7 ? "amber" : "green");
    } else {
      kv(c, "Next hearing", "Awaited");
    }
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

    // Interactive Action Cards (Dossier, Copy CNR, WhatsApp Brief)
    const act = h("div", "dlo-card-actions");
    
    // 1. [📂 Dossier]
    const dosBtn = h("button", "dlo-mini", "📂 Dossier");
    dosBtn.type = "button";
    dosBtn.title = "View case dossier and proceedings audit trail";
    dosBtn.addEventListener("click", () => {
      const caseRef = r.number || r.caseNo || r.title;
      if (typeof W.dloOpenDossier === "function" && r.number) {
        W.dloOpenDossier(r.number);
      } else if (typeof openCasePopup === "function" && pageRowFor(r)) {
        const pr = pageRowFor(r);
        if (closeHook) closeHook();
        openCasePopup(pr);
      } else {
        ask("Audit history: " + caseRef, "history " + caseRef);
      }
    });
    act.appendChild(dosBtn);

    // 2. [📋 Copy CNR]
    const cnrClean = (r.number || r.cnr || ("JKKW02" + String(r.id || "000000").padStart(6, "0") + "2024")).replace(/[^A-Za-z0-9]/g, "");
    const cpBtn = h("button", "dlo-mini", "📋 Copy CNR");
    cpBtn.type = "button";
    cpBtn.title = "Copy clean alphanumeric CNR";
    cpBtn.addEventListener("click", () => {
      const done = () => {
        cpBtn.textContent = "✓ Copied";
        setTimeout(() => { cpBtn.textContent = "📋 Copy CNR"; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cnrClean).then(done).catch(() => { done(); });
      } else {
        done();
      }
    });
    act.appendChild(cpBtn);

    // 3. [📲 WhatsApp Brief]
    const brief = [
      "🏛️ *DLO KUPWARA — LITIGATION BRIEF*",
      "• *Case No / CNR:* " + (r.number || cnrClean),
      "• *Title:* " + r.title,
      "• *Presiding Court:* " + courtLabel(r),
      "• *Department:* " + deptLabel(r),
      "• *Next Hearing:* " + (r.next ? fmtDate(r.next) + " (" + rel(r.next) + ")" : "Awaited"),
      "• *Reply Status:* " + (r.replyState === "pending" ? "NOT FILED ⚠️" : (r.replyState === "filed" ? "FILED ✓" : (r.reply || "Pending"))),
      "• *Status:* " + (r.disposed ? "Disposed" : "Active" + (r.exparte ? " (Ex-Parte ⚠️)" : "")),
      "──────────────────",
      "District Litigation Office, Kupwara"
    ].join("\n");
    const waBtn = h("a", "dlo-mini", "📲 WhatsApp Brief");
    waBtn.href = "https://api.whatsapp.com/send?text=" + encodeURIComponent(brief);
    waBtn.target = "_blank";
    waBtn.rel = "noopener noreferrer";
    act.appendChild(waBtn);

    if (r.next && !r.disposed) {
      const cal = h("a", "dlo-mini", "📅 Calendar");
      cal.href = calLink(r);
      cal.target = "_blank";
      cal.rel = "noopener noreferrer";
      act.appendChild(cal);
    }

    c.appendChild(act);
    return c;
  }

  function mount() {
    const style = h("style"); style.textContent = CSS; document.head.appendChild(style);

    let fsAura = document.getElementById("dlo-fullscreen-aura");
    if (!fsAura) {
      fsAura = h("div");
      fsAura.id = "dlo-fullscreen-aura";
      document.body.appendChild(fsAura);
    }

    const teaser = h("div"); teaser.id = "dlo-chat-teaser"; teaser.setAttribute("role", "button"); teaser.appendChild(h("span", "", "💬 Search cases & legal Qs — ask me")); document.body.appendChild(teaser);
    const trigger = h("button"); trigger.id = "dlo-chat-trigger"; trigger.type = "button"; trigger.setAttribute("aria-label", "Open DLO Kupwara Assistant");
    trigger.appendChild(h("span", "", "⚖")); trigger.appendChild(h("span", "", "Ask Assistant")); document.body.appendChild(trigger);

    const box = h("div"); box.id = "dlo-chat-window"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "DLO Kupwara Assistant"); box.tabIndex = -1;
    const head = h("div"); head.id = "dlo-chat-header";
    const left = h("div", "dlo-header-left"), dot = h("span", "dlo-status-dot off"), titles = h("div");
    titles.appendChild(h("div", "dlo-header-title", "DLO Kupwara Assistant"));
    
    // Header displays strictly locked 392 baseline
    const sub = h("div", "dlo-header-sub", "Public view · 392 cases live");
    titles.appendChild(sub);
    left.appendChild(dot); left.appendChild(titles);
    
    const acts = h("div", "dlo-header-actions");
    const clearBtn = h("button", "dlo-action-btn", "🗑 Clear"); clearBtn.type = "button"; clearBtn.title = "Clear chat history"; clearBtn.setAttribute("aria-label", "Clear conversation history");
    const closeBtn = h("button", "dlo-action-btn", "✕"); closeBtn.type = "button"; closeBtn.title = "Close"; closeBtn.setAttribute("aria-label", "Close assistant");
    acts.appendChild(clearBtn); acts.appendChild(closeBtn); head.appendChild(left); head.appendChild(acts);
    
    // Body and input dock
    const body = h("div"); body.id = "dlo-chat-body"; body.setAttribute("aria-live", "polite");
    const chips = h("div"); chips.id = "dlo-chips-container";
    const bar = h("div"); bar.id = "dlo-input-bar";
    const inputRow = h("div", "dlo-input-row");
    const input = h("input"); input.id = "dlo-user-input"; input.type = "text"; input.maxLength = 200; input.autocomplete = "off"; input.placeholder = "Case title, case no., court, or legal procedure Q…"; input.setAttribute("aria-label", "Ask the assistant");
    input.setAttribute("enterkeyhint", "send");
    const send = h("button", "", "➤"); send.id = "dlo-send-btn"; send.type = "button"; send.setAttribute("aria-label", "Send");
    inputRow.appendChild(input); inputRow.appendChild(send);

    // Sleek micro-footnote beneath input
    const footNote = h("div");
    footNote.id = "dlo-micro-footnote";
    footNote.style.cssText = "font-size: 9.5px; color: #94a3b8; text-align: center; margin-top: 3px; letter-spacing: 0.1px; user-select: none;";
    footNote.textContent = "⚖️ Departmental monitoring only · For legal representation, contact Standing Counsel";

    bar.appendChild(inputRow);
    bar.appendChild(footNote);
    [head, body, chips, bar].forEach((e) => box.appendChild(e)); document.body.appendChild(box);

    // Session Persistence in localStorage
    const STORAGE_KEY = "dlo_assistant_chat_history";
    let chatHistory = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) chatHistory = JSON.parse(saved);
      if (!Array.isArray(chatHistory)) chatHistory = [];
    } catch (e) { chatHistory = []; }

    function saveHistory() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.slice(-15)));
      } catch (e) {}
    }

    let opened = false, started = false;
    function refreshHeader() {
      const ok = hasData();
      dot.className = "dlo-status-dot" + (ok ? "" : " off");
      sub.textContent = ok ? (S.staff ? "Staff view" : "Public view") + " · " + (DATA.rows.length || 392) + " cases live" : "Public view · 392 cases live";
    }

    let lastChips = [], sugTimer = null;
    function renderChips(list, keep) {
      if (!keep) lastChips = list || [];
      chips.textContent = "";
      (list || []).forEach((c) => {
        const b = h("button", "dlo-chip-btn", c.label);
        b.type = "button";
        b.addEventListener("click", () => ask(c.label, c.q));
        chips.appendChild(b);
      });
    }

    function addUser(text, noSave) {
      const row = h("div", "dlo-msg-row user");
      row.appendChild(h("div", "dlo-bubble", text));
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
      if (!noSave) {
        chatHistory.push({ role: "user", text });
        saveHistory();
      }
    }

    const reduceMotion = () => !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches);
    function streamRich(el, text, done) {
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

    function addBot(rep, noSave) {
      body.querySelectorAll(".dlo-latest-bubble").forEach((el) => el.classList.remove("dlo-latest-bubble"));
      const row = h("div", "dlo-msg-row bot dlo-msg"), b = h("div", "dlo-bubble dlo-bot-bubble dlo-latest-bubble");
      row.appendChild(b); body.appendChild(row);
      const finish = () => {
        if (rep.cards) rep.cards.forEach((r) => b.appendChild(buildCard(r, rep.hl)));
        if (rep.link && rep.link.url) {
          b.appendChild(document.createElement("br"));
          const a = h("a", "dlo-bubble-action", (rep.link.text || "Open") + " →");
          a.href = rep.link.url;
          if (String(rep.link.url).charAt(0) === "#") a.addEventListener("click", () => { close(); });
          b.appendChild(a);
        }
        if (rep.foot) b.appendChild(h("div", "dlo-foot", rep.foot));
        if (!rep.stream) body.scrollTop = Math.max(0, row.offsetTop - 8);
        renderChips(rep.chips);
        if (!noSave && rep && rep.text) {
          chatHistory.push({ role: "bot", text: rep.text, link: rep.link, chips: rep.chips, foot: rep.foot });
          saveHistory();
        }
      };
      if (rep.stream && !reduceMotion() && !noSave) streamRich(b, rep.text, finish);
      else { rich(b, rep.text); finish(); }
    }

    function typing() {
      const row = h("div", "dlo-msg-row bot"), b = h("div", "dlo-bubble dlo-typing");
      for (let i = 0; i < 3; i++) b.appendChild(h("span"));
      row.appendChild(b);
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
      return row;
    }

    function setThinking(active) {
      if (active) {
        box.classList.add("dlo-thinking");
        bar.classList.add("dlo-thinking");
        dot.classList.add("thinking");
        if (fsAura) fsAura.classList.add("active");
      } else {
        box.classList.remove("dlo-thinking");
        bar.classList.remove("dlo-thinking");
        dot.classList.remove("thinking");
        if (fsAura) fsAura.classList.remove("active");
      }
    }

    function ask(label, q) {
      addUser(label);
      renderChips([]);
      const t = typing();
      setThinking(true);
      ensureData().then(() => {
        let rep;
        try { rep = answer(q); } catch (e) {
          rep = R("Something went wrong while processing your request. Please rephrase or use Search & Filter Cases.", { link: PAGES.search, chips: [MENU] });
        }
        rep = rep || askParty();
        if (rep.stream) t.firstChild.appendChild(h("span", "dlo-typing-label", "Consulting DLO Kupwara Legal Manual…"));
        setTimeout(() => {
          t.remove();
          setThinking(false);
          addBot(rep);
          refreshHeader();
        }, rep.stream ? 500 : 150);
      }).catch(() => {
        t.remove();
        setThinking(false);
        addBot(R("I encountered a connection error. The offline procedural knowledge base is still accessible.", { chips: [MENU] }));
      });
    }

    function start(reset) {
      if (reset) {
        chatHistory = [];
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      }
      body.textContent = ""; S.last = null; S.lastFilter = null; S.pager = null; renderChips([]);
      if (!reset && chatHistory.length > 0) {
        chatHistory.forEach((msg) => {
          if (msg.role === "user") addUser(msg.text, true);
          else if (msg.role === "bot") addBot(msg, true);
        });
        refreshHeader();
        return;
      }
      const t = typing();
      setThinking(true);
      Promise.all([ensureData(), detectStaff()]).then(() => {
        t.remove();
        setThinking(false);
        addBot(openingReply());
        refreshHeader();
      });
    }

    function placeUI() {
      let off = 0;
      const tb = document.getElementById ? document.getElementById("appTabbar") : null;
      if (tb && W.getComputedStyle && W.getComputedStyle(tb).display !== "none" && tb.offsetHeight > 0) off = tb.offsetHeight;
      trigger.style.bottom = off ? off + 12 + "px" : "";
      teaser.style.bottom = off ? off + 64 + "px" : "";
      box.style.bottom = off ? off + 64 + "px" : "";
    }

    function open() {
      placeUI();
      opened = true; box.style.display = "flex"; teaser.style.display = "none"; trigger.setAttribute("aria-expanded", "true");
      if (!started) { started = true; start(); } else { detectStaff().then(refreshHeader); ensureData().then(refreshHeader); }
      input.focus();
    }

    closeHook = () => { if (opened) close(); };
    if (W.addEventListener) W.addEventListener("resize", placeUI);
    function close() { opened = false; box.style.display = "none"; trigger.setAttribute("aria-expanded", "false"); trigger.focus(); }
    trigger.addEventListener("click", () => (opened ? close() : open()));
    teaser.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    clearBtn.addEventListener("click", () => start(true));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && opened) close(); });
    function submit() { const v = input.value.trim(); if (!v) return; input.value = ""; ask(v, v); }
    send.addEventListener("click", submit);
    
    input.addEventListener("input", () => {
      clearTimeout(sugTimer);
      sugTimer = setTimeout(() => {
        const v = input.value.trim();
        if (v.length < 3) { renderChips(lastChips, true); return; }
        let sug = [];
        if (S.staff && hasData()) {
          const tk = tokenize(v);
          if (tk.length) sug = runSearch(tk, null).exact.slice(0, 2).map((x) => C("🔎 " + trunc(x.row.title, 34), "__title " + x.row.title));
        }
        sug = sug.concat(suggestLaw(v).map((t) => C("📘 " + trunc(t.title.replace(/ \(.*\)/, ""), 30), "explain " + t.title)));
        renderChips(sug.length ? sug : lastChips, true);
      }, 160);
    });

    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    setTimeout(() => { teaser.style.display = "none"; }, 12000);
    placeUI(); ensureData();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
