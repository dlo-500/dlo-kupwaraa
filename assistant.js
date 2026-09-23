/*!
 * DLO Kupwara Assistant · NK.2.0 — dlokupwara.in
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
 *
 * SETUP (once, BEFORE this script tag, on every page):
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

  const VERSION = "NK.2.0";
  const CFG = Object.assign(
    { supabaseUrl: "", supabaseKey: "", table: "case_diary", client: null, maxRows: 5000,
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
  const translate = (q) => q.split(" ").map((w) => (SYN[w] != null ? SYN[w] : w)).join(" ").replace(/\s+/g, " ").trim();

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
  const R = (text, o) => { o = o || {}; return { text, cards: o.cards || null, link: o.link || null, chips: o.chips || null, hl: o.hl || null }; };
  const C = (label, q) => ({ label, q });
  const MENU = C("« Main menu", "menu");
  const MAIN_CHIPS = [C("Today's hearings", "hearings today"), C("Hearings tomorrow", "hearings tomorrow"), C("Missing replies", "missing reply hearing soon"), C("Overdue cases", "overdue cases"), C("Statistics", "statistics"), C("Departments", "all departments"), C("Courts", "all courts"), C("Office info", "office hours and address")];

  function noData() {
    return R("I can't reach the live case registry from this page right now, so I can't search or count cases.\n\nOffice information still works — or use the portal's own search.", { link: PAGES.search, chips: [C("Office info", "office hours and address"), MENU] });
  }
  function openingReply() {
    const s = snapshot();
    let t = "Welcome to the " + OFFICE.name + " legal desk.\n\n";
    t += s ? "**Today:** " + s.today + " hearing(s) · **Next 7 days:** " + s.week + "\n**Overdue:** " + s.overdue + " · **Reply missing (hearing within 7 days):** " + s.missing + "\n\n"
           : "The live registry isn't reachable from this page, so case search and counts are unavailable right now.\n\n";
    t += "Type a litigant name or any word from a case title, a case number, a court, a department, or a date — for example “yaqoob khan”, “hearings tomorrow”, “PMGSY pending replies”.";
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
      return R(head, { chips: tchips.concat([C("Hearings this week", q2("hearings this week")), C("Overdue", q2("overdue")), C("Reply missing", q2("missing reply")), C("Ex-parte", q2("ex parte")), C("List active", q2("list active")), MENU]) });
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
    { id: "enquiry", re: /\b(enquir\w*|inquir\w*|complaint|send (a )?message|feedback|suggestion)\b/, kw: kwset("enquiry enquiries inquiry complaint send message feedback suggestion"),
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
      const tk = norm(text.slice(8)).split(" ").filter(Boolean), res = runSearch(tk, null);
      return res.exact.length ? casesReply(res, tk, false) : notFound(res, tk);
    }
    if (text === "__partial") return S.partial ? casesReply(S.partial.res, S.partial.rem, true) : moreReply();

    let q = fixTypos(translate(norm(text)));
    const words = q.split(" ");
    if (words.length <= 4) {
      if (/^(hi+|hello|hey|salam|salaam|assalam\w*|asalam\w*|namaste|adaab|good (morning|afternoon|evening))\b/.test(q)) return R((/^a?salam|^assalam|^salaam/.test(q) ? "Wa-alaikum assalam. " : "Hello. ") + "Ask about a case, court, department, hearings or the office.", { chips: MAIN_CHIPS });
      if (/^(thanks?|thank you|thx|ok+|okay|great|nice|acha|theek)\b/.test(q)) return R("You're welcome. Ask another question whenever you need.", { chips: [MENU] });
      if (/^(menu|help|start|main menu|what can you do|examples?|options)$/.test(q)) return openingReply();
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
      return fallback(text, q);
    }
    if (it && !(it.skipIfEntity && entity)) return it.run(q);
    const g = !entity ? generalData(q) : null; if (g) return g;
    if (entity) return filterReply(ent, wantList);
    if (explicit) return askParty();
    return fallback(text, q);
  }

  const CORE = { answer, load: setRows, S, DATA, norm, phon, simTok, mk, VERSION };
  W.DLO_ASSISTANT = { version: VERSION, ask: answer, reload: () => ensureData(true), setStaff: (v) => { S.staff = !!v; }, data: DATA };
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
    function renderChips(list) {
      chips.textContent = "";
      (list || []).forEach((c) => { const b = h("button", "dlo-chip-btn", c.label); b.type = "button"; b.addEventListener("click", () => ask(c.label, c.q)); chips.appendChild(b); });
    }
    function addUser(text) { const row = h("div", "dlo-msg-row user"); row.appendChild(h("div", "dlo-bubble", text)); body.appendChild(row); body.scrollTop = body.scrollHeight; }
    function addBot(rep) {
      const row = h("div", "dlo-msg-row bot"), b = h("div", "dlo-bubble"); rich(b, rep.text);
      if (rep.cards) rep.cards.forEach((r) => b.appendChild(buildCard(r, rep.hl)));
      if (rep.link && rep.link.url) { b.appendChild(document.createElement("br")); const a = h("a", "dlo-bubble-action", (rep.link.text || "Open") + " →"); a.href = rep.link.url; b.appendChild(a); }
      row.appendChild(b); body.appendChild(row);
      body.scrollTop = Math.max(0, row.offsetTop - 8);
      renderChips(rep.chips);
    }
    function typing() { const row = h("div", "dlo-msg-row bot"), b = h("div", "dlo-bubble dlo-typing"); for (let i = 0; i < 3; i++) b.appendChild(h("span")); row.appendChild(b); body.appendChild(row); body.scrollTop = body.scrollHeight; return row; }
    function ask(label, q) {
      addUser(label); renderChips([]);
      const t = typing();
      ensureData().then(() => {
        setTimeout(() => {
          t.remove();
          let rep; try { rep = answer(q); } catch (e) { rep = R("Something went wrong while answering that. Please rephrase, or use Search & Filter Cases.", { link: PAGES.search, chips: [MENU] }); }
          addBot(rep || askParty()); refreshHeader();
        }, 160);
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
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    setTimeout(() => { teaser.style.display = "none"; }, 12000);
    ensureData();   // warm the cache in the background
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
