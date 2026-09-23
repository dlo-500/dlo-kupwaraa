(function () {
  // Decision tree mapping to the actual pages in dlo-kupwaraa
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

  // Inject widget CSS styles
  const style = document.createElement("style");
  style.textContent = `
    #dlo-chat-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f2c59;
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #dlo-chat-window {
      position: fixed;
      bottom: 80px;
      right: 24px;
      width: 320px;
      max-width: calc(100vw - 48px);
      max-height: 480px;
      background: #ffffff;
      color: #1a1a1a;
      border: 1px solid #dcdcdc;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
      font-family: inherit;
    }
    #dlo-chat-header {
      background: #0f2c59;
      color: #fff;
      padding: 12px 16px;
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
      background: #f0f4f8;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
      white-space: pre-line;
    }
    .dlo-bot-link {
      display: inline-block;
      margin-top: 8px;
      color: #0f2c59;
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
      border: 1px solid #0f2c59;
      color: #0f2c59;
      border-radius: 6px;
      padding: 7px 10px;
      text-align: left;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .dlo-chip:hover {
      background: #0f2c59;
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);

  // Inject widget HTML elements
  const trigger = document.createElement("button");
  trigger.id = "dlo-chat-trigger";
  trigger.innerHTML = "💬 Help Desk";
  document.body.appendChild(trigger);

  const box = document.createElement("div");
  box.id = "dlo-chat-window";
  box.innerHTML = `
    <div id="dlo-chat-header">
      <span>DLO Kupwara Help Desk</span>
      <span id="dlo-chat-close" style="cursor:pointer; font-size:16px;">✕</span>
    </div>
    <div id="dlo-chat-body"></div>
  `;
  document.body.appendChild(box);

  const chatBody = box.querySelector("#dlo-chat-body");

  // Render a step in the conversation
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

  // Toggle open/close
  trigger.onclick = () => {
    const isVisible = box.style.display === "flex";
    box.style.display = isVisible ? "none" : "flex";
    if (!isVisible) showStep("start");
  };

  box.querySelector("#dlo-chat-close").onclick = () => {
    box.style.display = "none";
  };
})();
