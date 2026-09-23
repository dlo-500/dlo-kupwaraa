(function () {
  // Decision tree knowledge base
  const BOT_DATA = {
    start: {
      message: "Hello! Welcome to the District Litigation Office Kupwara legal desk. How can I assist you today?",
      options: [
        { label: "📅 Daily Cause List", next: "causelist" },
        { label: "⚖️ Upcoming Hearings", next: "hearings" },
        { label: "🔍 Track Case History", next: "history" },
        { label: "📝 Departmental Replies / SOP", next: "replies_faq" },
        { label: "📊 Performance & Disposal", next: "performance" },
        { label: "🏢 Office Hours & Location", next: "office" },
        { label: "🔐 Operator Login", next: "operator" }
      ]
    },
    causelist: {
      message: "Daily cause lists are issued for matters listed before district and subordinate courts in Kupwara.",
      link: { url: "causelist.html", text: "Open Daily Cause List" },
      options: [
        { label: "⚖️ Check Upcoming Hearings", next: "hearings" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    hearings: {
      message: "You can track upcoming dates and scheduled proceedings across all 12 judicial forums in Kupwara.",
      link: { url: "hearings.html", text: "View Upcoming Hearings" },
      options: [
        { label: "📅 View Today's Cause List", next: "causelist" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    history: {
      message: "You can look up previous proceedings, interim orders, and case records by title or CNR number.",
      link: { url: "history.html", text: "Search Case History" },
      options: [{ label: "« Back to Main Menu", next: "start" }]
    },
    replies_faq: {
      message: "Departmental SOP for Objections / Replies:\n\n1. Parawise remarks must be submitted by the concerned department at least 3 days prior to the hearing date.\n2. All responses are vetted at the DLO scrutiny desk before submission before the courts.",
      options: [
        { label: "🏢 Office Location & Contact", next: "office" },
        { label: "« Back to Main Menu", next: "start" }
      ]
    },
    performance: {
      message: "Explore our performance dashboard for real-time statistics on case disposals, active cases, and pending responses.",
      link: { url: "performance.html", text: "Open Performance Portal" },
      options: [{ label: "« Back to Main Menu", next: "start" }]
    },
    office: {
      message: "District Litigation Office\nDC Office Complex, Kupwara, UT of J&K\n\n🕒 Working Hours: 10:00 AM – 4:30 PM (Mon–Sat)\n✉️ Email: dlo-kup@jk.gov.in",
      options: [{ label: "« Back to Main Menu", next: "start" }]
    },
    operator: {
      message: "The operator portal is strictly restricted to authorized departmental staff with active credentials.",
      link: { url: "operator.html", text: "Go to Operator Login" },
      options: [{ label: "« Back to Main Menu", next: "start" }]
    }
  };

  // Inject Chat Widget Styles
  const style = document.createElement("style");
  style.textContent = `
    /* Floating teaser badge */
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

    /* Main "Ask Assistant" pill button */
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

    /* Chat dialog container */
    #dlo-chat-window {
      position: fixed;
      bottom: 78px;
      left: 24px;
      width: 340px;
      max-width: calc(100vw - 48px);
      height: 490px;
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

    /* Header with title and controls */
    #dlo-chat-header {
      background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
      color: #ffffff;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
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
    .dlo-action-btn:hover {
      opacity: 1;
    }

    /* Conversation thread */
    #dlo-chat-body {
      padding: 16px 14px;
      overflow-y: auto;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
      scroll-behavior: smooth;
    }

    /* Speech bubbles */
    .dlo-msg-row {
      display: flex;
      width: 100%;
    }
    .dlo-msg-row.bot {
      justify-content: flex-start;
    }
    .dlo-msg-row.user {
      justify-content: flex-end;
    }

    .dlo-bubble {
      max-width: 82%;
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 12.5px;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-line;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .dlo-msg-row.bot .dlo-bubble {
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
    }
    .dlo-msg-row.user .dlo-bubble {
      background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }

    /* Action button inside bot message */
    .dlo-bubble-action {
      display: inline-block;
      margin-top: 8px;
      padding: 5px 10px;
      background: #f1f5f9;
      color: #1e3a8a;
      border-radius: 6px;
      font-weight: 600;
      text-decoration: none;
      font-size: 11.5px;
      border: 1px solid #cbd5e1;
    }
    .dlo-bubble-action:hover {
      background: #e2e8f0;
    }

    /* Typing animation */
    .dlo-typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 8px 12px;
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

    /* Bottom quick replies container */
    #dlo-chips-container {
      padding: 10px 14px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 160px;
      overflow-y: auto;
    }
    .dlo-chip-btn {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #0c2340;
      border-radius: 8px;
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dlo-chip-btn:hover {
      background: #0c2340;
      color: #ffffff;
      border-color: #0c2340;
    }
  `;
  document.head.appendChild(style);

  // 1. Create Floating Prompt
  const teaser = document.createElement("div");
  teaser.id = "dlo-chat-teaser";
  teaser.innerHTML = `<span>💬</span> <span>Need guidance? Ask me</span>`;
  document.body.appendChild(teaser);

  // 2. Create "Ask Assistant" Button
  const trigger = document.createElement("button");
  trigger.id = "dlo-chat-trigger";
  trigger.innerHTML = `<span style="font-size:15px;">⚖️</span><span>Ask Assistant</span>`;
  document.body.appendChild(trigger);

  // 3. Create Chat Window
  const box = document.createElement("div");
  box.id = "dlo-chat-window";
  box.innerHTML = `
    <div id="dlo-chat-header">
      <div class="dlo-header-left">
        <div class="dlo-status-dot"></div>
        <div class="dlo-header-title">DLO Kupwara Assistant</div>
      </div>
      <div class="dlo-header-actions">
        <span id="dlo-chat-restart" class="dlo-action-btn" title="Restart Conversation">↺</span>
        <span id="dlo-chat-close" class="dlo-action-btn" title="Close">✕</span>
      </div>
    </div>
    <div id="dlo-chat-body"></div>
    <div id="dlo-chips-container"></div>
  `;
  document.body.appendChild(box);

  const chatBody = box.querySelector("#dlo-chat-body");
  const chipsContainer = box.querySelector("#dlo-chips-container");
  let isInitialized = false;

  // Append a message bubble to the conversation thread
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

  // Show animated typing dots before bot reply
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

  // Handle a step in the conversation tree
  function triggerStep(stepKey, userLabel = null) {
    chipsContainer.innerHTML = "";

    // 1. If user clicked a chip, render it as user's message on the right
    if (userLabel) {
      appendMessage("user", userLabel);
    }

    // 2. Show typing indicator
    showTypingIndicator();

    // 3. Simulate natural reply after 350ms
    setTimeout(() => {
      removeTypingIndicator();
      const step = BOT_DATA[stepKey] || BOT_DATA.start;
      appendMessage("bot", step.message, step.link);

      // 4. Populate next quick-reply options
      if (step.options && step.options.length > 0) {
        step.options.forEach(opt => {
          const btn = document.createElement("button");
          btn.className = "dlo-chip-btn";
          btn.textContent = opt.label;
          btn.onclick = () => triggerStep(opt.next, opt.label);
          chipsContainer.appendChild(btn);
        });
      }
    }, 350);
  }

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
