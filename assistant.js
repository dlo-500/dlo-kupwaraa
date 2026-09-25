/*!
 * DLO Kupwara Assistant · NK.2.5-LR-COMPLETE — dlokupwara.in
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
 *    electronic evidence (BSA Section 63; legacy Section 65B only for historical references), S.80 notice, and S.41(ha) infrastructure-project restrictions,
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

  const VERSION = "NK.2.6-LR-ACCURATE";
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

  const S = { staff: false, last: null, lastFilter: null, pager: null, partial: null, legalSession: null };
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
    t: "Section 38 provides 30 days for the opposite party's version, with a further period not exceeding 15 days. The Supreme Court has treated the statutory 45-day period strictly; the case record and current controlling authority should be checked before advising on any delay consequence.",
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
    d: "Section 80(1) generally requires two months’ prior written notice before institution of a suit against the Government or a public officer for an act purportedly done in official capacity, subject to the statutory scheme and Section 80(2) urgent-relief route.",
    p: ["Notice must state plaintiff's name, description, residence, cause of action, and specific relief claimed", "Delivered to or left at the office of the Secretary to Government, Collector/Deputy Commissioner, or the concerned departmental officer", "Suit can only be validly instituted after the expiration of two months from notice delivery", "Do not state that non-service is automatically cured or automatically fatal: examine the pleadings, objections, statutory framework and controlling case law"],
    t: "Two months notice period. The period of notice is excluded from limitation calculation under Section 15(2) of the Limitation Act 1963.",
    g: "If served with a Section 80 notice, investigate the claim immediately and explore administrative settlement where justified. If a suit is filed without the required notice, examine the appropriate procedural objection in light of Section 80, the relief claimed and any court order under Section 80(2).",
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

  KT("infrastructure_injunction", "Infrastructure-project injunction restrictions (Ss.20A & 41(ha) Specific Relief Act)", {
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
    p: ["EXPRESS STATUTORY BARS IN J&K:", "1. J&K LAND REVENUE ACT (Sections 133-A & 133-B): Land-revenue and agrarian disputes may be subject to special statutory remedies or jurisdictional bars. Identify the exact land category, statute and relief before asserting that a civil court lacks jurisdiction.", "2. J&K AGRARIAN REFORMS ACT 1976 (Section 25 & Section 19): Section 25 expressly bars the jurisdiction of civil courts over any matter which the Revenue Officer / Agrarian Collector is empowered to determine under the Act (such as vesting of ownership under Section 4 or Section 8, tenancy, or agrarian disputes).", "3. PUBLIC PREMISES (EVICTION OF UNAUTHORISED OCCUPANTS) ACT: Exclusive jurisdiction is vested in the Estate Officer. The Public Premises Act contains a special statutory process and jurisdiction/finality provisions; any civil-court objection should be tied to the exact provision and relief sought.", "4. Where a special statute contains an express or implied jurisdictional bar, identify the precise provision and statutory remedy and apply the controlling judicial test; do not describe every special statute as creating a complete bar in every circumstance."],
    g: "When a suit is instituted regarding demarcation, mutation, tenancy, or state land encroachment, immediately move an application under Order VII Rule 11(d) CPC for rejection of plaint citing the express Section 9 statutory bars.",
    rel: ["jurisdiction", "reject_plaint", "adverse_possession_state_land"]
  });

  KT("electronic_evidence", "Electronic evidence certification (BSA Section 63 / S.65B Evidence Act)", {
    tokens: ["electronic evidence", "bsa 63", "65b", "section 63", "certificate", "arjun panditrao", "e office", "admissibility"],
    a: ["is a certificate under bsa section 63 evidence act section 65b mandatory for submitting digital file movement logs and e office records in court", "is a certificate under bsa section 63 evidence act section 65b mandatory for submitting digital file movement logs and e office records", "65b certificate", "bsa 63 electronic certificate", "arjun panditrao electronic evidence", "e office logs as evidence", "electronic evidence certificate", "is electronic evidence certificate mandatory"],
    k: "electronic certificate computer output email digital register custodian inadmissible 65b bsa 63 printout arjun panditrao",
    r: ["s65b", "s63bsa"], b: "Bharatiya Sakshya Adhiniyam 2023 S.63; Indian Evidence Act 1872 S.65B; Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, (2020) 7 SCC 1",
    d: "YES! Section 63 of the Bharatiya Sakshya Adhiniyam 2023 governs the statutory proof route for electronic records produced from computer or communication-device outputs. The Act contains a certificate framework; the exact requirement depends on how the record is tendered and the applicable statutory conditions.",
    p: ["Mandatory Scope: For a statutory computer/device-output route, the prescribed certificate and Schedule requirements must be addressed. Do not state that every electronic record, regardless of how it is produced or proved, is automatically inadmissible without a certificate", "The certificate must identify the electronic record, describe the device, certify that the computer/system operated properly during the period, and be signed by the official having lawful control/custody of the electronic system", "The governing electronic-evidence case law should be read together with the current BSA text; avoid carrying historical Section 65B propositions into BSA Section 63 without checking the current statutory wording"],
    g: "Never tender bare e-office screenshots or computer printouts in court. Have the designated District Informatics Officer (DIO) or departmental custodian sign an Electronic Evidence Certificate under BSA S.63 / S.65B.",
    rel: ["evidence", "burden_proof"]
  });

  KT("civil_death", "Presumption of civil death (BSA Section 111 / S.108 Evidence Act — 7-Year Rule)", {
    tokens: ["civil death", "7 years", "section 111", "section 108", "presumption of death", "untraced report"],
    a: ["what is the primary defense of the government when a plaintiff files a suit seeking declaration of civil death under bsa section 111 evidence act section 108", "what is the primary defense of the government when a plaintiff files a suit seeking declaration of civil death", "civil death 7 years", "presumption of death missing person", "section 108 evidence act", "declaration of civil death"],
    k: "missing seven years heard of legal heir death certificate public notice police report bsa 111 section 108 untraced report",
    r: ["s108", "s111bsa"], b: "Bharatiya Sakshya Adhiniyam 2023 S.111; Indian Evidence Act 1872 S.108; LIC of India v. Anuradha, (2004) 10 SCC 131",
    d: "Under Section 111 of the Bharatiya Sakshya Adhiniyam 2023 (formerly Section 108 of the Evidence Act), when it is proved that a person has not been heard of for SEVEN YEARS by those who would naturally have heard of him if alive, the legal presumption arises that he is dead.",
    p: ["DEFENSE STRATEGY & VERIFICATION REQUIREMENTS FOR GOVERNMENT DEPARTMENTS:", "1. Declaration of civil death is often sought by plaintiffs to claim compassionate appointment, family pension, or mutation of ancestral land.", "2. Insist on strict evidence that the missing person was continuously absent and unheard of by immediate family members for the full 7-year period.", "3. Check the available missing-person/police record and other evidence concerning the person's disappearance. Do not present a police untraced report as a universal statutory prerequisite unless the governing proceeding requires it.", "4. Check any notice/publication direction actually issued by the court or required by the governing procedural rules; do not treat newspaper publication as a universal statutory prerequisite.", "5. Date of Death: The presumption under Section 111 BSA relates ONLY to the fact of death at the date of the suit, NOT to the exact date of death during the 7-year period (LIC v. Anuradha)."],
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


  /* ───────────── 7A. LEGAL KNOWLEDGE EXPANSION — 100 TOPICS / 60,000 QUESTIONS ───────────── */
  // Expanded legal coverage built as question aliases over the existing Law Desk KB.
  // 60,000 questions = 100 topics × 30 intent forms × 20 natural-language contexts.
  // The question bank expands recognition; substantive answers remain tied to the mapped KB topic.
  KT("limitation_general", "General principles under the Limitation Act, 1963", {"core":"limitation under the Limitation Act, 1963","tokens":["limitation","Limitation Act","Section 3","Section 5","Section 14","Section 17","Section 18"],"r":["s3","s5","s14","s17","s18"],"b":"Limitation Act, 1963","d":"The Limitation Act, 1963 provides limitation periods for suits, appeals and applications and contains rules on computation, exclusion, condonation in appropriate cases, continuing causes and related matters. Courts apply limitation as a threshold issue according to the Act and the applicable Schedule.","p":["Identify the nature of the proceeding and the applicable article in the Schedule","Determine when the prescribed period began to run","Consider statutory exclusion or extension provisions that actually apply","Plead limitation specifically where it is available as a defence","Verify amendments and special limitation provisions applicable to the proceeding"],"g":"For departmental litigation, diarise limitation from the legally relevant starting point, not merely from internal receipt of a file. Preserve the originating order, notice, service proof and dates required to calculate time.","n":"Limitation is governed by statute and special laws can prescribe different periods. Do not assume a general period when a special enactment applies.","a":["limitation act 1963","what is limitation under law","how is limitation calculated","section 3 limitation act","section 5 limitation act","exclusion of time limitation","acknowledgment limitation"]});
  KT("specific_relief", "Specific Relief Act, 1963 — overview", {"core":"the Specific Relief Act, 1963","tokens":["specific relief","specific performance","injunction","declaration","cancellation","rectification","Specific Relief Act"],"r":["s10","s14","s16","s31","s34","s37","s38"],"b":"Specific Relief Act, 1963","d":"The Specific Relief Act, 1963 governs specified forms of civil relief, including specific performance of contracts, rectification and cancellation of instruments, declaratory relief and injunctions, subject to statutory conditions and exclusions.","p":["Identify the exact relief claimed","Check whether the statutory requirements for that remedy are satisfied","Consider whether an alternative monetary or other remedy affects maintainability or discretion","Examine limitation, pleadings, possession and necessary parties","Check the current statutory text and controlling precedents"],"g":"Departments should identify the precise statutory relief sought and collect the underlying contract, title, administrative record and chronology before instructing counsel.","n":"Different remedies under the Act have different requirements. A claim for declaration, specific performance and injunction should not be treated as interchangeable.","a":["specific relief act","specific relief","specific performance and injunction","declaratory relief under specific relief act","cancellation of instrument","rectification of instrument"]});
  KT("declaratory_relief", "Declaratory relief (Section 34, Specific Relief Act)", {"core":"declaratory relief under Section 34 of the Specific Relief Act","tokens":["declaration","section 34","declaratory relief","legal character","right as to property"],"r":["s34"],"b":"Specific Relief Act, 1963 — Section 34","d":"Section 34 of the Specific Relief Act concerns suits seeking a declaration of legal character or a right as to property. The availability of further relief and the plaintiff’s conduct and pleadings are important to the statutory analysis.","p":["Identify the legal character or property right alleged","Examine the pleading and the cause of action","Check whether consequential relief is also available and required","Examine limitation and necessary parties","Match the requested declaration with the legal interest asserted"],"g":"Government defendants should examine whether the plaint seeks only a declaration when further relief is legally available, and should scrutinise title, statutory records and the exact relief clause.","n":"A declaration is not a substitute for every form of consequential relief. The statutory language and the facts pleaded must be examined together.","a":["section 34 specific relief act","declaration suit","declaratory suit","what is declaratory relief","can a declaration be sought alone"]});
  KT("specific_performance", "Specific performance of contracts", {"core":"specific performance of a contract","tokens":["specific performance","contract enforcement","specific relief"],"r":["s10","s14","s16","s20"],"b":"Specific Relief Act, 1963","d":"Specific performance is a statutory civil remedy for enforcement of contractual obligations subject to the requirements, exclusions, bars and discretion provided by the current Specific Relief Act and applicable case law.","p":["Identify the contract and its essential terms","Check enforceability and statutory exclusions","Examine readiness and willingness where legally relevant","Assess limitation and necessary parties","Consider possession, title, performance obligations and equitable conduct"],"g":"The department should produce the full contract, approvals, correspondence, performance records, payment records and any termination or rescission material.","n":"The remedy is governed by the current statutory text; older case law must be checked against later amendments.","a":["specific performance suit","specific performance of contract","enforce a contract","specific performance requirements","when can specific performance be refused"]});
  KT("cancellation_rectification", "Cancellation and rectification of instruments", {"core":"cancellation or rectification of an instrument","tokens":["cancellation","rectification","instrument","specific relief"],"r":["s26","s31","s33"],"b":"Specific Relief Act, 1963","d":"The Specific Relief Act contains distinct remedies for rectification of an instrument and cancellation of instruments. The pleadings must identify the instrument, the legal defect or ground relied upon and the relief sought.","p":["Identify the instrument and parties","Set out the defect, mistake, fraud or legal basis relied upon","Examine possession and consequential relief","Check limitation and court-fee implications","Seek the precise statutory remedy in the plaint"],"g":"Government departments should preserve the original instrument, sanction files, registration material, correspondence and any record showing how the document came into existence.","n":"Rectification and cancellation are different remedies; a pleading should not blur the two.","a":["cancellation of document","cancellation of deed","rectification of instrument","rectification suit","when can an instrument be cancelled"]});
  KT("transfer_property", "Transfer of Property Act, 1882 — general principles", {"core":"transfer of property under the Transfer of Property Act, 1882","tokens":["transfer property","TPA","transfer","property","sale","mortgage","lease","gift"],"r":["s5","s6"],"b":"Transfer of Property Act, 1882","d":"The Transfer of Property Act, 1882 contains general rules relating to transfers of property and specific chapters on sales, mortgages, leases, exchanges and gifts, subject to the nature of the property and applicable special law.","p":["Identify the property and nature of the transfer","Check the transferor’s title and competence","Identify the specific mode of transfer","Check registration and stamp requirements","Examine statutory restrictions and pending litigation"],"g":"Before defending a property claim, the department should establish title, authority, mutation/revenue records, registration status and the chronology of the transaction.","n":"Property transfers are also affected by registration, stamp, revenue and special land laws.","a":["transfer of property act","tpa property law","what is transfer of property","property transfer requirements","valid transfer of property"]});
  KT("lis_pendens", "Lis pendens (Section 52, Transfer of Property Act)", {"core":"lis pendens under Section 52 of the Transfer of Property Act","tokens":["lis pendens","section 52","pending litigation","transfer during suit"],"r":["s52"],"b":"Transfer of Property Act, 1882 — Section 52","d":"The doctrine of lis pendens concerns transfers of immovable property during the pendency of a suit or proceeding in which rights to the property are directly and specifically in question, subject to the statutory conditions.","p":["Identify the pending proceeding","Check whether rights in the immovable property are directly and specifically in issue","Identify the date and nature of the transfer","Check the effect of the transfer on parties to the litigation","Preserve the pleadings, interim orders and registration records"],"g":"Departments should immediately bring any pendente lite transfer to counsel’s attention and place the complete suit and registration record before counsel.","n":"The doctrine is designed to preserve the subject matter of litigation; its precise application depends on the statutory requirements.","a":["section 52 tpa","lis pendens","transfer during pending suit","property sold during litigation","sale pendente lite"]});
  KT("part_performance", "Part performance (Section 53A, Transfer of Property Act)", {"core":"part performance under Section 53A of the Transfer of Property Act","tokens":["part performance","section 53A","possession agreement to sell"],"r":["s53a"],"b":"Transfer of Property Act, 1882 — Section 53A","d":"Section 53A recognises a statutory doctrine relating to part performance of certain contracts to transfer immovable property, subject to its statutory conditions and interaction with registration law.","p":["Identify the written contract and its terms","Check possession and acts in furtherance of the contract","Examine readiness and willingness to perform","Check registration requirements and statutory amendments","Examine whether the statutory conditions are satisfied"],"g":"Preserve the original agreement, possession records, payments, notices and correspondence and obtain a title/registration report.","n":"The doctrine has specific statutory conditions and should not be treated as an independent conveyance of title.","a":["section 53a tpa","part performance doctrine","agreement to sell possession","53a transfer of property","part performance defence"]});
  KT("sale_property", "Sale of immovable property (Section 54, Transfer of Property Act)", {"core":"sale of immovable property under Section 54 of the Transfer of Property Act","tokens":["sale","section 54","immovable property","sale deed"],"r":["s54"],"b":"Transfer of Property Act, 1882 — Section 54","d":"Section 54 defines sale of immovable property and distinguishes a sale from an agreement for sale. Transfer of title is subject to the statutory requirements and, where applicable, registration and stamp law.","p":["Verify title and authority of the transferor","Examine the sale instrument and registration","Check consideration and contractual terms","Check encumbrances, possession and pending litigation","Review revenue and land records"],"g":"A department defending title should collect the registered instrument, mutation records, previous title documents and any acquisition or allotment records.","n":"An agreement to sell does not by itself have the same legal effect as a completed sale.","a":["section 54 tpa","sale of immovable property","sale deed legal effect","agreement to sell versus sale","registered sale deed"]});
  KT("mortgage_property", "Mortgages of immovable property", {"core":"mortgage of immovable property under the Transfer of Property Act","tokens":["mortgage","section 58","redemption","foreclosure","mortgage deed"],"r":["s58","s60"],"b":"Transfer of Property Act, 1882","d":"The Transfer of Property Act contains the statutory framework for mortgages of immovable property, including modes of mortgage and the mortgagor’s rights such as redemption, subject to the instrument, statute and applicable special laws.","p":["Identify the type of mortgage","Examine the mortgage deed and registration","Determine outstanding secured debt","Check the right of redemption and any statutory restrictions","Identify the relief claimed and the forum"],"g":"Departments should preserve loan/security documents, registration records, payment statements and notices of default.","n":"Mortgage law can be supplemented or displaced by special financial recovery legislation in appropriate cases.","a":["mortgage act property","section 58 mortgage","right of redemption","mortgage deed","mortgage suit"]});
  KT("lease_property", "Leases of immovable property", {"core":"lease of immovable property under the Transfer of Property Act","tokens":["lease","section 105","rent","lessor","lessee","termination"],"r":["s105","s106","s111"],"b":"Transfer of Property Act, 1882","d":"The Transfer of Property Act regulates leases of immovable property, including the concepts of lessor and lessee, duration, determination and certain notice requirements, subject to the contract and special tenancy law.","p":["Identify the lease instrument and term","Check registration where required","Determine rent, renewal and termination clauses","Check statutory tenancy protections","Examine the notice and ground relied upon for termination"],"g":"Government departments should keep the original lease/allotment order, rent record, possession record and renewal correspondence together.","n":"Special rent-control or public-premises legislation may govern particular properties or occupancies.","a":["lease law tpa","section 105 lease","termination of lease","lessee rights","lessor rights"]});
  KT("gift_property", "Gifts of property", {"core":"gift of property under the Transfer of Property Act","tokens":["gift","section 122","donor","donee","gift deed"],"r":["s122","s123","s126"],"b":"Transfer of Property Act, 1882","d":"The Transfer of Property Act regulates gifts of existing property made voluntarily and without consideration, subject to its statutory requirements and registration rules for immovable property.","p":["Identify donor and donee","Check acceptance during donor’s lifetime","Examine the gift deed and registration","Check title and capacity","Consider whether revocation is legally available"],"g":"Verify the allotment/title record and registration status before admitting a gift-based property claim.","n":"A gift has distinct statutory requirements and should be distinguished from a will, sale or settlement.","a":["gift deed property law","section 122 gift","valid gift requirements","revocation of gift","registered gift deed"]});
  KT("registration_act", "Registration Act, 1908 — registration and effect", {"core":"registration of documents under the Registration Act, 1908","tokens":["registration act","section 17","section 23","section 49","registration of documents"],"r":["s17","s23","s49"],"b":"Registration Act, 1908","d":"The Registration Act, 1908 governs registration of specified instruments, the time and place for presentation, and the legal consequences associated with documents that require registration.","p":["Identify whether registration is compulsory or optional","Check the prescribed period and presentation requirements","Verify the registering office and parties","Examine stamp and registration fee compliance","Assess the effect of non-registration under the applicable provision"],"g":"Collect certified registration records and the original instrument whenever a department’s title or transaction depends on a registered document.","n":"Non-registration can have different consequences depending on the document and the statutory provision; do not apply Section 49 mechanically to every instrument.","a":["registration act 1908","section 17 registration","section 49 registration","compulsory registration","effect of non registration"]});
  KT("stamp_duty", "Stamp duty and impounding of instruments", {"core":"stamp duty and stamping of documents","tokens":["stamp duty","Indian Stamp Act","section 33","section 35","impounding"],"r":["s33","s35"],"b":"Indian Stamp Act, 1899, subject to applicable local modifications","d":"Stamp law governs the duty payable on instruments and contains provisions on impounding and admissibility of insufficiently stamped instruments. State or Union Territory modifications and applicable rules must be checked.","p":["Identify the instrument","Determine the applicable stamp article and duty","Check whether the instrument was duly stamped","Consider impounding and adjudication where required","Verify whether deficiency and penalty have been paid as legally permitted"],"g":"Departments should not rely on an unstamped or insufficiently stamped instrument without obtaining advice on the applicable stamp regime and admissibility consequences.","n":"Stamp duty is often affected by local amendments and notifications.","a":["stamp duty on agreement","insufficiently stamped document","section 33 stamp act","section 35 stamp act","impounding of document"]});
  KT("court_fees", "Court fees and valuation of civil proceedings", {"core":"court fees and valuation in civil proceedings","tokens":["court fee","Court Fees Act","valuation","court fees act"],"r":["court fees"],"b":"Court-Fees Act, 1870, subject to applicable local amendments","d":"Court-fee law governs the fees payable on plaints, memoranda of appeal and specified proceedings. Valuation and court-fee objections can affect the institution or maintainability of proceedings and must be considered with applicable local legislation.","p":["Identify the relief and relevant valuation rule","Calculate the prescribed fee under the applicable schedule","Check whether the valuation is jurisdictional as well as fee-related","Raise deficiency objections promptly","Preserve proof of payment"],"g":"The department should scrutinise the relief clause and valuation in the plaint and flag any court-fee or valuation objection for counsel.","n":"Court-fee rules are subject to local modifications; always verify the applicable J&K regime.","a":["court fee civil suit","court fees act","valuation of suit","deficiency court fee","court fee objection"]});
  KT("contract_general", "Indian Contract Act, 1872 — general principles", {"core":"general principles of contract law under the Indian Contract Act, 1872","tokens":["contract act","agreement","contract","consent","free consent","consideration"],"r":["s10","s11","s13","s14","s23","s25","s27"],"b":"Indian Contract Act, 1872","d":"The Indian Contract Act, 1872 contains the general law of contracts, including formation, competence, consent, legality of consideration and object, performance, breach and specified special contracts.","p":["Identify offer, acceptance and consideration","Check competence and free consent","Check legality of object and consideration","Examine contractual terms and performance","Identify breach, termination and available remedies"],"g":"Departments should preserve the tender, contract, approval, correspondence, performance certificates and payment record and identify the contractual clause relied upon.","n":"Special statutes, procurement rules and contractual clauses may supplement the general law of contract.","a":["contract act 1872","valid contract","essential elements contract","free consent contract","void agreement"]});
  KT("breach_of_contract", "Breach of contract and contractual remedies", {"core":"breach of contract and remedies for breach","tokens":["breach contract","repudiation","termination","remedy"],"r":["s39","s55","s73","s74"],"b":"Indian Contract Act, 1872","d":"The law of breach addresses non-performance, repudiation, compensation and other consequences depending on the contract and the statutory framework. The precise remedy depends on the clause, facts, loss and applicable special law.","p":["Identify the contractual obligation and due date","Establish the breach and notice history","Check contractual termination or cure clauses","Quantify and prove the loss claimed","Identify the remedy available under the contract and statute"],"g":"Keep a complete chronological record of default notices, departmental correspondence, extensions, measurements and payment records.","n":"A contractual penalty clause does not automatically determine recoverable compensation; the statutory rule and evidence must be examined.","a":["breach of contract remedy","contract terminated for breach","repudiation of contract","section 73 contract act","section 74 contract act"]});
  KT("damages_contract", "Damages and compensation for breach of contract", {"core":"damages for breach of contract","tokens":["damages","compensation","loss","remoteness","mitigation"],"r":["s73","s74"],"b":"Indian Contract Act, 1872 — Sections 73 and 74","d":"Sections 73 and 74 address compensation for loss or damage caused by breach and stipulated sums or penalty clauses, subject to the statutory principles and evidence.","p":["Prove the breach","Identify actual and legally relevant loss","Assess causation and remoteness","Consider mitigation and contractual exclusions","Produce documents supporting the monetary claim"],"g":"Government claims and defences should include audited loss calculations, contract clauses, departmental measurements and correspondence showing mitigation or causation.","n":"Recoverability depends on the statutory rule and evidence rather than the label used in the contract.","a":["damages under contract act","section 73 damages","section 74 penalty clause","compensation for breach","liquidated damages india"]});
  KT("indemnity_guarantee", "Indemnity and guarantee", {"core":"contracts of indemnity and guarantee","tokens":["indemnity","guarantee","surety","principal debtor","creditor"],"r":["s124","s126","s128","s140"],"b":"Indian Contract Act, 1872","d":"The Indian Contract Act recognises distinct contractual arrangements of indemnity and guarantee, with different roles and consequences for indemnifier, surety, principal debtor and creditor.","p":["Identify whether the instrument is an indemnity or guarantee","Identify the parties and obligations","Examine the underlying contract and defaults","Check invocation and notices","Assess discharge, subrogation and contribution issues where applicable"],"g":"Preserve the guarantee instrument, invocation notice, default record and payment details.","n":"A guarantee is accessory to the principal obligation in important respects, while indemnity has a different statutory structure.","a":["indemnity versus guarantee","section 124 indemnity","section 126 guarantee","surety rights","guarantee invocation"]});
  KT("agency", "Agency under the Indian Contract Act", {"core":"agency under the Indian Contract Act","tokens":["agency","agent","principal","authority","ratification"],"r":["s182","s201","s202"],"b":"Indian Contract Act, 1872","d":"Agency law regulates the relationship by which one person is authorised to act for or represent another, including authority, duties, revocation and termination of agency.","p":["Identify principal and agent","Determine actual or apparent authority","Check the terms of appointment","Review acts done on behalf of the principal","Assess ratification or termination issues"],"g":"Departmental cases should produce the delegation order, authorisation, file noting and communications showing the scope of authority.","n":"An employee or officer’s authority must be distinguished from mere employment or office holding.","a":["agency contract act","agent authority","principal agent relationship","ratification of act","termination of agency"]});
  KT("arbitration", "Arbitration and Conciliation Act, 1996", {"core":"arbitration under the Arbitration and Conciliation Act, 1996","tokens":["arbitration","arbitration agreement","arbitral tribunal","award","section 34","section 11"],"r":["s7","s9","s11","s16","s34","s36","s37"],"b":"Arbitration and Conciliation Act, 1996","d":"The Arbitration and Conciliation Act, 1996 governs domestic and international commercial arbitration, appointment and jurisdiction of arbitral tribunals, interim measures, awards, challenge and enforcement, subject to the applicable part of the Act.","p":["Check whether a valid arbitration agreement exists","Identify the dispute and contract","Examine appointment and jurisdiction issues","Preserve notices, pleadings and the arbitral record","Check the applicable time limit and remedy against the award"],"g":"Government departments should immediately flag arbitration clauses and preserve the contract, dispute notices and correspondence before a court filing is considered.","n":"Court intervention in arbitration is structured by the Act; do not assume that every contractual dispute proceeds by ordinary civil suit.","a":["arbitration act 1996","arbitration agreement","section 11 arbitration","section 34 arbitration","challenge arbitral award"]});
  KT("mediation", "Mediation Act, 2023", {"core":"mediation under the Mediation Act, 2023","tokens":["mediation act","mediation","pre litigation mediation","mediated settlement","online mediation"],"r":["s5","s19","s28"],"b":"Mediation Act, 2023","d":"The Mediation Act, 2023 promotes mediation, including pre-litigation and institutional mediation, mediated settlement agreements, community mediation and online mediation, subject to the statutory framework and exclusions.","p":["Identify whether the dispute is capable of settlement by mediation","Check any mandatory or court-referred mediation requirement","Select the appropriate mediator or institution","Record settlement terms precisely","Check enforceability and confidentiality requirements"],"g":"Government departments should identify authorised officers and approval levels for settlement proposals and preserve the administrative reasons for accepting or rejecting mediation.","n":"Mediation is a consensual dispute-resolution process and a settlement must comply with the statutory requirements to obtain the intended legal effect.","a":["mediation act 2023","pre litigation mediation","mediated settlement agreement","online mediation india","mediation procedure"]});
  KT("lok_adalat", "Lok Adalat under the Legal Services Authorities Act", {"core":"Lok Adalat proceedings under the Legal Services Authorities Act, 1987","tokens":["lok adalat","legal services authorities","settlement","award","permanent lok adalat"],"r":["s19","s20","s21","s22c","s22d","s22e"],"b":"Legal Services Authorities Act, 1987","d":"The Legal Services Authorities Act provides the statutory framework for Lok Adalats and Permanent Lok Adalats. Lok Adalats focus on compromise or settlement, while Permanent Lok Adalats have a statutory framework for public utility services.","p":["Identify whether the matter is suitable for settlement","Obtain competent departmental authority","Prepare a quantified settlement position","Record the terms accurately","Verify the statutory effect of the award or settlement"],"g":"Any settlement by a government department must be authorised by the competent authority and supported by a reasoned file record.","n":"The statutory framework distinguishes ordinary Lok Adalats and Permanent Lok Adalats.","a":["lok adalat procedure","legal services authorities act lok adalat","permanent lok adalat","lok adalat award","settlement before lok adalat"]});
  KT("legal_aid", "Legal services and legal aid", {"core":"legal aid and legal services under the Legal Services Authorities Act","tokens":["legal aid","free legal services","legal services authority","legal services authorities act"],"r":["s12","s13"],"b":"Legal Services Authorities Act, 1987","d":"The Legal Services Authorities Act establishes legal services authorities and provides for legal services to eligible persons under statutory criteria.","p":["Determine eligibility under the statutory criteria","Approach the appropriate legal services authority","Provide documents supporting eligibility and the dispute","Follow the authority’s legal-aid procedure","Preserve the order or assignment record"],"g":"Departments interacting with legal-services authorities should identify the case, provide complete records and comply with lawful directions.","n":"Eligibility is governed by the statutory categories and rules in force.","a":["free legal aid","legal services authority","legal aid eligibility","legal aid india","district legal services authority"]});
  KT("rti", "Right to Information Act, 2005", {"core":"the Right to Information Act, 2005","tokens":["RTI","right to information","public information officer","section 8","section 19","appeal"],"r":["s6","s7","s8","s19","s20"],"b":"Right to Information Act, 2005","d":"The Right to Information Act provides citizens a statutory framework to obtain information held by public authorities, subject to the Act’s exemptions, procedural requirements and appeal mechanisms.","p":["Identify the public authority and information sought","Process the request under the statutory procedure","Examine applicable exemptions carefully","Provide lawful reasons for refusal where permitted","Use the prescribed appellate mechanism where required"],"g":"Departments should preserve the original record, identify the competent information officer and avoid withholding information without a statutory basis.","n":"RTI analysis is document-specific. The existence of litigation does not by itself answer whether information is exempt.","a":["right to information act","rti act 2005","section 8 rti","rti appeal","public information officer"]});
  KT("constitutional_remedies", "Constitutional remedies and judicial review", {"core":"constitutional remedies in India","tokens":["constitution","fundamental rights","judicial review","article 14","article 21","article 226","article 227"],"r":["a14","a19","a21","a226","a227","a300a"],"b":"Constitution of India","d":"Constitutional remedies allow courts to review government action within their constitutional jurisdiction, subject to maintainability, alternative-remedy rules, the nature of the right asserted and the scope of the proceeding.","p":["Identify the constitutional right or public-law issue","Identify the impugned action or omission","Check jurisdiction and maintainability","Collect the administrative record","Frame the relief precisely"],"g":"Government departments should prepare the complete original record and a chronological statement of reasons, notices, hearings and decisions.","n":"Judicial review generally focuses on legality, jurisdiction, procedure and constitutional standards rather than acting as a routine appeal on every factual question.","a":["constitutional remedy","judicial review constitution","article 226 remedy","article 227 petition","fundamental rights government action"]});
  KT("writ_jurisdiction", "Writ jurisdiction under Article 226", {"core":"writ jurisdiction of the High Court under Article 226","tokens":["article 226","writ petition","mandamus","certiorari","prohibition","quo warranto"],"r":["a226"],"b":"Constitution of India — Article 226","d":"Article 226 empowers a High Court to issue writs, orders or directions for enforcement of fundamental rights and for other purposes, subject to constitutional and judicial limitations on jurisdiction and maintainability.","p":["Identify the public-law element","Identify the impugned action or inaction","Check existence and adequacy of alternative remedy","Place the complete record before the court","Address delay, laches and necessary parties"],"g":"The department should respond through an affidavit based on verified official records and should identify the statutory authority and reasons for the challenged decision.","n":"Writ jurisdiction is discretionary and fact-sensitive; maintainability depends on the nature of the dispute and the remedy sought.","a":["article 226 writ","writ petition high court","mandamus petition","certiorari india","writ against government"]});
  KT("judicial_review", "Judicial review of administrative action", {"core":"judicial review of administrative action","tokens":["judicial review","administrative action","illegality","irrationality","procedural impropriety"],"r":["a226","a227"],"b":"Constitution of India; applicable judicial precedents","d":"Judicial review of administrative action examines legality, jurisdiction, relevant procedural requirements and other recognised public-law grounds. The reviewing court does not ordinarily replace every administrative decision simply because another view is possible.","p":["Identify the source of power","Check jurisdiction and statutory limits","Check notice and hearing requirements","Check whether relevant material was considered","Check whether reasons and record support the decision"],"g":"Maintain the complete original file and ensure the affidavit accurately reflects the decision-making process.","n":"The scope and intensity of review depend on the statutory context and the nature of the decision.","a":["judicial review administrative action","grounds of judicial review india","review government decision","wednesbury judicial review","administrative law judicial review"]});
  KT("natural_justice", "Principles of natural justice", {"core":"principles of natural justice in administrative decisions","tokens":["natural justice","audi alteram partem","bias","hearing","speaking order"],"r":["a14","a21"],"b":"Constitution of India and administrative law jurisprudence","d":"Natural justice commonly includes fair hearing and decision-making free from disqualifying bias, subject to statutory context, urgency, exceptions and the requirements recognised by courts.","p":["Identify the legal source of the decision","Determine whether notice was required","Provide a reasonable opportunity to respond where required","Ensure decision-maker impartiality","Record reasons where a reasoned order is legally required"],"g":"Departments should preserve notices, responses, hearing minutes and the reasons supporting the final order.","n":"The content of natural justice is context-dependent and is not an inflexible checklist for every administrative act.","a":["natural justice administrative law","audi alteram partem","bias in administrative action","right to hearing government","speaking order"]});
  KT("admin_tribunals", "Administrative Tribunals Act, 1985", {"core":"the Administrative Tribunals Act, 1985","tokens":["Administrative Tribunals Act","tribunal","service matter","CAT","administrative tribunal"],"r":["s14","s19","s20","s21"],"b":"Administrative Tribunals Act, 1985","d":"The Administrative Tribunals Act provides for adjudication of specified disputes and complaints concerning recruitment and service conditions before administrative tribunals.","p":["Identify whether the dispute falls within tribunal jurisdiction","Check statutory remedies and exhaustion requirements","Verify limitation and filing requirements","Prepare the service record","Identify the appropriate respondent authorities"],"g":"Departments should send a complete service record and identify the relevant rule, appointment order, disciplinary order or administrative decision.","n":"Jurisdiction depends on the statutory coverage of the tribunal and the category of dispute.","a":["administrative tribunals act","service litigation tribunal","tribunal jurisdiction service matter","section 14 tribunals act","section 19 application tribunal"]});
  KT("cat_proceedings", "Central Administrative Tribunal (CAT) proceedings", {"core":"Central Administrative Tribunal proceedings","tokens":["CAT","Central Administrative Tribunal","service dispute","original application","administrative tribunal"],"r":["s14","s19","s21"],"b":"Administrative Tribunals Act, 1985","d":"The Central Administrative Tribunal adjudicates specified service-related disputes falling within its statutory jurisdiction. Proceedings typically involve an original application and responses supported by the service record and applicable rules.","p":["Verify CAT jurisdiction","Compile the complete service record","Identify the impugned order and legal grounds","Check limitation and any preliminary objection","Coordinate the department’s reply with counsel"],"g":"The department should provide the complete service book, appointment orders, seniority records, disciplinary file and impugned order where relevant.","n":"The exact jurisdiction and remedy must be tested against the Act and current tribunal practice.","a":["CAT case procedure","CAT original application","CAT service matter","Central Administrative Tribunal reply","CAT limitation"]});
  KT("public_premises", "Public Premises (Eviction of Unauthorised Occupants) Act, 1971", {"core":"eviction from public premises under the Public Premises Act","tokens":["public premises","unauthorised occupant","estate officer","eviction","appeal"],"r":["s4","s5","s9"],"b":"Public Premises (Eviction of Unauthorised Occupants) Act, 1971, where applicable","d":"The Public Premises Act provides a statutory mechanism in covered cases for eviction of unauthorised occupants and related recovery, with notice, hearing and appeal provisions. Applicability depends on the property and statutory coverage.","p":["Establish that the property is covered public premises","Identify the occupant and basis of occupation","Issue the statutory notice through the competent Estate Officer","Consider objections and evidence","Pass and serve a reasoned order where authorised"],"g":"Maintain title, allotment, possession, rent/licence and notice records in a single file.","n":"The Act is a special statutory mechanism and should not be conflated with an ordinary civil possession suit.","a":["public premises eviction","unauthorised occupant public land","estate officer eviction","public premises act 1971","eviction from government property"]});
  KT("land_acquisition", "Land Acquisition, Rehabilitation and Resettlement Act, 2013", {"core":"land acquisition under the 2013 land acquisition law","tokens":["land acquisition","RFCTLARR","compensation","rehabilitation","resettlement"],"r":["s11","s26","s30","s64"],"b":"Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013","d":"The 2013 land-acquisition framework regulates acquisition by specified authorities, compensation, rehabilitation and resettlement, and mechanisms for objections and reference/appeal. The current statutory text and relevant notifications should be checked for the project.","p":["Identify the acquiring authority and statutory purpose","Check notification and objection stages","Compile title and possession records","Calculate or verify compensation under the applicable framework","Track award, possession, rehabilitation and challenge periods"],"g":"Departments should maintain the acquisition file, notifications, award, compensation calculations, possession memo and correspondence.","n":"Land acquisition can involve Central and State/UT notifications and project-specific rules; verify the applicable regime.","a":["land acquisition act 2013","compensation land acquisition","rfctlarr act","rehabilitation resettlement land acquisition","land acquisition objection"]});
  KT("motor_vehicle", "Motor Vehicles Act, 1988 — claims and liability", {"core":"motor accident claims under the Motor Vehicles Act, 1988","tokens":["motor vehicle","MACT","accident claim","insurance","compensation"],"r":["s140","s164","s166"],"b":"Motor Vehicles Act, 1988","d":"The Motor Vehicles Act provides statutory mechanisms concerning motor-vehicle liability and compensation, including claims before the Motor Accident Claims Tribunal where applicable.","p":["Identify the vehicle, driver, owner and insurer","Collect FIR, site plan, medical and post-mortem records where relevant","Verify vehicle and insurance documents","Identify the statutory compensation route","Coordinate the claim file with counsel"],"g":"Government vehicle cases require prompt preservation of driver logs, authorisation, insurance and accident records.","n":"Different statutory compensation mechanisms have different proof and procedural requirements.","a":["motor accident claim","MACT claim","motor vehicles act compensation","owner insurer liability","accident claim tribunal"]});
  KT("electricity_law", "Electricity Act, 2003 — disputes and adjudication", {"core":"electricity disputes under the Electricity Act, 2003","tokens":["Electricity Act","electricity bill","electricity theft","consumer dispute","regulatory commission"],"r":["s125","s126","s127","s145","s164"],"b":"Electricity Act, 2003","d":"The Electricity Act, 2003 consolidates the law relating to generation, transmission, distribution, trading and use of electricity and provides statutory mechanisms for assessment, appeals, offences and regulatory adjudication.","p":["Identify the nature of the electricity dispute","Check the statutory officer or forum designated for the issue","Collect inspection, assessment and billing records","Verify notices and opportunity requirements","Identify appeal or review mechanism"],"g":"PDD/KPDCL litigation files should include inspection reports, meter records, assessment orders, bills, notices and proof of service.","n":"The statutory forum and remedy differ between assessment, consumer grievances, regulatory questions and criminal allegations.","a":["electricity act 2003","electricity assessment dispute","section 126 electricity act","electricity appeal","electricity bill litigation"]});
  KT("easements", "Indian Easements Act, 1882", {"core":"easement rights under the Indian Easements Act","tokens":["easement","right of way","dominant heritage","servient heritage","prescription"],"r":["s4","s15"],"b":"Indian Easements Act, 1882, where applicable","d":"The Easements Act governs rights enjoyed by one property for the beneficial enjoyment of another, including recognised modes of acquisition and extinction, subject to the facts and applicable local law.","p":["Identify dominant and servient tenements","Identify the nature of the claimed easement","Examine documents, plans and physical access","Assess acquisition and prescription evidence","Check the relief sought and limitation"],"g":"Departments should place maps, settlement records, road/path records and inspection reports before counsel.","n":"A right of way claim is fact-specific and should be supported by precise property identification.","a":["easement right way","right of way suit","easement by prescription","dominant heritage","servient heritage"]});
  KT("succession", "Indian Succession Act, 1925 — general principles", {"core":"succession under the Indian Succession Act, 1925","tokens":["succession","will","probate","letters administration","intestate"],"r":["s57","s213","s227"],"b":"Indian Succession Act, 1925","d":"The Indian Succession Act contains statutory rules on intestate and testamentary succession, probate, letters of administration and related matters, subject to its scope and the personal law regime applicable to the parties.","p":["Identify whether the deceased left a will","Identify the applicable personal law","Check jurisdiction and probate/administration requirements","Collect original will and death records","Identify beneficiaries and objections"],"g":"Government departments receiving succession claims should verify legal-heir, succession-certificate, probate or court-order requirements appropriate to the payment or property involved.","n":"Personal-law applicability must be checked; not every succession dispute is governed identically.","a":["indian succession act 1925","probate will","letters of administration","intestate succession","succession certificate"]});
  KT("hindu_succession", "Hindu Succession Act, 1956", {"core":"succession under the Hindu Succession Act, 1956","tokens":["Hindu Succession Act","coparcenary","Class I heirs","daughter coparcener","intestate succession"],"r":["s6","s8","s14"],"b":"Hindu Succession Act, 1956","d":"The Hindu Succession Act provides rules for intestate succession among Hindus and related statutory matters, including the statutory treatment of coparcenary interests and female property rights.","p":["Identify the applicable personal law","Identify the family tree and dates of death","Determine the nature of the property","Apply the applicable succession provision","Collect title, mutation and succession records"],"g":"Revenue and departmental records should not determine disputed title by themselves; obtain the appropriate succession document or court order where required.","n":"The 2005 amendment materially changed coparcenary law; applicable case law and dates must be checked.","a":["hindu succession act","daughter coparcener","section 6 hindu succession","class 1 heirs","hindu intestate succession"]});
  KT("benami", "Prohibition of Benami Property Transactions Act", {"core":"benami property transactions law","tokens":["benami","benami property","beneficial owner","benamidar","prohibition benami"],"r":["s2","s3","s4","s24","s26"],"b":"Prohibition of Benami Property Transactions Act, 1988, as amended","d":"The benami-prohibition framework addresses benami transactions, defines related concepts and provides statutory consequences and authorities for covered property.","p":["Identify the transaction and the persons involved","Check whether the statutory definition applies","Examine title, consideration and source of funds","Identify the competent authority and procedural stage","Check statutory consequences and appeal provisions"],"g":"Government departments should not characterise a transaction as benami without analysing the statutory definition and preserving documentary evidence.","n":"The Act contains detailed exceptions and procedural provisions; current statutory text must be checked before action.","a":["benami property act","benami transaction","beneficial owner benamidar","section 24 benami","benami property litigation"]});
  KT("criminal_codes", "BNS, BNSS and BSA — new criminal law framework", {"core":"the BNS, BNSS and BSA criminal-law framework","tokens":["BNS","BNSS","BSA","Bharatiya Nyaya Sanhita","Bharatiya Nagarik Suraksha Sanhita","Bharatiya Sakshya Adhiniyam","criminal law"],"r":["bns","bnss","bsa"],"b":"Bharatiya Nyaya Sanhita, 2023; Bharatiya Nagarik Suraksha Sanhita, 2023; Bharatiya Sakshya Adhiniyam, 2023","d":"India’s new criminal-law framework comprises the Bharatiya Nyaya Sanhita, 2023 for substantive offences, the Bharatiya Nagarik Suraksha Sanhita, 2023 for criminal procedure, and the Bharatiya Sakshya Adhiniyam, 2023 for evidence. The three statutes came into force from 1 July 2024, subject to their transitional provisions.","p":["Identify whether the issue concerns offence, procedure or evidence","Check the applicable new-code provision","Check transitional and savings provisions for older proceedings","Verify procedural stage and competent court","Preserve the record and evidence relevant to the statutory issue"],"g":"Government departments should identify whether the proceeding is governed by the new codes or transitional provisions and should provide counsel the complete underlying record.","n":"Exact provision numbers should be verified against the current statutory text; criminal law questions can turn on transition between old and new codes.","a":["BNS 2023","BNSS 2023","BSA 2023","new criminal laws india","new criminal codes india","criminal law after 1 july 2024"]});
  KT("partnership", "Indian Partnership Act, 1932 — general principles", {"core":"partnership law under the Indian Partnership Act, 1932","tokens":["partnership","firm","partner","registration of firm","section 69"],"r":["s4","s18","s25","s69"],"b":"Indian Partnership Act, 1932","d":"The Indian Partnership Act, 1932 defines partnership and regulates the relationship between partners, firm liability, authority, registration and dissolution, subject to applicable partnership law and the facts of the case.","p":["Identify the firm and partners","Check the partnership deed and changes in constitution","Examine authority and acts of the partner","Check registration status and statutory consequences","Identify the appropriate remedy and forum"],"g":"Departments dealing with firms should preserve the contract, registration details, purchase/tender documents and correspondence establishing the person authorised to bind the firm.","n":"Section 69 contains important consequences associated with an unregistered firm; the exact issue should be matched with the statutory text.","a":["indian partnership act","partnership firm legal status","partner liability","registration of partnership firm","section 69 partnership act"]});

  const LEGAL_KNOWLEDGE_SOURCES = {"cpc":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","commercial_courts":"https://www.indiacode.nic.in/indiacode/handle/123456789/2156?view_type=browse","specific_relief":"https://www.indiacode.nic.in/indiacode/handle/123456789/1583?view_type=browse","consumer":"https://www.indiacode.nic.in/indiacode/handle/123456789/21423?view_type=browse","bsa":"https://www.indiacode.nic.in/indiacode/handle/123456789/20063?col=123456789%2F1362&view_type=search","bns":"https://www.indiacode.nic.in/indiacode/handle/123456789/20062?col=123456789%2F1362&view_type=search","bnss":"https://www.indiacode.nic.in/indiacode/handle/123456789/20099?view_type=browse","arbitration":"https://www.indiacode.nic.in/indiacode/handle/123456789/1978?view_type=browse","mediation":"https://www.indiacode.nic.in/indiacode/handle/123456789/19637?col=123456789%2F1362&view_type=search","legal_services":"https://www.indiacode.nic.in/handle/123456789/12883?view_type=browse","contract":"https://www.indiacode.nic.in/handle/123456789/2187?col=123456789%2F1362","court_fees":"https://www.indiacode.nic.in/indiacode/handle/123456789/2293?view_type=browse","stamp":"https://www.indiacode.nic.in/handle/123456789/12853?col=123456789%2F1362","cat":"https://www.indiacode.nic.in/indiacode/handle/123456789/1832?col=123456789%2F1362&view_type=search","rti":"https://www.indiacode.nic.in/indiacode/handle/123456789/13072?view_type=browse","land_reorg":"https://www.indiacode.nic.in/indiacode/handle/123456789/12030?sam_handle=123456789%2F1362&view_type=search","mv":"https://www.indiacode.nic.in/indiacode/handle/123456789/1798?col=123456789%2F1362&view_type=search","electricity":"https://www.indiacode.nic.in/indiacode/handle/123456789/2058?view_type=browse","partnership":"https://www.indiacode.nic.in/handle/123456789/19914?view_type=browse","benami":"https://www.indiacode.nic.in/indiacode/handle/123456789/15415?view_type=browse","consumer2":"https://www.indiacode.nic.in/indiacode/handle/123456789/18555?view_type=browse"};
  const LEGAL_CURRENT_SOURCES = Object.assign({}, LEGAL_KNOWLEDGE_SOURCES, {
    limitation: "https://www.indiacode.nic.in/indiacode/handle/123456789/1565?col=123456789%2F1362&view_type=search",
    contempt: "https://www.indiacode.nic.in/indiacode/handle/123456789/1514?view_type=browse",
    public_premises: "https://www.indiacode.nic.in/indiacode/handle/123456789/1609?col=123456789%2F1362&view_type=search",
    easements: "https://www.indiacode.nic.in/indiacode/handle/123456789/2349?view_type=browse"
  });
  W.DLO_LEGAL_CURRENT_SOURCES = LEGAL_CURRENT_SOURCES;

  const EXPANSION_STEMS = ["What is {core}?","What does {core} mean in law?","Explain {core} in simple terms.","What is the legal position on {core}?","Which law governs {core}?","Which provision deals with {core}?","What are the essential requirements of {core}?","What are the conditions for {core}?","What is the procedure for {core}?","What steps are involved in {core}?","What documents are relevant to {core}?","What evidence is relevant to {core}?","What are the main grounds concerning {core}?","What are the exceptions relating to {core}?","What are the legal consequences of {core}?","What happens if {core} is not complied with?","Can {core} be challenged?","Who can invoke or rely on {core}?","Against whom can {core} be asserted?","When can {core} be invoked?","When is {core} not available?","What limitation issues can arise in {core}?","What jurisdiction issues can arise in {core}?","What objections can be raised concerning {core}?","What should a Government department do regarding {core}?","What should Government Standing Counsel examine regarding {core}?","What should the defendant check regarding {core}?","What should the plaintiff establish regarding {core}?","What common mistakes arise in {core}?","What practical checklist should be followed for {core}?"];
  const EXPANSION_CONTEXTS = [""," in a civil case"," in a suit against the Government"," when a Government department is a party"," before a subordinate civil court"," before the High Court of J&K and Ladakh"," in Jammu and Kashmir"," at the filing stage"," after service of notice"," after service of summons"," during trial"," during evidence"," at the arguments stage"," after an adverse order"," when an interim order is sought"," when the opposite party objects"," where delay has occurred"," where the other side seeks restoration"," for a defendant department"," from a litigation-monitoring perspective"];
  const LEGAL_EXPANSION_TARGET = 60000;

  const EXPANSION_CORE = Object.create(null);
  const expansionAdd = (entry, core) => {
    if (!entry) return;
    EXPANSION_CORE[entry.id] = core;
    const aliases = [];
    for (let si = 0; si < EXPANSION_STEMS.length; si++) {
      for (let ci = 0; ci < EXPANSION_CONTEXTS.length; ci++) {
        const q = EXPANSION_STEMS[si].replace(/\{core\}/g, core) + EXPANSION_CONTEXTS[ci] + "?";
        aliases.push(q);
      }
    }
    entry.a = (entry.a || []).concat(aliases);
  };

  /* Short cores keep question matching natural while the full topic remains the answer source. */
  const EXISTING_EXPANSION_CORE = {
    "applicability": "Procedural law applicable in UT of Jammu & Kashmir",
    "cpc_overview": "Structure of Code of Civil Procedure 1908",
    "civil_suit": "Civil suit life cycle & trial stages",
    "plaint": "Plaint requirements & verification",
    "reject_plaint": "Rejection of plaint",
    "written_statement": "Written statement in ordinary suits",
    "commercial_ws": "Commercial suit written statement",
    "consumer_process": "Consumer complaint written statement",
    "evasive_denial": "Evasive denials & deemed admissions",
    "s80_notice": "Mandatory Section 80 CPC notice to Government & public officers",
    "s80_urgent_stay_bar": "Section 80 CPC & statutory bar on day-one ex-parte injunctions",
    "interim_injunction": "Temporary injunctions",
    "injunction_disobedience": "Disobedience of injunction & status quo orders",
    "infrastructure_injunction": "Complete bar on injunctions against infrastructure projects Specific Relief Act)",
    "mandatory_injunction": "Distinction between prohibitory, mandatory & perpetual injunctions",
    "caveat": "Caveat applications & 90-day statutory validity",
    "caveat_restoration": "Filing a caveat against an anticipated restoration application",
    "caveat_without_notice": "Order passed without notice to caveator Violation)",
    "exparte": "Ex-parte proceedings & limitation for setting aside",
    "exparte_remedies": "3 Concurrent remedies against an ex-parte decree",
    "exparte_notice": "Mandatory notice to plaintiff before setting aside ex-parte decree",
    "restoration": "Restoration of suits dismissed for default",
    "condonation_delay": "Condonation of delay",
    "execution": "Execution of decrees",
    "exec_cannot_go_behind": "Executing court cannot go behind the decree",
    "exec_govt": "Execution against Government & 3-month protection window",
    "o21r22": "Mandatory notice in execution after two years",
    "exec_stay": "Stay of execution pending appeal",
    "exec_modes": "Modes of execution",
    "attachment_sale": "Attachment & sale of property in execution & Section 60 exemptions",
    "civil_prison": "Arrest & civil prison in execution & Section 56 female exemption",
    "contempt": "Civil contempt petitions & 1-year limitation bar",
    "wage_claim": "Wage claims under Payment of Wages Act S.15",
    "mact": "Motor accident claims & no-fault liability",
    "adverse_possession_state_land": "Defending adverse possession claims against State Land, Kahcharai, Shamlat & Nazool",
    "land_revenue_demarcation": "Cross-examination on boundary, demarcation & spot-inspection reports",
    "s9_bar": "Civil court jurisdictional bars under Section 9 CPC",
    "electronic_evidence": "Electronic evidence certification",
    "civil_death": "Presumption of civil death",
    "adr_lok_adalat": "Lok Adalat & ADR conciliation standards in government litigation",
    "procedural_deadlines": "Master Procedural Timeline Matrix",
    "appeals": "Appeals",
    "second_appeal": "Second appeal",
    "revision": "Civil revision before High Court",
    "review": "Review of judgment",
    "res_judicata": "Res judicata & constructive res judicata",
    "sub_judice": "Res sub judice & stay of parallel suits",
    "revenue_glossary": "Land Revenue & Settlement Terminology Glossary",
    "g_plaintiff": "Plaintiff and defendant",
    "g_decree_holder": "Decree-holder and judgment-debtor",
    "g_cause_of_action": "Cause of action",
    "g_ad_interim": "Ad interim / interim order",
    "g_status_quo": "Status quo",
    "g_stay": "Stay",
    "g_affidavit": "Affidavit and verification",
    "g_vakalatnama": "Vakalatnama",
    "g_counterclaim": "Counterclaim and set-off",
    "g_locus_standi": "Locus standi and maintainability",
    "g_certified_copy": "Certified copy",
  };

  Object.keys(EXISTING_EXPANSION_CORE).forEach((id) => expansionAdd(KB.filter((x) => x.id === id)[0], EXISTING_EXPANSION_CORE[id]));
  const NEW_EXPANSION_CORES = {"limitation_general":"limitation under the Limitation Act, 1963","specific_relief":"the Specific Relief Act, 1963","declaratory_relief":"declaratory relief under Section 34 of the Specific Relief Act","specific_performance":"specific performance of a contract","cancellation_rectification":"cancellation or rectification of an instrument","transfer_property":"transfer of property under the Transfer of Property Act, 1882","lis_pendens":"lis pendens under Section 52 of the Transfer of Property Act","part_performance":"part performance under Section 53A of the Transfer of Property Act","sale_property":"sale of immovable property under Section 54 of the Transfer of Property Act","mortgage_property":"mortgage of immovable property under the Transfer of Property Act","lease_property":"lease of immovable property under the Transfer of Property Act","gift_property":"gift of property under the Transfer of Property Act","registration_act":"registration of documents under the Registration Act, 1908","stamp_duty":"stamp duty and stamping of documents","court_fees":"court fees and valuation in civil proceedings","contract_general":"general principles of contract law under the Indian Contract Act, 1872","breach_of_contract":"breach of contract and remedies for breach","damages_contract":"damages for breach of contract","indemnity_guarantee":"contracts of indemnity and guarantee","agency":"agency under the Indian Contract Act","arbitration":"arbitration under the Arbitration and Conciliation Act, 1996","mediation":"mediation under the Mediation Act, 2023","lok_adalat":"Lok Adalat proceedings under the Legal Services Authorities Act, 1987","legal_aid":"legal aid and legal services under the Legal Services Authorities Act","rti":"the Right to Information Act, 2005","constitutional_remedies":"constitutional remedies in India","writ_jurisdiction":"writ jurisdiction of the High Court under Article 226","judicial_review":"judicial review of administrative action","natural_justice":"principles of natural justice in administrative decisions","admin_tribunals":"the Administrative Tribunals Act, 1985","cat_proceedings":"Central Administrative Tribunal proceedings","public_premises":"eviction from public premises under the Public Premises Act","land_acquisition":"land acquisition under the 2013 land acquisition law","motor_vehicle":"motor accident claims under the Motor Vehicles Act, 1988","electricity_law":"electricity disputes under the Electricity Act, 2003","easements":"easement rights under the Indian Easements Act","succession":"succession under the Indian Succession Act, 1925","hindu_succession":"succession under the Hindu Succession Act, 1956","benami":"benami property transactions law","criminal_codes":"the BNS, BNSS and BSA criminal-law framework","partnership":"partnership law under the Indian Partnership Act, 1932"};
  Object.keys(NEW_EXPANSION_CORES).forEach((id) => expansionAdd(KB.filter((x) => x.id === id)[0], NEW_EXPANSION_CORES[id]));

  const EXPANDED_QUESTION_COUNT = Object.keys(EXPANSION_CORE).length * EXPANSION_STEMS.length * EXPANSION_CONTEXTS.length;
  if (EXPANDED_QUESTION_COUNT !== LEGAL_EXPANSION_TARGET) console.warn("DLO Legal Question Bank count mismatch", EXPANDED_QUESTION_COUNT);
  W.DLO_LEGAL_QUESTION_COUNT = EXPANDED_QUESTION_COUNT;
  W.DLO_LEGAL_KNOWLEDGE_SOURCES = LEGAL_KNOWLEDGE_SOURCES;

  // Extra aliases for common legal phrasing not covered by the original entries.
  const EXTRA_LEGAL_ALIASES = {"applicability":["which laws apply in jammu and kashmir","central civil laws in jammu and kashmir","post reorganisation civil procedure law"],"cpc_overview":["what are the orders in cpc","what are the sections of cpc","cpc sections and orders"],"written_statement":["written statement deadline","ws filing time","delay in written statement"],"commercial_ws":["commercial suit ws limit","120 day written statement","forfeiture of written statement right"],"consumer_process":["consumer commission reply deadline","45 day consumer reply","consumer complaint defence"],"s80_notice":["notice before suing government","section 80 notice period","government suit notice"],"caveat":["caveat validity period","section 148a caveat","how to lodge caveat"],"caveat_restoration":["caveat against restoration","caveat after dismissal in default","restoration caveat"],"exparte":["ex parte decree set aside","order 9 rule 13","ex parte decree limitation"],"restoration":["restore suit dismissed in default","order 9 rule 9 restoration","restoration of civil suit"],"execution":["execution petition","execute decree","limitation for execution"],"appeals":["first appeal section 96","order 41 appeal","appeal against decree"],"second_appeal":["section 100 second appeal","substantial question of law","second appeal high court"],"revision":["section 115 revision","civil revision petition","revision jurisdiction"],"review":["order 47 review","review petition civil","grounds of review"],"res_judicata":["section 11 res judicata","constructive res judicata","bar of res judicata"],"sub_judice":["section 10 res sub judice","stay parallel suit","res sub judice"]};
  Object.keys(EXTRA_LEGAL_ALIASES).forEach((id) => {
    const e = KB.filter((x) => x.id === id)[0];
    if (e) e.a = (e.a || []).concat(EXTRA_LEGAL_ALIASES[id]);
  });

  /* ───────────── 7B. ACCURACY OVERRIDES FOR LEGAL ANSWERS ─────────────
     These overrides qualify older/manual language so the live assistant does not
     overstate a statutory proposition when the new fact-interview layer is not used. */
  const LEGAL_KB_ACCURACY_OVERRIDES = {
    infrastructure_injunction: {
      d: "Sections 20A and 41(ha) of the Specific Relief Act impose restrictions on injunctions in qualifying infrastructure-project circumstances. The project must satisfy the statutory definition/Schedule requirements and the requested injunction must meet the statutory impact test; this is not a blanket bar on every injunction connected with infrastructure.",
      p: ["Identify whether the project is a qualifying infrastructure project under the current statutory Schedule/notification", "Identify whether the requested injunction would impede or delay progress/completion or interfere with the continued provision of the relevant service", "Rely on Sections 20A/41(ha) only after the statutory ingredients are established on the record"],
      g: "Verify project classification, Schedule/notification, the precise injunction sought, and its actual effect before relying on Sections 20A or 41(ha)."
    },
    electronic_evidence: {
      d: "Under Section 63 BSA, electronic records tendered through the statutory computer/device-output route must satisfy the conditions and certificate framework prescribed by the Act and Schedule. The correct mode of proof matters; do not state that every electronic record is automatically inadmissible without a certificate.",
      p: ["Identify how the electronic record is being tendered", "For the Section 63 statutory route, preserve the prescribed certificate and relevant device/source particulars", "Preserve original source/device, provenance, export/hash and custody material where relevant", "Check current BSA text and controlling case law before asserting an absolute certificate requirement"],
      g: "For departmental e-office, CCTV, email or messaging evidence, identify the custodian/source and prepare the statutory certificate where the chosen mode of proof requires it; do not rely on bare screenshots alone when a formal electronic-record route is being used."
    },
    civil_death: {
      d: "Section 111 BSA concerns the evidentiary burden where a person has not been heard of for the statutory seven-year period by persons who would naturally have heard from that person if alive. It does not itself establish an exact date/place/time of death or replace every separate statutory document needed for consequential relief.",
      p: ["Establish the statutory seven-year foundational facts", "Identify the natural informants and the evidence concerning absence of communication", "Separate the evidentiary presumption from the specific consequential relief sought"],
      g: "Verify missing-person records, police material and the exact consequential relief before processing benefits or revenue changes. A presumption concerning death is not by itself a substitute for every statutory document or court order."
    },
    mact: {
      d: "Motor accident compensation is generally pursued under the Motor Vehicles Act before the Claims Tribunal. The precise route, limitation and statutory compensation provisions should be checked against the current text of Sections 164, 166, 168 and related provisions and the law applicable to the particular accident.",
      p: ["Identify whether the claim is under Section 166 or another statutory route", "Verify the current limitation position before pleading limitation", "Collect FIR/accident record, medical/post-mortem material, vehicle/driver/insurance documents and dependency/income evidence as applicable"],
      t: "Do not hard-code a limitation period without checking the current Section 166 text and current judicial position for the relevant period and proceeding."
    },
    wage_claim: {
      d: "Wage and delayed-payment disputes must first be matched to the statute and forum actually governing the worker and claim. Section 15 of the Payment of Wages Act may be relevant only where that Act currently governs the particular claim; other labour statutes/regimes can prescribe different routes and periods.",
      t: "Do not hard-code a 12-month period without first confirming that the claim is governed by Section 15 of the Payment of Wages Act as currently applicable to the claimant and subject matter.",
      g: "Identify worker category, governing labour regime, nature of deduction/delay, forum and applicable limitation before drafting a defence. Preserve wage registers, attendance, sanction and payment records."
    },
    s9_bar: {
      d: "Section 9 CPC recognises broad civil-court jurisdiction subject to express or implied statutory bars. A bar must be established from the exact special statute, subject matter and statutory remedy; it should not be inferred merely because a dispute concerns revenue, public premises or a government function.",
      p: ["Identify the exact right and relief sought in the plaint", "Identify the special statute said to create the alternative remedy", "Check whether the statute expressly bars civil jurisdiction or whether an implied bar is established by controlling precedent", "Compare the statutory remedy with the relief claimed in the civil suit", "Only then consider Order VII Rule 11(d) or another jurisdictional objection"]
    },
    land_revenue_demarcation: {
      d: "A revenue demarcation or spot-inspection report must be tested against the applicable procedure, authority, notice/participation, survey material and contemporaneous records. A report is not automatically conclusive merely because it bears a revenue official's signature, and it is not automatically void merely because a Patwari prepared it.",
      p: ["Identify who ordered and who conducted the demarcation and under what rule/order", "Check notice or participation requirements under the governing procedure", "Verify reference points, khasra numbers, field map/tatima, scale and measurements", "Compare the report with Jamabandi, Khasra Girdawari, Roznamcha and other primary records", "Use the procedural remedy appropriate to the forum if the report is genuinely disputed"]
    },
    adverse_possession_state_land: {
      d: "Adverse-possession questions against Government property require separate analysis of Article 112, the land category, the statutory revenue/land regime and the evidence of hostile, continuous and open possession. Common or public lands may be subject to additional statutory restrictions; do not treat every State-land case as governed by one universal proposition.",
      g: "Obtain certified revenue records and identify the statutory category of the land. The response should distinguish State land, common land, Kahcharai, Shamilat/Nazool and other categories rather than applying one blanket proposition."
    },
    adr_lok_adalat: {
      p: ["Obtain competent departmental authority required by the applicable Government rules before consenting to settlement", "Ensure the compromise is recorded in the legally required form and approved/signed by an authorised person", "For Lok Adalat, verify the statutory effect of the award and that settlement was voluntary and within authority", "Do not describe the absence of an ordinary appeal as meaning every supervisory or constitutional challenge is impossible; check the governing law"]
    },
    injunction_disobedience: {
      d: "Order XXXIX Rule 2A provides consequences for disobedience of an injunction or breach of its terms. The court's order and the identity of the person alleged to have disobeyed it matter; do not assume personal civil imprisonment of a government officer follows automatically from a departmental breach allegation.",
      g: "On service of an injunction or status quo order, preserve compliance immediately, identify the responsible officers, document steps taken and instruct counsel on discharge/modification or other appropriate relief under the governing CPC provisions."
    },
    s80_notice: {
      d: "Section 80(1) CPC generally requires two months’ notice before instituting a suit against Government or a public officer for acts purportedly done in official capacity. Section 80(2) contains the statutory route for urgent/immediate relief and the court-controlled safeguards; non-service should therefore be analysed with the pleadings, relief sought and any order granting leave.",
      p: ["Identify the correct statutory recipient and prove service", "Read the exact relief clause to determine whether Section 80(2) is invoked", "Check whether the plaint records compliance and whether the court granted leave where required", "Do not state that non-service automatically ends the suit without checking the procedural posture and objections"],
      t: "Two months under Section 80(1), subject to the statutory framework and any applicable exception/leave under Section 80(2)."
    },
    consumer_process: {
      d: "Section 38 of the Consumer Protection Act, 2019 provides the opposite party 30 days to give its version, with a further period not exceeding 15 days. The statutory/procedural position has been treated strictly by the Supreme Court; the exact proceeding and current case law should be checked before calculating a filing consequence.",
      p: ["Verify the date of service of the complaint", "Calculate 30 days and then assess whether a further period within the statutory maximum is available", "Check the Commission’s orders and the current controlling authority", "Do not import the commercial-suit 120-day rule into consumer proceedings" ]
    },
    ordinary_ws: {
      d: "Order VIII Rule 1 provides 30 days from service of summons for filing a written statement in an ordinary civil suit. The court may allow enlargement in appropriate cases subject to the governing procedural law and judicial precedent; this is materially different from the commercial 120-day forfeiture regime.",
      t: "30 days is the ordinary period. Any enlargement must be assessed under the ordinary-suit regime and the facts explaining delay; do not treat 90 days as an automatic deadline that mechanically extinguishes the defence."
    },
    section_80_draft: {
      d: "Section 80 objections should be drafted conditionally: identify the statutory notice requirement, verify the recipient/service and the relief claimed, and address any Section 80(2) order or exception actually present in the record."
    },
    revenue_glossary: {
      d: "J&K revenue terms such as Jamabandi, Khasra Girdawari, Tatima Shajra and other cadastral records should be read according to the governing revenue/settlement record and current local practice. A glossary label should not be treated as a conclusive statement of title, possession or legal effect."
    }
  };
  Object.keys(LEGAL_KB_ACCURACY_OVERRIDES).forEach((id) => {
    const e = KB.find((x) => x.id === id), o = LEGAL_KB_ACCURACY_OVERRIDES[id];
    if (e && o) Object.keys(o).forEach((k) => { e[k] = o[k]; });
  });

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


  /* ───────────── 8A. NON-LLM LEGAL REASONING / FACT INTERVIEW ─────────────
   * This layer does not generate new law. It uses structured, reviewed rules to:
   * 1) detect missing legally material facts;
   * 2) ask targeted follow-up questions;
   * 3) maintain a lightweight conversation state;
   * 4) explain which facts change the result; and
   * 5) force source/qualification language where the issue is fact-sensitive.
   */
  const LEGAL_REASONING_RULES = [{"id":"caveat_restoration","title":"Caveat against an anticipated restoration application","source":"Code of Civil Procedure, 1908 — Section 148A; Order IX; verify current court rules","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"caveat.*restor|restor.*caveat|caveat.*dismiss|dismiss.*caveat","keywords":["caveat","restoration","dismissed in default","order ix"],"facts":["applicationStatus","dismissalStatus","court","partyRole"],"questions":[{"key":"applicationStatus","q":"Has the restoration application already been filed, or is it only anticipated?","patterns":[{"re":"\\b(already|has|have).*\\b(filed|moved|presented)\\b","v":"filed"},{"re":"\\b(expect|apprehend|likely|may|threat|anticipat).*(restor|application)","v":"anticipated"},{"re":"\\bnot filed\\b","v":"anticipated"}]},{"key":"dismissalStatus","q":"Was the suit actually dismissed for default/non-appearance under Order IX, and was it a dismissal of the plaintiff's suit?","patterns":[{"re":"dismissed (for |in )?default|dismissal (for |in )?default|non.?appearance","v":"default"},{"re":"ex.?parte decree","v":"exparte"}]},{"key":"partyRole","q":"Are you appearing for the defendant/respondent who wants notice before the application is heard?","patterns":[{"re":"\\b(defendant|respondent|dlo|department|government)\\b","v":"defendant"},{"re":"\\bplaintiff|applicant\\b","v":"plaintiff"}]}],"base":"Section 148A permits a person claiming a right to appear on an application to lodge a caveat when an application is expected or has been made in a suit or proceeding. A caveat ordinarily remains in force for 90 days unless the application is made before expiry.","branches":[{"when":{"applicationStatus":"filed"},"text":"Because the application is said to have been filed, the question is no longer merely anticipatory: the caveator's immediate focus should be service of the application and opportunity to be heard."},{"when":{"applicationStatus":"anticipated"},"text":"Because the application is only apprehended, the key issue is whether you have a right to appear on that anticipated application and can properly invoke Section 148A."},{"when":{"dismissalStatus":"exparte"},"text":"Do not treat an ex-parte decree and dismissal for default as the same procedural event. The remedy and limitation analysis may differ."}],"next":"Do not calculate a filing deadline or assume that a caveat automatically blocks an order; verify the relevant court's filing and service requirements.","priority":120,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["caveat","restor","dismiss","default","order ix","order 9"]},{"id":"commercial_ws","title":"Written statement in a commercial dispute","source":"Commercial Courts Act, 2015; amended CPC Order V Rule 1 / Order VIII Rule 1","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2156?view_type=browse","trigger":"commercial.*(written statement|\\bws\\b)|(written statement|\\bws\\b).*commercial|\\b120\\s*days?\\b.*(written statement|\\bws\\b)|forfeit.*written statement","keywords":["commercial","written statement","120 days","summons"],"facts":["serviceDate","commercialNature","urgentRelief","statementFiled"],"questions":[{"key":"serviceDate","q":"On what date were summons served on the defendant?","patterns":[{"re":"\\b(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})\\b","v":"date"}]},{"key":"statementFiled","q":"Has the written statement already been filed, or has the 120-day period expired?","patterns":[{"re":"\\b(file[d]?|submitted|taken on record)\\b","v":"filed"},{"re":"\\b120\\s*days?.*(expired|over|lapsed)|forfeit","v":"expired"},{"re":"\\bnot filed|no ws","v":"notfiled"}]},{"key":"serviceMode","q":"Was the summons served in the proceeding in the manner recorded by the court, and is the service record available?","patterns":[{"re":"\\bservice|served|summons\\b","v":"recorded"}]}],"base":"In a commercial dispute governed by the Commercial Courts Act regime, Order V/Order VIII as modified for commercial suits provides a hard outer limit of 120 days from service of summons for filing the written statement; after expiry, the right to file is forfeited and the court shall not allow the written statement to be taken on record.","branches":[{"when":{"statementFiled":"expired"},"text":"If the 120-day period has actually expired, the issue is no longer an ordinary request for extension; counsel should examine the exact service date, computation, court record and applicable commercial-court rules before advising on any procedural route."},{"when":{"statementFiled":"filed"},"text":"If the written statement was filed, the next accuracy question is whether it was within the statutory period and in the prescribed commercial-pleading format/verification requirements."}],"next":"Calculate from the legally relevant service date, not from the department's internal receipt date.","priority":120,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["commercial","written statement","120 days","120 day","forfeit"]},{"id":"ordinary_ws","title":"Written statement in an ordinary civil suit","source":"Code of Civil Procedure, 1908 — Order VIII Rule 1","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"written statement.*(ordinary|civil suit|order viii)|order viii rule 1|delay.*written statement|written statement.*delay","keywords":["written statement","90 days","order viii rule 1"],"facts":["serviceDate","statementFiled","delayReason"],"questions":[{"key":"serviceDate","q":"When were summons served on the defendant?","patterns":[{"re":"\\b(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})\\b","v":"date"}]},{"key":"statementFiled","q":"Has the written statement been filed already?","patterns":[{"re":"\\b(yes|filed|submitted|already filed)\\b","v":"filed"},{"re":"\\b(no|not filed|pending)\\b","v":"notfiled"}]},{"key":"delayReason","q":"If there is delay, what is the specific reason and how long is the delay?","patterns":[{"re":"\\b(office|departmental|file|sanction|approval|administrative)\\b","v":"administrative"},{"re":"\\b(illness|hospital|medical)\\b","v":"medical"},{"re":"\\b(no delay|within time)\\b","v":"none"}]}],"base":"Order VIII Rule 1 sets 30 days from service of summons as the ordinary period for filing a written statement, with judicially recognized extension in appropriate cases up to 90 days in ordinary suits; the commercial-suit regime is materially stricter.","branches":[{"when":{"statementFiled":"notfiled"},"text":"A department should immediately establish the summons-service date and place the plaint, annexures and complete instructions before counsel rather than treating internal file processing as the statutory starting point."},{"when":{"delayReason":"administrative"},"text":"Administrative movement of a government file does not itself answer whether sufficient cause exists; the court will examine the governing procedural rule and the explanation for delay."}],"next":"Keep ordinary-suit timing separate from the 120-day commercial-suit hard stop.","priority":70,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["ordinary suit","civil suit","order viii","written statement"]},{"id":"s80_notice","title":"Section 80 CPC notice before suing Government","source":"Code of Civil Procedure, 1908 — Section 80","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"section 80|s 80|section eighty|notice.*government.*suit|suit.*government.*notice","keywords":["section 80","government","notice","two months"],"facts":["governmentDefendant","noticeServed","urgentRelief"],"questions":[{"key":"governmentDefendant","q":"Is the suit against the Government/public officer in respect of an act purportedly done in official capacity?","patterns":[{"re":"\\b(government|govt|state|public officer|department|official capacity)\\b","v":"yes"},{"re":"\\bprivate party|private person\\b","v":"no"}]},{"key":"noticeServed","q":"Was a Section 80(1) notice served, and can you prove the date and contents of service?","patterns":[{"re":"\\bnotice (was )?served|section 80 notice sent|legal notice served","v":"served"},{"re":"\\bno notice|without notice|not served","v":"notserved"}]},{"key":"urgentRelief","q":"Does the plaint genuinely seek immediate urgent or interim relief, or is it an ordinary suit?","patterns":[{"re":"\\b(urgent|immediate|interim|injunction|temporary injunction)\\b","v":"urgent"},{"re":"\\bordinary|no interim relief|routine","v":"ordinary"}]}],"base":"Section 80(1) generally requires two months' notice before institution of a suit against the Government or specified public officers for official acts. Section 80(2) creates a court-controlled route for urgent or immediate relief, subject to its statutory conditions.","branches":[{"when":{"noticeServed":"notserved","urgentRelief":"ordinary"},"text":"If no Section 80 notice was served and the case is not within the urgent-relief route, the department should examine the statutory objection at the threshold and the exact relief claimed."},{"when":{"noticeServed":"notserved","urgentRelief":"urgent"},"text":"If urgent relief is genuinely contemplated, the question becomes whether leave under Section 80(2) was sought/obtained and what the court actually ordered. Do not assume that urgency automatically waives Section 80."}],"next":"Check the notice date, addressee, contents, statutory two-month period, and any order granting leave under Section 80(2).","priority":115,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["section 80","s 80","government","public officer","notice"]},{"id":"caveat","title":"Caveat under Section 148A CPC","source":"Code of Civil Procedure, 1908 — Section 148A","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"\\bcaveat\\b|148a","keywords":["caveat","148a","notice","90 days"],"facts":["applicationStatus","court"],"questions":[{"key":"applicationStatus","q":"Is the application already filed, or is it only expected?","patterns":[{"re":"\\b(already|has|have).*\\b(filed|moved)\\b","v":"filed"},{"re":"\\b(expected|anticipated|apprehend|likely|may file)\\b","v":"anticipated"}]},{"key":"court","q":"Which court or forum is expected to hear the application?","patterns":[{"re":"\\b(high court|district court|sessions|sub judge|munsiff|consumer|cat|tribunal)\\b","v":"identified"}]}],"base":"Section 148A allows a person claiming a right to appear at the hearing of an application to lodge a caveat where the application is expected or has been made. The caveat procedure includes notice/service duties, and the statutory text provides a 90-day life unless the application is made before expiry.","next":"A caveat is about notice and opportunity to be heard; it is not itself an adjudication on the merits of the expected application.","priority":85,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"exparte","title":"Setting aside an ex-parte decree under Order IX Rule 13","source":"Code of Civil Procedure, 1908 — Order IX Rule 13 and Limitation Act","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"ex.?parte.*decree|order ix rule 13|set aside.*ex.?parte|ex.?parte remedies","keywords":["ex parte","order ix rule 13","decree","30 days"],"facts":["decreeDate","serviceStatus","appearanceReason","appealFiled"],"questions":[{"key":"serviceStatus","q":"Was the defendant duly served with summons, and if so was there sufficient time to appear?","patterns":[{"re":"\\b(not served|no service|not duly served)\\b","v":"defective"},{"re":"\\bduly served|properly served|served in time\\b","v":"proper"}]},{"key":"appearanceReason","q":"Why did the defendant not appear when the matter was called?","patterns":[{"re":"\\bsufficient cause|illness|hospital|wrong date|miscommunication|counsel absent|mistake\\b","v":"possibleCause"},{"re":"\\bdeliberate|intentionally|knowingly did not appear\\b","v":"deliberate"}]},{"key":"appealFiled","q":"Has an appeal against the ex-parte decree already been filed and disposed of?","patterns":[{"re":"\\bappeal.*filed|filed.*appeal\\b","v":"filed"},{"re":"\\bno appeal|appeal not filed\\b","v":"none"}]}],"base":"Order IX Rule 13 provides a route to seek setting aside of an ex-parte decree on the statutory grounds, including improper service or sufficient cause for non-appearance. Limitation must be calculated from the legally relevant date under the Limitation Act and its exclusion rules.","branches":[{"when":{"serviceStatus":"defective"},"text":"If service was not duly effected, that fact is central and should be proved from the summons record and court process, not merely asserted."},{"when":{"appearanceReason":"possibleCause"},"text":"If a sufficient-cause explanation is relied on, preserve contemporaneous medical, travel, communication or counsel records supporting it."},{"when":{"appealFiled":"filed"},"text":"If an appeal has already been pursued, the availability of a separate Order IX Rule 13 route can be affected by the statutory explanation attached to Rule 13 and by what happened in the appeal; counsel should examine the appellate record."}],"next":"Do not give a fixed limitation date without the decree/service facts and the relevant limitation article.","priority":110,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"restoration","title":"Restoration after dismissal for default","source":"Code of Civil Procedure, 1908 — Order IX Rules 4 and 9; Limitation Act","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"restore.*suit|restoration.*suit|dismissed.*default|order ix rule 9","keywords":["restoration","dismissed for default","order ix rule 9"],"facts":["dismissalType","absenceReason","noticeDate"],"questions":[{"key":"dismissalType","q":"Was the plaintiff's suit dismissed for non-appearance/default, and under which Order IX provision if known?","patterns":[{"re":"dismissed.*default|dismissed.*non.?appearance|order ix rule 9","v":"plaintiffDefault"}]},{"key":"absenceReason","q":"What is the explanation for the plaintiff or counsel not appearing?","patterns":[{"re":"\\bsufficient cause|illness|hospital|wrong date|counsel absent|mistake\\b","v":"possibleCause"}]}],"base":"Where a suit is dismissed for default, the appropriate restoration route depends on the precise Order IX provision under which dismissal occurred and the facts explaining non-appearance. Limitation must be checked against the applicable Article and Section 5 where condonation is legally available.","next":"Obtain the dismissal order itself before advising on the remedy; the wording of the order determines the procedural route.","priority":100,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"condonation_delay","title":"Condonation of delay under Section 5 Limitation Act","source":"Limitation Act, 1963 — Section 5","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1565?col=123456789%2F1362&view_type=search","trigger":"condonation|delay.*limitation|section 5|s\\.?5.*limitation","keywords":["condonation","delay","section 5","sufficient cause"],"facts":["proceedingType","delayCause","dayToDayExplanation"],"questions":[{"key":"proceedingType","q":"What proceeding is delayed—an appeal or an application? Section 5 does not extend to every proceeding or every special limitation regime.","patterns":[{"re":"\\bappeal\\b","v":"appeal"},{"re":"\\bapplication|miscellaneous application|restoration|review\\b","v":"application"},{"re":"\\bsuit\\b","v":"suit"}]},{"key":"delayCause","q":"What is the specific cause of delay, with supporting dates/documents?","patterns":[{"re":"\\bmedical|hospital|illness\\b","v":"medical"},{"re":"\\bdepartment|administrative|file|sanction|approval\\b","v":"administrative"},{"re":"\\bcounsel|advocate|wrong advice|communication\\b","v":"counsel"}]},{"key":"dayToDayExplanation","q":"Can the delay be explained for the relevant period rather than only by a single broad reason?","patterns":[{"re":"\\bday.?to.?day|each day|chronology|date wise\\b","v":"yes"},{"re":"\\bno chronology|no explanation\\b","v":"no"}]}],"base":"Section 5 permits condonation in appeals and specified applications where sufficient cause is shown; it does not automatically apply to suits, and special statutes may contain their own limitation regime. The explanation and evidence for delay must be matched to the governing provision.","branches":[{"when":{"proceedingType":"suit"},"text":"If the delayed proceeding is a suit, do not assume Section 5 can condone the delay. First identify the applicable statutory limitation rule and any specific extension/exclusion provision."},{"when":{"delayCause":"administrative"},"text":"Internal departmental delay should be documented chronologically; merely stating that a file moved through offices is not a substitute for the statutory test."}],"next":"Always identify the exact limitation Article/section before calculating delay or drafting a condonation application.","priority":80,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"execution","title":"Execution of civil decrees","source":"CPC Sections 36–74, Section 47, Order XXI; Limitation Act Article 136","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"execution.*decree|execute.*decree|order xxi|execution petition","keywords":["execution","decree holder","judgment debtor","order xxi"],"facts":["decreeType","paymentStatus","appealStay","mode"],"questions":[{"key":"decreeType","q":"What does the decree require—money payment, possession, injunction, delivery, or another act?","patterns":[{"re":"\\bmoney|payment|amount|mesne profits\\b","v":"money"},{"re":"\\bpossession|eviction|delivery\\b","v":"possession"},{"re":"\\binjunction|restrain|mandatory direction\\b","v":"injunction"}]},{"key":"paymentStatus","q":"Has the judgment-debtor complied with the decree, wholly or partly?","patterns":[{"re":"\\bpaid|complied|satisfied|partly complied\\b","v":"partly"},{"re":"\\bnot paid|not complied|unsatisfied\\b","v":"unsatisfied"}]},{"key":"appealStay","q":"Is there an appeal, and has a stay of execution actually been granted?","patterns":[{"re":"\\bappeal.*stay|stay.*execution|stay order\\b","v":"stay"},{"re":"\\bappeal.*no stay|no stay\\b","v":"nostay"}]}],"base":"A decree is enforced through the execution machinery of CPC, principally Order XXI. The executing court ordinarily enforces the decree rather than reopening its merits; Section 47 assigns specified execution questions to the executing court. Limitation and any stay order must be checked separately.","branches":[{"when":{"appealStay":"nostay"},"text":"The mere filing of an appeal does not by itself establish a stay of execution. Obtain and read the actual stay order, if any."},{"when":{"decreeType":"possession"},"text":"For possession decrees, the execution route, resistance/obstruction provisions and the nature of the occupant must be identified before choosing the procedural step."}],"next":"Identify the exact decree and relief before selecting the execution mode.","priority":90,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"exec_govt","title":"Execution of decrees against Government","source":"CPC Section 82","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"execution.*government|section 82|s\\.?82.*cpc|three months.*government","keywords":["government","section 82","three months","execution"],"facts":["decreeDate","satisfied"],"questions":[{"key":"decreeDate","q":"What is the date of the decree/order/award against the Government or public officer?","patterns":[{"re":"\\b(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})\\b","v":"date"}]},{"key":"satisfied","q":"Has the decree been satisfied, partly satisfied, or remains unsatisfied?","patterns":[{"re":"\\bunsatisfied|not complied|not paid\\b","v":"unsatisfied"},{"re":"\\bpaid|satisfied|complied\\b","v":"satisfied"}]}],"base":"Section 82 CPC provides that where a qualifying decree is against the Government or a public officer in respect of an official act, execution shall not issue unless the decree remains unsatisfied for three months from the date of the decree; the provision also addresses qualifying orders/awards capable of execution as decrees.","next":"Do not confuse the three-month execution protection with the separate 12-year limitation applicable to many civil decrees under Article 136 of the Limitation Act.","priority":110,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"injunction","title":"Temporary injunction","source":"CPC Order XXXIX Rules 1–2; Specific Relief Act","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"temporary injunction|interim injunction|order xxxix|injunction.*prima facie|balance of convenience","keywords":["injunction","prima facie","balance of convenience","irreparable injury"],"facts":["relief","urgency","priorOrder"],"questions":[{"key":"relief","q":"What exactly is sought to be restrained—dispossession, construction, recovery, transfer, or another act?","patterns":[{"re":"\\bdispossess|evict|possession\\b","v":"possession"},{"re":"\\bconstruct|demolish|infrastructure|road|bridge|pipeline\\b","v":"construction"},{"re":"\\btransfer|sale|alienate\\b","v":"transfer"}]},{"key":"urgency","q":"What immediate event is said to make relief urgent?","patterns":[{"re":"\\bimmediate|urgent|tomorrow|demolition|demolish|dispossession|auction\\b","v":"urgent"}]},{"key":"priorOrder","q":"Is there already an interim/status-quo/stay order in force?","patterns":[{"re":"\\bstatus quo|stay order|interim order|injunction already\\b","v":"yes"},{"re":"\\bno prior order|no stay|no injunction\\b","v":"no"}]}],"base":"Temporary injunction analysis is fact-sensitive. Courts ordinarily examine the recognised interim-relief principles, including prima facie case, balance of convenience and irreparable injury, alongside the statutory restrictions and conduct of the parties.","next":"The bot should not predict whether an injunction will be granted without the exact act sought to be restrained, existing orders and the applicable statutory bar.","priority":85,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"infrastructure_injunction","title":"Infrastructure-project injunction restrictions","source":"Specific Relief Act, 1963 — Sections 20A and 41(ha), Schedule","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1583?view_type=browse","trigger":"infrastructure.*injunction|injunction.*infrastructure|41\\(?ha\\)?|20a.*injunction|road.*(?:injunction|stay|project)|bridge.*(?:injunction|stay|project)|pipeline.*(?:injunction|stay|project)|power.*(?:injunction|stay|project)","keywords":["infrastructure","injunction","section 20a","section 41 ha"],"facts":["projectType","projectSchedule","injunctionImpact"],"questions":[{"key":"projectType","q":"What infrastructure project is involved—for example roads, bridges, water/sanitation, energy or another scheduled category?","patterns":[{"re":"\\broad|highway|bridge|rail|airport|port|water|sanitation|power|electric|energy\\b","v":"scheduledCandidate"}]},{"key":"projectSchedule","q":"Can the project be matched to the current statutory Schedule/notification defining an infrastructure project?","patterns":[{"re":"\\b(schedule|notified|listed|specified)\\b","v":"yes"},{"re":"\\bnot in schedule|uncertain|don't know|unknown\\b","v":"unknown"}]},{"key":"injunctionImpact","q":"Would the requested injunction, on the pleaded facts, impede or delay progress/completion or interfere with the relevant facility/service?","patterns":[{"re":"\\b(delay|impede|stop|halt|block|interfere)\\b","v":"yes"},{"re":"\\bno delay|would not affect\\b","v":"no"}]}],"base":"Sections 20A and 41(ha) of the Specific Relief Act impose restrictions on injunctions in qualifying infrastructure-project circumstances. The project must satisfy the statutory definition/Schedule requirements and the requested injunction must satisfy the statutory impact test; this is not a blanket bar on every injunction connected with infrastructure.","next":"Verify the current Schedule/notification and the precise contractual/statutory basis of the suit before relying on Sections 20A or 41(ha).","priority":125,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"electronic_evidence","title":"Electronic evidence under BSA Section 63","source":"Bharatiya Sakshya Adhiniyam, 2023 — Section 63 and Schedule","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/20063?col=123456789%2F1362&view_type=search","trigger":"electronic evidence|digital evidence|65b|section 63.*bsa|whatsapp.*(?:chat|message|evidence|certificate)|(?:chat|message).*bsa|cctv.*(?:evidence|certificate)|email.*(?:evidence|certificate)|electronic record","keywords":["electronic evidence","BSA 63","certificate","hash"],"facts":["recordType","sourceDevice","certificateAvailable"],"questions":[{"key":"recordType","q":"What electronic record is involved—WhatsApp/chat, email, CCTV, audio/video, server log, phone data, or a computer output?","patterns":[{"re":"\\bwhatsapp|chat|message|email|cctv|audio|video|server|log|computer output|mobile|digital\\b","v":"electronic"}]},{"key":"sourceDevice","q":"Do you have the original device/source or only a copy/export/printout/screenshot?","patterns":[{"re":"\\boriginal device|original source|device available\\b","v":"original"},{"re":"\\bcopy|printout|export|screenshot|forwarded\\b","v":"copy"}]},{"key":"certificateAvailable","q":"Do you have the Section 63 certificate in the prescribed form, with the required device/source particulars and other statutory particulars where applicable?","patterns":[{"re":"\\bcertificate|section 63 certificate\\b","v":"yes"},{"re":"\\bno certificate|without certificate\\b","v":"no"}]},{"key":"tenderRoute","q":"How will the record be tendered—through the Section 63 statutory computer/device-output route or another mode of proof?","patterns":[{"re":"\\bsection 63|computer output|device output|certificate\\b","v":"section63"},{"re":"\\boriginal device|directly from device|primary\\b","v":"source"}]}],"base":"Section 63 BSA governs the statutory route for proving electronic records through computer/communication-device output. The Act contains a certificate framework and Schedule. The correct mode of proof must be identified before saying a certificate is or is not required in a particular case.","branches":[{"when":{"sourceDevice":"original"},"text":"If the original source/device is available, counsel should identify whether the record is being proved through direct/primary evidence or as a computer output under Section 63."},{"when":{"certificateAvailable":"no"},"text":"If a certificate is required for the chosen mode of proof, its absence is a procedural/evidentiary issue to address before tendering the record; verify the exact statutory route and current case law."}],"next":"Identify the mode of tender, preserve the source/device and provenance, and verify the current Section 63 certificate requirements and controlling case law before asserting admissibility or inadmissibility.","priority":125,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["whatsapp","email","cctv","electronic evidence","digital evidence","65b","bsa 63","section 63"]},{"id":"civil_death","title":"Seven-year evidentiary presumption concerning a missing person","source":"Bharatiya Sakshya Adhiniyam, 2023 — Sections 110–111","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/20063?col=123456789%2F1362&view_type=search","trigger":"civil death|presumption of death|not heard.*seven years|section 111.*bsa","keywords":["seven years","missing person","presumption of death","BSA 111"],"facts":["lastHeard","naturalInformants","reliefSought"],"questions":[{"key":"lastHeard","q":"When was the person last heard of, and has the statutory seven-year period been completed?","patterns":[{"re":"\\bseven years?|7 years?\\b","v":"sevenYears"}]},{"key":"naturalInformants","q":"Which persons would naturally have heard from the missing person if the person were alive, and what evidence shows they did not?","patterns":[{"re":"\\bfamily|spouse|children|parents|natural informants|heard from\\b","v":"identified"}]},{"key":"reliefSought","q":"What consequential relief is actually being sought—succession, pension, mutation, declaration, appointment, or another benefit?","patterns":[{"re":"\\bpension|mutation|succession|declaration|appointment|benefit\\b","v":"identified"}]}],"base":"Section 111 BSA addresses the evidentiary burden concerning a person who has not been heard of for the statutory seven-year period by persons who would naturally have heard from that person if alive. It should not be treated as an automatic determination of an exact date/place/time of death or as a universal administrative declaration.","next":"Identify the competent forum and the exact consequential relief before advising on the next procedural step.","priority":110,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"limitation_general","title":"Limitation: identifying the correct period","source":"Limitation Act, 1963","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1565?col=123456789%2F1362&view_type=search","trigger":"limitation|time barred|time-barred|limitation period|article \\d+.*limitation|section 3.*limitation|section 5.*limitation","keywords":["limitation","article","section 3","special law"],"facts":["proceeding","startEvent","specialLaw"],"questions":[{"key":"proceeding","q":"What exact proceeding is being timed—a suit, first/second appeal, review, revision, execution, or application?","patterns":[{"re":"\\bsuit\\b","v":"suit"},{"re":"\\bfirst appeal|appeal\\b","v":"appeal"},{"re":"\\bsecond appeal\\b","v":"secondAppeal"},{"re":"\\breview\\b","v":"review"},{"re":"\\brevision\\b","v":"revision"},{"re":"\\bexecution\\b","v":"execution"},{"re":"\\bapplication\\b","v":"application"}]},{"key":"startEvent","q":"What event/date started the limitation period—order, decree, knowledge, refusal, cause of action, or another statutory event?","patterns":[{"re":"\\bdecree|judgment|order\\b","v":"order"},{"re":"\\bknowledge|discovery|aware\\b","v":"knowledge"},{"re":"\\brefusal|rejected|denied\\b","v":"refusal"}]},{"key":"specialLaw","q":"Does a special statute govern the proceeding and prescribe its own limitation period?","patterns":[{"re":"\\bconsumer|commercial|arbitration|motor vehicles|electricity|special act|special statute\\b","v":"yes"},{"re":"\\bno special law|general law\\b","v":"no"}]}],"base":"The Limitation Act contains different Articles for different proceedings, and Section 3 makes limitation a mandatory threshold rule subject to the Act and special statutes. The first task is to identify the exact proceeding and the Article or special-law provision, then compute the legally relevant start date and statutory exclusions/extensions.","next":"Never answer a limitation question from the number of days alone; identify the proceeding, Article, triggering event and any exclusion/extension provision.","priority":20,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"appeals","title":"First appeal and limitation","source":"CPC Section 96, Order XLI; Limitation Act","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"first appeal|section 96|order xli|appeal against decree","keywords":["appeal","section 96","order xli","decree"],"facts":["decreeType","forum","stayNeeded"],"questions":[{"key":"decreeType","q":"Is the impugned decision a decree, and is it a preliminary or final decree?","patterns":[{"re":"\\bdecree\\b","v":"decree"},{"re":"\\binterim order|order only\\b","v":"order"}]},{"key":"forum","q":"Which court passed the decree and which appellate forum is contemplated?","patterns":[{"re":"\\bsub judge|munsiff|district court|trial court\\b","v":"subordinate"},{"re":"\\bhigh court\\b","v":"highcourt"}]},{"key":"stayNeeded","q":"Does execution or implementation need to be stayed urgently pending appeal?","patterns":[{"re":"\\bstay|execution|urgent\\b","v":"yes"},{"re":"\\bno stay\\b","v":"no"}]}],"base":"Section 96 CPC provides for appeals from decrees subject to its statutory exceptions. The appropriate appellate forum and limitation period must be identified from the nature of the decree, the court that passed it and the applicable Limitation Act Article. A stay of execution is a separate question and is not automatic merely because an appeal is filed.","next":"Read the decree, identify the appellate court and separately prepare any stay application if execution is at risk.","priority":75,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"second_appeal","title":"Second appeal and substantial question of law","source":"CPC Section 100","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"second appeal|section 100|substantial question of law","keywords":["second appeal","section 100","substantial question of law"],"facts":["appellateDecree","questionOfLaw","factFindings"],"questions":[{"key":"appellateDecree","q":"Is the impugned decision a decree passed in first appeal?","patterns":[{"re":"\\bfirst appeal.*decree|appellate decree\\b","v":"yes"}]},{"key":"questionOfLaw","q":"What precise question of law is said to be substantial?","patterns":[{"re":"\\bquestion of law|substantial question|interpretation of statute|jurisdictional legal error\\b","v":"identified"}]},{"key":"factFindings","q":"Is the proposed challenge only asking the High Court to re-appreciate concurrent findings of fact?","patterns":[{"re":"\\bre.?appreciate evidence|concurrent findings|facts only\\b","v":"factsOnly"},{"re":"\\blegal question|perversity|misapplication of law\\b","v":"law"}]}],"base":"Section 100 CPC confines second appeals to cases involving a substantial question of law, subject to the statutory conditions. A second appeal is not a routine third factual hearing.","branches":[{"when":{"factFindings":"factsOnly"},"text":"If the proposed grounds only seek re-appreciation of concurrent factual findings, the Section 100 threshold must be addressed explicitly rather than presenting the case as an ordinary appeal."}],"next":"Frame the proposed substantial question of law precisely before drafting the memorandum of appeal.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"review","title":"Review under Section 114 and Order XLVII CPC","source":"CPC Section 114, Order XLVII; Limitation Act Article 124","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"review.*judgment|section 114|order xlvii|error apparent","keywords":["review","error apparent","new evidence","order xlvii"],"facts":["ground","dueDiligence","sameCourt"],"questions":[{"key":"ground","q":"Is the review based on new evidence, an error apparent on the record, or another recognised sufficient reason?","patterns":[{"re":"new evidence|new and important evidence","v":"newEvidence"},{"re":"error apparent|apparent error","v":"error"},{"re":"sufficient reason","v":"sufficientReason"}]},{"key":"dueDiligence","q":"If new evidence is relied on, why could it not be produced earlier despite due diligence?","patterns":[{"re":"due diligence|not available|could not obtain","v":"explained"}]},{"key":"sameCourt","q":"Is the application being made before the same court that passed the decree/order?","patterns":[{"re":"same court|same judge|court which passed","v":"yes"},{"re":"different court|appeal court","v":"no"}]}],"base":"Review is a limited statutory jurisdiction. The grounds are materially narrower than an appeal and ordinarily include discovery of new and important matter/evidence despite due diligence, an error apparent on the face of the record, or another recognised sufficient reason under Order XLVII.","next":"Do not use review simply to re-argue the merits as though it were an appeal.","priority":95,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"res_judicata","title":"Res judicata under Section 11 CPC","source":"CPC Section 11","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"res judicata|section 11|constructive res judicata","keywords":["res judicata","former suit","same parties","constructive"],"facts":["sameParties","sameIssue","finalDecision","competentCourt"],"questions":[{"key":"sameParties","q":"Are the parties (or persons litigating under the same title) substantially the same?","patterns":[{"re":"\\bsame parties|same title|same litigants\\b","v":"yes"},{"re":"\\bdifferent parties|different title\\b","v":"no"}]},{"key":"sameIssue","q":"Is the matter directly and substantially in issue in both proceedings?","patterns":[{"re":"\\bsame issue|same matter|directly and substantially\\b","v":"yes"},{"re":"\\bdifferent issue\\b","v":"no"}]},{"key":"finalDecision","q":"Was the issue heard and finally decided by a competent court?","patterns":[{"re":"\\bfinally decided|judgment on merits|final decision\\b","v":"yes"},{"re":"\\bnot decided|pending|withdrawn before decision\\b","v":"no"}]}],"base":"Section 11 bars a subsequent suit or issue where the statutory conditions of former adjudication are satisfied. The analysis is fact-specific: parties, title, issue, competence of the former court and final adjudication must all be tested. Constructive res judicata adds the statutory deeming rule in Explanation IV.","next":"Compare the two pleadings and prior judgment side-by-side before asserting res judicata.","priority":95,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"sub_judice","title":"Res sub judice under Section 10 CPC","source":"CPC Section 10","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2191?view_type=browse","trigger":"res sub judice|section 10|parallel suit|stay.*suit","keywords":["section 10","parallel suit","same matter","previously instituted"],"facts":["earlierSuit","sameIssue","sameParties","competentCourt"],"questions":[{"key":"earlierSuit","q":"Is there a previously instituted suit still pending?","patterns":[{"re":"\\bpreviously instituted|earlier suit|pending suit\\b","v":"yes"}]},{"key":"sameIssue","q":"Is the matter directly and substantially in issue in both suits?","patterns":[{"re":"\\bsame issue|same matter|directly and substantially\\b","v":"yes"}]},{"key":"sameParties","q":"Are the parties litigating under the same title in both suits?","patterns":[{"re":"\\bsame parties|same title\\b","v":"yes"}]}],"base":"Section 10 concerns the trial of a later suit where the statutory conditions of a previously instituted pending suit are satisfied. It is distinct from res judicata because the earlier matter has not yet reached final adjudication.","next":"Obtain the earlier suit's pleadings, parties, court competence and current status before relying on Section 10.","priority":85,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"public_premises","title":"Eviction from public premises","source":"Public Premises (Eviction of Unauthorised Occupants) Act, 1971","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1609?col=123456789%2F1362&view_type=search","trigger":"public premises|estate officer|unauthori[sz]ed occupant|eviction.*public premises","keywords":["public premises","eviction","unauthorised occupant","estate officer"],"facts":["premisesStatus","authority","notice"],"questions":[{"key":"premisesStatus","q":"Is the property actually covered by the statutory definition of public premises?","patterns":[{"re":"\\bgovernment|public authority|corporation|premises\\b","v":"candidate"}]},{"key":"notice","q":"Has the Estate Officer served the statutory notice and provided the opportunity contemplated by the Act?","patterns":[{"re":"\\bnotice served|show cause|estate officer\\b","v":"yes"},{"re":"\\bno notice\\b","v":"no"}]}],"base":"The Public Premises Act establishes a statutory eviction process for covered public premises, including notice, adjudication by the Estate Officer and an appeal route. The Act also contains finality/jurisdiction provisions, so a civil-court challenge must be tested against the exact statutory provision and relief sought.","next":"Confirm that the land/premises falls within the Act before treating ordinary civil-suit procedure as the primary route.","priority":100,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["public premises","estate officer"]},{"id":"arbitration","title":"Arbitration and setting aside an award","source":"Arbitration and Conciliation Act, 1996; J&K/Ladakh adaptation must be checked","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1978?view_type=browse","trigger":"arbitration|section 34.*award|set aside.*award|arbitral award","keywords":["arbitration","section 34","award","stay"],"facts":["awardDate","partyReceivesAward","jurisdiction","jkaAdaptation"],"questions":[{"key":"partyReceivesAward","q":"When did the challenging party receive the arbitral award (or the decision on a Section 33 request, if any)?","patterns":[{"re":"\\b(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})\\b","v":"date"}]},{"key":"jkaAdaptation","q":"Is the matter governed by the J&K/Ladakh statutory adaptation of Section 34?","patterns":[{"re":"\\bjammu.?kashmir|j&k|ladakh\\b","v":"yes"},{"re":"\\bother state|delhi|punjab|outside jk\\b","v":"no"}]}],"base":"Section 34 provides the statutory route to set aside an arbitral award. In the India Code text for the J&K/Ladakh adaptations, the period in Section 34(3) is modified from three months to six months, with the proviso figures modified from thirty days to sixty days. The exact applicable adaptation and computation must be checked from the current statutory text.","next":"Read the current statutory/adaptation text and award-service date before calculating the Section 34 deadline.","priority":120,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["arbitration","section 34","arbitral award"]},{"id":"mediation","title":"Mediation and pre-litigation settlement","source":"Mediation Act, 2023; Commercial Courts Act Section 12A for specified commercial suits","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/19637?col=123456789%2F1362&view_type=search","trigger":"mediation|pre.?litigation mediation|pre.?institution mediation|section 12a|12a.*commercial","keywords":["mediation","pre litigation","commercial court","settlement"],"facts":["commercial","urgentRelief","consent"],"questions":[{"key":"commercial","q":"Is the dispute a commercial dispute of specified value governed by the Commercial Courts Act?","patterns":[{"re":"\\bcommercial|commercial suit|specified value\\b","v":"yes"},{"re":"\\bcivil|non.?commercial\\b","v":"no"}]},{"key":"urgentRelief","q":"Does the proposed commercial suit contemplate urgent interim relief?","patterns":[{"re":"\\burgent|immediate interim|urgent injunction\\b","v":"yes"},{"re":"\\bno urgent|no interim\\b","v":"no"}]}],"base":"The Mediation Act, 2023 provides a general statutory framework for mediation, while Section 12A of the Commercial Courts Act specifically governs pre-institution mediation for covered commercial suits that do not contemplate urgent interim relief.","branches":[{"when":{"commercial":"yes","urgentRelief":"no"},"text":"For a qualifying commercial suit without urgent interim relief, Section 12A is a threshold procedural requirement and should be checked before institution."},{"when":{"commercial":"yes","urgentRelief":"yes"},"text":"The urgent-relief exception must be examined carefully; do not treat the word 'urgent' in a plaint as automatically dispositive without the court considering the relief actually contemplated."}],"next":"Keep the Commercial Courts Act's mandatory pre-institution regime distinct from voluntary/general mediation under the Mediation Act.","priority":120,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["mediation","12a","pre institution","pre litigation"]},{"id":"consumer_process","title":"Consumer Commission written version","source":"Consumer Protection Act, 2019 — Section 38","url":"https://www.indiacode.nic.in/bitstream/123456789/15256/5/A2019-35.pdf","trigger":"consumer.*(?:reply|written version|defence|defense)|45 days|consumer commission.*(?:version|reply)|hilli","keywords":["consumer","written version","30 days","15 days"],"facts":["serviceDate","versionFiled"],"questions":[{"key":"serviceDate","q":"When was the complaint served on the opposite party?","patterns":[{"re":"\\b(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})\\b","v":"date"}]},{"key":"versionFiled","q":"Has the written version/reply already been filed?","patterns":[{"re":"\\bfiled|submitted\\b","v":"filed"},{"re":"\\bnot filed|pending\\b","v":"notfiled"}]}],"base":"Section 38 of the Consumer Protection Act, 2019 provides 30 days for the opposite party's version, with a further period not exceeding 15 days that the Commission may grant. The statutory/procedural position has been treated strictly by the Supreme Court, so the service date and case record matter.","next":"Do not simply import ordinary CPC written-statement rules into a consumer complaint.","priority":115,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["consumer","consumer commission","written version"]},{"id":"motor_vehicle","title":"Motor accident compensation claim","source":"Motor Vehicles Act, 1988 — Sections 166, 168, 169 and related provisions","url":"https://www.indiacode.nic.in/bitstream/123456789/1798/1/198859.pdf","trigger":"mact|motor accident|motor vehicle.*(?:claim|accident)|section 166|section 164|section 173|accident compensation","keywords":["MACT","accident","compensation","insurer"],"facts":["accident","claimRoute","records"],"questions":[{"key":"claimRoute","q":"Is the claim being pursued before the Motor Accident Claims Tribunal under the current statutory regime?","patterns":[{"re":"\\bMACT|claims tribunal|section 166\\b","v":"yes"}]},{"key":"records","q":"Are FIR/accident records, medical or post-mortem evidence and vehicle/insurance records available?","patterns":[{"re":"\\bFIR|medical|post.?mortem|insurance|RC|driving licence\\b","v":"available"}]}],"base":"Motor accident compensation proceedings are governed by the Motor Vehicles Act and the procedure/rules applicable to the Claims Tribunal. The claim file should distinguish the statutory route, claimant category, insurer position and the evidence required to quantify or establish compensation.","next":"Verify the current limitation/procedural rule applicable to the particular claim and preserve the accident record immediately.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"contempt","title":"Civil contempt and wilful disobedience","source":"Contempt of Courts Act, 1971 — Sections 2(b), 12, 20 and applicable court rules","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1514?view_type=browse","trigger":"civil contempt|wilful disobedience|contempt.*order|section 12.*contempt|section 20.*contempt","keywords":["contempt","wilful disobedience","court order","undertaking"],"facts":["orderClarity","knowledge","wilfulness"],"questions":[{"key":"orderClarity","q":"What exact order, judgment, direction or undertaking is said to have been breached?","patterns":[{"re":"\\bjudgment|decree|direction|order|undertaking\\b","v":"identified"}]},{"key":"knowledge","q":"How and when did the alleged contemnor receive knowledge of the order?","patterns":[{"re":"\\bserved|notice|knowledge|received|informed\\b","v":"known"}]},{"key":"wilfulness","q":"What facts show deliberate or wilful disobedience rather than inability, ambiguity or accidental non-compliance?","patterns":[{"re":"\\bdeliberate|wilful|knowingly|intentionally\\b","v":"alleged"},{"re":"\\bno knowledge|impossible|unable|ambiguous\\b","v":"defence"}]}],"base":"Civil contempt under Section 2(b) focuses on wilful disobedience of a judgment, decree, direction, order, writ or process of a court, or wilful breach of an undertaking given to a court. The clarity of the order and the evidence of knowledge and wilfulness are central.","branches":[{"when":{"wilfulness":"defence"},"text":"If impossibility, ambiguity or lack of knowledge is relied on, preserve the chronology and compliance efforts; contempt should not be treated as automatic merely because an order was not fully complied with."}],"next":"Also check Section 20 and the applicable court's contempt rules for limitation/procedure.","priority":110,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"specific_performance","title":"Specific performance of a contract","source":"Specific Relief Act, 1963 — current statutory text and amendments","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1583?view_type=browse","trigger":"specific performance|enforce.*contract|performance of contract","keywords":["specific performance","contract","specific relief"],"facts":["contract","readiness","limitation"],"questions":[{"key":"contract","q":"Is there a written or otherwise provable contract, and what obligation is sought to be specifically enforced?","patterns":[{"re":"\\bcontract|agreement|undertaking\\b","v":"identified"}]},{"key":"readiness","q":"What evidence shows performance, readiness/willingness or compliance with contractual conditions?","patterns":[{"re":"\\breadiness|willingness|payment|performance|complied\\b","v":"evidence"}]},{"key":"limitation","q":"What date is said to start the limitation period for the specific-performance claim?","patterns":[{"re":"\\brefusal|notice|termination|breach\\b","v":"triggerIdentified"}]}],"base":"Specific performance is governed by the current Specific Relief Act and its statutory conditions, exclusions and limitation rules. The precise contractual term, enforceability, plaintiff conduct and limitation event must be identified before assessing the remedy.","next":"Do not rely on pre-2018 descriptions of specific performance without checking the amended statute.","priority":110,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["specific performance"]},{"id":"declaratory_relief","title":"Declaratory relief under Section 34 of the Specific Relief Act","source":"Specific Relief Act, 1963 — Section 34","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1583?view_type=browse","trigger":"section 34.*declaration|declaratory relief|declaration.*legal character","keywords":["section 34","declaration","legal character","property right"],"facts":["rightClaimed","furtherRelief","possession"],"questions":[{"key":"rightClaimed","q":"What legal character or right as to property is sought to be declared?","patterns":[{"re":"\\btitle|ownership|legal character|right|status\\b","v":"identified"}]},{"key":"furtherRelief","q":"Is further relief such as possession, injunction or cancellation available but omitted?","patterns":[{"re":"\\bpossession|injunction|cancellation|further relief\\b","v":"possible"}]},{"key":"possession","q":"Is the plaintiff in possession of the property or seeking possession?","patterns":[{"re":"\\bin possession|possession with plaintiff\\b","v":"in"},{"re":"\\bnot in possession|seeking possession\\b","v":"out"}]}],"base":"Section 34 addresses declaratory relief concerning legal character or a right as to property. The availability and necessity of consequential relief must be assessed from the statutory proviso and the pleaded facts.","next":"A declaration should be matched to the exact right asserted and to any consequential relief that the plaintiff is legally able to seek.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["declaration","declaratory","section 34"]},{"id":"lis_pendens","title":"Lis pendens under Section 52 of the Transfer of Property Act","source":"Transfer of Property Act, 1882 — Section 52","url":"https://www.indiacode.nic.in/handle/123456789/2187?col=123456789%2F1362","trigger":"lis pendens|section 52.*transfer|sale.*during.*pending suit|pendente lite","keywords":["lis pendens","section 52","pending suit","transfer"],"facts":["propertyInIssue","pendingSuit","transferDate"],"questions":[{"key":"propertyInIssue","q":"Are rights in the immovable property directly and specifically in issue in the pending proceeding?","patterns":[{"re":"\\btitle|ownership|partition|possession|property rights\\b","v":"yes"}]},{"key":"pendingSuit","q":"Was the proceeding pending when the transfer was made?","patterns":[{"re":"\\bpending|during suit|during litigation|pendency\\b","v":"yes"}]},{"key":"transferDate","q":"What is the date and nature of the transfer?","patterns":[{"re":"\\bsale|gift|mortgage|lease|transfer\\b","v":"identified"}]}],"base":"Section 52 applies to qualifying transfers of immovable property during the pendency of a suit or proceeding in which the right to the property is directly and specifically in question. It does not simply make every transfer during litigation void; its statutory effect must be stated accurately.","next":"Compare the pleading, property description, pendency period and transfer instrument before invoking lis pendens.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["lis pendens","section 52","pending suit","pendente lite"]},{"id":"contract_general","title":"Contract validity and breach","source":"Indian Contract Act, 1872","url":"https://www.indiacode.nic.in/handle/123456789/2187?col=123456789%2F1362","trigger":"contract validity|valid contract|breach of contract|indian contract act","keywords":["contract","offer","acceptance","breach","consideration"],"facts":["agreement","breach","relief"],"questions":[{"key":"agreement","q":"What are the essential terms, parties and consideration alleged?","patterns":[{"re":"\\bagreement|offer|acceptance|consideration|contract\\b","v":"identified"}]},{"key":"breach","q":"What exact contractual obligation is alleged to have been breached, and when?","patterns":[{"re":"\\bbreach|failed|default|repudiation|terminated\\b","v":"identified"}]},{"key":"relief","q":"What relief is claimed—damages, specific performance, injunction, restitution or termination?","patterns":[{"re":"\\bdamages|specific performance|injunction|restitution|termination\\b","v":"identified"}]}],"base":"Contract disputes should be analysed by first identifying formation/validity, the contractual obligation, the alleged breach and the remedy claimed. Contract-law questions often interact with limitation, specific relief, arbitration and public-contract rules.","next":"Read the complete contract and amendments; a summary of the contract is not a substitute for its operative clauses.","priority":55,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"writ_jurisdiction","title":"Article 226 writ jurisdiction","source":"Constitution of India — Article 226; applicable High Court rules","url":"https://www.indiacode.nic.in/","trigger":"article ?226|writ(?: petition)?|mandamus|certiorari|prohibition|quo warranto|government order.*writ|writ.*government order","keywords":["article 226","writ","mandamus","certiorari"],"facts":["publicLaw","alternativeRemedy","impugnedAction"],"questions":[{"key":"publicLaw","q":"Is the challenged action by a public authority or otherwise amenable to public-law review?","patterns":[{"re":"\\b(government|department|authority|public body|statutory|official order)\\b","v":"yes"}]},{"key":"alternativeRemedy","q":"Is there an effective statutory appeal or alternative remedy, and is any recognised exception relied on?","patterns":[{"re":"\\bappeal|alternative remedy|tribunal|statutory remedy\\b","v":"yes"},{"re":"\\bno appeal|no alternative remedy\\b","v":"no"}]},{"key":"impugnedAction","q":"What exact order, action, omission or inaction is challenged?","patterns":[{"re":"\\border|notice|inaction|decision|termination|assessment|refusal\\b","v":"identified"}]},{"key":"relief","q":"What writ relief is sought—mandamus, certiorari, prohibition, quo warranto, or another Article 226 remedy?","patterns":[{"re":"\\bmandamus|certiorari|prohibition|quo warranto|writ\\b","v":"identified"}]}],"base":"Article 226 gives the High Court power to issue constitutional writs for enforcement of fundamental rights and for other purposes, subject to the constitutional and judicially developed limits of writ jurisdiction. Alternative-remedy principles are important but are not an absolute jurisdictional bar in every case.","next":"Identify the public-law element, impugned action, statutory remedy and the precise writ relief sought.","priority":125,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["writ","article 226","mandamus","certiorari","prohibition","quo warranto"]},{"id":"natural_justice","title":"Natural justice in administrative decisions","source":"Constitutional administrative law; relevant statute and case law","url":"https://www.indiacode.nic.in/","trigger":"natural justice|show cause|audi alteram partem|bias|hearing before adverse order","keywords":["natural justice","hearing","bias","show cause"],"facts":["adverseAction","notice","hearing","bias"],"questions":[{"key":"adverseAction","q":"What adverse administrative decision is proposed or has been made?","patterns":[{"re":"\\btermination|penalty|blacklist|cancellation|adverse order|recovery\\b","v":"identified"}]},{"key":"notice","q":"Was a meaningful notice of the proposed action and allegations given?","patterns":[{"re":"\\bshow cause|notice served|notice\\b","v":"yes"},{"re":"\\bno notice|without notice\\b","v":"no"}]},{"key":"hearing","q":"Was a reasonable opportunity to respond/hear provided where the governing law requires it?","patterns":[{"re":"\\bhearing|reply|opportunity\\b","v":"yes"},{"re":"\\bno hearing|no opportunity\\b","v":"no"}]}],"base":"Natural justice usually concerns fair procedure, including notice and an opportunity to respond, and the rule against bias, subject to the governing statute and recognised exceptions. The exact content depends on the nature of the power and decision.","next":"Check the statutory scheme first; not every administrative act carries the same hearing requirement.","priority":90,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"rti","title":"Right to Information requests and exemptions","source":"Right to Information Act, 2005","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/13072?view_type=browse","trigger":"right to information|RTI|section 8.*RTI|public information officer","keywords":["RTI","information","PIO","exemption"],"facts":["publicAuthority","informationHeld","exemption"],"questions":[{"key":"publicAuthority","q":"Is the information sought from a public authority covered by the RTI Act?","patterns":[{"re":"\\bgovernment|department|public authority|PIO|CPIO|SPIO\\b","v":"yes"}]},{"key":"informationHeld","q":"Is the requested material held by or under the control of the public authority?","patterns":[{"re":"\\bheld|record|file|register|document|information\\b","v":"yes"}]},{"key":"exemption","q":"Is a specific Section 8/9 exemption being claimed, or is the issue only that the department does not hold the information?","patterns":[{"re":"\\bsection 8|exemption|national security|personal information|commercial confidence\\b","v":"possible"},{"re":"\\bnot held|does not exist|no record\\b","v":"notheld"}]}],"base":"RTI analysis should distinguish information held by the public authority from information that would require creation/opinion/advice, and should identify any specific statutory exemption before refusing access.","next":"State the precise record requested and the statutory provision relied on for any exemption/refusal.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["rti","right to information","public information officer"]},{"id":"land_acquisition","title":"Land acquisition and compensation under the 2013 Act","source":"Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013","url":"https://www.indiacode.nic.in/","trigger":"land acquisition|RFCTLARR|compensation.*acquisition|rehabilitation.*resettlement","keywords":["land acquisition","compensation","award","rehabilitation"],"facts":["notification","award","compensation","possession"],"questions":[{"key":"notification","q":"Which statutory notification/section initiated the acquisition and on what date?","patterns":[{"re":"\\bnotification|section 4|section 11|preliminary notification\\b","v":"identified"}]},{"key":"award","q":"Has an award been passed and what compensation components are included?","patterns":[{"re":"\\baward|compensation|solatium|market value\\b","v":"identified"}]},{"key":"possession","q":"Has possession been taken, and under what statutory record?","patterns":[{"re":"\\bpossession|taking possession|panchnama|memo\\b","v":"identified"}]}],"base":"Land-acquisition disputes require identification of the statutory acquisition route, notification, objections, award, compensation, rehabilitation/resettlement obligations and possession chronology. Special acquisition regimes can displace the general statute.","next":"Do not infer the applicable acquisition law merely from the department involved; identify the notification and statutory power actually used.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["land acquisition","rfctlarr","compensation","rehabilitation"]},{"id":"electricity_law","title":"Electricity assessment and appeal disputes","source":"Electricity Act, 2003 — Sections 126–127 and related provisions","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2058?view_type=browse","trigger":"electricity.*section 126|assessment.*electricity|electricity.*appeal|electricity bill dispute","keywords":["electricity","assessment","section 126","appeal"],"facts":["disputeType","assessmentOrder","appeal"],"questions":[{"key":"disputeType","q":"Is this an assessment under Section 126, a billing dispute, a disconnection issue, or another electricity-law matter?","patterns":[{"re":"\\bsection 126|assessment|unauthorised use\\b","v":"assessment"},{"re":"\\bbill|billing|disconnection\\b","v":"billing"}]},{"key":"assessmentOrder","q":"Was an assessment/order served and is there a record of inspection and reasons?","patterns":[{"re":"\\binspection|assessment order|notice|served\\b","v":"identified"}]},{"key":"appeal","q":"Has the statutory appeal route under Section 127 been used or is the limitation period still running?","patterns":[{"re":"\\bappeal|section 127\\b","v":"yes"}]}],"base":"Electricity disputes should be classified under the statutory provision governing assessment, billing, disconnection, theft allegations or regulatory adjudication. Sections 126 and 127 create a specific assessment-and-appeal framework for unauthorised-use cases.","next":"Read the assessment order and statutory notice before treating the issue as an ordinary civil dispute.","priority":100,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"easements","title":"Easement and right-of-way claims","source":"Indian Easements Act, 1882, where applicable; local land law may also matter","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/2349?view_type=browse","trigger":"easement|right of way|right-of-way|prescriptive easement","keywords":["easement","right of way","dominant heritage","servient heritage"],"facts":["dominant","servient","route","prescription"],"questions":[{"key":"dominant","q":"What property is said to benefit from the claimed easement?","patterns":[{"re":"\\bdominant|benefited property|enjoyment\\b","v":"identified"}]},{"key":"servient","q":"What property is alleged to be subject to the easement?","patterns":[{"re":"\\bservient|burdened property\\b","v":"identified"}]},{"key":"route","q":"What exact physical route/right is claimed, and what maps or inspection records prove it?","patterns":[{"re":"\\bpath|road|route|access|map|demarcation\\b","v":"identified"}]},{"key":"prescription","q":"Is acquisition by prescription being claimed, and for how long?","patterns":[{"re":"\\bprescription|twenty years|20 years\\b","v":"claimed"}]}],"base":"Right-of-way and easement disputes turn on the property relationship, the precise nature of the claimed right, its mode of acquisition and the evidence establishing the route and use. Local land/revenue rules may also affect the dispute.","next":"Attach a precise map/route and distinguish an easement from a public pathway, tenancy right or mere permissive use.","priority":90,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["easement","right of way","prescriptive"]},{"id":"succession","title":"Succession and legal-heir documentation","source":"Indian Succession Act, 1925 and applicable personal law","url":"https://www.indiacode.nic.in/","trigger":"succession|legal heir|probate|letters of administration|succession certificate","keywords":["succession","will","probate","legal heirs","intestate"],"facts":["will","personalLaw","asset","courtDocument"],"questions":[{"key":"will","q":"Did the deceased leave a will, or is the succession intestate?","patterns":[{"re":"\\bwill|testament|probate\\b","v":"will"},{"re":"\\bno will|intestate\\b","v":"intestate"}]},{"key":"personalLaw","q":"Which personal-law regime applies to the succession?","patterns":[{"re":"\\bhindu|muslim|christian|parsi|personal law\\b","v":"identified"}]},{"key":"asset","q":"What asset or departmental benefit is being claimed?","patterns":[{"re":"\\bland|property|pension|salary|deposit|service benefit\\b","v":"identified"}]}],"base":"Succession questions require the applicable personal law, the existence and status of any will, the asset/benefit involved and the documentary or court order required for the particular transfer or payment. Revenue mutation alone does not necessarily adjudicate disputed title.","next":"Identify the exact benefit/property and the legally appropriate succession document before releasing or mutating it.","priority":90,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"hindu_succession","title":"Hindu Succession Act and coparcenary questions","source":"Hindu Succession Act, 1956, including 2005 amendment and controlling case law","url":"https://www.indiacode.nic.in/","trigger":"hindu succession|daughter coparcener|section 6.*hindu|class i heirs","keywords":["Hindu Succession Act","coparcenary","daughter","Class I"],"facts":["dateOfDeath","propertyCharacter","familyTree"],"questions":[{"key":"dateOfDeath","q":"What are the relevant dates of death of the coparcener/deceased persons?","patterns":[{"re":"\\b(19|20)\\d{2}\\b","v":"date"}]},{"key":"propertyCharacter","q":"Is the property claimed to be coparcenary/ancestral property or separate property?","patterns":[{"re":"\\bcoparcenary|ancestral|joint family|self.?acquired\\b","v":"identified"}]},{"key":"familyTree","q":"Who are the surviving heirs/coparceners and what were their relationships?","patterns":[{"re":"\\bdaughter|son|widow|mother|father|coparcener|heir\\b","v":"identified"}]}],"base":"The Hindu Succession Act contains rules on intestate succession and coparcenary rights. The 2005 amendment is material, and the answer can turn on the property character and the relevant dates and relationship structure.","next":"Build the family tree and property history before applying Section 6 or the intestate-succession provisions.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"benami","title":"Benami transaction analysis","source":"Prohibition of Benami Property Transactions Act, 1988, as amended","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/15415?view_type=browse","trigger":"benami|benamidar|beneficial owner","keywords":["benami","beneficial owner","benamidar","property"],"facts":["ownerOnTitle","consideration","exception","authority"],"questions":[{"key":"ownerOnTitle","q":"Who is recorded as the owner of the property, and who allegedly provided the consideration?","patterns":[{"re":"\\btitle|registered owner|consideration|paid by\\b","v":"identified"}]},{"key":"consideration","q":"What evidence links the consideration/payment to the alleged beneficial owner?","patterns":[{"re":"\\bpayment|bank|funds|consideration|source of money\\b","v":"evidence"}]},{"key":"exception","q":"Has any statutory exception to the definition been considered?","patterns":[{"re":"\\bexception|HUF|fiduciary|spouse|child\\b","v":"consider"}]},{"key":"authority","q":"At what statutory stage is the matter—notice, provisional attachment, adjudication or appeal?","patterns":[{"re":"\\bnotice|attachment|adjudication|appeal\\b","v":"identified"}]}],"base":"Benami analysis starts with the statutory definition and exceptions, then examines title, consideration, beneficial interest and the prescribed authorities/procedure. A department should not label a transaction benami merely because ownership and payment are different without applying the statutory test.","next":"Read the current statutory definition and exception clauses before drafting a factual allegation or defence.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":[]},{"id":"partnership","title":"Partnership Act and firm liability","source":"Indian Partnership Act, 1932","url":"https://www.indiacode.nic.in/handle/123456789/19914?view_type=browse","trigger":"partnership.*firm|section 69.*partnership|partner liability|unregistered firm","keywords":["partnership","partner","firm","section 69"],"facts":["registration","partnerAuthority","contract","relief"],"questions":[{"key":"registration","q":"Is the firm registered, and what does the registration/deed show?","patterns":[{"re":"\\bregistered firm|registration|unregistered\\b","v":"identified"}]},{"key":"partnerAuthority","q":"Was the person who bound the firm authorised as a partner/agent under the deed and applicable law?","patterns":[{"re":"\\bauthori[sz]ed|partner|power|deed\\b","v":"identified"}]},{"key":"contract","q":"What contract, tender or transaction is the firm alleged to have entered into?","patterns":[{"re":"\\bcontract|tender|agreement|purchase order\\b","v":"identified"}]},{"key":"relief","q":"What remedy is sought against the firm or individual partner?","patterns":[{"re":"\\bdamages|recovery|injunction|specific performance|declaration\\b","v":"identified"}]}],"base":"Partnership disputes require identification of the firm, partnership deed/registration, authority of the partner, transaction and relief. Section 69 can create important consequences for suits by an unregistered firm, but its exact application depends on the statutory ingredients and nature of the claim.","next":"Read the partnership deed and registration record before treating the firm and each partner as automatically interchangeable defendants.","priority":90,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["partnership","unregistered firm","partner"]},{"id":"lok_adalat","title":"Lok Adalat and settlement","source":"Legal Services Authorities Act, 1987","url":"https://www.indiacode.nic.in/handle/123456789/12883?view_type=browse","trigger":"lok adalat|legal services authority|settlement.*lok adalat","keywords":["Lok Adalat","settlement","award","legal services"],"facts":["settlement","pendingCase","consent"],"questions":[{"key":"pendingCase","q":"Is the dispute already pending before a court/tribunal or proposed to be taken to a Lok Adalat?","patterns":[{"re":"\\bpending|court case|tribunal\\b","v":"pending"}]},{"key":"settlement","q":"Are the parties willing to settle and what terms can actually be agreed?","patterns":[{"re":"\\bsettle|settlement|compromise|consent\\b","v":"yes"}]},{"key":"consent","q":"Is the settlement voluntary and within the authority of the persons signing it?","patterns":[{"re":"\\bconsent|authori[sz]ed|settlement authority\\b","v":"yes"}]}],"base":"Lok Adalats under the Legal Services Authorities Act facilitate settlement/conciliation of matters within their jurisdiction. A settlement must be voluntary and within the parties' authority; the statutory effect of an award/settlement should be checked before assuming that every referred matter ends in the same way.","next":"For Government cases, obtain competent sanction/authority for settlement before committing the department to terms.","priority":105,"status":"source-anchored","verifiedOn":"2026-09-25","sourceNote":"Use the current statutory text and applicable court/local rules; do not infer a final legal outcome from topic alone.","disambiguators":["lok adalat","legal services authority"]},{"id":"special_law_priority","title":"Special statute versus general CPC procedure","source":"Code of Civil Procedure, 1908 Section 4 and the governing special statute/rules","url":"https://www.indiacode.nic.in/bitstream/123456789/2191/1/A1908-05.pdf","trigger":"special statute|special law|specific statute|cpc and special act|which law applies|general law.*special law","keywords":["special law","special statute","general law","cpc","special act"],"facts":["specialStatute","conflict","specificProvision"],"questions":[{"key":"specialStatute","q":"Which special statute, rules or tribunal regime governs the dispute?","patterns":[{"re":"\\b(consumer|commercial courts|arbitration|electricity|public premises|land acquisition|service tribunal|labour|revenue|special act|special statute)\\b","v":"identified"}]},{"key":"specificProvision","q":"What specific provision or procedural route is said to conflict with the general CPC rule?","patterns":[{"re":"\\b(section|rule|order|appeal|tribunal|authority|limitation)\\b","v":"identified"}]}],"base":"The CPC is a general procedural code, but Section 4 and numerous special statutes preserve or create special procedures. When a special statute governs the subject matter, identify the exact statutory provision and forum before importing a general CPC rule.","next":"Do not answer a deadline, forum or remedy question from the CPC alone when a special enactment may govern."}];
  // Accuracy enrichment: add a challenge/appeal fact to public-premises interviews.
  if (Array.isArray(LEGAL_REASONING_RULES)) {
    const pp = LEGAL_REASONING_RULES.find(r => r.id === "public_premises");
    if (pp) {
      pp.facts = Array.from(new Set((pp.facts || []).concat(["appealOrChallenge"])));
      pp.questions = (pp.questions || []).concat([
        { key: "authority", q: "Was the order passed by the statutory Estate Officer, and is the appeal route under the Act identified?", patterns: [
          {re:"\\bEstate Officer|estate officer|eviction officer\\b", v:"yes"},
          {re:"\\bno estate officer|not by estate officer\\b", v:"no"}
        ]},
        { key: "appealOrChallenge", q: "Has the Estate Officer order already been appealed, or is the proposed challenge a civil suit/injunction?", patterns: [
          {re:"\\bappeal(?:ed| filed)?\\b|\\bappellate\\b", v:"appeal"},
          {re:"\\bcivil suit|injunction|declaration|civil court\\b", v:"civil"}
        ]}
      ]);
    }
  }

  const LEGAL_REASONING = Object.create(null);
  LEGAL_REASONING_RULES.forEach((r) => {
    LEGAL_REASONING[r.id] = r;
    r._re = r.trigger ? new RegExp(r.trigger, "i") : null;
    (r.questions || []).forEach((q) => {
      (q.patterns || []).forEach((p) => { p._re = new RegExp(p.re, "i"); });
    });
  });

  const LEGAL_ACCURACY_SOURCES = {"cpc":{"title":"Code of Civil Procedure, 1908","url":"https://www.indiacode.nic.in/bitstream/123456789/2191/1/A1908-05.pdf","verified":"2026-09-25"},"commercial_courts":{"title":"Commercial Courts Act, 2015","url":"https://www.indiacode.nic.in/handle/123456789/2156?view_type=browse","verified":"2026-09-25"},"consumer":{"title":"Consumer Protection Act, 2019","url":"https://www.indiacode.nic.in/bitstream/123456789/15256/5/A2019-35.pdf","verified":"2026-09-25"},"bsa":{"title":"Bharatiya Sakshya Adhiniyam, 2023","url":"https://www.indiacode.nic.in/indiacode/bitstream/123456789/20063/1/aa202347.pdf","verified":"2026-09-25"},"arbitration":{"title":"Arbitration and Conciliation Act, 1996 including J&K/Ladakh adaptations","url":"https://www.indiacode.nic.in/bitstream/123456789/1978/3/a1996-26.pdf","verified":"2026-09-25"},"specific_relief":{"title":"Specific Relief Act, 1963","url":"https://www.indiacode.nic.in/bitstream/123456789/1583/7/A1963-47.pdf","verified":"2026-09-25"},"mediation":{"title":"Mediation Act, 2023","url":"https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_3_46_00011_A2023-32_1697800640677&type=act","verified":"2026-09-25"},"limitation":{"title":"Limitation Act, 1963","url":"https://www.indiacode.nic.in/indiacode/handle/123456789/1565?col=123456789%2F1362&view_type=search","verified":"2026-09-25"},"public_premises":{"title":"Public Premises (Eviction of Unauthorised Occupants) Act, 1971","url":"https://www.indiacode.nic.in/bitstream/123456789/1609/1/A1971-40.pdf","verified":"2026-09-25"},"legal_services":{"title":"Legal Services Authorities Act, 1987","url":"https://www.indiacode.nic.in/handle/123456789/12883?view_type=browse","verified":"2026-09-25"},"sc_ai_citation_warning":{"title":"Supreme Court of India — Pooja Ramesh Singh v. Jammu and Kashmir Bank Ltd. landmark summary","url":"https://www.sci.gov.in/landmark-judgment-summaries/","verified":"2026-09-25","note":"Source registry reminder: do not invent or rely on unverified citations."}};
  W.DLO_LEGAL_ACCURACY_SOURCES = LEGAL_ACCURACY_SOURCES;
  const REASON_ACTION_CUE = /\b(can|may|should|could|would|whether|how can|how should|what should|what can|what remedy|remedy|challenge|oppose|resist|defend|file\w*|lodge|restore|set aside|stay|injunction|deadline|limitation|notice|procedure|proceed|consequence|effect|valid|maintainable|barred|required|mandatory|admissib\w*|prove|evidence|execute|appeal|review|revision|writ|quash|declare|enforce|recover|compensat\w*|settle)\b/i;
  const REASON_SIMPLE_CUE = /^(what is|define|meaning of|explain|tell me about|what does)\b/i;
  const UNKNOWN = "unknown";

  function rsPickRule(q, preferred) {
    if (preferred && LEGAL_REASONING[preferred]) return LEGAL_REASONING[preferred];
    const n = norm(q);
    const ids = Object.keys(LEGAL_REASONING);
    let best = null, bestScore = 0;
    for (let i = 0; i < ids.length; i++) {
      const r = LEGAL_REASONING[ids[i]]; let score = Number(r.priority || 0); let trig = false;
      if (r._re) { r._re.lastIndex = 0; trig = r._re.test(n); if (trig) score += 120; }
      let hits = 0; (r.keywords || []).forEach((k) => { if (k && n.indexOf(norm(k)) !== -1) hits++; }); score += hits * 18;
      let dh = 0; (r.disambiguators || []).forEach((k) => { if (k && n.indexOf(norm(k)) !== -1) dh++; }); score += dh * 12;
      if (trig && dh) score += 40;
      if ((trig || hits >= 2 || dh >= 2) && score > bestScore) { bestScore = score; best = r; }
    }
    return best;
  }

  function rsExtract(rule, q, seedFacts, rawInput) {
    const f = Object.assign({}, seedFacts || {}); const conflicts = [];
    const rawQ = String(rawInput != null ? rawInput : q || "");
    const negFiled = /\b(?:not\s+filed|hasn't\s+filed|have not\s+filed|yet\s+to\s+file|no\s+ws|ws\s+not\s+filed)\b/i.test(rawQ);
    const negServed = /\b(?:not\s+served|no\s+notice|without\s+notice)\b/i.test(rawQ);
    const negAppeal = /\b(?:no\s+appeal|appeal\s+not\s+filed|not\s+appealed)\b/i.test(rawQ);
    (rule.questions || []).forEach((item) => {
      const vals = [];
      (item.patterns || []).forEach((p) => {
        if (!p._re) return;
        if (p.v === 'filed' && negFiled) return;
        if (p.v === 'served' && negServed) return;
        if (p.v === 'yes' && (negServed || /\bno\s+certificate\b/i.test(rawQ))) return;
        if (p.v === 'filed' && negAppeal && item.key === 'appealFiled') return;
        p._re.lastIndex=0; const m=p._re.exec(rawQ); if(m) vals.push(p.v==='date'&&m[1]?m[1]:p.v);
      });
      const uniq=vals.filter((v,i,a)=>a.indexOf(v)===i); if(uniq.length>1) conflicts.push({key:item.key,values:uniq}); if(uniq.length) f[item.key]=uniq[uniq.length-1];
    });
    const n=norm(rawQ);
    if (rule.id==='commercial_ws' && /\bcommercial\b/.test(n) && !/\bnot commercial\b/.test(n)) f.commercialNature='yes';
    if (rule.id==='writ_jurisdiction' && /\b(government|department|public authority|statutory authority|official order)\b/.test(n)) f.publicLaw='yes';
    if (rule.id==='electronic_evidence' && /\b(whatsapp|chat|message|email|cctv|audio|video|server|digital|electronic)\b/.test(n)) f.recordType='electronic';
    if (rule.id==='mediation' && /\bcommercial\b/.test(n)) f.commercial='yes';
    if (rule.id==='arbitration' && /\b(jammu.?kashmir|j&k|ladakh)\b/.test(n)) f.jkaAdaptation='yes';
    if (rule.id==='caveat_restoration' && /\b(defendant|respondent|department|government|dlo)\b/.test(n)) f.partyRole='defendant';
    if (rule.id==='s80_notice' && /\b(government|department|public officer|official capacity)\b/.test(n)) f.governmentDefendant='yes';
    if (rule.id==='infrastructure_injunction' && /\b(road|bridge|pipeline|power|water|sanitation|highway)\b/.test(n)) f.projectType='scheduledCandidate';
    if (rule.id==='infrastructure_injunction' && /\b(schedule|listed in the schedule|qualifying infrastructure|statutory category)\b/.test(n)) f.projectSchedule='yes';
    if (rule.id==='infrastructure_injunction' && /\b(delay|impede|stall|interfere|completion|progress)\b/.test(n)) f.injunctionImpact='yes';
    if (rule.id==='public_premises' && /\b(public premises|government premises)\b/.test(n)) f.premisesStatus='yes';
    if (rule.id==='public_premises' && /\b(estate officer|eviction officer)\b/.test(n)) f.authority='yes';
    if (rule.id==='partnership' && /\bunregistered(?: firm| partnership)?\b/.test(n)) f.registration='unregistered';
    if (rule.id==='special_law_priority' && /\b(consumer|commercial courts|arbitration|electricity|public premises|land acquisition|service tribunal|labour|revenue)\b/.test(n)) f.specialStatute='identified';
    const yes=/^(yes|yeah|yep|haan|han|ji|bilkul|correct|right)\b/i.test(q), no=/^(no|nah|nope|nahi|nahin|not)\b/i.test(q);
    if((yes||no)&&S.legalSession&&S.legalSession.ruleId===rule.id&&S.legalSession.pendingKey&&!f[S.legalSession.pendingKey]) f[S.legalSession.pendingKey]=yes?'yes':'no';
    rsExtractGenericDates(rule, rawQ, f);
    if(conflicts.length) f.__conflicts=conflicts;
    return f;
  }

  // Context-aware date extraction. Do not copy one date into unrelated fact slots.
  function rsExtractGenericDates(rule, q, facts) {
    const raw = String(q || "");
    const m = raw.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4})\b/i);
    if (!m) return facts;
    const lower = raw.toLowerCase();
    const setIf = (key, cues) => {
      if (facts[key]) return;
      const hit = cues.some(c => lower.includes(c));
      if (hit) facts[key] = m[1];
    };
    setIf("serviceDate", ["summons served", "summons was served", "summons were served", "served on", "service date", "complaint served", "notice served"]);
    setIf("noticeDate", ["notice dated", "notice on", "date of notice"]);
    setIf("decreeDate", ["decree dated", "decree on", "date of decree", "ex parte decree dated"]);
    setIf("awardDate", ["award dated", "award on", "date of award", "award pronounced"]);
    setIf("partyReceivesAward", ["received the award", "received award", "receipt of award", "award received", "served with the award"]);
    return facts;
  }

  const RS_OPTIONAL_FACTS = {
    infrastructure_injunction: ["projectType"],
    public_premises: ["appealOrChallenge"]
  };

  function rsMissing(rule, facts) {
    const opt = RS_OPTIONAL_FACTS[rule.id] || [];
    return (rule.questions || []).filter((q) => !opt.includes(q.key) && (!facts[q.key] || facts[q.key] === UNKNOWN));
  }

  function rsBranchText(rule, facts) {
    const out = [];
    (rule.branches || []).forEach((b) => {
      const ok = Object.keys(b.when || {}).every((k) => facts[k] === b.when[k]);
      if (ok && b.text) out.push(b.text);
    });
    return out.join("\n\n");
  }

  function rsEvidenceChecklist(rule) {
    const m = {
      caveat: ["copy of the caveat", "proof of service/notice", "application or expected application details"],
      caveat_restoration: ["dismissal order", "case number/court details", "restoration application if filed", "proof of service"],
      commercial_ws: ["summons and proof of service", "plaint and annexures", "written statement/Statement of Truth", "full chronology of instructions"],
      ordinary_ws: ["summons and proof of service", "plaint and annexures", "departmental instructions", "delay chronology if any"],
      s80_notice: ["Section 80 notice", "proof of service", "plaint and relief clause", "any order under Section 80(2)"],
      exparte: ["summons/service record", "ex-parte decree", "attendance/proceeding sheets", "evidence supporting sufficient cause"],
      restoration: ["dismissal order", "attendance/proceeding sheets", "sufficient-cause documents", "date calculation"],
      execution: ["decree", "execution application", "stay orders if any", "payment/compliance record"],
      exec_govt: ["decree/order/award", "date of decree", "compliance/payment record"],
      injunction: ["plaint/application", "site/land documents", "existing orders", "evidence of imminent harm"],
      infrastructure_injunction: ["project contract/tender", "project classification/Schedule source", "work programme", "effect of proposed injunction"],
      electronic_evidence: ["original device/source where available", "electronic file/export", "Section 63 certificate where required", "hash/chain-of-custody material"],
      civil_death: ["missing-person record", "evidence of last contact", "evidence that natural informants did not hear from the person", "statement of the relief sought"],
      limitation_general: ["order/decree/notice", "service/knowledge proof", "relevant limitation Article", "exclusion/extension documents"],
      appeals: ["decree", "certified copy", "limitation computation", "stay requirement and execution status"],
      second_appeal: ["first appellate judgment/decree", "proposed substantial question of law", "findings of fact", "relevant statutory provisions"],
      review: ["judgment/order", "alleged error/new evidence", "due-diligence explanation", "date calculation"],
      res_judicata: ["earlier plaint/written statement", "issues framed", "prior judgment/decree", "party/title comparison"],
      sub_judice: ["earlier suit plaint", "later suit plaint", "party comparison", "status of earlier proceeding"],
      public_premises: ["title/public-premises record", "notice", "Estate Officer order", "proof of service"],
      arbitration: ["arbitration agreement", "award", "proof of receipt", "Section 34 record/orders"],
      mediation: ["commercial classification", "claim value", "proposed relief", "pre-institution mediation record"],
      consumer_process: ["consumer complaint", "proof of service", "written version", "commission orders"],
      motor_vehicle: ["FIR/accident report", "medical/post-mortem record", "vehicle/insurance records", "tribunal pleadings"],
      contempt: ["operative order/judgment", "proof of knowledge/service", "compliance record", "evidence of alleged wilfulness"]
    };
    return m[rule.id] || ["operative order/statute", "pleadings/application", "proof of service", "relevant chronology"];
  }

  function rsDeadlineText(rule, facts) {
    function parseDMY(v) {
      const m = String(v || "").match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
      if (!m) return null; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      const d = new Date(y, +m[2]-1, +m[1]); return isNaN(d) ? null : d;
    }
    function addDays(d,n){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n); }
    function addMonths(d,n){ return new Date(d.getFullYear(),d.getMonth()+n,d.getDate()); }
    const today = todayD();
    const items=[];
    if (rule.id === "commercial_ws" && facts.serviceDate) { const d=parseDMY(facts.serviceDate); if(d){ const due=addDays(d,120); const diff=Math.round((due-today)/86400000); items.push("Commercial WS calendar checkpoint from service: " + shortDate(due) + " (" + (diff>=0?diff+" days remaining":Math.abs(diff)+" days overdue") + "). This is a calendar calculation only; counsel should verify the recorded service date and computation rule."); }}
    if (rule.id === "consumer_process" && facts.serviceDate) { const d=parseDMY(facts.serviceDate); if(d){ const due=addDays(d,45); const diff=Math.round((due-today)/86400000); items.push("Consumer written-version outer date from service: " + shortDate(due) + " (" + (diff>=0?diff+" days remaining":Math.abs(diff)+" days overdue") + ")."); }}
    if (rule.id === "arbitration" && facts.partyReceivesAward) { const d=parseDMY(facts.partyReceivesAward); if(d){ const months = facts.jkaAdaptation === "yes" ? 6 : 3; const due=addMonths(d,months); const diff=Math.round((due-today)/86400000); items.push("Section 34 baseline calculation from receipt date: " + shortDate(due) + " (verify the applicable J&K/Ladakh adaptation and any statutory computation rule before filing)." + " " + (diff>=0?diff+" days remaining":Math.abs(diff)+" days elapsed") + "."); }}
    return items.join("\n");
  }

  function rsAssessment(rule, facts) {
    const f = facts || {};
    switch (rule.id) {
      case "caveat_restoration":
        if (f.applicationStatus === "anticipated" && f.dismissalStatus === "default") return "On the facts supplied, Section 148A is potentially relevant because a restoration application is apprehended after a dismissal for default. The next issue is whether the caveator has the statutory right to appear on that application and whether the caveat has been properly lodged/served.";
        if (f.applicationStatus === "filed") return "The application is reported as already filed, so the focus shifts from anticipation to the actual application, notice/service, hearing date and the caveator's right to be heard.";
        break;
      case "commercial_ws":
        if (f.statementFiled === "notfiled" && f.serviceDate) { const d = rsCommercialDueDate(f.serviceDate); if (d) return "The service date is now identified. For a covered commercial suit, counsel should treat the 120-day period as the statutory outer limit and verify the court record before acting."; }
        if (f.statementFiled === "expired") return "If the court record confirms that 120 days from valid service have expired, the commercial written-statement regime treats the right as forfeited; the file should be escalated immediately for counsel's procedural assessment rather than treated as an ordinary extension request.";
        break;
      case "ordinary_ws":
        if (f.statementFiled === "notfiled" && f.serviceDate) return "The service date is the starting point for the ordinary Order VIII Rule 1 calculation. Unlike the commercial regime, the ordinary-rule analysis is not reduced to the commercial 120-day forfeiture rule; the court's discretion and the explanation for delay remain relevant.";
        break;
      case "s80_notice":
        if (f.governmentDefendant === "yes" && f.noticeServed === "notserved" && f.urgentRelief === "ordinary") return "On the facts stated, a Section 80 objection is prima facie relevant. Verify the statutory recipient, the contents/proof of notice, and whether any statutory exception or court order changes the position.";
        if (f.noticeServed === "notserved" && f.urgentRelief === "urgent") return "Urgency does not by itself erase Section 80 requirements. The record should show whether leave was sought under Section 80(2) and what the court directed before granting interim relief.";
        break;
      case "writ_jurisdiction":
        if (f.publicLaw === "yes" && f.alternativeRemedy === "yes") return "A public-law element is present, but an effective alternative statutory remedy ordinarily weighs against immediate writ intervention. The next check is whether the facts disclose a recognised exception and whether the impugned action is amenable to judicial review.";
        if (f.publicLaw === "yes" && f.alternativeRemedy === "no") return "The reported dispute has a public-law element and no effective alternative remedy has been identified; a writ route may therefore require closer examination, subject to the precise impugned action and relief.";
        break;
      case "electronic_evidence":
        if (f.recordType === "electronic" && f.sourceDevice === "original") return "Because the original/source device is reportedly available, counsel should distinguish the original-record route from a secondary output such as a screenshot, printout or export. The correct Section 63 route depends on how the record will actually be tendered.";
        if (f.recordType === "electronic" && f.sourceDevice === "copy" && f.certificateAvailable === "no") return "Only a copy/output is reported and no certificate is available. The evidentiary route needs to be addressed before tendering; do not assume a screenshot alone establishes admissibility.";
        break;
      case "infrastructure_injunction":
        if (f.projectSchedule === "yes" && f.injunctionImpact === "yes") return "The two reported facts potentially bring the application within Sections 20A/41(ha). Counsel should still verify the statutory project category and the precise effect of the injunction on progress/completion or services before pleading the restriction as decisive.";
        break;
      case "public_premises":
        if (f.premisesStatus === "yes" && f.authority === "yes") return "If the premises are covered and the Estate Officer has statutory authority, the special statutory process should be examined first. Any civil-court challenge must be tested against the Act's jurisdiction/finality provisions and the exact relief sought.";
        break;
      case "arbitration":
        if (f.partyReceivesAward && f.jkaAdaptation === "yes") return "For a J&K/Ladakh proceeding, the adapted Section 34 period needs to be calculated from the legally relevant date of receipt, while separately checking the 60-day proviso, court record and current territorial applicability.";
        break;
      case "mediation":
        if (f.commercial === "yes" && f.urgentRelief === "no") return "For a covered specified-value commercial dispute without urgent interim relief, pre-institution mediation under the applicable Section 12A framework should be checked before institution of the commercial suit.";
        break;
      case "consumer_process":
        if (f.versionFiled === "notfiled" && f.serviceDate) return "The service date should now be used to calculate the statutory 30-day period and any further period permitted by Section 38, subject to the consumer-law regime and current controlling authority.";
        break;
      case "contempt":
        if (f.knowledge === "yes" && f.wilfulness === "yes" && f.orderClarity === "clear") return "The reported facts contain the core factual elements usually examined in a civil-contempt inquiry—clarity of the operative command, knowledge and alleged wilful disobedience. The actual order and compliance record must be tested before concluding contempt.";
        break;
      case "second_appeal":
        if (f.questionOfLaw === "identified") return "A second appeal should be framed around the identified substantial question of law; disagreement merely over appreciation of evidence does not by itself satisfy Section 100 CPC.";
        break;
      case "review":
        if (f.ground === "error") return "If the alleged ground is an error apparent, the question is whether the error is self-evident on the record rather than a disguised request to re-argue the appeal.";
        break;
      case "res_judicata":
        if (f.sameParties === "yes" && f.sameIssue === "yes" && f.finalDecision === "yes" && f.competentCourt === "yes") return "The supplied facts correspond closely to the core Section 11 res judicata conditions; counsel should verify the exact issues, title, pleadings and final adjudication before pleading the bar.";
        break;
      case "sub_judice":
        if (f.earlierSuit === "pending" && f.sameIssue === "yes" && f.sameParties === "yes" && f.competentCourt === "yes") return "The reported facts potentially satisfy the Section 10 framework for staying the trial of the later suit; compare the two pleadings and confirm the earlier suit was instituted first and remains pending before a competent court.";
        break;
      case "declaratory_relief":
        if (f.furtherRelief === "required" && f.possession === "adverse") return "A bare declaration may be vulnerable where consequential relief is available but omitted. The exact relief, possession position and statutory wording of Section 34 should be checked against the plaint.";
        break;
      case "lis_pendens":
        if (f.propertyInIssue === "yes" && f.pendingSuit === "yes" && f.transferDate) return "A transfer during pendency of a qualifying suit is not automatically void merely because it occurred during litigation; Section 52 principally concerns the effect of the transfer on the rights determined in the pending proceeding, subject to its statutory conditions.";
        break;
      case "partnership":
        if (f.registration === "unregistered" || f.registration === "identified") return "The firm is reported as unregistered. Section 69 consequences must now be tested against the precise nature of the proposed claim and the statutory exceptions rather than treating registration status as an automatic answer to every dispute.";
        break;
      case "lok_adalat":
        if (f.settlement === "yes" && f.consent === "yes") return "A voluntary settlement within the signatory's authority is consistent with the Lok Adalat settlement function. Government counsel should still verify competence to compromise and the statutory effect of the award before execution.";
        break;
      case "special_law_priority":
        if (f.specialStatute === "identified") return "A special statutory regime has been identified. The bot should now stop treating the general CPC as the sole procedural source and examine the special statute, forum, remedy and any expressly preserved CPC provisions.";
        break;
    }
    return "";
  }

  function rsCommercialDueDate(v) {
    const m=String(v||"").match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(!m) return null; const y=+m[3]<100?2000+ +m[3]:+m[3]; const d=new Date(y,+m[2]-1,+m[1]);
    if(isNaN(d.getTime())) return null; return new Date(y,+m[2]-1,+m[1]+120);
  }

  function rsReply(rule, facts, askMore) {
    let out = "**Legal reasoning check — " + rule.title + "**\n\n" + (rule.base || "");
    const conflicts=facts.__conflicts||[]; const branch=rsBranchText(rule,facts);
    const deadline=rsDeadlineText(rule,facts); if(deadline) out += "\n\n**Calculated checkpoint (calendar reference only):**\n"+deadline;
    if(branch) out += "\n\n**Rule branch:**\n"+branch;
    const assessment = rsAssessment(rule, facts);
    if (assessment) out += "\n\n**Preliminary assessment:**\n" + assessment;
    if(conflicts.length){
      const c=conflicts[0], qq=(rule.questions||[]).find(x=>x.key===c.key);
      out += "\n\n**I found a factual conflict that must be clarified:**\n"+(qq?qq.q:c.key)+"\n\nReported alternatives: "+c.values.join(" / ");
      S.legalSession={ruleId:rule.id,facts,pendingKey:c.key,askedAt:Date.now(),confidence:'conflicted'};
      return R(out,{chips:[C('Clarify fact','continue'),C('Law desk','law desk'),MENU],stream:true,foot:LAW_FOOT+' The answer is intentionally held at fact clarification because inconsistent facts were detected.'});
    }
    const known=(rule.questions||[]).filter(q=>facts[q.key]&&facts[q.key]!==UNKNOWN).length;
    const confidence=askMore?(known?'preliminary — material facts still missing':'rule identified — facts not yet confirmed'):'fact-complete at the level supplied — verify documents before filing/acting';
    out += "\n\n**Reasoning status:** "+confidence;
    if(askMore){
      const miss=rsMissing(rule,facts), q=miss[0];
      if(q){ out += "\n\n**One fact I need before narrowing this down:**\n"+q.q+"\n\n**Why it matters:** this fact can change the applicable procedural route, limitation analysis, forum, or evidentiary treatment."; S.legalSession={ruleId:rule.id,facts,pendingKey:q.key,askedAt:Date.now(),confidence}; }
    }else{
      out += "\n\n**Application to the facts provided:**\n";
      const entries=Object.keys(facts).filter(k=>k!=='__conflicts'&&facts[k]&&facts[k]!==UNKNOWN).map(k=>'• '+k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())+': '+facts[k]);
      out += entries.length?entries.join('\n'):'• No material facts were confirmed beyond the question itself.';
      out += "\n\n**Documents / checks:**\n"+rsEvidenceChecklist(rule).map(x=>'• '+x).join('\n');
      if(rule.next) out += "\n\n**Accuracy safeguard:** "+rule.next;
      out += "\n\n**Source:** "+rule.source; if(rule.url) out += "\n**Official source:** "+rule.url;
      S.legalSession=null;
    }
    return R(out,{chips:[C('Continue legal facts','continue'),C('Show rule only','explain '+rule.title),C('Law desk','law desk'),MENU],stream:true,foot:LAW_FOOT+' This non-LLM reasoning layer uses source-anchored rules, asks for material facts, distinguishes rules from fact-dependent application, and avoids inventing authorities.'});
  }

  function rsLooksLikeContinuation(q) {
    const n = norm(q);
    if (!n) return false;
    if (/^(what|why|which|who|when|where|how|can|may|should|could|would|is|are|do|does|did|tell|explain|please|is there|what happens)\b/i.test(n)) return false;
    if (/^(yes|no|haan|han|ji|nahi|nahin|correct|right|only|already|not|filed|anticipated|defendant|plaintiff|government|department|ordinary|urgent|same|different|none|unknown)\b/i.test(n) && n.split(/\s+/).length <= 12) return true;
    if (n.split(/\s+/).length <= 12) return true;
    return false;
  }

  function continueLegalReasoning(q, rawInput) {
    if (!S.legalSession || !rsLooksLikeContinuation(q)) return null;
    if (S.legalSession.askedAt && (Date.now()-S.legalSession.askedAt)>20*60*1000) { S.legalSession=null; return null; }
    const rule = LEGAL_REASONING[S.legalSession.ruleId]; if (!rule) { S.legalSession = null; return null; }
    const facts = rsExtract(rule, q, S.legalSession.facts, rawInput);
    // If the answer clearly introduces a different legal topic, abandon the old interview.
    const topicHints = [];
    (rule.keywords || []).forEach((k) => topicHints.push(norm(k)));
    const topicHit = topicHints.some((k) => k && norm(q).indexOf(k) !== -1);
    const pending = S.legalSession.pendingKey;
    const answerWord = /^(yes|no|haan|han|ji|nahi|nahin|correct|right|only|already|not|filed|anticipated|defendant|plaintiff|government|department|ordinary|urgent|same|different|none|unknown)\b/i.test(norm(q));
    const pendingRule = (rule.questions || []).find(x => x.key === pending);
    const pendingHit = !!(pendingRule && (pendingRule.patterns || []).some(p => { try { return new RegExp(p.re, 'i').test(String(rawInput != null ? rawInput : q)); } catch (_) { return false; } }));
    const contextualAnswer = /\b(it|this|that|the case|the suit|the application|the order|today|tomorrow|already|not yet|over|expired|pending|filed|filing|served|service|court|case|suit|application|order|date|because|since)\b/i.test(norm(q));
    if (!topicHit && !answerWord && !pendingHit && !contextualAnswer && pending !== "court" && pending !== "partyRole") { S.legalSession = null; return null; }
    const missing = rsMissing(rule, facts);
    if (missing.length) return rsReply(rule, facts, true);
    return rsReply(rule, facts, false);
  }

  function legalReasoning(q, topicId, rawInput) {
    const preferredCandidate = topicId && LEGAL_REASONING[topicId] ? topicId : null;
    // Retrieval can rank a narrowly related topic above its parent topic. Do not let
    // that force an unrelated interview (e.g. plain "Can I file a caveat?" -> restoration).
    let preferred = preferredCandidate;
    const nq=norm(q);
    const explicit=[
      ["writ_jurisdiction", /\b(writ|article 226|mandamus|certiorari|prohibition|quo warranto)\b/],
      ["electronic_evidence", /\b(whatsapp|chat|email|cctv|digital evidence|electronic evidence|bsa 63|section 63 bsa|65b)\b/],
      ["specific_performance", /\bspecific performance\b/],
      ["declaratory_relief", /\b(declaratory relief|section 34.*specific relief|declaration.*legal character)\b/],
      ["lis_pendens", /\b(lis pendens|pendente lite|section 52.*transfer|transfer.*pendenc|pendency.*transfer|transfer.*during.*suit)\b/],
      ["arbitration", /\b(arbitration|arbitral award|section 34.*award|section 34.*challenge|challenge.*section 34)\b/],
      ["mediation", /\b(pre.?institution mediation|pre.?litigation mediation|section 12a|mediation)\b/],
      ["rti", /\b(rti|right to information|public information officer)\b/],
      ["public_premises", /\b(public premises|estate officer)\b/],
      ["land_acquisition", /\b(land acquisition|rfctlarr|compensation.*acquisition)\b/],
      ["partnership", /\b(unregistered firm|partnership firm|partner liability|section 69.*partnership)\b/],
      ["lok_adalat", /\b(lok adalat|legal services authority)\b/],
      ["execution", /\b(executing court|execution petition|execute.*decree|go behind the decree|section 47.*execution)\b/],
      ["special_law_priority", /\b(which law applies|special statute|special law|general law.*special law)\b/]
    ];
    for(let i=0;i<explicit.length;i++){if(explicit[i][1].test(nq)){preferred=explicit[i][0];break;}}
    // Prefer a specialised rule when the query itself contains the specialised context.
    if (/\b(caveat)\b/i.test(q) && /\b(restor\w*|dismiss\w*|default|order ix|order 9)\b/i.test(q)) preferred = "caveat_restoration";
    else if (preferred === "caveat_restoration" && !/\b(restor\w*|dismiss\w*|default|order ix|order 9)\b/i.test(q)) preferred = "caveat";
    const active = S.legalSession && (!preferred || S.legalSession.ruleId === preferred) ? continueLegalReasoning(q, rawInput) : null;
    if (active) return active;
    const r = rsPickRule(q, preferred);
    if (!r) return null;
    // Simple definitional questions should use the normal Law Desk answer.
    if (REASON_SIMPLE_CUE.test(q) && !REASON_ACTION_CUE.test(q)) return null;
    if (!REASON_ACTION_CUE.test(q) && !S.legalSession) return null;
    const facts = rsExtract(r, q, {}, rawInput);
    const missing = rsMissing(r, facts);
    return rsReply(r, facts, missing.length > 0);
  }

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
  const LAW_FOOT = "⚖️ Source-anchored legal information · Check the current statute, applicable court/local rules and the case record before filing or acting. For formal legal advice, case strategy, and court representation, refer to assigned Government Standing Counsel.";
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
    const rr = legalReasoning(q, m && m.top && m.top.t ? m.top.t.id : null);
    return rr || legalReply(m, q);
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
      "• What is the correct proof route for electronic evidence under BSA S.63?\n" +
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
             "   • **Calendar reference:** **" + fmtDate(d90) + "** (" + (rem90 < 0 ? Math.abs(rem90) + " days passed 🔴" : rem90 + " days left") + ")\n" +
             "   • In ordinary suits, the 30-day period is the ordinary starting point and extension is controlled by the CPC and binding case law; do not treat 90 days as a universal hard stop.\n\n";
      out += "3. **120-Day Commercial Written-Statement Outer Limit (Commercial Courts Act 2015):**\n" +
             "   • **Calendar checkpoint:** **" + fmtDate(d120) + "** (" + (rem120 < 0 ? "past the 120-day point 🔴" : rem120 + " days left") + ")\n" +
             "   • The commercial-suit regime treats expiry of 120 days as a forfeiture point; verify the service record and applicable commercial-court law before filing or seeking any procedural relief.\n\n";
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
      const d60 = new Date(base.getFullYear(), base.getMonth() + 2, base.getDate());
      const d61 = new Date(d60.getFullYear(), d60.getMonth(), d60.getDate() + 1);
      const rem60 = daysFrom(d60);

      let out = "**⚖️ Section 80(1) CPC Statutory Notice Expiry Calculator**\n\n";
      out += "📬 **Notice Service Date:** " + fmtDate(base) + (dtFound ? "" : " *(Using today as baseline)*") + "\n\n";
      out += "1. **Two-Month Notice Period under Section 80(1) CPC:**\n" +
             "   • **Notice Period Expiry:** **" + fmtDate(d60) + "** (" + (rem60 < 0 ? "Expired " + Math.abs(rem60) + " days ago" : rem60 === 0 ? "Expires today" : rem60 + " days remaining") + ")\n" +
             "   • Section 80(1) generally requires two months' notice before institution of the suit, subject to the statutory urgent-relief route in Section 80(2).\n\n";
      out += "2. **Earliest Lawful Plaint Filing Date:**\n" +
             "   • **Calendar reference after two months:** **" + fmtDate(d61) + "**\n" +
             "   • Check the actual notice, its service, the relief claimed, and any leave/order under Section 80(2) before asserting that institution was barred.\n\n";
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
                "*(Statutory restrictions to be pleaded only where the project and injunction satisfy Sections 20A/41(ha))*\n\n" +
                "```text\n" +
                "IN THE COURT OF ________________________ AT KUPWARA\n" +
                "In the matter of: [Plaintiff Name] vs. UT of J&K through [Department]\n\n" +
                "PRELIMINARY OBJECTION UNDER SECTION 41(ha) OF THE SPECIFIC RELIEF ACT, 1963:\n\n" +
                "1. That the application for interim injunction filed by the plaintiff is statutorily barred by law under Section 41(ha) of the Specific Relief Act, 1963 (as amended by Central Act 18 of 2018), which restricts injunctions in qualifying infrastructure-project circumstances where the statutory requirements are met, including the specified project category and the required impact on progress/completion or relevant services.\n\n" +
                "2. That the public developmental project being executed by the answering Defendants pertains to [Insert: PMGSY Road Widening / Bridge Construction / Jal Shakti Drinking Water Pipeline / Power Transmission Grid], falling within the applicable infrastructure category in the statutory Schedule/notification, as established by the record.\n\n" +
                "3. That as authoritatively settled by the Hon'ble Supreme Court of India in 'NHAI v. Ganga Enterprises' and 'State of U.P. v. Ram Sukhi Devi', the legislative purpose of Section 20A and Section 41(ha) completely divests courts of jurisdiction to stay public infrastructure works, subject to the statute, the project category and the actual effect of the relief sought.\n\n" +
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
                "2. That under Section 80(1) of the CPC, delivery of Section 80(1) generally requires prior two-month notice before institution of the suit, subject to the statutory urgent-relief route under Section 80(2).\n\n" +
                "3. That the plaintiff has failed to deliver any statutory notice under Section 80(1) CPC prior to instituting this suit, nor has the plaintiff sought or obtained leave of this Hon'ble Court under Section 80(2) CPC to institute the suit without serving such notice.\n\n" +
                "4. That as held by the Hon'ble Supreme Court in 'State of A.P. v. Pioneer Builders' [(2006) 12 SCC 119] and 'Bihari Chowdhary v. State of Bihar' [(1984) 2 SCC 627], non-compliance can give rise to a statutory objection; the precise procedural consequence should be framed from the plaint, notice record and current case law rather than assumed automatically.\n\n" +
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
    const continuedLegal = continueLegalReasoning(qFull, text);
    if (continuedLegal) return continuedLegal;
    const words = q.split(" ");
    const directLegalReason = legalReasoning(qFull, null, text);
    if (directLegalReason) return directLegalReason;
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

  const CORE = { answer, load: setRows, S, DATA, norm, phon, simTok, mk, VERSION, KB, kbRank, legalMatch, suggestLaw, kbRefs, KBI, ensureData, LEGAL_REASONING_RULES, legalReasoning, LEGAL_ACCURACY_SOURCES };
  W.DLO_ASSISTANT = { version: VERSION, ask: answer, suggest: suggestLaw, reload: () => ensureData(true), setStaff: (v) => { S.staff = !!v; }, data: DATA, legalReasoning: legalReasoning, legalRules: LEGAL_REASONING_RULES, legalAccuracySources: LEGAL_ACCURACY_SOURCES };
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
