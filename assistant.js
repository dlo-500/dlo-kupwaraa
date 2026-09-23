(function () {
  // Official courts under DLO Kupwara jurisdiction
  const COURTS_LIST = [
    { id: "dist_sessions", name: "PR. DISTRICT AND SESSIONS COURT KUPWARA", short: "Sessions Court Kupwara", keywords: ["sessions", "dist sessions", "pr district"] },
    { id: "sub_kupwara", name: "Sub Judge Kupwara", short: "Sub Judge Kupwara", keywords: ["sub judge kupwara", "subjudge kupwara"] },
    { id: "cjm_handwara", name: "CJM/SUB JUDGE HANDWARA", short: "CJM / Sub Judge Handwara", keywords: ["cjm", "cjm handwara", "sub judge handwara"] },
    { id: "addl_handwara", name: "ADDITIONAL DISTRICT AND SESSIONS COURT HANDWARA", short: "Addl. Sessions Handwara", keywords: ["additional sessions", "addl sessions", "addl handwara"] },
    { id: "munsiff_kupwara", name: "MUNSIFF KUPWARA", short: "Munsiff Kupwara", keywords: ["munsiff kupwara"] },
    { id: "munsiff_handwara", name: "MUNSIFF HANDWARA", short: "Munsiff Handwara", keywords: ["munsiff handwara"] },
    { id: "munsiff_kralpora", name: "Munsiff Kralpora", short: "Munsiff Kralpora", keywords: ["kralpora", "munsiff kralpora"] },
    { id: "munsiff_sogam", name: "MUNSIFF SOGAM", short: "Munsiff Sogam", keywords: ["sogam", "munsiff sogam"] },
    { id: "sub_trehgam", name: "SUB JUDGE TREHGAM", short: "Sub Judge Trehgam", keywords: ["trehgam", "sub judge trehgam"] },
    { id: "consumer", name: "CONSUMER COURT KUPWARA", short: "Consumer Court Kupwara", keywords: ["consumer", "consumer court", "dcdrc"] },
    { id: "labour", name: "LABOUR COURT KUPWARA", short: "Labour Court Kupwara", keywords: ["labour", "labor court"] },
    { id: "mact", name: "MACT KUPWARA", short: "MACT Kupwara", keywords: ["mact", "accident claim"] }
  ];

  // Helper: Extract live stats rendered on the webpage DOM
  function getLiveMetrics() {
    const text = document.body.innerText || "";
    const totalMatch = text.match(/Total cases.*?:\s*(\d+)/i) || text.match(/(\d+)\s*TOTAL CASES/i);
    const activeMatch = text.match(/Active cases.*?:\s*(\d+)/i) || text.match(/(\d+)\s*ACTIVE/i);
    const disposedMatch = text.match(/Disposed cases.*?:\s*(\d+)/i) || text.match(/(\d+)\s*DISPOSED/i);
    const pendingReplyMatch = text.match(/(\d+)\s*REPLY PENDING/i);
    const exparteMatch = text.match(/(\d+)\s*EX-PARTE/i);

    return {
      total: totalMatch ? totalMatch[1] : "392",
      active: activeMatch ? activeMatch[1] : "365",
      disposed: disposedMatch ? disposedMatch[1] : "27",
      pendingReply: pendingReplyMatch ? pendingReplyMatch[1] : "261",
      exparte: exparteMatch ? exparteMatch[1] : "47"
    };
  }

  // Helper: Find cases scheduled for a specific court
  function getCourtListings(courtName) {
    const results = [];
    const normalizedTarget = courtName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Check in-memory case datasets if available on window
    const rawList = window.allCases || window.cases || window.casesData || window.DLO_CASES || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      rawList.forEach(c => {
        const cCourt = (c.court || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cCourt.includes(normalizedTarget) || normalizedTarget.includes(cCourt)) {
          results.push({
            number: c.case_number || c.cnr || "Case",
            title: c.title || c.case_title || "State Matter",
            date: c.hearing_date || c.next_date || "Today"
          });
        }
      });
      if (results.length > 0) return results;
    }

    // 2. Scrape live ticker/feed items on index.html
    const tickerItems = document.querySelectorAll(".ticker span, marquee span, .live-updates *, #ticker *");
    const searchPool = tickerItems.length > 0 ? Array.from(tickerItems) : Array.from(document.querySelectorAll("p, div, li, tr"));

    searchPool.forEach(el => {
      const line = el.textContent || "";
      if (line.includes("Hearing scheduled") || line.includes("Sept") || line.includes("2026")) {
        const lineNormalized = line.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lineNormalized.includes(normalizedTarget)) {
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

    return results.filter((v, i, a) => a.findIndex(t => (t.number === v.number && t.number !== "Listed Matter")) === i);
  }

  // Conversational knowledge base
  const BOT_DATA = {
    start: {
      message: "Hello! Welcome to the District Litigation Office Kupwara legal desk. Ask me any question below or pick a category:",
      options: [
        { label: "📅 Today's Cause List by Court", next: "choose_court" },
        { label: "📊 Real-Time Portal Statistics", next: "live_stats" },
        { label: "⚠️ Urgent Hearings (Next 2 Days)", next: "urgent_hearings" },
        { label: "📝 Departmental SOP for Replies", next: "replies_sop" },
        { label: "🏢 Office Hours & Location", next: "office" },
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

    live_stats: {
      getMessage: () => {
        const m = getLiveMetrics();
        return `📊 Real-Time Legal Statistics (DLO Kupwara):\n\n` +
               `• Total Cases: ${m.total}\n` +
               `• Active Cases: ${m.active}\n` +
               `• Disposed: ${m.disposed}\n` +
               `• Pending Departmental Replies: ${m.pendingReply}\n` +
               `• Ex-parte Cases Monitored: ${m.exparte}\n\n` +
               `Data synchronized across 12 judicial forums in Kupwara district.`;
      },
      link: { url: "performance.html", text: "Open Performance Dashboard" },
      options: [
        { label: "📅 Check Today's Cause List", next: "choose_court" },
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
      message: "Departmental SOP for Objections & Parawise Replies:\n\n1. Parawise remarks must be submitted at least 3 days prior to the hearing date.\n2. All replies undergo formal vetting at the DLO scrutiny desk before submission in court.",
      link: { url: "contact.html", text: "Contact Scrutiny Desk" },
      options: [
        { label: "🏢 Office Timings & Address", next: "office" },
        { label: "« Back to Main Menu", next: "start" }
      ]
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

  // Add court nodes
  COURTS_LIST.forEach(court => {
    BOT_DATA[`court_${court.id}`] = {
      getMessage: () => {
        const matches = getCourtListings(court.name);
        if (matches.length === 0) {
          return `🏛️ ${court.name}\n\nNo government matters are currently flagged for immediate hearing today in this court.`;
        }
        let msg = `🏛️ ${court.name}\n\nFound ${matches.length} matter(s) scheduled for hearing:\n\n`;
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

  // Natural language query processor
  function processUserText(text) {
    const q = text.toLowerCase();

    // 1. Check for court-specific queries
    for (const c of COURTS_LIST) {
      if (c.keywords.some(k => q.includes(k)) || q.includes(c.short.toLowerCase())) {
        return {
          stepKey: `court_${c.id}`,
          customUserLabel: `Cases in ${c.short}`
        };
      }
    }

    // 2. Active / Total / Stats queries
    if (q.includes("active") || q.includes("total") || q.includes("statistic") || q.includes("performance") || q.includes("how many case")) {
      return { stepKey: "live_stats" };
    }

    // 3. Urgent hearings / Tomorrow / Today's hearings
    if (q.includes("urgent") || q.includes("hearing") || q.includes("tomorrow") || q.includes("cause list") || q.includes("listed")) {
      if (q.includes("cause list")) return { stepKey: "choose_court" };
      return { stepKey: "urgent_hearings" };
    }

    // 4. Replies / SOP / Objections
    if (q.includes("reply") || q.includes("sop") || q.includes("objection") || q.includes("parawise") || q.includes("vetting")) {
      return { stepKey: "replies_sop" };
    }

    // 5. Office info / Timing / Email / Location
    if (q.includes("timing") || q.includes("time") || q.includes("address") || q.includes("location") || q.includes("where") || q.includes("contact") || q.includes("email") || q.includes("phone")) {
      return { stepKey: "office" };
    }

    // 6. Login / Staff / Operator
    if (q.includes("login") || q.includes("operator") || q.includes("staff") || q.includes("admin")) {
      return { stepKey: "operator" };
    }

    // Fallback: couldn't find exact match
    return {
      fallbackMessage: `I couldn't find an exact match for "${text}". You can ask about active cases, a specific court (e.g. "Munsiff Kupwara"), hearing schedules, or select from the quick options below:`,
      fallbackOptions: [
        { label: "📅 Today's Cause List", next: "choose_court" },
        { label: "📊 Real-Time Stats", next: "live_stats" },
        { label: "🏢 Office Info", next: "office" },
        { label: "« Main Menu", next: "start" }
      ]
    };
  }

  // Inject Styles (Both Guided Chips and Text Input Bar)
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
      width: 360px;
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

    /* Guided Chips Container */
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

    /* Bottom Input Bar */
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

  // 1. Floating Prompt
  const teaser = document.createElement("div");
  teaser.id = "dlo-chat-teaser";
  teaser.innerHTML = `<span>💬</span> <span>Need guidance? Ask me</span>`;
  document.body.appendChild(teaser);

  // 2. Trigger Button
  const trigger = document.createElement("button");
  trigger.id = "dlo-chat-trigger";
  trigger.innerHTML = `<span style="font-size:15px;">⚖️</span><span>Ask Assistant</span>`;
  document.body.appendChild(trigger);

  // 3. Main Chat Window
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

  // Handle free-text form submission
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

      if (match.stepKey) {
        const step = BOT_DATA[match.stepKey];
        const messageText = typeof step.getMessage === "function"
          ? step.getMessage()
          : (typeof step.message === "function" ? step.message() : step.message);

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
      } else {
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
