(function () {
  // Decision tree mapping to dlo-kupwaraa portal pages
  const BOT_DATA = {
    start: {
      message: "Welcome to the District Litigation Office Kupwara legal desk. How can we assist you?",
      options: [
        { label: "📅 Daily Cause List", next: "causelist" },
        { label: "⚖️ Upcoming Hearings", next: "hearings" },
        { label: "🔍 Track Case History", next: "history" },
        { label: "📊 Performance & Disposal", next: "performance" },
        { label: "🏢 Office Hours & Location", next: "office" },
        { label: "🔐 Operator Login", next: "operator" }
      ]
    },
    causelist: {
      message: "Daily cause lists are issued for matters listed before district and subordinate courts in Kupwara.",
      link: { url: "causelist.html", text: "Open Daily Cause List" },
      options: [{ label: "« Main Menu", next: "start" }]
    },
    hearings: {
      message: "Check scheduled dates and track upcoming compliance deadlines.",
      link: { url: "hearings.html", text: "View Upcoming Hearings" },
      options: [{ label: "« Main Menu", next: "start" }]
    },
    history: {
      message: "View archived proceedings, previous orders, and case timelines.",
      link: { url: "history.html", text: "Search Case History" },
      options: [{ label: "« Main Menu", next: "start" }]
    },
    performance: {
      message: "Review statistical summaries, disposal ratios, and departmental performance.",
      link: { url: "performance.html", text: "View Performance Analytics" },
      options: [{ label: "« Main Menu", next: "start" }]
    },
    office: {
      message: "District Litigation Office\nDC Office Complex, Kupwara, UT of J&K\nHours: 10:00 AM – 4:30 PM (Mon–Sat)",
      options: [{ label: "« Main Menu", next: "start" }]
    },
    operator: {
      message: "The operator portal is restricted to authorized personnel with active departmental credentials.",
      link: { url: "operator.html", text: "Go to Operator Portal" },
      options: [{ label: "« Main Menu", next: "start" }]
    }
  };

  // Inject widget CSS styles (Anchored to the Bottom-Left)
  const style = document.createElement("style");
  style.textContent = `
    /* Floating teaser prompt / badge */
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
      transition: opacity 0.2s ease, transform 0.2s ease;
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

    /* "Ask Assistant" Main Button */
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
      letter-spacing: 0.3px;
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
    #dlo-chat-trigger .dlo-icon {
      font-size: 15px;
    }

    /* Chat Drawer Window */
    #dlo-chat-window {
      position: fixed;
      bottom: 78px;
      left: 24px;
      width: 320px;
      max-width: calc(100vw - 48px);
      max-height: 480px;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      box-shadow: 0 10px 35px rgba(0, 0, 0, 0.22);
      display: none;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
      font-family: inherit;
    }
    #dlo-chat-header {
      background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
      color: #ffffff;
      padding: 13px 16px;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #dlo-chat-body {
      padding: 14px;
      overflow-y: auto;
      flex-grow: 1;
      font-size: 13px;
      line-height: 1.5;
    }
    .dlo-bot-msg {
      background: #f1f5f9;
      border-left: 3px solid #1e3a8a;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
      white-space: pre-line;
      color: #0f172a;
    }
    .dlo-bot-link {
      display: inline-block;
      margin-top: 8px;
      color: #1e3a8a;
      font-weight: 600;
      text-decoration: underline;
    }
    .dlo-chip-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 8px;
    }
    .dlo-chip {
      background: #ffffff;
      border: 1px solid #94a3b8;
      color: #0f2c59;
      border-radius: 6px;
      padding: 8px 11px;
      text-align: left;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dlo-chip:hover {
      background: #0c2340;
      color: #ffffff;
      border-color: #0c2340;
    }
  `;
  document.head.appendChild(style);

  // 1. Create floating teaser badge ("Ask me anything")
  const teaser = document.createElement("div");
  teaser.id = "dlo-chat-teaser";
  teaser.innerHTML = `<span>💬</span> <span>Need guidance? Ask me</span>`;
  document.body.appendChild(teaser);

  // 2. Create the "Ask Assistant" button
  const trigger = document.createElement("button");
  trigger.id = "dlo-chat-trigger";
  trigger.innerHTML = `<span class="dlo-icon">⚖️</span><span>Ask Assistant</span>`;
  document.body.appendChild(trigger);

  // 3. Create the chat window
  const box = document.createElement("div");
  box.id = "dlo-chat-window";
  box.innerHTML = `
    <div id="dlo-chat-header">
      <span>DLO Legal Assistant</span>
      <span id="dlo-chat-close" style="cursor:pointer; font-size:16px;">✕</span>
    </div>
    <div id="dlo-chat-body"></div>
  `;
  document.body.appendChild(box);

  const chatBody = box.querySelector("#dlo-chat-body");

  function showStep(stepKey) {
    const step = BOT_DATA[stepKey] || BOT_DATA.start;
    chatBody.innerHTML = "";

    const msg = document.createElement("div");
    msg.className = "dlo-bot-msg";
    msg.textContent = step.message;

    if (step.link) {
      const a = document.createElement("a");
      a.className = "dlo-bot-link";
      a.href = step.link.url;
      a.textContent = step.link.text + " →";
      msg.appendChild(document.createElement("br"));
      msg.appendChild(a);
    }
    chatBody.appendChild(msg);

    const group = document.createElement("div");
    group.className = "dlo-chip-group";

    step.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "dlo-chip";
      btn.textContent = opt.label;
      btn.onclick = () => showStep(opt.next);
      group.appendChild(btn);
    });

    chatBody.appendChild(group);
  }

  function toggleChat() {
    const isVisible = box.style.display === "flex";
    box.style.display = isVisible ? "none" : "flex";
    teaser.style.display = isVisible ? "flex" : "none";
    if (!isVisible) showStep("start");
  }

  trigger.onclick = toggleChat;
  teaser.onclick = toggleChat;

  box.querySelector("#dlo-chat-close").onclick = () => {
    box.style.display = "none";
    teaser.style.display = "flex";
  };
})();
