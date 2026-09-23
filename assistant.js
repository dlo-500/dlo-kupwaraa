(function () {
  "use strict";
  if (window.__DLO_ASSISTANT_MOUNTED) return;
  window.__DLO_ASSISTANT_MOUNTED = true;

  // ─── 0. VERSION ──────────────────────────────────────────────────────────
  var DLO_ASSISTANT_VERSION = "NK.1.2";

  // ─── 1. OFFICIAL COURTS DIRECTORY & ALIASES (12 COURTS) ───────────────────
  var COURTS_LIST = [
    {
      id: "cjm_handwara",
      name: "CJM/SUB JUDGE HANDWARA",
      short: "CJM / Sub Judge Handwara",
      aliases: ["cjm", "cjm handwara", "sub judge handwara", "subjudge handwara", "chief judicial magistrate handwara", "chief judicial magistrate", "cjm court handwara", "cjm/sub judge handwara", "cjm sub judge", "handwara cjm", "jmfc handwara"]
    },
    {
      id: "dist_sessions",
      name: "PR. DISTRICT AND SESSIONS COURT KUPWARA",
      short: "Sessions Court Kupwara",
      aliases: ["sessions", "dist sessions", "pr district", "district court kupwara", "principal district and sessions", "sessions kupwara", "pdj kupwara", "pdj", "principal district", "sessions court", "district and sessions", "pr. district", "district sessions kupwara", "sessions judge kupwara"]
    },
    {
      id: "sub_kupwara",
      name: "Sub Judge Kupwara",
      short: "Sub Judge Kupwara",
      aliases: ["sub judge kupwara", "subjudge kupwara", "senior civil judge kupwara", "sub-judge kupwara", "scj kupwara", "civil judge senior division kupwara"]
    },
    {
      id: "addl_handwara",
      name: "ADDITIONAL DISTRICT AND SESSIONS COURT HANDWARA",
      short: "Addl. Sessions Handwara",
      aliases: ["additional sessions", "addl sessions", "addl handwara", "ad&sj handwara", "additional district court handwara", "additional district and sessions", "adsj handwara", "addj handwara", "addl. sessions", "additional sessions handwara"]
    },
    {
      id: "consumer",
      name: "CONSUMER COURT KUPWARA",
      short: "Consumer Court Kupwara",
      aliases: ["consumer", "consumer court", "dcdrc", "consumer commission", "consumer forum", "district consumer", "consumer disputes", "dcdrc kupwara"]
    },
    {
      id: "munsiff_kralpora",
      name: "Munsiff Kralpora",
      short: "Munsiff Kralpora",
      aliases: ["kralpora", "munsiff kralpora", "court kralpora", "munsif kralpora", "civil judge kralpora", "kralpora court"]
    },
    {
      id: "munsiff_kupwara",
      name: "MUNSIFF KUPWARA",
      short: "Munsiff Kupwara",
      aliases: ["munsiff kupwara", "munsif kupwara", "civil judge kupwara", "court of munsiff kupwara", "munsiff court kupwara"]
    },
    {
      id: "labour",
      name: "LABOUR COURT KUPWARA",
      short: "Labour Court Kupwara",
      aliases: ["labour court", "labor court", "industrial tribunal", "wage authority", "labour officer court", "labour tribunal"]
    },
    {
      id: "munsiff_sogam",
      name: "MUNSIFF SOGAM",
      short: "Munsiff Sogam",
      aliases: ["sogam", "munsiff sogam", "munsif sogam", "lolab court", "munsiff lolab", "court sogam", "sogam court", "lolab"]
    },
    {
      id: "sub_trehgam",
      name: "SUB JUDGE TREHGAM",
      short: "Sub Judge Trehgam",
      aliases: ["trehgam", "sub judge trehgam", "subjudge trehgam", "munsiff trehgam", "court trehgam", "trehgam court"]
    },
    {
      id: "munsiff_handwara",
      name: "MUNSIFF HANDWARA",
      short: "Munsiff Handwara",
      aliases: ["munsiff handwara", "munsif handwara", "court munsiff handwara", "civil judge handwara"]
    },
    {
      id: "mact",
      name: "MACT KUPWARA",
      short: "MACT Kupwara",
      aliases: ["mact", "accident claim", "motor accident", "mact tribunal", "claims tribunal", "motor accident claims", "maact", "accident tribunal"]
    }
  ];

  // ─── 2. DEPARTMENT DIRECTORY, ALIASES & FALLBACK SNAPSHOT ────────────────
  var DEPT_ALIASES = {
    "pmgsy": "R&b", "pwd": "R&b", "r&b": "R&b", "r and b": "R&b", "roads": "R&b", "bridges": "R&b",
    "public works": "R&b", "highways": "R&b", "rb": "R&b", "rnb": "R&b",
    "pdd": "PDD", "kpdcl": "PDD", "power": "PDD", "electricity": "PDD", "electric": "PDD",
    "power development": "PDD", "pdd kpdcl": "PDD",
    "jal shakti": "PHE/JAL SHAKTI", "phe": "PHE/JAL SHAKTI", "water": "PHE/JAL SHAKTI",
    "drinking water": "PHE/JAL SHAKTI", "jalshakti": "PHE/JAL SHAKTI", "phe jal shakti": "PHE/JAL SHAKTI",
    "i&fc": "I&FC", "ifc": "I&FC", "irrigation": "I&FC", "flood control": "I&FC", "i and fc": "I&FC",
    "ulb": "URBAN LOCAL BODIES", "urban local bodies": "URBAN LOCAL BODIES", "municipality": "URBAN LOCAL BODIES",
    "mc kupwara": "URBAN LOCAL BODIES", "mc handwara": "URBAN LOCAL BODIES", "municipal council": "URBAN LOCAL BODIES",
    "municipal committee": "URBAN LOCAL BODIES", "sanitation": "URBAN LOCAL BODIES", "urban": "URBAN LOCAL BODIES",
    "langate": "URBAN LOCAL BODIES",
    "revenue": "Revenue", "patwari": "Revenue", "tehsildar": "Revenue", "naib tehsildar": "Revenue",
    "girdawar": "Revenue", "land": "Revenue", "mutation": "Revenue", "demarcation": "Revenue",
    "kahcharai": "Revenue", "state land": "Revenue", "evacuee": "Revenue", "nazool": "Revenue",
    "collector": "Revenue", "land acquisition": "Revenue",
    "rdd": "RDD", "rural development": "RDD", "bdo": "RDD", "panchayat": "RDD", "vlw": "RDD", "acd": "RDD",
    "education": "EDUCATION", "school": "EDUCATION", "teacher": "EDUCATION", "ceo kupwara": "EDUCATION",
    "zep": "EDUCATION", "zeo": "EDUCATION", "ceo": "EDUCATION",
    "samagra": "SMAGRA SHIKSHA", "smagra shiksha": "SMAGRA SHIKSHA", "samagra shiksha": "SMAGRA SHIKSHA",
    "health": "HEALTH AND MEDICAL EDUCATION", "hospital": "HEALTH AND MEDICAL EDUCATION",
    "doctor": "HEALTH AND MEDICAL EDUCATION", "medical": "HEALTH AND MEDICAL EDUCATION",
    "cmo kupwara": "HEALTH AND MEDICAL EDUCATION", "bmo": "HEALTH AND MEDICAL EDUCATION",
    "cmo": "HEALTH AND MEDICAL EDUCATION", "h&me": "HEALTH AND MEDICAL EDUCATION",
    "social welfare": "SOCIAL WELFARE", "icds": "SOCIAL WELFARE", "anganwadi": "SOCIAL WELFARE", "pension": "SOCIAL WELFARE",
    "dsw": "SOCIAL WELFARE",
    "forest": "FOREST", "jungle": "FOREST", "wildlife": "FOREST", "dfo": "FOREST", "timber": "FOREST", "sfc": "FOREST",
    "range officer": "FOREST",
    "home": "HOME", "police": "HOME", "fir": "HOME", "ssp kupwara": "HOME", "sho": "HOME", "thana": "HOME",
    "ssp": "HOME",
    "fcs&ca": "FCS&CA", "capd": "FCS&CA", "ration": "FCS&CA", "food supplies": "FCS&CA", "fcsca": "FCS&CA",
    "food safety": "Food Safety officer", "fso": "Food Safety officer", "food safety officer": "Food Safety officer",
    "horticulture": "HORTICULTURE", "fruit": "HORTICULTURE", "apple": "HORTICULTURE",
    "agriculture": "AGRICULTURE", "kissan": "AGRICULTURE", "kisan": "AGRICULTURE",
    "animal husbandary": "ANIMAL HUSBANDARY", "animal husbandry": "ANIMAL HUSBANDARY",
    "veterinary": "ANIMAL HUSBANDARY", "aho": "ANIMAL HUSBANDARY",
    "sheep": "SHEEP HUSBANDRY", "sheep husbandry": "SHEEP HUSBANDRY",
    "jkedi": "JKEDI", "edi": "JKEDI",
    "industries": "INDUSTRIES AND COMMERCE", "commerce": "INDUSTRIES AND COMMERCE", "dic": "INDUSTRIES AND COMMERCE",
    "geology": "GEOLOGY AND MINING", "mining": "GEOLOGY AND MINING",
    "transport": "TRANSPORT", "rto": "TRANSPORT", "arvo": "TRANSPORT",
    "skill": "SKILL DEVELOPMENT", "iti": "SKILL DEVELOPMENT", "skill development": "SKILL DEVELOPMENT",
    "defence estates": "DEFENCE ESTATES", "army land": "DEFENCE ESTATES", "deo": "DEFENCE ESTATES",
    "uoi": "UOI", "union of india": "UOI", "union india": "UOI",
    "sports": "YOUTH SERVICES AND SPORTS", "youth": "YOUTH SERVICES AND SPORTS", "yss": "YOUTH SERVICES AND SPORTS",
    "culture": "CULTURE",
    "science": "SCIENCE AND TECHNOLOGY", "science and technology": "SCIENCE AND TECHNOLOGY",
    "relief": "RELIEF", "disaster": "RELIEF",
    "jkrlm": "JKRLM", "nrlm": "JKRLM", "umed": "JKRLM",
    "information": "INFORMATION", "dipr": "INFORMATION", "information department": "INFORMATION"
  };

  var FALLBACK_METRICS = {
    total: "392", active: "365", disposed: "27",
    replyPending: "261", replyFiled: "131", exparte: "47",
    rate: "7%", courts: "12", depts: "30",
    urgent48h: "16", overdue: "126", missingSoon: "28",
    counselZubair: "200", counselWasim: "192"
  };

  var FALLBACK_COURTS = {
    "CJM/SUB JUDGE HANDWARA": { total: "107", active: "100", disposed: "7", replyPending: "51", exparte: "5" },
    "PR. DISTRICT AND SESSIONS COURT KUPWARA": { total: "73", active: "70", disposed: "3", replyPending: "46", exparte: "3" },
    "Sub Judge Kupwara": { total: "57", active: "52", disposed: "5", replyPending: "38", exparte: "13" },
    "ADDITIONAL DISTRICT AND SESSIONS COURT HANDWARA": { total: "46", active: "39", disposed: "7", replyPending: "26", exparte: "1" },
    "CONSUMER COURT KUPWARA": { total: "24", active: "23", disposed: "1", replyPending: "22", exparte: "1" },
    "Munsiff Kralpora": { total: "19", active: "17", disposed: "2", replyPending: "17", exparte: "9" },
    "MUNSIFF KUPWARA": { total: "18", active: "18", disposed: "0", replyPending: "18", exparte: "7" },
    "LABOUR COURT KUPWARA": { total: "15", active: "15", disposed: "0", replyPending: "4", exparte: "0" },
    "MUNSIFF SOGAM": { total: "14", active: "14", disposed: "0", replyPending: "12", exparte: "3" },
    "SUB JUDGE TREHGAM": { total: "9", active: "8", disposed: "1", replyPending: "8", exparte: "4" },
    "MUNSIFF HANDWARA": { total: "6", active: "5", disposed: "1", replyPending: "3", exparte: "1" },
    "MACT KUPWARA": { total: "4", active: "4", disposed: "0", replyPending: "1", exparte: "0" }
  };

  var FALLBACK_DEPTS = {
    "Revenue": { total: "87", active: "81", disposed: "6", replyPending: "54", replyFiled: "27", exparte: "13" },
    "URBAN LOCAL BODIES": { total: "68", active: "61", disposed: "7", replyPending: "47", replyFiled: "14", exparte: "5" },
    "R&b": { total: "34", active: "33", disposed: "1", replyPending: "20", replyFiled: "13", exparte: "4" },
    "PDD": { total: "31", active: "28", disposed: "3", replyPending: "22", replyFiled: "6", exparte: "4" },
    "FOREST": { total: "24", active: "21", disposed: "3", replyPending: "11", replyFiled: "10", exparte: "1" },
    "RDD": { total: "23", active: "21", disposed: "2", replyPending: "16", replyFiled: "5", exparte: "5" },
    "PHE/JAL SHAKTI": { total: "20", active: "19", disposed: "1", replyPending: "8", replyFiled: "11", exparte: "1" },
    "EDUCATION": { total: "20", active: "20", disposed: "0", replyPending: "14", replyFiled: "6", exparte: "5" },
    "UOI": { total: "12", active: "11", disposed: "1", replyPending: "7", replyFiled: "4", exparte: "3" },
    "I&FC": { total: "11", active: "10", disposed: "1", replyPending: "7", replyFiled: "3", exparte: "2" },
    "HEALTH AND MEDICAL EDUCATION": { total: "11", active: "11", disposed: "0", replyPending: "8", replyFiled: "3", exparte: "2" },
    "SOCIAL WELFARE": { total: "8", active: "8", disposed: "0", replyPending: "6", replyFiled: "2", exparte: "0" },
    "JKEDI": { total: "6", active: "5", disposed: "1", replyPending: "2", replyFiled: "3", exparte: "0" },
    "Food Safety officer": { total: "5", active: "5", disposed: "0", replyPending: "5", replyFiled: "0", exparte: "0" },
    "HOME": { total: "5", active: "5", disposed: "0", replyPending: "0", replyFiled: "5", exparte: "0" },
    "HORTICULTURE": { total: "4", active: "4", disposed: "0", replyPending: "3", replyFiled: "1", exparte: "0" },
    "TRANSPORT": { total: "3", active: "3", disposed: "0", replyPending: "2", replyFiled: "1", exparte: "1" },
    "FCS&CA": { total: "2", active: "2", disposed: "0", replyPending: "2", replyFiled: "0", exparte: "0" },
    "ANIMAL HUSBANDARY": { total: "2", active: "2", disposed: "0", replyPending: "1", replyFiled: "1", exparte: "0" },
    "DEFENCE ESTATES": { total: "2", active: "2", disposed: "0", replyPending: "2", replyFiled: "0", exparte: "0" },
    "GEOLOGY AND MINING": { total: "2", active: "1", disposed: "1", replyPending: "1", replyFiled: "0", exparte: "0" },
    "CULTURE": { total: "2", active: "2", disposed: "0", replyPending: "2", replyFiled: "0", exparte: "1" },
    "SKILL DEVELOPMENT": { total: "2", active: "2", disposed: "0", replyPending: "1", replyFiled: "1", exparte: "0" },
    "YOUTH SERVICES AND SPORTS": { total: "2", active: "2", disposed: "0", replyPending: "0", replyFiled: "2", exparte: "0" },
    "SMAGRA SHIKSHA": { total: "1", active: "1", disposed: "0", replyPending: "0", replyFiled: "1", exparte: "0" },
    "INFORMATION": { total: "1", active: "1", disposed: "0", replyPending: "1", replyFiled: "0", exparte: "0" },
    "JKRLM": { total: "1", active: "1", disposed: "0", replyPending: "1", replyFiled: "0", exparte: "0" },
    "RELIEF": { total: "1", active: "1", disposed: "0", replyPending: "1", replyFiled: "0", exparte: "0" },
    "SCIENCE AND TECHNOLOGY": { total: "1", active: "1", disposed: "0", replyPending: "1", replyFiled: "0", exparte: "0" },
    "INDUSTRIES AND COMMERCE": { total: "1", active: "1", disposed: "0", replyPending: "1", replyFiled: "0", exparte: "0" }
  };

  var FALLBACK_TYPES = {
    "Civil Suit": 220, "Execution Petition": 19, "Wage Claim": 15, "Consumer Matter": 23,
    "Appeal": 15, "Restoration Application": 10, "Contempt Petition": 5, "Criminal Complaint": 5,
    "MACT Case": 4, "Pauper Suit": 3, "Revision": 2, "Miscellaneous Petition": 2,
    "Transfer Application": 1, "Review": 1, "Criminal Miscellaneous Application": 1,
    "Condonation of Delay": 1, "Complaint": 1
  };

  var OFFICE = {
    name: "District Litigation Office Kupwara",
    parent: "Department of Law, Justice & Parliamentary Affairs, Government of Jammu & Kashmir",
    address: "1st Floor, DC Office Complex, Kupwara, UT of J&K — 193222",
    pin: "193222",
    hours: "10:00 AM – 5:00 PM, Monday to Saturday",
    closed: "Sundays and public holidays",
    email: "districtlitigationofficekupwar@gmail.com",
    phone: "Contact the office directly (number is listed on the portal as masked)",
    dlo: "Ishfaq Ahmad Khan",
    counsel: ["Adv. Zubair Ahmad Wani", "Adv. Wasim Nazir Khan"],
    developer: "Tariq Ahmad Lone",
    version: "NK.1.0",
    motto: "Justice · Integrity · Law",
    mission: "Empowering Good Governance Through Effective Litigation Management",
    quote1: "The law is not a game of chance. It is a structure of logical moves, deliberate strategy, and precision.",
    quote2: "Every case is a move on the board — studied, deliberate, and purposeful.",
    disclaimer: "The information on this portal is intended solely to keep employees of stakeholder departments aware of statistics and developments of cases handled by DLO Kupwara. It cannot be made the basis of any litigation, legal proceeding, claim, or action. For official case records, contact DLO Kupwara directly."
  };

  var PAGES = {
    home: { url: "index.html", text: "Open Homepage" },
    hearings: { url: "hearings.html", text: "View Upcoming Hearings" },
    history: { url: "history.html", text: "Open Case History Tracker" },
    causelist: { url: "causelist.html", text: "Open Cause List Explorer" },
    performance: { url: "performance.html", text: "Open Performance Dashboard" },
    operator: { url: "operator.html", text: "Go to Staff Login" },
    contact: { url: "index.html#contact", text: "Open Contact / Enquiry" },
    filter: { url: "index.html#live-data", text: "Search & Filter Cases" },
    courts: { url: "index.html#courts", text: "Court-wise Distribution" },
    analytics: { url: "index.html#analytics", text: "Open Analytics" },
    calendar: { url: "index.html#calendar", text: "Open Hearing Calendar" },
    updates: { url: "index.html#updates", text: "Orders, Notices & Circulars" },
    team: { url: "index.html#team", text: "View Officials" }
  };

  // ─── 3. LIVE DOM SCRAPERS ────────────────────────────────────────────────
  function elText(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var t = (el.textContent || "").replace(/[,\s]/g, "").trim();
    return /^\d+%?$/.test(t) ? t : null;
  }

  function getLiveMetrics() {
    var total = elText("homeStatTotal") || elText("heroTotal") || elText("appHomeTotal");
    var active = elText("homeStatActive") || elText("heroActive") || elText("appHomeActive");
    var disposed = elText("homeStatDisposed") || elText("heroDisposed") || elText("appHomeDisposed");
    var filed = elText("homeStatReplyFiled") || elText("appHomeReplyFiled");
    var pending = elText("homeStatReplyPending") || elText("appHomeReplyPending");
    var exparte = elText("homeStatExparte") || elText("appHomeExparte");
    var text = (document.body && document.body.innerText) || "";
    function grab(re, alt) {
      var m = text.match(re) || (alt ? text.match(alt) : null);
      return m ? m[1] : null;
    }
    total = total || grab(/Total cases.*?:\s*([\d,]+)/i, /([\d,]+)\s*TOTAL CASES/i);
    active = active || grab(/Active cases.*?:\s*([\d,]+)/i, /([\d,]+)\s*ACTIVE/i);
    disposed = disposed || grab(/Disposed cases.*?:\s*([\d,]+)/i, /([\d,]+)\s*DISPOSED/i);
    pending = pending || grab(/([\d,]+)\s*REPLY PENDING/i);
    filed = filed || grab(/([\d,]+)\s*REPLY FILED/i);
    exparte = exparte || grab(/([\d,]+)\s*EX-PARTE/i);
    var totN = parseInt((total || FALLBACK_METRICS.total).replace(/,/g, ""), 10) || 392;
    var disN = parseInt((disposed || FALLBACK_METRICS.disposed).replace(/,/g, ""), 10) || 27;
    var rate = totN ? Math.round((disN / totN) * 100) + "%" : FALLBACK_METRICS.rate;
    return {
      total: (total || FALLBACK_METRICS.total).replace(/,/g, ""),
      active: (active || FALLBACK_METRICS.active).replace(/,/g, ""),
      disposed: (disposed || FALLBACK_METRICS.disposed).replace(/,/g, ""),
      replyPending: (pending || FALLBACK_METRICS.replyPending).replace(/,/g, ""),
      replyFiled: (filed || FALLBACK_METRICS.replyFiled).replace(/,/g, ""),
      exparte: (exparte || FALLBACK_METRICS.exparte).replace(/,/g, ""),
      rate: rate,
      courts: FALLBACK_METRICS.courts,
      depts: FALLBACK_METRICS.depts
    };
  }

  function normKey(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function getCourtDistributionStats(courtName) {
    var norm = normKey(courtName);
    var rows = document.querySelectorAll("table tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var cols = Array.prototype.map.call(rows[i].querySelectorAll("td"), function (td) {
        return td.innerText.trim();
      });
      if (cols.length === 3) {
        var cNorm = normKey(cols[1]);
        if (cNorm && (cNorm.indexOf(norm) !== -1 || norm.indexOf(cNorm) !== -1)) {
          return { name: cols[1], total: cols[2] };
        }
      }
    }
    var fb = FALLBACK_COURTS[courtName];
    if (fb) return { name: courtName, total: fb.total, extra: fb };
    return null;
  }

  function getCourtExtra(courtName) {
    var live = getCourtDistributionStats(courtName);
    var fb = FALLBACK_COURTS[courtName] || {};
    return {
      name: (live && live.name) || courtName,
      total: (live && live.total) || fb.total || "—",
      active: fb.active || "—",
      disposed: fb.disposed || "—",
      replyPending: fb.replyPending || "—",
      exparte: fb.exparte || "—"
    };
  }

  function getDepartmentData(rawDeptQuery) {
    var q = String(rawDeptQuery || "").toLowerCase().trim();
    var resolvedDept = DEPT_ALIASES[q] || rawDeptQuery;
    var rows = document.querySelectorAll("table tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var cols = Array.prototype.map.call(rows[i].querySelectorAll("td"), function (td) {
        return td.innerText.trim();
      });
      if (cols.length >= 6 && isNaN(Number(cols[1]))) {
        var deptInTable = cols[1].toLowerCase();
        var resolved = String(resolvedDept).toLowerCase();
        if (deptInTable.indexOf(resolved) !== -1 || resolved.indexOf(deptInTable) !== -1) {
          return {
            name: cols[1],
            total: cols[2],
            active: cols[3],
            disposed: cols[4],
            replyPending: cols[5],
            alias: DEPT_ALIASES[q] ? q.toUpperCase() : null
          };
        }
      }
    }
    var key = DEPT_ALIASES[q] || rawDeptQuery;
    var fb = FALLBACK_DEPTS[key];
    if (fb) {
      return {
        name: key,
        total: fb.total,
        active: fb.active,
        disposed: fb.disposed,
        replyPending: fb.replyPending,
        replyFiled: fb.replyFiled,
        exparte: fb.exparte,
        alias: DEPT_ALIASES[q] ? q.toUpperCase() : null
      };
    }
    return null;
  }

  function getCourtListings(courtName) {
    var results = [];
    var norm = normKey(courtName);
    var rawList = window.allCases || window.cases || window.casesData || window.DLO_CASES || window.ALL_ROWS || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      rawList.forEach(function (c) {
        var cNorm = normKey(c.court || c.court_name || "");
        if (cNorm && (cNorm.indexOf(norm) !== -1 || norm.indexOf(cNorm) !== -1)) {
          results.push({
            number: c.case_number || c.cnr || c.caseNo || c.cnr_case_no || "Case",
            title: c.title || c.case_title || c.caseTitle || "State Matter",
            date: c.hearing_date || c.next_date || (c.nextHearing ? String(c.nextHearing) : "Scheduled"),
            dept: c.dept || c.department || ""
          });
        }
      });
      if (results.length > 0) return results;
    }
    var tickerItems = document.querySelectorAll(".ticker span, marquee span, .live-updates *, #ticker *, #tickerTrack *");
    var searchPool = tickerItems.length > 0 ? Array.prototype.slice.call(tickerItems) : Array.prototype.slice.call(document.querySelectorAll("p, div, li, tr"));
    searchPool.forEach(function (el) {
      var line = el.textContent || "";
      if (line.indexOf("Hearing scheduled") !== -1 || line.indexOf("Sept") !== -1 || line.indexOf("2026") !== -1) {
        var lineNorm = normKey(line);
        if (lineNorm.indexOf(norm) !== -1) {
          var parts = line.split("—").map(function (p) { return p.trim(); });
          if (parts.length >= 3) {
            results.push({
              number: parts[1] || "Listed Matter",
              title: parts[2] || courtName,
              date: parts[3] || "Scheduled"
            });
          }
        }
      }
    });
    return results.filter(function (v, i, a) {
      return a.findIndex(function (t) { return t.number === v.number && t.number !== "Listed Matter"; }) === i;
    });
  }

  // ─── 3B. CASE SEARCH ENGINE (BY LITIGANT NAME, CNR, OR KEYWORDS) ─────────
  function searchRegistryCases(rawQuery) {
    var q = normalize(rawQuery);

    // Strip noise phrases to isolate the name, keywords, or case number
    var clean = q
      .replace(/\b(next\s*date\s*of|hearing\s*date\s*of|date\s*of\s*the\s*case|next\s*hearing\s*of|when\s*is\s*the\s*hearing\s*of|next\s*date|hearing\s*date|when\s*is|case\s*status\s*of|status\s*of\s*the\s*case|case\s*of|case\s*details|hearing\s*details|versus|vs|v\/s)\b/g, " ")
      .replace(/\b(the|of|for|in|court|matter|case|and|at|on|scheduled)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean || clean.length < 5) {
      return { tooShort: true, query: clean };
    }

    var pool = [];
    var rawList = window.allCases || window.cases || window.casesData || window.DLO_CASES || window.ALL_ROWS || [];

    if (Array.isArray(rawList) && rawList.length > 0) {
      pool = rawList;
    } else {
      // Scrape dynamically from the master table (#live-data)
      var rows = document.querySelectorAll("#live-data table tbody tr, table tbody tr");
      for (var i = 0; i < rows.length; i++) {
        var cols = Array.prototype.map.call(rows[i].querySelectorAll("td"), function (td) {
          return td.innerText.trim();
        });
        // Table columns: [# , Case No, Title, Subject, Dept, Court, Last Proc, Next Hearing, Reply Status, Case Status, Type, Standing Counsel, Ex-parte]
        if (cols.length >= 9 && cols[2] && (cols[2].indexOf("Vs") !== -1 || cols[2].indexOf("V/S") !== -1 || cols[2].indexOf("v/s") !== -1 || cols[2].indexOf("V/s") !== -1 || cols[2].indexOf("vs") !== -1)) {
          pool.push({
            case_number: cols[1] && cols[1] !== "—" ? cols[1] : "",
            title: cols[2],
            dept: cols[4] || "Stakeholder Dept",
            court: cols[5] || "Judicial Forum Kupwara",
            hearing_date: cols[7] || "Date Awaited",
            reply_status: cols[8] || "Not Specified",
            status: cols[9] || "Active"
          });
        }
      }
    }

    if (!pool.length) return { noData: true, query: clean };

    var tokens = clean.split(" ").filter(function (t) { return t.length >= 2; });

    var matches = pool.filter(function (c) {
      var title = normalize(c.title || c.case_title || c.caseTitle || "");
      var cnr = normalize(c.case_number || c.cnr || c.caseNo || "");
      var dept = normalize(c.dept || c.department || "");
      var full = title + " " + cnr + " " + dept;

      // If single token (e.g. "yaqoo"), substring matching
      if (tokens.length === 1) {
        return full.indexOf(tokens[0]) !== -1;
      }
      // If multi-token (e.g. "yaqoob khan"), all tokens must match
      return tokens.every(function (tok) {
        return full.indexOf(tok) !== -1;
      });
    });

    // Deduplicate by title + case number
    var uniqueMatches = matches.filter(function (v, i, a) {
      var vKey = (v.title || "") + "|" + (v.case_number || "");
      return a.findIndex(function (t) {
        return ((t.title || "") + "|" + (t.case_number || "")) === vKey;
      }) === i;
    });

    return {
      query: clean,
      results: uniqueMatches
    };
  }

  // ─── 4. STRUCTURED KNOWLEDGE TREE ────────────────────────────────────────
  var BOT_DATA = {
    start: {
      message: "Hello! Welcome to the District Litigation Office Kupwara legal desk.\n\nAsk in plain language — courts, departments, hearings, replies, officials — or pick a category:",
      options: [
        { label: "Today's Cause List by Court", next: "choose_court" },
        { label: "Real-Time Portal Statistics", next: "live_stats" },
        { label: "Court-wise Case Distribution", next: "court_dist" },
        { label: "Department Caseloads", next: "dept_overview" },
        { label: "Urgent Hearings (Next 2 Days)", next: "urgent_hearings" },
        { label: "Departmental SOP for Replies", next: "replies_sop" },
        { label: "Office Hours & Location", next: "office" },
        { label: "Officials & Standing Counsel", next: "officials" },
        { label: "Portal Pages & Downloads", next: "pages" },
        { label: "Operator Login", next: "operator" }
      ]
    },
    choose_court: {
      message: "Select a court to view scheduled government cases:",
      options: COURTS_LIST.map(function (court) {
        return { label: court.short, next: "court_" + court.id };
      }).concat([{ label: "« Back to Main Menu", next: "start" }])
    },
    court_dist: {
      getMessage: function () {
        var m = getLiveMetrics();
        return "Court-wise Registered Case Distribution (" + m.total + " Total):\n\n" +
          "1. CJM/Sub Judge Handwara: 107 cases\n" +
          "2. Pr. District & Sessions Kupwara: 73 cases\n" +
          "3. Sub Judge Kupwara: 57 cases\n" +
          "4. Addl. District & Sessions Handwara: 46 cases\n" +
          "5. Consumer Court Kupwara: 24 cases\n" +
          "6. Munsiff Kralpora: 19 cases\n" +
          "7. Munsiff Kupwara: 18 cases\n" +
          "8. Labour Court Kupwara: 15 cases\n" +
          "9. Munsiff Sogam: 14 cases\n" +
          "10. Sub Judge Trehgam: 9 cases\n" +
          "11. Munsiff Handwara: 6 cases\n" +
          "12. MACT Kupwara: 4 cases\n\n" +
          "Highest caseload: CJM/Sub Judge Handwara.\nLowest: MACT Kupwara.\n\nType a court name for active / disposed / reply-pending split.";
      },
      link: PAGES.courts,
      options: [
        { label: "Check Today's Cause List", next: "choose_court" },
        { label: "Department Caseloads", next: "dept_overview" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    live_stats: {
      getMessage: function () {
        var m = getLiveMetrics();
        return "Real-Time Legal Statistics (DLO Kupwara):\n\n" +
          "• Total Cases Registered: " + m.total + "\n" +
          "• Active Monitored Cases: " + m.active + "\n" +
          "• Cases Disposed: " + m.disposed + " (" + m.rate + " disposal rate)\n" +
          "• Replies Filed: " + m.replyFiled + "\n" +
          "• Replies Pending: " + m.replyPending + "\n" +
          "• Ex-parte Cases Monitored: " + m.exparte + "\n" +
          "• Judicial Forums Covered: " + m.courts + " (portal also notes 13+ including DLSA liaison)\n" +
          "• Stakeholder Departments: " + m.depts + "\n\n" +
          "Data is synchronized with the DC Office Complex litigation registry. Figures on this chat refresh from the page when available.";
      },
      link: PAGES.performance,
      options: [
        { label: "Court Distribution", next: "court_dist" },
        { label: "Department Caseloads", next: "dept_overview" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    urgent_hearings: {
      getMessage: function () {
        return "Urgent government hearings — next 48 hours:\n\n" +
          "About " + FALLBACK_METRICS.urgent48h + " government hearings are listed across Kupwara courts in the next two days.\n\n" +
          "Colour code on the portal:\n• Red — within 3 days\n• Yellow — within 7 days\n• Green — within 15 days\n\n" +
          "Stakeholder departments must furnish standing counsel with parawise remarks at least 3 days before court call.\n\n" +
          "Hearing windows, Excel/PDF export and WhatsApp share are on the Hearings module.";
      },
      link: PAGES.hearings,
      options: [
        { label: "View Cause List by Court", next: "choose_court" },
        { label: "Missing Reply — Hearing Soon", next: "missing_reply" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    replies_sop: {
      message: "Departmental SOP for Objections & Parawise Replies:\n\n" +
        "1. Parawise remarks must be submitted by the concerned department at least 3 days prior to the hearing date.\n" +
        "2. All responses undergo formal vetting at the DLO scrutiny desk before submission in court.\n" +
        "3. In contempt matters, an Action Taken Report (ATR) must be furnished immediately — and at least 48 hours prior to hearing — to prevent personal appearance.\n" +
        "4. Nodal officers should attach supporting record (orders, reports, revenue extracts) with the draft reply.\n" +
        "5. Standing counsel files only after DLO scrutiny. Last-minute drafts risk adjournment or adverse orders.\n\n" +
        "Highest pending-reply departments: Revenue, Urban Local Bodies, PDD, R&B, RDD, Education, Forest.",
      link: PAGES.contact,
      options: [
        { label: "Office Timings & Address", next: "office" },
        { label: "Reply Pending Stats", next: "reply_pending" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    officials: {
      message: "DLO Kupwara Officials & Legal Cadre:\n\n" +
        "• District Litigation Officer: Ishfaq Ahmad Khan\n" +
        "  Department of Law, Justice & Parliamentary Affairs, UT of J&K\n\n" +
        "• Standing Counsel: Adv. Zubair Ahmad Wani — ~200 assigned matters\n" +
        "• Standing Counsel: Adv. Wasim Nazir Khan — ~192 assigned matters\n\n" +
        "They represent government departments in civil, service, consumer, labour and MACT matters across all district forums.\n\n" +
        "Attendance and performance logs are maintained on the Standing Counsel Performance page.",
      link: PAGES.team,
      options: [
        { label: "Counsel Performance Page", next: "counsel_perf" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    office: {
      message: "District Litigation Office Kupwara\n1st Floor, DC Office Complex, Kupwara, UT of J&K — 193222\n\nHours: 10:00 AM – 5:00 PM (Monday–Saturday)\nClosed: Sundays and public holidays\nEmail: districtlitigationofficekupwar@gmail.com\nPhone: listed as masked on the public portal — use the enquiry form or visit the office.\n\nParent department: Law, Justice & Parliamentary Affairs, Government of Jammu & Kashmir.\n\nWalk-ins: departmental nodal officers should carry case number / CNR and hearing date.",
      link: PAGES.contact,
      options: [
        { label: "Send an Enquiry", next: "enquiry" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    operator: {
      message: "The operator portal is strictly restricted to authorized departmental staff with active credentials.\n\nStaff tools after login:\n• Search and update case diary\n• Add a new case\n• Today's cause list and overdue queue\n• Ex-parte monitor\n• Activity log\n• Manage access / password\n\nPublic users cannot obtain a password here. For a departmental account, write to the DLO through the enquiry form.",
      link: PAGES.operator,
      options: [{ label: "« Back to Main Menu", next: "start" }]
    },
    dept_overview: {
      getMessage: function () {
        return "Department Litigation Monitoring (30 departments):\n\n" +
          "Top caseloads (total / active / replies pending):\n" +
          "1. Revenue — 87 / 81 / 54\n" +
          "2. Urban Local Bodies — 68 / 61 / 47\n" +
          "3. R&B / PWD / PMGSY — 34 / 33 / 20\n" +
          "4. PDD / KPDCL — 31 / 28 / 22\n" +
          "5. Forest — 24 / 21 / 11\n" +
          "6. RDD / Panchayats — 23 / 21 / 16\n" +
          "7. PHE / Jal Shakti — 20 / 19 / 8\n" +
          "8. Education — 20 / 20 / 14\n\n" +
          "Type any department or acronym (PMGSY, PDD, Jal Shakti, ULB, FSO, UOI…) for a full split.";
      },
      link: PAGES.analytics,
      options: [
        { label: "SOP for Replies", next: "replies_sop" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    reply_pending: {
      getMessage: function () {
        var m = getLiveMetrics();
        return "Departmental Reply Status:\n\n" +
          "• Replies Pending: " + m.replyPending + " active cases\n" +
          "• Replies Filed: " + m.replyFiled + " cases\n\n" +
          "Highest pending (active cases):\nRevenue 54 · ULB 47 · PDD 22 · R&B 20 · RDD 16 · Education 14 · Forest 11 · Health 8 · I&FC 7 · UOI 7\n\n" +
          "Parawise replies are due at least 3 days before the hearing.";
      },
      link: PAGES.analytics,
      options: [
        { label: "SOP for Replies", next: "replies_sop" },
        { label: "« Main Menu", next: "start" }
      ]
    },
    missing_reply: {
      message: "Missing Reply — Hearing Soon:\n\nCases where the reply is not filed and the hearing is within 7 days are flagged on the Analytics module (red priority).\n\nDepartments must send parawise remarks to the scrutiny desk immediately so standing counsel can file before the date of hearing.\n\nExcel and PDF exports are available on the portal.",
      link: PAGES.analytics,
      options: [
        { label: "Urgent Hearings", next: "urgent_hearings" },
        { label: "« Main Menu", next: "start" }
      ]
    },
    overdue: {
      message: "Overdue Cases:\n\nOverdue matters are those where the scheduled hearing date has passed but status remains Active in the diary.\n\nOperators and nodal officers must update proceeding orders immediately after each date.\n\nFilter: Live Data → Overdue Cases. Excel/PDF export is available.",
      link: PAGES.filter,
      options: [{ label: "« Main Menu", next: "start" }]
    },
    case_types: {
      message: "Case Types across Kupwara forums:\n\n" +
        "• Civil Suits: 220 (majority)\n" +
        "• Execution Petitions: 19\n" +
        "• Wage Claims (Labour): 15\n" +
        "• Consumer Matters: 23\n" +
        "• Appeals: 15\n" +
        "• Restoration Applications: 10\n" +
        "• Contempt Petitions: 5\n" +
        "• Criminal Complaints: 5\n" +
        "• MACT Claims: 4\n" +
        "• Pauper Suits: 3\n" +
        "• Revision / Review / Transfer / Misc.: remaining\n\n" +
        "Use Search & Filter to slice by type, court, department, counsel or ex-parte flag.",
      link: PAGES.filter,
      options: [{ label: "« Main Menu", next: "start" }]
    },
    practice: {
      message: "Areas of Legal Practice (DLO Kupwara):\n\n" +
        "• Civil Litigation — property disputes, land acquisition, mutation challenges, civil suits (Revenue · PWD · Forest)\n" +
        "• Labour & Service Matters — Labour · Education · Health\n" +
        "• MACT & Motor Claims — MACT · Insurance · PWD\n" +
        "• Forest & Environment\n" +
        "• Revenue Matters — Patwari · Tehsildar · Collector\n" +
        "• Court Coordination — Sessions Court through MACT and DLSA, across 12 trial forums\n\n" +
        "Mission: Empowering Good Governance Through Effective Litigation Management.",
      link: { url: "index.html#services", text: "Open Legal Services" },
      options: [{ label: "« Main Menu", next: "start" }]
    },
    pages: {
      message: "Portal modules you can open:\n\n" +
        "• Home / Live Data — search & filter the case diary\n" +
        "• Hearings — next 15 days, colour-coded, Excel/PDF/WhatsApp\n" +
        "• History — chronological proceedings by title, CNR, court or department\n" +
        "• Cause List — today's government matters, print/Excel/WhatsApp\n" +
        "• Performance — standing counsel logs and attendance\n" +
        "• Analytics — disposal rate, department table, overdue, missing replies\n" +
        "• Calendar — click a navy date for that day's hearings\n" +
        "• Updates — orders, notices and circulars\n" +
        "• Contact — enquiry form (stored in the office database)\n" +
        "• Operator — staff login only\n" +
        "• PWA — install from Download App in the header",
      link: PAGES.home,
      options: [
        { label: "How to Install the App", next: "pwa" },
        { label: "« Main Menu", next: "start" }
      ]
    },
    pwa: {
      message: "Install DLO Kupwara Progressive Web App:\n\n" +
        "Tap Download App in the navigation bar, or use Install / Add to Home Screen in the browser.\n\n" +
        "Works on Android, iPhone and desktop for faster access to cases, hearings and cause lists.\n\n" +
        "App name: District Litigation Office Kupwara (short: DLO Kupwara).\nVersion: NK.1.0 · PWA enabled.",
      options: [{ label: "« Main Menu", next: "start" }]
    },
    counsel_perf: {
      message: "Standing Counsel Performance module:\n\n" +
        "Sourced from PERFORMANCE_LOG. Filter by date range and counsel to see:\n" +
        "• Logged entries, ex-parte entries, disposed matters, replies filed\n" +
        "• Detailed case log (order date, CNR, title, department, forum, next date, remarks)\n" +
        "• Case-history attendance: attended vs not attended vs ex-parte vs disposed\n\n" +
        "Excel and PDF full-detail export is available.\n\n" +
        "Assigned diary (approx.): Adv. Zubair Ahmad Wani 200 · Adv. Wasim Nazir Khan 192.",
      link: PAGES.performance,
      options: [{ label: "« Main Menu", next: "start" }]
    },
    enquiry: {
      message: "Send a public or departmental enquiry:\n\n" +
        "Required: Full Name, Contact Number.\nOptional: Department, Case Number (e.g. CMR/001/2024), Message.\n\n" +
        "Departments on the form: Revenue, Labour, Forest, Education, PWD, Police, Other.\n\n" +
        "All enquiries are recorded in the office database. Use the contact section on the homepage. Do not send passwords or OTPs.",
      link: PAGES.contact,
      options: [{ label: "« Main Menu", next: "start" }]
    },
    disclaimer: {
      message: OFFICE.disclaimer + "\n\nFooter notice: the portal is managed by employees of DLO Kupwara to keep stakeholder departments informed. © 2026 District Litigation Office Kupwara. Government of Jammu & Kashmir.",
      options: [{ label: "« Main Menu", next: "start" }]
    },
    history_help: {
      message: "Case Diary & Audit Trail:\n\nSearch proceedings history by case title, CNR, court or department. Results open a chronological timeline of hearings, attendance and summaries sourced from the proceedings log.\n\nUse the History page or the Case History section on the homepage.",
      link: PAGES.history,
      options: [{ label: "« Main Menu", next: "start" }]
    },
    calendar_help: {
      message: "Hearing Calendar:\n\nNavy / highlighted dates have listed government hearings. Click a date to see that day's matters.\n\nCause list for today is generated automatically from the master diary.",
      link: PAGES.calendar,
      options: [
        { label: "Today's Cause List", next: "choose_court" },
        { label: "« Main Menu", next: "start" }
      ]
    },
    updates_help: {
      message: "Orders, Notices & Circulars:\n\nThe Updates strip is auto-refreshed. Click View Document to open an attached file.\nIf the list is empty, no circular has been published in the current feed.",
      link: PAGES.updates,
      options: [{ label: "« Main Menu", next: "start" }]
    }
  };

  COURTS_LIST.forEach(function (court) {
    BOT_DATA["court_" + court.id] = {
      getMessage: function () {
        var matches = getCourtListings(court.name);
        var extra = getCourtExtra(court.name);
        if (!matches.length) {
          return court.name + "\n\n" +
            "• Total registered: " + extra.total + "\n" +
            "• Active: " + extra.active + " · Disposed: " + extra.disposed + "\n" +
            "• Replies pending (active): " + extra.replyPending + " · Ex-parte: " + extra.exparte + "\n\n" +
            "No government matter is flagged for immediate hearing in this chat feed right now.\nOpen the Cause List module for the full daily board.";
        }
        var msg = court.name + " (Total: " + extra.total + ")\n\nFound " + matches.length + " listed matter(s):\n\n";
        matches.slice(0, 6).forEach(function (item, idx) {
          msg += (idx + 1) + ". " + item.number + "\n   • " + item.title + "\n   • Date: " + item.date + "\n\n";
        });
        if (matches.length > 6) msg += "…and " + (matches.length - 6) + " more listed.";
        return msg.trim();
      },
      link: { url: "causelist.html", text: "Open " + court.short + " Cause List" },
      options: [
        { label: "« Select Another Court", next: "choose_court" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  });

  // ─── 5. NLP ENGINE (entities, scoring, 3000+ question index) ─────────────
  var STOP = { a:1, an:1, the:1, in:1, of:1, for:1, to:1, is:1, are:1, was:1, were:1, be:1, please:1, kindly:1, can:1, you:1, i:1, we:1, me:1, my:1, our:1, at:1, on:1, by:1, with:1, from:1, or:1, and:1, do:1, does:1, did:1, any:1, all:1, this:1, that:1, there:1, their:1, how:1, what:1, which:1, who:1, where:1, when:1, why:1, give:1, tell:1, show:1, list:1, open:1, see:1, view:1, get:1, find:1, check:1 };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[?!.,;:'"()[\]{}]/g, " ")
      .replace(/[\/_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stem(w) {
    var irr = {
      cases: "case", hearings: "hearing", replies: "reply", departments: "dept", department: "dept",
      courts: "court", statistics: "stat", stats: "stat", statistic: "stat",
      disposed: "dispose", disposal: "dispose", pending: "pend", listed: "list",
      lawyers: "lawyer", advocates: "advocate", officials: "official", officers: "officer",
      timings: "time", hours: "time", address: "location", located: "location",
      numbers: "number", counts: "count", registered: "register",
      contempts: "contempt", petitions: "petition", applications: "application"
    };
    if (irr[w]) return irr[w];
    if (w.length > 6 && w.slice(-3) === "ing") return w.slice(0, -3);
    if (w.length > 5 && w.slice(-3) === "ies") return w.slice(0, -3) + "y";
    if (w.length > 5 && w.slice(-2) === "es") return w.slice(0, -2);
    if (w.length > 4 && w.slice(-1) === "s" && w.slice(-2) !== "ss") return w.slice(0, -1);
    return w;
  }

  function tokens(q) {
    return normalize(q).split(" ").filter(function (w) { return w && w.length > 1; }).map(stem);
  }

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > 2) return 99;
    var i, j, prev = [], cur = [];
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : Math.min(prev[j - 1], prev[j], cur[j - 1]) + 1;
      }
      prev = cur; cur = [];
    }
    return prev[b.length];
  }

  function extractCourt(q) {
    var best = null, bestLen = 0;
    COURTS_LIST.forEach(function (c) {
      var names = [c.name, c.short].concat(c.aliases);
      names.forEach(function (n) {
        var nn = normalize(n);
        if (nn.length >= 3 && q.indexOf(nn) !== -1 && nn.length > bestLen) {
          best = c; bestLen = nn.length;
        }
      });
    });
    if (best) return best;
    var places = [
      ["kralpora", "munsiff_kralpora"], ["sogam", "munsiff_sogam"], ["trehgam", "sub_trehgam"],
      ["lolab", "munsiff_sogam"], ["mact", "mact"], ["consumer", "consumer"],
      ["sessions", "dist_sessions"], ["pdj", "dist_sessions"]
    ];
    for (var i = 0; i < places.length; i++) {
      if (q.indexOf(places[i][0]) !== -1) {
        return COURTS_LIST.filter(function (c) { return c.id === places[i][1]; })[0] || null;
      }
    }
    return null;
  }

  function extractDept(q) {
    var bestKey = null, bestLen = 0;
    Object.keys(DEPT_ALIASES).forEach(function (alias) {
      if (alias.length >= 3 && q.indexOf(alias) !== -1 && alias.length > bestLen) {
        bestKey = alias; bestLen = alias.length;
      }
    });
    if (bestKey) return { alias: bestKey, name: DEPT_ALIASES[bestKey] };
    Object.keys(FALLBACK_DEPTS).forEach(function (name) {
      var n = normalize(name);
      if (n.length >= 3 && q.indexOf(n) !== -1 && n.length > bestLen) {
        bestKey = name; bestLen = n.length;
      }
    });
    if (bestKey && FALLBACK_DEPTS[bestKey]) return { alias: bestKey, name: bestKey };
    return null;
  }

  function extractMetric(q) {
    if (/(ex[-\s]?parte|exparte)/.test(q)) return "exparte";
    if (/(reply pend|replies pend|unfiled|missing reply|not filed|pending reply)/.test(q)) return "pending";
    if (/(reply filed|replies filed|filed reply)/.test(q)) return "filed";
    if (/(disposal|disposed|dismissed|closed case)/.test(q)) return "disposed";
    if (/(overdue|delay|date passed|lapsed)/.test(q)) return "overdue";
    if (/(today|cause list|listed|hearing|schedule|tomorrow|board)/.test(q)) return "listings";
    if (/(active|ongoing|pending case|current)/.test(q)) return "active";
    if (/(total|how many|count|registered|caseload|number of)/.test(q)) return "total";
    return null;
  }

  function extractType(q) {
    var map = [
      ["contempt", "Contempt Petition"], ["execution", "Execution Petition"],
      ["wage", "Wage Claim"], ["consumer", "Consumer Matter"],
      ["restoration", "Restoration Application"], ["civil suit", "Civil Suit"],
      ["writ", "Civil Suit"], ["appeal", "Appeal"], ["mact", "MACT Case"],
      ["pauper", "Pauper Suit"], ["revision", "Revision"], ["review", "Review"],
      ["criminal", "Criminal Complaint"], ["condonation", "Condonation of Delay"],
      ["transfer", "Transfer Application"]
    ];
    for (var i = 0; i < map.length; i++) {
      if (q.indexOf(map[i][0]) !== -1) return map[i][1];
    }
    return null;
  }

  var COURT_Q = [
    "how many cases in {c}", "total cases in {c}", "total cases {c}", "cases registered in {c}",
    "what is the caseload of {c}", "{c} case count", "number of government cases in {c}",
    "how many files in {c}", "registered matters in {c}", "show {c} statistics",
    "active cases in {c}", "how many active matters in {c}", "ongoing cases {c}",
    "pending cases in {c}", "current cases {c}", "live cases in {c}",
    "disposed cases in {c}", "how many disposed in {c}", "dismissal count {c}",
    "pending replies in {c}", "replies pending {c}", "unfiled replies {c}", "missing reply {c}",
    "ex parte cases in {c}", "exparte in {c}", "ex-parte {c}",
    "today cause list of {c}", "today's cause list {c}", "hearings today in {c}",
    "hearings tomorrow in {c}", "listed matters in {c}", "cause list {c}",
    "schedule of {c}", "is anything listed in {c} today", "{c} hearings",
    "government litigation in {c}", "dlo cases in {c}", "status of {c}",
    "tell me about {c}", "details of {c}", "open {c}", "show {c}",
    "what is listed in {c}", "board of {c}", "daily board {c}",
    "how many cases are pending in {c}", "give me {c} figures",
    "caseload of {c} court", "{c} court statistics", "cases before {c}"
  ];
  var DEPT_Q = [
    "how many cases in {d}", "total cases {d}", "{d} caseload", "{d} statistics",
    "active cases {d}", "disposed cases {d}", "pending replies {d}", "replies pending in {d}",
    "ex parte {d}", "exparte cases {d}", "filed replies {d}",
    "tell me about {d} litigation", "{d} department cases", "status of {d} cases",
    "how many {d} matters", "show {d} performance", "{d} reply pending",
    "what is the position of {d}", "dlo cases of {d}", "breakup of {d}",
    "number of cases against {d}", "government cases {d} department"
  ];
  var TYPE_Q = [
    "how many {t}", "total {t} cases", "{t} count", "list {t}",
    "active {t}", "pending {t}", "{t} in kupwara", "number of {t}"
  ];
  var STATIC_Q = [
    { q: "who is the dlo", intent: "dlo" }, { q: "who is district litigation officer", intent: "dlo" },
    { q: "who is ishfaq ahmad khan", intent: "dlo" }, { q: "who is incharge", intent: "dlo" },
    { q: "who heads dlo kupwara", intent: "dlo" }, { q: "dlo name", intent: "dlo" },
    { q: "who are standing counsel", intent: "counsel" }, { q: "list of advocates", intent: "counsel" },
    { q: "zubair ahmad wani", intent: "counsel" }, { q: "wasim nazir khan", intent: "counsel" },
    { q: "who is the lawyer", intent: "counsel" }, { q: "government counsel", intent: "counsel" },
    { q: "who built this portal", intent: "developer" }, { q: "who is tariq ahmad lone", intent: "developer" },
    { q: "developer name", intent: "developer" }, { q: "who designed the website", intent: "developer" },
    { q: "office address", intent: "office" }, { q: "where is dlo", intent: "office" },
    { q: "office timing", intent: "office" }, { q: "email of dlo", intent: "office" },
    { q: "pin code", intent: "office" }, { q: "phone number", intent: "office" },
    { q: "is office open on sunday", intent: "office" }, { q: "dc office complex", intent: "office" },
    { q: "how to submit reply", intent: "sop" }, { q: "parawise remarks", intent: "sop" },
    { q: "vetting of replies", intent: "sop" }, { q: "scrutiny desk", intent: "sop" },
    { q: "contempt petitions", intent: "contempt" }, { q: "action taken report", intent: "contempt" },
    { q: "atr for contempt", intent: "contempt" }, { q: "personal appearance", intent: "contempt" },
    { q: "total cases", intent: "stats" }, { q: "active cases", intent: "stats" },
    { q: "disposal rate", intent: "stats" }, { q: "portal statistics", intent: "stats" },
    { q: "how many departments", intent: "dept_overview" }, { q: "how many courts", intent: "court_dist" },
    { q: "which court has most cases", intent: "ranking_court" }, { q: "which department has most pending replies", intent: "ranking_dept" },
    { q: "install app", intent: "pwa" }, { q: "download pwa", intent: "pwa" },
    { q: "operator login", intent: "operator" }, { q: "staff password", intent: "operator" },
    { q: "disclaimer", intent: "disclaimer" }, { q: "can i use this in court", intent: "disclaimer" },
    { q: "send enquiry", intent: "enquiry" }, { q: "contact form", intent: "enquiry" },
    { q: "case history", intent: "history" }, { q: "proceedings tracker", intent: "history" },
    { q: "hearing calendar", intent: "calendar" }, { q: "circulars", intent: "updates" },
    { q: "overdue cases", intent: "overdue" }, { q: "missing reply hearing soon", intent: "missing_reply" },
    { q: "mission of dlo", intent: "practice" }, { q: "areas of practice", intent: "practice" },
    { q: "what is dlsa", intent: "practice" }, { q: "version of portal", intent: "developer" }
  ];

  var QUESTION_BANK = null;
  var Q_INDEX = null;
  var QUESTION_COUNT = 0;

  function courtNames(c) {
    var set = {};
    [c.name, c.short].concat(c.aliases).forEach(function (n) { set[normalize(n)] = true; });
    return Object.keys(set);
  }

  function deptNames(canonical) {
    var set = {};
    set[normalize(canonical)] = true;
    Object.keys(DEPT_ALIASES).forEach(function (a) {
      if (DEPT_ALIASES[a] === canonical) set[a] = true;
    });
    return Object.keys(set);
  }

  function ensureQuestionBank() {
    if (QUESTION_BANK) return QUESTION_BANK;
    var bank = [];
    function add(q, payload) {
      q = normalize(q);
      if (!q) return;
      bank.push({ q: q, p: payload });
    }
    COURTS_LIST.forEach(function (c) {
      courtNames(c).forEach(function (n) {
        COURT_Q.forEach(function (tpl) { add(tpl.replace("{c}", n), { kind: "court", id: c.id, metricHint: tpl }); });
      });
    });
    Object.keys(FALLBACK_DEPTS).forEach(function (name) {
      deptNames(name).forEach(function (n) {
        DEPT_Q.forEach(function (tpl) { add(tpl.replace("{d}", n), { kind: "dept", name: name, metricHint: tpl }); });
      });
    });
    Object.keys(FALLBACK_TYPES).forEach(function (t) {
      TYPE_Q.forEach(function (tpl) { add(tpl.replace("{t}", normalize(t)), { kind: "type", name: t }); });
    });
    STATIC_Q.forEach(function (row) { add(row.q, { kind: "static", intent: row.intent }); });
    var extras = [
      "hi", "hello", "assalamualaikum", "salaam", "salam", "good morning", "good afternoon",
      "help", "menu", "what can you do", "examples", "thanks", "thank you", "shukria",
      "office kahan hai", "time kya hai", "dlo kaun hai", "contact number kya hai",
      "email kya hai", "sunday open hai", "pin code kya hai"
    ];
    extras.forEach(function (e) { add(e, { kind: "static", intent: "smalltalk" }); });
    QUESTION_BANK = bank;
    QUESTION_COUNT = bank.length;
    Q_INDEX = {};
    bank.forEach(function (item, idx) {
      item.q.split(" ").forEach(function (w) {
        w = stem(w);
        if (!w || STOP[w] || w.length < 3) return;
        if (!Q_INDEX[w]) Q_INDEX[w] = [];
        Q_INDEX[w].push(idx);
      });
    });
    return bank;
  }

  function bestQuestionMatch(q) {
    ensureQuestionBank();
    var ts = tokens(q);
    var scores = {};
    ts.forEach(function (w) {
      if (STOP[w] || w.length < 3) return;
      var ids = Q_INDEX[w];
      if (!ids) return;
      for (var i = 0; i < ids.length; i++) scores[ids[i]] = (scores[ids[i]] || 0) + 1;
    });
    var bestIdx = -1, best = 0;
    Object.keys(scores).forEach(function (k) {
      var s = scores[k] / Math.max(ts.length, 1);
      if (s > best) { best = s; bestIdx = Number(k); }
    });
    if (bestIdx >= 0 && best >= 0.45) {
      return { item: QUESTION_BANK[bestIdx], score: best };
    }
    return null;
  }

  function replyDept(d) {
    var data = getDepartmentData(d.alias || d.name) || getDepartmentData(d.name);
    if (!data) return null;
    return {
      customReply: "Department Litigation Breakdown: " + data.name +
        (data.alias ? "\n(Queried via: " + data.alias + ")" : "") + "\n\n" +
        "• Total Cases: " + data.total + "\n" +
        "• Active Cases: " + data.active + "\n" +
        "• Disposed: " + data.disposed + "\n" +
        "• Pending Replies (active): " + data.replyPending + "\n" +
        (data.replyFiled ? "• Replies Filed: " + data.replyFiled + "\n" : "") +
        (data.exparte ? "• Ex-parte: " + data.exparte + "\n" : "") +
        "\nParawise replies are due at least 3 days before the hearing. Open Analytics for the full 30-department table.",
      customLink: PAGES.performance,
      customOptions: [
        { label: "SOP for Submitting Replies", next: "replies_sop" },
        { label: "All Departments", next: "dept_overview" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  }

  function replyCourt(c, metric) {
    if (metric === "listings") {
      return { stepKey: "court_" + c.id, customUserLabel: "Cases in " + c.short };
    }
    var extra = getCourtExtra(c.name);
    var focus = "";
    if (metric === "active") focus = "• Active cases: " + extra.active + "\n";
    else if (metric === "disposed") focus = "• Disposed: " + extra.disposed + "\n";
    else if (metric === "pending") focus = "• Replies pending (active): " + extra.replyPending + "\n";
    else if (metric === "exparte") focus = "• Ex-parte: " + extra.exparte + "\n";
    else if (metric === "overdue") focus = "Overdue matters (hearing date passed, still Active) are filtered on Live Data — not court-wise in this chat.\n";
    return {
      customReply: c.name + "\n\n" +
        "• Total registered government cases: " + extra.total + "\n" +
        "• Active: " + extra.active + " · Disposed: " + extra.disposed + "\n" +
        "• Replies pending: " + extra.replyPending + " · Ex-parte: " + extra.exparte + "\n" +
        focus +
        "\nJurisdiction: District Kupwara. Ask for today's cause list or open the Cause List module.",
      customLink: { url: "causelist.html", text: "Open " + c.short + " Cause List" },
      customOptions: [
        { label: "View " + c.short + " Cause List", next: "court_" + c.id },
        { label: "All Court Distributions", next: "court_dist" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  }

  function rankingCourtReply() {
    return {
      customReply: "Highest government caseload by court:\n\n" +
        "1. CJM / Sub Judge Handwara — 107\n" +
        "2. Pr. District & Sessions Kupwara — 73\n" +
        "3. Sub Judge Kupwara — 57\n\n" +
        "Lowest: MACT Kupwara — 4.\n\nHighest ex-parte concentration: Sub Judge Kupwara (13) and Munsiff Kralpora (9).",
      customLink: PAGES.courts,
      customOptions: [
        { label: "Full Court Table", next: "court_dist" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  }

  function rankingDeptReply() {
    return {
      customReply: "Highest pending replies (active cases):\n\n" +
        "1. Revenue — 54\n2. Urban Local Bodies — 47\n3. PDD / KPDCL — 22\n4. R&B / PWD / PMGSY — 20\n5. RDD — 16\n6. Education — 14\n7. Forest — 11\n\n" +
        "Home (Police) currently shows 0 pending / 5 filed.\nYouth Services & Sports: 0 pending / 2 filed.",
      customLink: PAGES.analytics,
      customOptions: [
        { label: "All Departments", next: "dept_overview" },
        { label: "SOP for Replies", next: "replies_sop" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  }

  function smalltalkReply(q) {
    if (/thank|shukr|ok thanks|great/.test(q)) {
      return {
        customReply: "You're welcome. Ask another court, department, hearing or SOP question whenever you need.",
        customOptions: [{ label: "Main Menu", next: "start" }]
      };
    }
    if (/help|what can you|example|menu|start/.test(q)) {
      return { stepKey: "start" };
    }
    return {
      customReply: "Wa-alaikum assalam. I can help with DLO Kupwara courts, departments, hearings, replies and office information. Try: \"next date of Yaqoob Khan\", \"PMGSY pending replies\", or \"who is the DLO\".",
      customOptions: [
        { label: "Main Menu", next: "start" },
        { label: "Real-Time Stats", next: "live_stats" }
      ]
    };
  }

  function handleStaticIntent(intent, q) {
    var map = {
      dlo: "officials", counsel: "officials", office: "office", sop: "replies_sop",
      stats: "live_stats", dept_overview: "dept_overview", court_dist: "court_dist",
      pwa: "pwa", operator: "operator", disclaimer: "disclaimer", enquiry: "enquiry",
      history: "history_help", calendar: "calendar_help", updates: "updates_help",
      overdue: "overdue", missing_reply: "missing_reply", practice: "practice"
    };
    if (intent === "developer") {
      return {
        customReply: "Portal Development & System Architecture:\n\nDesigned & Developed by Tariq Ahmad Lone for the District Litigation Office Kupwara, Department of Law, Justice & Parliamentary Affairs, UT of Jammu & Kashmir.\n\nVersion: NK.1.0 (PWA Enabled).\nAssistant widget: " + DLO_ASSISTANT_VERSION + " (" + (QUESTION_COUNT || "3000+") + " indexed question permutations).\nMotto: Justice · Integrity · Law.",
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }
    if (intent === "contempt") {
      return {
        customReply: "Contempt Petitions & Judicial Compliance:\n\n• 5 active contempt petitions are monitored.\n• Heads of Department must submit Action Taken Reports (ATRs) and verified compliance at least 48 hours before hearing.\n• Direct coordination with the DLO scrutiny desk is mandatory to avert personal appearance orders.\n• Draft replies still go through 3-day parawise SOP plus scrutiny.",
        customLink: PAGES.contact,
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }
    if (intent === "ranking_court") return rankingCourtReply();
    if (intent === "ranking_dept") return rankingDeptReply();
    if (intent === "smalltalk") return smalltalkReply(q);
    if (map[intent] && BOT_DATA[map[intent]]) return { stepKey: map[intent] };
    return null;
  }

  // ─── 6. MASTER NLP & CASE LOOKUP PROCESSOR ───────────────────────────────
  function processUserText(text) {
    ensureQuestionBank();
    var q = normalize(text);
    var words = q.split(" ");

    // 1. Greetings & Courtesy
    if (/^(hi|hii|hello|hey|yo|salaam|salam|assalam|asalam|good morning|good afternoon|good evening|namaste|adaab)\b/.test(q) && words.length <= 4) {
      return smalltalkReply(q);
    }
    if (/^(thanks|thank you|thx|ok|okay|shukria|jee)\b/.test(q) && words.length <= 4) {
      return smalltalkReply(q);
    }

    // 2. Direct CNR Pattern Matching
    var cnr = text.match(/\b(JK[A-Z]{2}\d{6,}|CASE-[A-Z0-9]{3,}|CMR[\/\-]\d+[\/\-]\d+)\b/i);
    if (cnr) {
      var cnrSearch = searchRegistryCases(cnr[1]);
      if (cnrSearch && cnrSearch.results && cnrSearch.results.length > 0) {
        var c = cnrSearch.results[0];
        return {
          customReply: "🔍 Record Found for CNR " + cnr[1] + ":\n\n" +
            "• Case Title: " + (c.title || "Government Matter") + "\n" +
            "• 📅 Next Hearing Date: " + (c.hearing_date || c.next_date || "Date Awaited") + "\n" +
            "• 🏢 Department: " + (c.dept || c.department || "Stakeholder Dept") + "\n" +
            "• 📋 Reply Status: " + (c.reply_status || "Not Specified") + "\n" +
            "• 🏛️ Court: " + (c.court || "Judicial Forum Kupwara"),
          customLink: PAGES.filter,
          customOptions: [
            { label: "Search Another Case", next: "start" },
            { label: "« Main Menu", next: "start" }
          ]
        };
      }
      return {
        customReply: "CNR / Case ID \"" + cnr[1] + "\" was not found in active listings.\n\nPlease verify on the master Case Filter or Case History tracker.",
        customLink: PAGES.filter,
        customOptions: [
          { label: "Open Case History", next: "history_help" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }

    // 3. Litigant & Case Next-Date Engine
    var isExplicitSearch = /(next\s*date|hearing\s*date|when\s*is|case\s*of|vs|v\/s|hearing\s*of)/.test(q);
    var isCourtQ = extractCourt(q);
    var isDeptQ = extractDept(q);
    var isMetricQ = extractMetric(q);
    var isStaticKeyword = /(active|total|stat|office|login|sop|contempt|exparte|ex[-\s]parte|department|developer|disclaimer|counsel|lawyer|advocate)/.test(q);

    var cleanSearchTerm = q
      .replace(/\b(next|hearing|date|status|when|is|the|of|for|case|matter|versus|vs|v\/s)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Trigger lookup if explicitly asked for hearing date OR if user typed a name/keyword (>= 5 chars) not matching system topics
    if (isExplicitSearch || (!isCourtQ && !isDeptQ && !isMetricQ && !isStaticKeyword && cleanSearchTerm.length >= 5 && words.length <= 4)) {
      var searchRes = searchRegistryCases(text);

      if (searchRes && searchRes.results && searchRes.results.length > 0) {
        var count = searchRes.results.length;
        var reply = "🔍 Found " + count + " matching case(s) for \"" + searchRes.query + "\":\n\n";

        searchRes.results.slice(0, 4).forEach(function (c, idx) {
          var title = c.title || c.case_title || "Government Matter";
          var nextDate = c.hearing_date || c.next_date || "Date Awaited";
          var dept = c.dept || c.department || "Stakeholder Dept";
          var court = c.court || "Judicial Forum Kupwara";
          var replyStat = c.reply_status || (c.reply_filed ? "Reply Filed ✅" : "Reply Not Filed ❌");
          var caseNum = c.case_number && c.case_number !== "—" ? (" (" + c.case_number + ")") : "";

          reply += (idx + 1) + ". " + title + caseNum + "\n" +
                   "   • 📅 Next Hearing: " + nextDate + "\n" +
                   "   • 🏢 Department: " + dept + "\n" +
                   "   • 📋 Reply Status: " + replyStat + "\n" +
                   "   • 🏛️ Court: " + court + "\n\n";
        });

        if (count > 4) {
          reply += "…and " + (count - 4) + " more matching record(s). Open Live Data for full records.";
        }

        return {
          customReply: reply.trim(),
          customLink: PAGES.filter,
          customOptions: [
            { label: "Check Another Case", next: "start" },
            { label: "« Main Menu", next: "start" }
          ]
        };
      } else if (searchRes && !searchRes.tooShort) {
        if (isExplicitSearch || cleanSearchTerm.length >= 5) {
          return {
            customReply: "🔍 I couldn't find any registered case matching \"" + searchRes.query + "\".\n\n" +
                         "Suggestions:\n" +
                         "• Verify the spelling of the party's name (e.g. \"Yaqoob Khan\").\n" +
                         "• Search with at least 5 letters of the litigant's name (e.g. \"Yaqoo\").\n" +
                         "• Search by CNR number or open the master Case Filter on the portal.",
            customLink: PAGES.filter,
            customOptions: [
              { label: "Today's Cause List", next: "choose_court" },
              { label: "« Main Menu", next: "start" }
            ]
          };
        }
      } else if (isExplicitSearch && searchRes && searchRes.tooShort) {
        return {
          customReply: "Please provide at least 5 letters of the litigant's name (e.g. \"Yaqoob\") or the case CNR number to search.",
          customLink: PAGES.filter,
          customOptions: [{ label: "« Main Menu", next: "start" }]
        };
      }
    }

    // 4. Disambiguation & Entity Resolution
    var court = isCourtQ;
    var dept = isDeptQ;
    var metric = isMetricQ;
    var ctype = extractType(q);

    if (dept && court && /labour|labor/.test(q)) {
      if (/court|tribunal|wage claim/.test(q)) dept = null;
      else if (/dept|department/.test(q)) court = null;
    }

    if (court && (!dept || (metric && metric !== "total") || /court|munsiff|munsif|sessions|cjm|judge|mact|forum/.test(q))) {
      if (!dept || courtNames(court).some(function (n) { return q.indexOf(n) !== -1 && n.length >= 5; })) {
        return replyCourt(court, metric || (/(today|cause|hearing|list|schedule)/.test(q) ? "listings" : "total"));
      }
    }

    if (dept) {
      var r = replyDept(dept);
      if (r) return r;
    }

    if (ctype && /type|how many|count|total|appeal|suit|petition|claim|contempt|execution|restoration|consumer matter/.test(q)) {
      var n = FALLBACK_TYPES[ctype] || "—";
      return {
        customReply: "Case type: " + ctype + "\n\nApproximate registered count: " + n + ".\n\nFull mix: Civil Suits 220 · Execution 19 · Wage Claims 15 · Consumer 23 · Appeals 15 · Restoration 10 · Contempt 5 · Criminal complaints 5 · MACT 4.\n\nFilter by case type on Live Data.",
        customLink: PAGES.filter,
        customOptions: [
          { label: "All Case Types", next: "case_types" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }

    // 5. Officials & Administration
    if (/ishfaq|dlo\b|incharge|in charge|who is the officer|who heads|litigation officer/.test(q) && !/counsel|lawyer|advocate|zubair|wasim/.test(q)) {
      return {
        customReply: "District Litigation Officer Kupwara:\n\nIshfaq Ahmad Khan\nDistrict Litigation Officer, DLO Kupwara\nDepartment of Law, Justice & Parliamentary Affairs, UT of J&K.\nOffice: 1st Floor, DC Office Complex Kupwara — 193222.",
        customLink: PAGES.contact,
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }
    if (/standing counsel|lawyer|advocate|\badv\b|zubair|wasim|wani|counsel performance/.test(q)) {
      if (/performance|attendance|log/.test(q)) return { stepKey: "counsel_perf" };
      return { stepKey: "officials" };
    }
    if (/developer|who built|who created|who designed|tariq/.test(q)) {
      return handleStaticIntent("developer", q);
    }
    if (/ex[-\s]?parte|exparte/.test(q)) {
      var m = getLiveMetrics();
      return {
        customReply: "Ex-Parte Case Monitoring:\n\nCurrently " + m.exparte + " cases are flagged Ex-parte across Kupwara courts.\n\nImmediate action: concerned departments must file restoration applications or parawise objections through standing counsel to avoid adverse ex-parte decrees.\n\nHighest ex-parte courts: Sub Judge Kupwara (13), Munsiff Kralpora (9), Munsiff Kupwara (7).",
        customLink: PAGES.filter,
        customOptions: [
          { label: "SOP for Replies", next: "replies_sop" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }
    if (/contempt|compliance|\batr\b|action taken|personal appearance/.test(q)) {
      return handleStaticIntent("contempt", q);
    }
    if (/reply pend|replies pend|unfiled|missing reply/.test(q)) {
      return { stepKey: "reply_pending" };
    }
    if (/disposal|disposed|disposal rate/.test(q)) {
      return { stepKey: "live_stats" };
    }
    if (/court distribution|all courts|how many court|12 court|13\+|courts covered|which court has/.test(q)) {
      if (/most|highest|maximum|largest/.test(q)) return rankingCourtReply();
      return { stepKey: "court_dist" };
    }
    if (/which department|highest pending|most pending|worst pending|top department/.test(q)) {
      return rankingDeptReply();
    }
    if (/\bdepartment\b|\bdept\b|stakeholder|30 department/.test(q)) {
      return { stepKey: "dept_overview" };
    }
    if (/case type|civil suit|execution petition|wage claim|writ|appeal|mact case|restoration|pauper/.test(q)) {
      return { stepKey: "case_types" };
    }
    if (/overdue|date passed|hearing lapsed/.test(q)) return { stepKey: "overdue" };
    if (/urgent|hearing|tomorrow|today|cause list|listed/.test(q)) {
      if (/cause list|today board|daily board/.test(q)) return { stepKey: "choose_court" };
      if (/calendar/.test(q)) return { stepKey: "calendar_help" };
      return { stepKey: "urgent_hearings" };
    }
    if (/reply|sop|objection|parawise|vetting|scrutiny/.test(q)) return { stepKey: "replies_sop" };
    if (/time|timing|hours|address|location|where|contact|email|phone|dc office|pin code|pincode|sunday|holiday/.test(q)) {
      return { stepKey: "office" };
    }
    if (/login|operator|staff portal|admin|password|2fa|otp/.test(q)) return { stepKey: "operator" };
    if (/\bapp\b|download|install|pwa|\bapk\b/.test(q)) return { stepKey: "pwa" };
    if (/disclaimer|legal proceeding|cannot be the basis|is this official record/.test(q)) return { stepKey: "disclaimer" };
    if (/enquir|complaint form|send message/.test(q)) return { stepKey: "enquiry" };
    if (/history|proceeding|audit trail|timeline/.test(q)) return { stepKey: "history_help" };
    if (/calendar/.test(q)) return { stepKey: "calendar_help" };
    if (/circular|notice|update|order uploaded/.test(q)) return { stepKey: "updates_help" };
    if (/practice|mission|what do you do|dlsa|civil litigation/.test(q)) return { stepKey: "practice" };
    if (/performance|standing counsel log/.test(q)) return { stepKey: "counsel_perf" };
    if (/excel|pdf|whatsapp|print|download report/.test(q)) {
      return {
        customReply: "Exports on the portal:\n\n• Live Data / Filter — Excel, PDF, Print\n• Hearings — Excel, PDF, Share on WhatsApp\n• Cause List — Print, WhatsApp, Excel\n• Department performance, overdue, missing-reply — Excel & PDF\n• Standing Counsel Performance — Excel & PDF (full details)\n\nWhatsApp share is meant for internal departmental circulation.",
        customOptions: [
          { label: "Portal Pages", next: "pages" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }
    if (/active|total|statistic|stats|performance|summary|how many case/.test(q)) {
      return { stepKey: "live_stats" };
    }

    // 6. Question Bank Nearest-Neighbor Match
    var hit = bestQuestionMatch(q);
    if (hit && hit.item) {
      var p = hit.item.p;
      if (p.kind === "court") {
        var cObj = COURTS_LIST.filter(function (c) { return c.id === p.id; })[0];
        if (cObj) return replyCourt(cObj, extractMetric(p.metricHint || q) || "total");
      }
      if (p.kind === "dept") {
        var rd = replyDept({ name: p.name, alias: p.name });
        if (rd) return rd;
      }
      if (p.kind === "type") {
        return {
          customReply: "Case type: " + p.name + " — about " + (FALLBACK_TYPES[p.name] || "—") + " registered matters.\nFilter this type on Live Data.",
          customLink: PAGES.filter,
          customOptions: [{ label: "All Case Types", next: "case_types" }, { label: "« Main Menu", next: "start" }]
        };
      }
      if (p.kind === "static") {
        var sr = handleStaticIntent(p.intent, q);
        if (sr) return sr;
      }
    }

    var suggestions = [
      { label: "Today's Cause List", next: "choose_court" },
      { label: "Real-Time Stats", next: "live_stats" },
      { label: "Court Distribution", next: "court_dist" },
      { label: "Department Caseloads", next: "dept_overview" },
      { label: "Office Info", next: "office" }
    ];
    return {
      fallbackMessage: "I couldn't find an exact match for \"" + text + "\". Try one of these:\n\n" +
        "• Case / Litigant lookup — \"next date of Yaqoob Khan\" or \"Yaqoo\"\n" +
        "• A court — \"Sub Judge Kupwara\", \"CJM Handwara\", \"MACT\"\n" +
        "• A department or acronym — \"PMGSY\", \"PDD\", \"Jal Shakti\", \"Revenue\"\n" +
        "• Officials — \"who is the DLO\", \"standing counsel\"\n" +
        "• Process — \"parawise SOP\", \"contempt ATR\", \"office hours\"",
      fallbackOptions: suggestions
    };
  }

  // ─── 7. UI STYLES (EXECUTIVE NAVY GRADIENT, RESPONSIVE) ──────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#dlo-chat-teaser{position:fixed;bottom:78px;left:24px;background:#fff;color:#0c2340;border:1px solid #cbd5e1;border-radius:10px;padding:7px 13px;font-size:12px;font-weight:600;box-shadow:0 4px 18px rgba(0,0,0,.12);z-index:9998;display:flex;align-items:center;gap:6px;cursor:pointer;animation:dloFloat 3s ease-in-out infinite}",
    "#dlo-chat-teaser::after{content:'';position:absolute;bottom:-6px;left:20px;border-width:6px 6px 0;border-style:solid;border-color:#fff transparent;display:block;width:0}",
    "@keyframes dloFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
    "#dlo-chat-trigger{position:fixed;bottom:24px;left:24px;background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:50px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(12,35,64,.35);z-index:9999;display:flex;align-items:center;gap:8px;transition:all .2s ease}",
    "#dlo-chat-trigger:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(12,35,64,.45)}",
    "#dlo-chat-window{position:fixed;bottom:78px;left:24px;width:365px;max-width:calc(100vw - 36px);height:520px;max-height:min(520px,78vh);background:#fff;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 12px 35px rgba(0,0,0,.22);display:none;flex-direction:column;z-index:9999;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
    "#dlo-chat-header{background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}",
    ".dlo-header-left{display:flex;align-items:center;gap:8px}",
    ".dlo-status-dot{width:8px;height:8px;background:#10b981;border-radius:50%;box-shadow:0 0 6px #10b981}",
    ".dlo-header-title{font-weight:600;font-size:13.5px}",
    ".dlo-header-sub{font-size:10px;opacity:.75;margin-top:1px}",
    ".dlo-header-actions{display:flex;gap:12px;align-items:center}",
    ".dlo-action-btn{cursor:pointer;opacity:.85;font-size:15px;transition:opacity .15s}",
    ".dlo-action-btn:hover{opacity:1}",
    "#dlo-chat-body{padding:14px;overflow-y:auto;flex-grow:1;display:flex;flex-direction:column;gap:10px;background:#f8fafc;scroll-behavior:smooth}",
    ".dlo-msg-row{display:flex;width:100%}",
    ".dlo-msg-row.bot{justify-content:flex-start}",
    ".dlo-msg-row.user{justify-content:flex-end}",
    ".dlo-bubble{max-width:85%;padding:9px 12px;border-radius:12px;font-size:12px;line-height:1.45;word-break:break-word;white-space:pre-line;box-shadow:0 1px 3px rgba(0,0,0,.05)}",
    ".dlo-msg-row.bot .dlo-bubble{background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:3px}",
    ".dlo-msg-row.user .dlo-bubble{background:linear-gradient(135deg,#0c2340 0%,#1e3a8a 100%);color:#fff;border-bottom-right-radius:3px}",
    ".dlo-bubble-action{display:inline-block;margin-top:6px;padding:5px 10px;background:#eff6ff;color:#1e3a8a;border-radius:6px;font-weight:600;text-decoration:none;font-size:11px;border:1px solid #bfdbfe}",
    ".dlo-typing{display:inline-flex;gap:4px;align-items:center;padding:6px 10px}",
    ".dlo-typing span{width:5px;height:5px;background:#94a3b8;border-radius:50%;animation:dloBounce 1.2s infinite ease-in-out}",
    ".dlo-typing span:nth-child(2){animation-delay:.2s}",
    ".dlo-typing span:nth-child(3){animation-delay:.4s}",
    "@keyframes dloBounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}",
    "#dlo-chips-container{padding:8px 12px;background:#fff;border-top:1px solid #f1f5f9;display:flex;flex-wrap:wrap;gap:5px;max-height:110px;overflow-y:auto;flex-shrink:0}",
    ".dlo-chip-btn{background:#f8fafc;border:1px solid #cbd5e1;color:#0c2340;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease}",
    ".dlo-chip-btn:hover{background:#0c2340;color:#fff;border-color:#0c2340}",
    "#dlo-input-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#fff;border-top:1px solid #e2e8f0;flex-shrink:0}",
    "#dlo-user-input{flex-grow:1;border:1px solid #cbd5e1;border-radius:20px;padding:7px 12px;font-size:12px;outline:none;color:#0f172a}",
    "#dlo-user-input:focus{border-color:#1e3a8a}",
    "#dlo-send-btn{background:#0c2340;color:#fff;border:none;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;transition:background .15s;flex-shrink:0}",
    "#dlo-send-btn:hover{background:#1e3a8a}",
    "@media (max-width:480px){#dlo-chat-window{left:8px;right:8px;width:auto;bottom:70px;height:min(560px,80vh);border-radius:14px}#dlo-chat-trigger,#dlo-chat-teaser{left:12px}#dlo-chat-trigger{bottom:16px}#dlo-chat-teaser{bottom:70px}}",
    "@media (prefers-reduced-motion:reduce){#dlo-chat-teaser{animation:none}#dlo-chat-trigger:hover{transform:none}}"
  ].join("\n");
  document.head.appendChild(style);

  // ─── 8. DOM MOUNTING & EVENT BINDINGS ────────────────────────────────────
  var teaser = document.createElement("div");
  teaser.id = "dlo-chat-teaser";
  teaser.setAttribute("role", "button");
  teaser.innerHTML = "<span>💬 Need guidance? Ask me</span>";
  document.body.appendChild(teaser);

  var trigger = document.createElement("button");
  trigger.id = "dlo-chat-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-label", "Open DLO Kupwara Assistant");
  trigger.innerHTML = "<span style=\"font-size:15px\">&#9878;</span><span>Ask Assistant</span>";
  document.body.appendChild(trigger);

  var box = document.createElement("div");
  box.id = "dlo-chat-window";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "DLO Kupwara Assistant");
  box.innerHTML = ""
    + "<div id=\"dlo-chat-header\">"
    + "  <div class=\"dlo-header-left\">"
    + "    <div class=\"dlo-status-dot\"></div>"
    + "    <div><div class=\"dlo-header-title\">DLO Kupwara Assistant</div>"
    + "    <div class=\"dlo-header-sub\">Legal desk · live registry</div></div>"
    + "  </div>"
    + "  <div class=\"dlo-header-actions\">"
    + "    <span id=\"dlo-chat-restart\" class=\"dlo-action-btn\" title=\"Restart\" role=\"button\">&#8634;</span>"
    + "    <span id=\"dlo-chat-close\" class=\"dlo-action-btn\" title=\"Close\" role=\"button\">&#10005;</span>"
    + "  </div>"
    + "</div>"
    + "<div id=\"dlo-chat-body\"></div>"
    + "<div id=\"dlo-chips-container\"></div>"
    + "<form id=\"dlo-input-bar\">"
    + "  <input type=\"text\" id=\"dlo-user-input\" placeholder=\"e.g. next date of yaqoob khan, PMGSY…\" autocomplete=\"off\" />"
    + "  <button type=\"submit\" id=\"dlo-send-btn\" title=\"Send\">&#10148;</button>"
    + "</form>";
  document.body.appendChild(box);

  var chatBody = box.querySelector("#dlo-chat-body");
  var chipsContainer = box.querySelector("#dlo-chips-container");
  var inputForm = box.querySelector("#dlo-input-bar");
  var userInput = box.querySelector("#dlo-user-input");
  var isInitialized = false;

  function appendMessage(sender, text, link) {
    var row = document.createElement("div");
    row.className = "dlo-msg-row " + sender;
    var bubble = document.createElement("div");
    bubble.className = "dlo-bubble";
    bubble.textContent = text;
    if (link && link.url) {
      var a = document.createElement("a");
      a.className = "dlo-bubble-action";
      a.href = link.url;
      a.textContent = (link.text || "Open") + " →";
      bubble.appendChild(document.createElement("br"));
      bubble.appendChild(a);
    }
    row.appendChild(bubble);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTypingIndicator() {
    var row = document.createElement("div");
    row.className = "dlo-msg-row bot";
    row.id = "dlo-typing-row";
    var bubble = document.createElement("div");
    bubble.className = "dlo-bubble dlo-typing";
    bubble.innerHTML = "<span></span><span></span><span></span>";
    row.appendChild(bubble);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function removeTypingIndicator() {
    var typing = document.getElementById("dlo-typing-row");
    if (typing) typing.remove();
  }

  function renderChips(options) {
    chipsContainer.innerHTML = "";
    if (!options) return;
    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dlo-chip-btn";
      btn.textContent = opt.label;
      btn.onclick = function () { triggerStep(opt.next, opt.label); };
      chipsContainer.appendChild(btn);
    });
  }

  function triggerStep(stepKey, userLabel) {
    chipsContainer.innerHTML = "";
    if (userLabel) appendMessage("user", userLabel);
    showTypingIndicator();
    setTimeout(function () {
      removeTypingIndicator();
      var step = BOT_DATA[stepKey] || BOT_DATA.start;
      var messageText = typeof step.getMessage === "function" ? step.getMessage()
        : (typeof step.message === "function" ? step.message() : step.message);
      appendMessage("bot", messageText, step.link);
      renderChips(step.options);
    }, 240);
  }

  function applyMatch(match) {
    if (match.customReply) {
      appendMessage("bot", match.customReply, match.customLink || null);
      renderChips(match.customOptions);
    } else if (match.stepKey) {
      var step = BOT_DATA[match.stepKey] || BOT_DATA.start;
      var messageText = typeof step.getMessage === "function" ? step.getMessage() : step.message;
      appendMessage("bot", messageText, step.link);
      renderChips(step.options);
    } else {
      appendMessage("bot", match.fallbackMessage);
      renderChips(match.fallbackOptions);
    }
  }

  inputForm.onsubmit = function (e) {
    e.preventDefault();
    var query = userInput.value.trim();
    if (!query) return;
    userInput.value = "";
    appendMessage("user", query);
    chipsContainer.innerHTML = "";
    showTypingIndicator();
    setTimeout(function () {
      removeTypingIndicator();
      applyMatch(processUserText(query));
    }, 240);
  };

  function startChat() {
    chatBody.innerHTML = "";
    triggerStep("start");
  }

  function toggleChat() {
    var isVisible = box.style.display === "flex";
    box.style.display = isVisible ? "none" : "flex";
    teaser.style.display = isVisible ? "flex" : "none";
    if (!isVisible && !isInitialized) {
      startChat();
      isInitialized = true;
      ensureQuestionBank();
    }
    if (!isVisible) setTimeout(function () { userInput.focus(); }, 50);
  }

  trigger.onclick = toggleChat;
  teaser.onclick = toggleChat;
  box.querySelector("#dlo-chat-close").onclick = function () {
    box.style.display = "none";
    teaser.style.display = "flex";
  };
  box.querySelector("#dlo-chat-restart").onclick = function () { startChat(); };

  window.DLO_ASSISTANT = {
    version: DLO_ASSISTANT_VERSION,
    questionCount: function () { ensureQuestionBank(); return QUESTION_COUNT; },
    ask: processUserText
  };
})();
