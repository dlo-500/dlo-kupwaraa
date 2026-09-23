(function () {
  // ─── 1. OFFICIAL COURTS DIRECTORY & ALIASES (12 COURTS) ───────────────────
  const COURTS_LIST = [
    {
      id: "cjm_handwara",
      name: "CJM/SUB JUDGE HANDWARA",
      short: "CJM / Sub Judge Handwara",
      aliases: ["cjm", "cjm handwara", "sub judge handwara", "subjudge handwara", "chief judicial magistrate handwara"]
    },
    {
      id: "dist_sessions",
      name: "PR. DISTRICT AND SESSIONS COURT KUPWARA",
      short: "Sessions Court Kupwara",
      aliases: ["sessions", "dist sessions", "pr district", "district court kupwara", "principal district and sessions", "sessions kupwara", "pdj kupwara"]
    },
    {
      id: "sub_kupwara",
      name: "Sub Judge Kupwara",
      short: "Sub Judge Kupwara",
      aliases: ["sub judge kupwara", "subjudge kupwara", "senior civil judge kupwara", "sub-judge kupwara"]
    },
    {
      id: "addl_handwara",
      name: "ADDITIONAL DISTRICT AND SESSIONS COURT HANDWARA",
      short: "Addl. Sessions Handwara",
      aliases: ["additional sessions", "addl sessions", "addl handwara", "ad&sj handwara", "additional district court handwara"]
    },
    {
      id: "consumer",
      name: "CONSUMER COURT KUPWARA",
      short: "Consumer Court Kupwara",
      aliases: ["consumer", "consumer court", "dcdrc", "consumer commission", "consumer forum"]
    },
    {
      id: "munsiff_kralpora",
      name: "Munsiff Kralpora",
      short: "Munsiff Kralpora",
      aliases: ["kralpora", "munsiff kralpora", "court kralpora", "munsif kralpora"]
    },
    {
      id: "munsiff_kupwara",
      name: "MUNSIFF KUPWARA",
      short: "Munsiff Kupwara",
      aliases: ["munsiff kupwara", "munsif kupwara", "civil judge kupwara", "court of munsiff kupwara"]
    },
    {
      id: "labour",
      name: "LABOUR COURT KUPWARA",
      short: "Labour Court Kupwara",
      aliases: ["labour", "labor", "labour court", "labor court", "industrial tribunal", "wage authority", "labour officer"]
    },
    {
      id: "munsiff_sogam",
      name: "MUNSIFF SOGAM",
      short: "Munsiff Sogam",
      aliases: ["sogam", "munsiff sogam", "munsif sogam", "lolab court", "munsiff lolab", "court sogam"]
    },
    {
      id: "sub_trehgam",
      name: "SUB JUDGE TREHGAM",
      short: "Sub Judge Trehgam",
      aliases: ["trehgam", "sub judge trehgam", "subjudge trehgam", "munsiff trehgam", "court trehgam"]
    },
    {
      id: "munsiff_handwara",
      name: "MUNSIFF HANDWARA",
      short: "Munsiff Handwara",
      aliases: ["munsiff handwara", "munsif handwara", "court munsiff handwara"]
    },
    {
      id: "mact",
      name: "MACT KUPWARA",
      short: "MACT Kupwara",
      aliases: ["mact", "accident claim", "motor accident", "mact tribunal", "claims tribunal"]
    }
  ];

  // ─── 2. EXHAUSTIVE DEPARTMENT DIRECTORY & ACRONYM RESOLVER ───────────────
  const DEPT_ALIASES = {
    // R&B / PWD / PMGSY
    "pmgsy": "R&b", "pwd": "R&b", "r&b": "R&b", "roads": "R&b", "bridges": "R&b", "public works": "R&b", "highways": "R&b",
    // PDD / KPDCL
    "pdd": "PDD", "kpdcl": "PDD", "power": "PDD", "electricity": "PDD", "electric": "PDD", "power development": "PDD",
    // Jal Shakti / PHE / Irrigation
    "jal shakti": "PHE/JAL SHAKTI", "phe": "PHE/JAL SHAKTI", "water": "PHE/JAL SHAKTI", "drinking water": "PHE/JAL SHAKTI",
    "i&fc": "I&FC", "ifc": "I&FC", "irrigation": "I&FC", "flood control": "I&FC",
    // Municipal / Urban Local Bodies
    "ulb": "URBAN LOCAL BODIES", "urban local bodies": "URBAN LOCAL BODIES", "municipality": "URBAN LOCAL BODIES",
    "mc kupwara": "URBAN LOCAL BODIES", "mc handwara": "URBAN LOCAL BODIES", "municipal council": "URBAN LOCAL BODIES",
    "municipal committee": "URBAN LOCAL BODIES", "sanitation": "URBAN LOCAL BODIES",
    // Revenue
    "revenue": "Revenue", "patwari": "Revenue", "tehsildar": "Revenue", "naib tehsildar": "Revenue",
    "girdawar": "Revenue", "land": "Revenue", "mutation": "Revenue", "demarcation": "Revenue",
    "kahcharai": "Revenue", "state land": "Revenue", "evacuee": "Revenue", "nazool": "Revenue",
    // RDD
    "rdd": "RDD", "rural development": "RDD", "bdo": "RDD", "panchayat": "RDD", "vlw": "RDD", "acd": "RDD",
    // Education & Samagra Shiksha
    "education": "EDUCATION", "school": "EDUCATION", "teacher": "EDUCATION", "ceo kupwara": "EDUCATION",
    "zep": "EDUCATION", "zeo": "EDUCATION", "samagra": "SMAGRA SHIKSHA", "smagra shiksha": "SMAGRA SHIKSHA",
    // Health
    "health": "HEALTH AND MEDICAL EDUCATION", "hospital": "HEALTH AND MEDICAL EDUCATION", "doctor": "HEALTH AND MEDICAL EDUCATION",
    "medical": "HEALTH AND MEDICAL EDUCATION", "cmo kupwara": "HEALTH AND MEDICAL EDUCATION", "bmo": "HEALTH AND MEDICAL EDUCATION",
    // Social Welfare & ICDS
    "social welfare": "SOCIAL WELFARE", "icds": "SOCIAL WELFARE", "anganwadi": "SOCIAL WELFARE", "pension": "SOCIAL WELFARE",
    // Forest & Environment
    "forest": "FOREST", "jungle": "FOREST", "wildlife": "FOREST", "dfo": "FOREST", "timber": "FOREST", "sfc": "FOREST",
    // Police / Home
    "home": "HOME", "police": "HOME", "fir": "HOME", "ssp kupwara": "HOME", "sho": "HOME", "thana": "HOME",
    // Food & Civil Supplies
    "fcs&ca": "FCS&CA", "capd": "FCS&CA", "ration": "FCS&CA", "food supplies": "FCS&CA", "food safety": "Food Safety officer", "fso": "Food Safety officer",
    // Agriculture & Allied
    "horticulture": "HORTICULTURE", "fruit": "HORTICULTURE", "agriculture": "AGRICULTURE", "kissan": "AGRICULTURE",
    "animal husbandary": "ANIMAL HUSBANDARY", "veterinary": "ANIMAL HUSBANDARY", "sheep": "SHEEP HUSBANDRY",
    // Industry & Others
    "jkedi": "JKEDI", "edi": "JKEDI", "industries": "INDUSTRIES AND COMMERCE", "geology": "GEOLOGY AND MINING", "mining": "GEOLOGY AND MINING",
    "transport": "TRANSPORT", "rto": "TRANSPORT", "arvo": "TRANSPORT", "skill": "SKILL DEVELOPMENT", "iti": "SKILL DEVELOPMENT",
    "defence estates": "DEFENCE ESTATES", "army land": "DEFENCE ESTATES", "uoi": "UOI", "union of india": "UOI",
    "sports": "YOUTH SERVICES AND SPORTS", "culture": "CULTURE", "science": "SCIENCE AND TECHNOLOGY", "relief": "RELIEF", "jkrlm": "JKRLM"
  };

  // ─── 3. LIVE DOM SCRAPERS (READS REAL DATA FROM WEBPAGE) ─────────────────
  function getLiveMetrics() {
    const text = document.body.innerText || "";
    const totalM = text.match(/Total cases.*?:\s*(\d+)/i) || text.match(/(\d+)\s*TOTAL CASES/i);
    const activeM = text.match(/Active cases.*?:\s*(\d+)/i) || text.match(/(\d+)\s*ACTIVE/i);
    const disposedM = text.match(/Disposed cases.*?:\s*(\d+)/i) || text.match(/(\d+)\s*DISPOSED/i);
    const pendingM = text.match(/(\d+)\s*REPLY PENDING/i);
    const filedM = text.match(/(\d+)\s*REPLY FILED/i);
    const exparteM = text.match(/(\d+)\s*EX-PARTE/i);

    return {
      total: totalM ? totalM[1] : "392",
      active: activeM ? activeM[1] : "365",
      disposed: disposedM ? disposedM[1] : "27",
      replyPending: pendingM ? pendingM[1] : "261",
      replyFiled: filedM ? filedM[1] : "131",
      exparte: exparteM ? exparteM[1] : "47",
      rate: "7%"
    };
  }

  function getCourtDistributionStats(courtName) {
    const norm = courtName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const rows = document.querySelectorAll("table tbody tr");
    for (const tr of rows) {
      const cols = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
      if (cols.length === 3) {
        const cNorm = cols[1].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cNorm.includes(norm) || norm.includes(cNorm)) {
          return { name: cols[1], total: cols[2] };
        }
      }
    }
    return null;
  }

  function getDepartmentData(rawDeptQuery) {
    const q = rawDeptQuery.toLowerCase().trim();
    const resolvedDept = DEPT_ALIASES[q] || q;

    const rows = document.querySelectorAll("table tbody tr");
    for (const tr of rows) {
      const cols = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
      if (cols.length >= 6 && isNaN(cols[1])) {
        const deptInTable = cols[1].toLowerCase();
        if (deptInTable.includes(resolvedDept.toLowerCase()) || resolvedDept.toLowerCase().includes(deptInTable)) {
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
    return null;
  }

  function getCourtListings(courtName) {
    const results = [];
    const norm = courtName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const rawList = window.allCases || window.cases || window.casesData || window.DLO_CASES || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      rawList.forEach(c => {
        const cNorm = (c.court || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cNorm.includes(norm) || norm.includes(cNorm)) {
          results.push({
            number: c.case_number || c.cnr || "Case",
            title: c.title || c.case_title || "State Matter",
            date: c.hearing_date || c.next_date || "Today"
          });
        }
      });
      if (results.length > 0) return results;
    }

    const tickerItems = document.querySelectorAll(".ticker span, marquee span, .live-updates *, #ticker *");
    const searchPool = tickerItems.length > 0 ? Array.from(tickerItems) : Array.from(document.querySelectorAll("p, div, li, tr"));

    searchPool.forEach(el => {
      const line = el.textContent || "";
      if (line.includes("Hearing scheduled") || line.includes("Sept") || line.includes("2026")) {
        const lineNorm = line.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lineNorm.includes(norm)) {
          const parts = line.split("—").map(p => p.trim());
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

    return results.filter((v, i, a) => a.findIndex(t => t.number === v.number && t.number !== "Listed Matter") === i);
  }

  // ─── 4. STRUCTURED KNOWLEDGE TREE (GUIDED BUTTONS) ────────────────────────
  const BOT_DATA = {
    start: {
      message: "Hello! Welcome to the District Litigation Office Kupwara legal desk. Ask me any question below or choose a category:",
      options: [
        { label: "📅 Today's Cause List by Court", next: "choose_court" },
        { label: "📊 Real-Time Portal Statistics", next: "live_stats" },
        { label: "🏛️ Court-wise Case Distribution", next: "court_dist" },
        { label: "⚠️ Urgent Hearings (Next 2 Days)", next: "urgent_hearings" },
        { label: "📝 Departmental SOP for Replies", next: "replies_sop" },
        { label: "🏢 Office Hours & Location", next: "office" },
        { label: "👨‍⚖️ Officials & Standing Counsel", next: "officials" },
        { label: "🔐 Operator Login", next: "operator" }
      ]
    },

    choose_court: {
      message: "Select a court to view scheduled government cases:",
      options: COURTS_LIST.map(court => ({
        label: court.short,
        next: `court_${court.id}`
      })).concat([{ label: "« Back to Main Menu", next: "start" }])
    },

    court_dist: {
      getMessage: () => {
        return `🏛️ Court-wise Registered Case Distribution (392 Total):\n\n` +
               `1. CJM/Sub Judge Handwara: 107 cases\n` +
               `2. Pr. District & Sessions Kupwara: 73 cases\n` +
               `3. Sub Judge Kupwara: 57 cases\n` +
               `4. Addl. District & Sessions Handwara: 46 cases\n` +
               `5. Consumer Court Kupwara: 24 cases\n` +
               `6. Munsiff Kralpora: 19 cases\n` +
               `7. Munsiff Kupwara: 18 cases\n` +
               `8. Labour Court Kupwara: 15 cases\n` +
               `9. Munsiff Sogam: 14 cases\n` +
               `10. Sub Judge Trehgam: 9 cases\n` +
               `11. Munsiff Handwara: 6 cases\n` +
               `12. MACT Kupwara: 4 cases\n\n` +
               `Select any court or type its name to view details.`;
      },
      link: { url: "causelist.html", text: "Open Cause List Explorer" },
      options: [
        { label: "📅 Check Today's Cause List", next: "choose_court" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },

    live_stats: {
      getMessage: () => {
        const m = getLiveMetrics();
        return `📊 Real-Time Legal Statistics (DLO Kupwara):\n\n` +
               `• Total Cases Registered: ${m.total}\n` +
               `• Active Monitored Cases: ${m.active}\n` +
               `• Cases Disposed: ${m.disposed} (${m.rate} disposal rate)\n` +
               `• Replies Filed: ${m.replyFiled}\n` +
               `• Replies Pending: ${m.replyPending}\n` +
               `• Ex-parte Cases Monitored: ${m.exparte}\n` +
               `• Judicial Forums Covered: 12\n\n` +
               `Data synchronized with DC Office Complex litigation registry.`;
      },
      link: { url: "performance.html", text: "Open Performance Dashboard" },
      options: [
        { label: "🏛️ Court Distribution", next: "court_dist" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },

    urgent_hearings: {
      message: "⚠️ 16 government hearings are listed across Kupwara courts in the next 48 hours.\n\nStakeholder departments must furnish standing counsel with parawise remarks prior to court call.",
      link: { url: "hearings.html", text: "View All Upcoming Hearings" },
      options: [
        { label: "📅 View Cause List by Court", next: "choose_court" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },

    replies_sop: {
      message: "Departmental SOP for Objections & Parawise Replies:\n\n1. Parawise remarks must be submitted by the concerned department at least 3 days prior to the hearing date.\n2. All responses undergo formal vetting at the DLO scrutiny desk before submission in court.\n3. In contempt matters, an Action Taken Report (ATR) must be furnished immediately to prevent personal appearance.",
      link: { url: "contact.html", text: "Contact Scrutiny Desk" },
      options: [
        { label: "🏢 Office Timings & Address", next: "office" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },

    officials: {
      message: "🏛️ DLO Kupwara Officials & Legal Cadre:\n\n" +
               "• District Litigation Officer: Ishfaq Ahmad Khan\n" +
               "• Standing Counsel: Adv. Zubair Ahmad Wani\n" +
               "• Standing Counsel: Adv. Wasim Nazir Khan\n\n" +
               "Coordinating legal representation across civil, service, and labour matters in all district forums.",
      link: { url: "contact.html", text: "Contact Officials" },
      options: [{ label: "« Back to Main Menu", next: "start" }]
    },

    office: {
      message: "District Litigation Office Kupwara\n1st Floor, DC Office Complex, Kupwara, UT of J&K — 193222\n\n🕒 Hours: 10:00 AM – 5:00 PM (Mon–Sat)\n✉️ Email: districtlitigationofficekupwar@gmail.com",
      link: { url: "contact.html", text: "Submit Public / Departmental Enquiry" },
      options: [{ label: "« Back to Main Menu", next: "start" }]
    },

    operator: {
      message: "The operator portal is strictly restricted to authorized departmental staff with active credentials.",
      link: { url: "operator.html", text: "Go to Staff Login" },
      options: [{ label: "« Back to Main Menu", next: "start" }]
    }
  };

  // Dynamically build court cause list nodes
  COURTS_LIST.forEach(court => {
    BOT_DATA[`court_${court.id}`] = {
      getMessage: () => {
        const matches = getCourtListings(court.name);
        const dist = getCourtDistributionStats(court.name);
        const totalCases = dist ? dist.total : "registered";

        if (matches.length === 0) {
          return `🏛️ ${court.name}\nTotal Registered: ${totalCases} cases\n\nNo government matters are flagged for immediate hearing today in this court.\n\nYou can review the complete cause list in the Cause List module.`;
        }
        let msg = `🏛️ ${court.name} (Total: ${totalCases} cases)\n\nFound ${matches.length} matter(s) scheduled for hearing:\n\n`;
        matches.slice(0, 5).forEach((item, idx) => {
          msg += `${idx + 1}. ${item.number}\n   • Title: ${item.title}\n   • Date: ${item.date}\n\n`;
        });
        if (matches.length > 5) msg += `...and ${matches.length - 5} more matters listed.`;
        return msg.trim();
      },
      link: { url: "causelist.html", text: `Open ${court.short} Cause List` },
      options: [
        { label: "« Select Another Court", next: "choose_court" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  });

  // ─── 5. HIGH-ACCURACY NLP QUERY PROCESSOR (300+ PERMUTATIONS) ─────────────
  function processUserText(text) 
  // ── Check for Case Search (Names, Numbers, CNR, or "next date") ────────
    const isSearchIntent = q.includes("next date") || q.includes("case of") || q.includes("hearing of") || q.includes("jkkw") || q.includes(" vs ") || q.includes(" v/s ") || words.length <= 4;
    
    // Ignore pure menu or generic keyword queries
    const isGenericKeyword = ["active", "total", "stats", "office", "login", "sop", "contempt", "ex-parte", "departments"].some(k => q === k);

    if (isSearchIntent && !isGenericKeyword) {
      const searchData = searchCases(text);

      if (searchData && searchData.results.length > 0) {
        const count = searchData.results.length;
        let reply = `🔍 Found ${count} matching case(s) for "${searchData.query}"`;
        if (searchData.courtFiltered) reply += ` in ${searchData.courtFiltered}`:
        reply += `:\n\n`;

        searchData.results.slice(0, 4).forEach((item, idx) => {
          const num = item.case_number || item.cnr || "Case";
          const title = item.title || item.case_title || "State Matter";
          const court = item.court || "Judicial Forum Kupwara";
          const date = item.hearing_date || item.next_date || "Date Awaited";
          const status = item.status || "Active";

          reply += `${idx + 1}. ${title}\n` +
                   `   • Case No: ${num}\n` +
                   `   • Court: ${court}\n` +
                   `   • Next Hearing: 📅 ${date}\n` +
                   `   • Status: ${status}\n\n`;
        });

        if (count > 4) {
          reply += `...and ${count - 4} more matching cases found.`;
        }

        return {
          customReply: reply.trim(),
          customLink: { url: "search-filter-cases.html", text: "Open Full Case Filter" },
          customOptions: [
            { label: "🔍 Search Another Case", next: "start" },
            { label: "« Main Menu", next: "start" }
          ]
        };
      } else if (searchData && searchTokens.length > 0) {
        return {
          customReply: `🔍 No records found matching "${searchData.query}"${searchData.courtFiltered ? ` in ${searchData.courtFiltered}` : ""}.\n\nSuggestions:\n• Verify the spelling of the party's name.\n• Search using the CNR / Case number (e.g. JKKW02...).\n• Or use the full portal filter.`,
          customLink: { url: "search-filter-cases.html", text: "Search in Full Registry" },
          customOptions: [
            { label: "📅 View Today's Cause List", next: "choose_court" },
            { label: "« Main Menu", next: "start" }
          ]
        };
      }
    }
  {
    const q = text.toLowerCase().trim().replace(/[?!.,;]/g, " ");
    const words = q.split(/\s+/);

    // Q1. Officials / Counsel / DLO In-charge
    if (q.includes("ishfaq") || q.includes("dlo") || q.includes("officer") || q.includes("incharge") || q.includes("head") || q.includes("who is")) {
      if (q.includes("counsel") || q.includes("lawyer") || q.includes("advocate") || q.includes("zubair") || q.includes("wasim")) {
        return {
          customReply: `👨‍⚖️ Standing Counsel at DLO Kupwara:\n\n1. Adv. Zubair Ahmad Wani — Standing Counsel\n2. Adv. Wasim Nazir Khan — Standing Counsel\n\nThey represent government departments across district and subordinate courts in Kupwara.`,
          customLink: { url: "contact.html", text: "Contact Standing Counsel" },
          customOptions: [{ label: "« Main Menu", next: "start" }]
        };
      }
      if (q.includes("dlo") || q.includes("officer") || q.includes("incharge") || q.includes("head") || q.includes("director")) {
        return {
          customReply: `⚖️ District Litigation Officer Kupwara:\n\nIshfaq Ahmad Khan\nDistrict Litigation Officer, DLO Kupwara\nDepartment of Law, Justice & Parliamentary Affairs, UT of J&K.\nOffice: 1st Floor, DC Office Complex Kupwara.`,
          customLink: { url: "contact.html", text: "Send Message to DLO" },
          customOptions: [{ label: "« Main Menu", next: "start" }]
        };
      }
    }

    if (q.includes("standing counsel") || q.includes("lawyer") || q.includes("advocate") || q.includes("adv")) {
      return { stepKey: "officials" };
    }

    // Q2. Developer / Architecture Info
    if (q.includes("developer") || q.includes("who built") || q.includes("who created") || q.includes("who designed") || q.includes("tariq")) {
      return {
        customReply: `💻 Portal Development & System Architecture:\n\nDesigned & Developed by Tariq Ahmad Lone for the District Litigation Office Kupwara, Department of Law, Justice & Parliamentary Affairs, UT of Jammu & Kashmir.\nVersion: NK.1.0 (PWA Enabled).`,
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }

    // Q3. Ex-parte matters
    if (q.includes("ex-parte") || q.includes("exparte") || q.includes("ex parte")) {
      const m = getLiveMetrics();
      return {
        customReply: `⚠️ Ex-Parte Case Monitoring:\n\nThere are currently ${m.exparte} cases flagged as Ex-parte across Kupwara courts.\n\nImmediate Action: Concerned departments must file restoration applications or parawise objections immediately through standing counsel to avoid adverse ex-parte decrees.`,
        customLink: { url: "search-filter-cases.html", text: "Filter Ex-Parte Cases" },
        customOptions: [
          { label: "📝 SOP for Replies", next: "replies_sop" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }

    // Q4. Contempt & Compliance
    if (q.includes("contempt") || q.includes("compliance") || q.includes("atr") || q.includes("action taken")) {
      return {
        customReply: `⚠️ Contempt Petitions & Judicial Compliance:\n\n• There are 5 active contempt petitions being closely monitored.\n• Head of Departments (HODs) must submit Action Taken Reports (ATRs) and verified compliance statements at least 48 hours prior to hearing.\n• Direct coordination with the DLO scrutiny desk is mandatory to avert personal appearance orders.`,
        customLink: { url: "contact.html", text: "Contact Scrutiny Desk" },
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }

    // Q5. Replies Pending / Filed statistics
    if (q.includes("reply pending") || q.includes("replies pending") || q.includes("unfiled") || q.includes("missing reply")) {
      const m = getLiveMetrics();
      return {
        customReply: `📋 Departmental Reply Status:\n\n• Replies Pending: ${m.replyPending} active cases\n• Replies Filed: ${m.replyFiled} cases\n\nTop departments with pending replies: Revenue (54), Urban Local Bodies (47), PDD (22), R&B (20), RDD (16), Education (14), Forest (11).`,
        customLink: { url: "performance.html", text: "View Reply Pending Table" },
        customOptions: [
          { label: "📝 SOP for Replies", next: "replies_sop" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }

    // Q6. Disposal Rate & Statistics
    if (q.includes("disposal") || q.includes("disposed") || q.includes("disposal rate")) {
      const m = getLiveMetrics();
      return {
        customReply: `📈 Disposal Performance:\n\n• Cases Disposed: ${m.disposed} cases\n• Total Monitored: ${m.total} cases\n• Current Disposal Rate: ${m.rate}\n• Active Continuing Cases: ${m.active}`,
        customLink: { url: "performance.html", text: "Open Full Performance Dashboard" },
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }

    // Q7. Court-Specific Queries (Active, Total, vs Cause List)
    for (const c of COURTS_LIST) {
      const matchesCourt = c.aliases.some(alias => q.includes(alias)) || q.includes(c.short.toLowerCase());
      if (matchesCourt) {
        const isAskingTotal = q.includes("total") || q.includes("active") || q.includes("how many") || q.includes("cases in") || q.includes("count") || q.includes("registered");
        const isAskingToday = q.includes("today") || q.includes("cause list") || q.includes("hearing") || q.includes("schedule") || q.includes("tomorrow") || q.includes("listed");

        if (isAskingTotal && !isAskingToday) {
          const courtStat = getCourtDistributionStats(c.name);
          const totalCount = courtStat ? courtStat.total : "57";
          return {
            customReply: `🏛️ ${c.name}\n\n• Total Registered Government Cases: ${totalCount}\n• Jurisdiction: District Kupwara\n\nWould you like to view the cause list or scheduled hearings for this court?`,
            customLink: { url: "causelist.html", text: `Open ${c.short} Cause List` },
            customOptions: [
              { label: `📅 View ${c.short} Cause List`, next: `court_${c.id}` },
              { label: "🏛️ All Court Distributions", next: "court_dist" },
              { label: "« Main Menu", next: "start" }
            ]
          };
        }

        return {
          stepKey: `court_${c.id}`,
          customUserLabel: `Cases in ${c.short}`
        };
      }
    }

    // Q8. All Courts Distribution
    if (q.includes("court distribution") || q.includes("all courts") || q.includes("how many court") || q.includes("12 court") || q.includes("courts covered")) {
      return { stepKey: "court_dist" };
    }

    // Q9. Department Queries (Direct name or aliases like "pmgsy", "pwd", "pdd", "jal shakti", "revenue")
    // Check against alias dictionary first
    for (const [alias, realDept] of Object.entries(DEPT_ALIASES)) {
      if (q.includes(alias) || words.includes(alias)) {
        const d = getDepartmentData(alias);
        if (d) {
          return {
            customReply: `🏛️ Department Litigation Breakdown: ${d.name}\n` +
                         (d.alias ? `(Queried via: ${d.alias})\n\n` : `\n`) +
                         `• Total Cases: ${d.total}\n` +
                         `• Active Cases: ${d.active}\n` +
                         `• Disposed: ${d.disposed}\n` +
                         `• Pending Replies: ${d.replyPending} (Active)\n\n` +
                         `Stakeholder departments must submit parawise replies at least 3 days before the hearing date.`,
            customLink: { url: "performance.html", text: `${d.name} Performance Details` },
            customOptions: [
              { label: "📝 SOP for Submitting Replies", next: "replies_sop" },
              { label: "« Main Menu", next: "start" }
            ]
          };
        }
      }
    }

    // Q10. General Department Queries
    if (q.includes("department") || q.includes("dept") || q.includes("stakeholder")) {
      return {
        customReply: `🏛️ Department Litigation Monitoring (30 Departments):\n\nDLO Kupwara monitors litigation for all 30 departments in the district. Top 5 caseloads:\n\n1. Revenue: 81 active (54 replies pending)\n2. Urban Local Bodies: 61 active (47 replies pending)\n3. R&B / PWD / PMGSY: 33 active (20 replies pending)\n4. PDD / KPDCL: 28 active (22 replies pending)\n5. RDD / Panchayats: 21 active (16 replies pending)\n\nType any department or acronym (e.g. "PMGSY", "PDD", "Jal Shakti") for specific details.`,
        customLink: { url: "performance.html", text: "View All 30 Departments" },
        customOptions: [
          { label: "📝 SOP for Replies", next: "replies_sop" },
          { label: "« Main Menu", next: "start" }
        ]
      };
    }

    // Q11. Case Types Breakdown
    if (q.includes("case type") || q.includes("civil suit") || q.includes("writ") || q.includes("appeal") || q.includes("mact case")) {
      return {
        customReply: `📜 Case Types Distribution across Kupwara Forums:\n\n• Civil Suits: 220 cases (majority)\n• Execution Petitions: 19 cases\n• Wage Claims (Labour): 15 cases\n• Consumer Matters: 23 cases\n• Appeals: 15 cases\n• Restoration Applications: 10 cases\n• Contempt Petitions: 5 cases\n• Criminal Complaints: 5 cases\n• MACT Claims: 4 cases`,
        customLink: { url: "search-filter-cases.html", text: "Filter by Case Type" },
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }

    // Q12. Overdue Cases
    if (q.includes("overdue") || q.includes("delay") || q.includes("passed")) {
      return {
        customReply: `⚠️ Overdue Cases Notice:\n\nOverdue cases are matters where the scheduled hearing date has passed but status remains active in court records.\nOperators and nodal officers must update proceeding orders immediately.`,
        customLink: { url: "search-filter-cases.html", text: "View Overdue Cases" },
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }

    // Q13. Overall Portal Statistics
    if (q.includes("active") || q.includes("total") || q.includes("statistic") || q.includes("stats") || q.includes("performance") || q.includes("summary")) {
      return { stepKey: "live_stats" };
    }

    // Q14. Urgent Hearings & Schedules
    if (q.includes("urgent") || q.includes("hearing") || q.includes("tomorrow") || q.includes("today") || q.includes("cause list") || q.includes("listed")) {
      if (q.includes("cause list")) return { stepKey: "choose_court" };
      return { stepKey: "urgent_hearings" };
    }

    // Q15. Filing & Replies SOP
    if (q.includes("reply") || q.includes("sop") || q.includes("objection") || q.includes("parawise") || q.includes("vetting") || q.includes("scrutiny")) {
      return { stepKey: "replies_sop" };
    }

    // Q16. Office Address, Hours, Contact
    if (q.includes("time") || q.includes("timing") || q.includes("hours") || q.includes("address") || q.includes("location") || q.includes("where") || q.includes("contact") || q.includes("email") || q.includes("phone") || q.includes("dc office")) {
      return { stepKey: "office" };
    }

    // Q17. Staff Login & Operator Credentials
    if (q.includes("login") || q.includes("operator") || q.includes("staff") || q.includes("admin") || q.includes("password") || q.includes("2fa")) {
      return { stepKey: "operator" };
    }

    // Q18. App Download
    if (q.includes("app") || q.includes("download") || q.includes("install") || q.includes("pwa") || q.includes("apk")) {
      return {
        customReply: `📱 Install DLO Kupwara Progressive Web App:\n\nYou can install the portal directly onto your Android, iPhone, or PC by tapping "Download App" in the navigation bar or "Install" in your browser settings for offline access.`,
        customOptions: [{ label: "« Main Menu", next: "start" }]
      };
    }

    // Fallback for unclassified questions
    return {
      fallbackMessage: `I couldn't find an exact match for "${text}". You can ask about:\n\n• Active cases in any court (e.g. "Sub Judge Kupwara")\n• Department statistics (e.g. "PMGSY", "PDD", "Revenue")\n• Officials & Standing Counsel\n• Hearing schedules & replies SOP`,
      fallbackOptions: [
        { label: "📅 Today's Cause List", next: "choose_court" },
        { label: "📊 Real-Time Stats", next: "live_stats" },
        { label: "🏛️ Court Distribution", next: "court_dist" },
        { label: "🏢 Office Info", next: "office" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  }

  // ─── 6. EXECUTIVE UI STYLES (BOTTOM-LEFT ANCHORED) ────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #dlo-chat-teaser {
      position: fixed;
      bottom: 78px;
      left: 24px;
      background: #ffffff;
      color: #0c2340;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 7px 13px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
      z-index: 9998;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      animation: dloFloat 3s ease-in-out infinite;
    }
    #dlo-chat-teaser::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 20px;
      border-width: 6px 6px 0;
      border-style: solid;
      border-color: #ffffff transparent;
      display: block;
      width: 0;
    }
    @keyframes dloFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    #dlo-chat-trigger {
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 50px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(12, 35, 64, 0.35);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    #dlo-chat-trigger:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(12, 35, 64, 0.45);
    }

    #dlo-chat-window {
      position: fixed;
      bottom: 78px;
      left: 24px;
      width: 365px;
      max-width: calc(100vw - 36px);
      height: 520px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.22);
      display: none;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    #dlo-chat-header {
      background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
      color: #ffffff;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .dlo-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dlo-status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 6px #10b981;
    }
    .dlo-header-title {
      font-weight: 600;
      font-size: 13.5px;
    }
    .dlo-header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .dlo-action-btn {
      cursor: pointer;
      opacity: 0.85;
      font-size: 15px;
      transition: opacity 0.15s;
    }
    .dlo-action-btn:hover { opacity: 1; }

    #dlo-chat-body {
      padding: 14px;
      overflow-y: auto;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
      scroll-behavior: smooth;
    }

    .dlo-msg-row {
      display: flex;
      width: 100%;
    }
    .dlo-msg-row.bot { justify-content: flex-start; }
    .dlo-msg-row.user { justify-content: flex-end; }

    .dlo-bubble {
      max-width: 85%;
      padding: 9px 12px;
      border-radius: 12px;
      font-size: 12px;
      line-height: 1.45;
      word-break: break-word;
      white-space: pre-line;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .dlo-msg-row.bot .dlo-bubble {
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 3px;
    }
    .dlo-msg-row.user .dlo-bubble {
      background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
      color: #ffffff;
      border-bottom-right-radius: 3px;
    }

    .dlo-bubble-action {
      display: inline-block;
      margin-top: 6px;
      padding: 5px 10px;
      background: #eff6ff;
      color: #1e3a8a;
      border-radius: 6px;
      font-weight: 600;
      text-decoration: none;
      font-size: 11px;
      border: 1px solid #bfdbfe;
    }

    .dlo-typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 6px 10px;
    }
    .dlo-typing span {
      width: 5px;
      height: 5px;
      background: #94a3b8;
      border-radius: 50%;
      animation: dloBounce 1.2s infinite ease-in-out;
    }
    .dlo-typing span:nth-child(2) { animation-delay: 0.2s; }
    .dlo-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dloBounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    #dlo-chips-container {
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-height: 110px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .dlo-chip-btn {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #0c2340;
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dlo-chip-btn:hover {
      background: #0c2340;
      color: #ffffff;
      border-color: #0c2340;
    }

    #dlo-input-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    #dlo-user-input {
      flex-grow: 1;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      padding: 7px 12px;
      font-size: 12px;
      outline: none;
      color: #0f172a;
    }
    #dlo-user-input:focus {
      border-color: #1e3a8a;
    }
    #dlo-send-btn {
      background: #0c2340;
      color: #ffffff;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    #dlo-send-btn:hover {
      background: #1e3a8a;
    }
  `;
  document.head.appendChild(style);

  // ─── 7. DOM MOUNTING & CONTROLS ──────────────────────────────────────────
  const teaser = document.createElement("div");
  teaser.id = "dlo-chat-teaser";
  teaser.innerHTML = `<span>💬</span> <span>Need guidance? Ask me</span>`;
  document.body.appendChild(teaser);

  const trigger = document.createElement("button");
  trigger.id = "dlo-chat-trigger";
  trigger.innerHTML = `<span style="font-size:15px;">⚖️</span><span>Ask Assistant</span>`;
  document.body.appendChild(trigger);

  const box = document.createElement("div");
  box.id = "dlo-chat-window";
  box.innerHTML = `
    <div id="dlo-chat-header">
      <div class="dlo-header-left">
        <div class="dlo-status-dot"></div>
        <div class="dlo-header-title">DLO Kupwara Assistant</div>
      </div>
      <div class="dlo-header-actions">
        <span id="dlo-chat-restart" class="dlo-action-btn" title="Restart">↺</span>
        <span id="dlo-chat-close" class="dlo-action-btn" title="Close">✕</span>
      </div>
    </div>
    <div id="dlo-chat-body"></div>
    <div id="dlo-chips-container"></div>
    <form id="dlo-input-bar">
      <input type="text" id="dlo-user-input" placeholder="Type a question or pick an option..." autocomplete="off" />
      <button type="submit" id="dlo-send-btn" title="Send">➤</button>
    </form>
  `;
  document.body.appendChild(box);

  const chatBody = box.querySelector("#dlo-chat-body");
  const chipsContainer = box.querySelector("#dlo-chips-container");
  const inputForm = box.querySelector("#dlo-input-bar");
  const userInput = box.querySelector("#dlo-user-input");
  let isInitialized = false;

  function appendMessage(sender, text, link = null) {
    const row = document.createElement("div");
    row.className = `dlo-msg-row ${sender}`;

    const bubble = document.createElement("div");
    bubble.className = "dlo-bubble";
    bubble.textContent = text;

    if (link) {
      const a = document.createElement("a");
      a.className = "dlo-bubble-action";
      a.href = link.url;
      a.textContent = link.text + " →";
      bubble.appendChild(document.createElement("br"));
      bubble.appendChild(a);
    }

    row.appendChild(bubble);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTypingIndicator() {
    const row = document.createElement("div");
    row.className = "dlo-msg-row bot";
    row.id = "dlo-typing-row";

    const bubble = document.createElement("div");
    bubble.className = "dlo-bubble dlo-typing";
    bubble.innerHTML = `<span></span><span></span><span></span>`;

    row.appendChild(bubble);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById("dlo-typing-row");
    if (typing) typing.remove();
  }

  function triggerStep(stepKey, userLabel = null) {
    chipsContainer.innerHTML = "";

    if (userLabel) {
      appendMessage("user", userLabel);
    }

    showTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator();
      const step = BOT_DATA[stepKey] || BOT_DATA.start;

      const messageText = typeof step.getMessage === "function"
        ? step.getMessage()
        : (typeof step.message === "function" ? step.message() : step.message);

      appendMessage("bot", messageText, step.link);

      if (step.options && step.options.length > 0) {
        step.options.forEach(opt => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "dlo-chip-btn";
          btn.textContent = opt.label;
          btn.onclick = () => triggerStep(opt.next, opt.label);
          chipsContainer.appendChild(btn);
        });
      }
    }, 280);
  }

  // ─── 8. FORM SUBMISSION EVENT HANDLER ────────────────────────────────────
  inputForm.onsubmit = (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    userInput.value = "";
    appendMessage("user", query);
    chipsContainer.innerHTML = "";
    showTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator();
      const match = processUserText(query);

      // A. Custom dynamic reply (Court total count, Department query, etc.)
      if (match.customReply) {
        appendMessage("bot", match.customReply, match.customLink || null);
        if (match.customOptions) {
          match.customOptions.forEach(opt => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dlo-chip-btn";
            btn.textContent = opt.label;
            btn.onclick = () => triggerStep(opt.next, opt.label);
            chipsContainer.appendChild(btn);
          });
        }
      }
      // B. Standard node jump
      else if (match.stepKey) {
        const step = BOT_DATA[match.stepKey];
        const messageText = typeof step.getMessage === "function" ? step.getMessage() : step.message;
        appendMessage("bot", messageText, step.link);
        if (step.options) {
          step.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dlo-chip-btn";
            btn.textContent = opt.label;
            btn.onclick = () => triggerStep(opt.next, opt.label);
            chipsContainer.appendChild(btn);
          });
        }
      }
      // C. Fallback
      else {
        appendMessage("bot", match.fallbackMessage);
        match.fallbackOptions.forEach(opt => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "dlo-chip-btn";
          btn.textContent = opt.label;
          btn.onclick = () => triggerStep(opt.next, opt.label);
          chipsContainer.appendChild(btn);
        });
      }
    }, 280);
  };

  function startChat() {
    chatBody.innerHTML = "";
    triggerStep("start");
  }

  function toggleChat() {
    const isVisible = box.style.display === "flex";
    box.style.display = isVisible ? "none" : "flex";
    teaser.style.display = isVisible ? "flex" : "none";

    if (!isVisible && !isInitialized) {
      startChat();
      isInitialized = true;
    }
  }

  trigger.onclick = toggleChat;
  teaser.onclick = toggleChat;

  box.querySelector("#dlo-chat-close").onclick = () => {
    box.style.display = "none";
    teaser.style.display = "flex";
  };

  box.querySelector("#dlo-chat-restart").onclick = () => {
    startChat();
  };
})();
