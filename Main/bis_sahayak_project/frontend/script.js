(function () {
  // ============================================================
  // BACKEND CONNECTION
  // ============================================================
  var CHAT_API_URL = window.BIS_MITRA_API_URL || "";
  var FEEDBACK_API_URL = window.BIS_MITRA_FEEDBACK_URL ||
    (CHAT_API_URL ? CHAT_API_URL.replace(/\/api\/chat$/, "/api/feedback") : "");

  // A fresh ID per page load so the backend can remember this conversation's
  // recent turns (for follow-ups like "what is the minimum cover?" after
  // "what is IS 456?"). Kept in memory only, not persisted anywhere.
  var CONVERSATION_ID = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : "conv-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  // ============================================================
  // LANGUAGE STRINGS (UI-level translation; the AI backend
  // already replies in whichever language the user's query was
  // written in, this just switches the widget's own UI text)
  // ============================================================
  var STRINGS = {
    en: {
      subtitle: "Online \u00b7 answers cited to source",
      placeholder: "Ask about a product or standard...",
      greeting: "Namaste! I'm BIS Mitra. Ask me about a product and I'll find the applicable Indian Standard \u2014 try one below, or type your own.",
      suggestions: ["LED bulb", "Motorcycle helmet", "Packaged drinking water", "Pressure cooker"],
      notFound: "This product isn't in the demo dataset yet.",
      genericError: "Something went wrong reaching the assistant. Please try again.",
      thanks: "Thanks for the feedback!",
      feedbackError: "Couldn't save feedback \u2014 check backend.",
      micUnsupported: "Voice input isn't supported in this browser. Try Chrome or Edge.",
      micDenied: "Microphone access was blocked. Please allow it and try again.",
      listening: "Listening..."
    },
    hi: {
      subtitle: "\u0911\u0928\u0932\u093e\u0907\u0928 \u00b7 \u0938\u094d\u0930\u094b\u0924 \u0915\u0947 \u0938\u093e\u0925 \u0909\u0924\u094d\u0924\u0930",
      placeholder: "\u0915\u093f\u0938\u0940 \u0909\u0924\u094d\u0938\u093e\u0926 \u092f\u093e \u092e\u093e\u0928\u0915 \u0915\u0947 \u092c\u093e\u0930\u0947 \u0940\u0902 \u092e\u0947\u0902 \u092a\u0942\u091b\u0947\u0902...",
      greeting: "\u0928\u092e\u0938\u094d\u0924\u0947! \u092e\u0947\u0902 BIS \u092e\u093f\u0924\u094d\u0930 \u0939\u0942\u0902\u0964 \u0915\u093f\u0938\u0940 \u0909\u0924\u094d\u0938\u093e\u0926 \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u092a\u0942\u091b\u0947\u0902 \u0914\u0930 \u092e\u0947\u0902 \u0932\u093e\u0917\u0942 \u092d\u093e\u0930\u0924\u0940\u092f \u092e\u093e\u0928\u0915 \u0922\u0942\u0902\u0922 \u0926\u0942\u0902\u0917\u093e \u2014 \u0928\u0940\u091a\u0947 \u0938\u0947 \u091a\u0941\u0928\u0947\u0902, \u092f\u093e \u0916\u0941\u0926 \u0932\u093f\u0916\u0947\u0902\u0964",
      suggestions: ["\u090f\u0932\u0908\u0921\u0940 \u092c\u0932\u094d\u092c", "\u092e\u094b\u091f\u0930\u0938\u093e\u0907\u0915\u0932 \u0939\u0947\u0932\u092e\u0947\u091f", "\u092a\u0947\u0915\u094d\u0921 \u092a\u0940\u0928\u0947 \u0915\u093e \u092a\u093e\u0928\u0940", "\u092a\u094d\u0930\u0947\u0936\u0930 \u0915\u0941\u0915\u0930"],
      notFound: "\u092f\u0939 \u0909\u0924\u094d\u0938\u093e\u0926 \u0905\u092d\u0940 \u0921\u0947\u092e\u094b \u0921\u0947\u091f\u093e\u0938\u0947\u091f \u092e\u0947\u0902 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
      genericError: "\u0938\u0939\u093e\u092f\u0915 \u0924\u0915 \u092a\u0939\u0941\u0902\u0928\u0928\u0947 \u092e\u0947\u0902 \u0938\u092e\u0938\u094d\u092f\u093e \u0939\u0941\u0908\u0964 \u0915\u0943\u092a\u092f\u093e \u0926\u094b\u092c\u093e\u0930\u093e \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964",
      thanks: "\u092a\u094d\u0930\u0924\u093f\u0915\u094d\u0930\u093f\u092f\u093e \u0915\u0947 \u0932\u093f\u090f \u0927\u0928\u094d\u092f\u0935\u093e\u0926!",
      feedbackError: "\u092a\u094d\u0930\u0924\u093f\u0915\u094d\u0930\u093f\u092f\u093e \u0938\u0947\u0935 \u0928\u0939\u0940\u0902 \u0939\u094b \u0938\u0915\u0940 \u2014 \u092c\u0948\u0915\u090f\u0902\u0921 \u091c\u093e\u0902\u091a\u0947\u0902\u0964",
      micUnsupported: "\u0907\u0938 \u092c\u094d\u0930\u093e\u0909\u091c\u0930 \u092e\u0947\u0902 \u0906\u0935\u093e\u091c\u093c \u0907\u0928\u092a\u0941\u091f \u0938\u092e\u0930\u094d\u0925\u093f\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 Chrome \u092f\u093e Edge \u0907\u0938\u094d\u0924\u0947\u0902\u0928\u093e\u0932 \u0915\u0930\u0947\u0902\u0964",
      micDenied: "\u092e\u093e\u0907\u0915\u094d\u0930\u094b\u095e\u094b\u0928 \u090f\u0915\u094d\u0938\u0947\u0938 \u092c\u094d\u0932\u0949\u0915 \u0939\u094b \u0917\u092f\u093e\u0964 \u0915\u0943\u092a\u092f\u093e \u0905\u0928\u0941\u092e\u0924\u093f \u0926\u0947\u0902 \u0914\u0930 \u0926\u094b\u092c\u093e\u0930\u093e \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964",
      listening: "\u0938\u0941\u0928 \u0930\u0939\u093e \u0939\u0942\u0902..."
    }
  };
  var currentLang = "en"; // 'en' or 'hi' — controls UI text + voice recognition language

  // ---- Offline demo dataset (used only when CHAT_API_URL is empty) ----
  var KB = [
    { keywords: ["led bulb","bulb","led lamp","light bulb","\u090f\u0932\u0908\u0921\u0940 \u092c\u0932\u094d\u092c"], is: "IS 16102 (Part 1)", title: "Self-ballasted LED Lamps for General Lighting Services", scope: "Safety and performance requirements for LED bulbs.", cert: "CRS \u2014 mandatory", allied: [["IS 16103","LED Modules"],["IS 15885","LED Drivers"]] },
    { keywords: ["helmet","motorcycle helmet","bike helmet","\u0939\u0947\u0932\u092e\u0947\u091f"], is: "IS 4151", title: "Protective Helmets for Two-Wheeler Riders", scope: "Materials, construction and testing requirements for motorcycle helmets.", cert: "ISI Mark \u2014 mandatory", allied: [["IS 2925","Industrial Safety Helmets"]] },
    { keywords: ["cement","opc","portland cement","\u0938\u0940\u092e\u0947\u0902\u091f"], is: "IS 269", title: "Ordinary Portland Cement \u2014 Specification", scope: "Composition and requirements for OPC used in construction.", cert: "ISI Mark \u2014 mandatory", allied: [["IS 3466","Masonry Cement"]] },
    { keywords: ["plug","socket","electrical plug","\u092a\u094d\u0932\u0917"], is: "IS 1293", title: "Plugs and Socket-outlets for Household Use", scope: "Safety and dimensional requirements for domestic plugs and sockets.", cert: "ISI Mark \u2014 mandatory", allied: [] },
    { keywords: ["water bottle","drinking water","packaged water","bottled water","\u092a\u093e\u0928\u0940"], is: "IS 14543", title: "Packaged Drinking Water", scope: "Microbiological and packaging requirements for bottled drinking water.", cert: "ISI Mark \u2014 mandatory", allied: [["IS 13428","Natural Mineral Water"]] },
    { keywords: ["pressure cooker","cooker","\u0915\u0941\u0915\u0930"], is: "IS 2347", title: "Domestic Pressure Cooker \u2014 Specification", scope: "Safety devices and construction requirements for pressure cookers.", cert: "ISI Mark \u2014 mandatory", allied: [["IS 7466","Pressure Cooker Gaskets"]] },
  ];

  function offlineMatch(q) {
    var qn = q.toLowerCase();
    var best = null, bestScore = 0;
    KB.forEach(function (e) {
      var score = 0;
      e.keywords.forEach(function (k) { if (qn.indexOf(k.toLowerCase()) !== -1) score += k.length; });
      if (score > bestScore) { bestScore = score; best = e; }
    });
    return best;
  }

  async function getAnswer(query) {
    if (CHAT_API_URL) {
      var res = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, conversation_id: CONVERSATION_ID }),
      });
      if (!res.ok) throw new Error("Server responded with " + res.status);
      var data = await res.json();
      if (data.success === false) throw new Error(data.error || "Backend returned an error");
      return {
        mode: "live",
        log_id: data.log_id,
        answer: data.answer,
        citations: data.citations || [],
        confidence: data.confidence || "",
      };
    }

    await new Promise(function (r) { setTimeout(r, 550 + Math.random() * 400); });
    var match = offlineMatch(query);
    if (!match) return { mode: "offline_not_found" };
    return { mode: "offline", is: match.is, title: match.title, scope: match.scope, cert: match.cert, allied: match.allied };
  }

  async function sendFeedback(logId, feedback, btnUp, btnDown, thanksEl) {
    if (!FEEDBACK_API_URL || logId === undefined || logId === null) return;
    btnUp.disabled = true; btnDown.disabled = true;
    btnUp.classList.toggle("bm-fb-active-up", feedback === "up");
    btnDown.classList.toggle("bm-fb-active-down", feedback === "down");
    try {
      await fetch(FEEDBACK_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId, feedback: feedback }),
      });
      thanksEl.textContent = STRINGS[currentLang].thanks;
    } catch (e) {
      thanksEl.textContent = STRINGS[currentLang].feedbackError;
    }
  }

  var root = document.getElementById("bm-root");
  var launcher = document.getElementById("bmLauncher");
  var closeBtn = document.getElementById("bmCloseBtn");
  var expandBtn = document.getElementById("bmExpandBtn");
  var expandIcon = document.getElementById("bmExpandIcon");
  var body = document.getElementById("bmBody");
  var chipsEl = document.getElementById("bmChips");
  var input = document.getElementById("bmInput");
  var sendBtn = document.getElementById("bmSend");
  var micBtn = document.getElementById("bmMic");
  var titleEl = document.getElementById("bmTitle");
  var subtitleEl = document.getElementById("bmSubtitle");
  var langEnBtn = document.getElementById("bmLangEn");
  var langHiBtn = document.getElementById("bmLangHi");

  var greeted = false;
  var isFull = false;

  // ============================================================
  // LANGUAGE TOGGLE
  // ============================================================
  function setLanguage(lang) {
    currentLang = lang;
    var s = STRINGS[lang];
    subtitleEl.textContent = s.subtitle;
    input.placeholder = s.placeholder;
    langEnBtn.classList.toggle("bm-lang-active", lang === "en");
    langHiBtn.classList.toggle("bm-lang-active", lang === "hi");
    renderChips();
    // Note: messages already in the chat stay in the language they
    // were sent in — only new UI text / new messages use the new language.
  }
  langEnBtn.addEventListener("click", function () { setLanguage("en"); });
  langHiBtn.addEventListener("click", function () { setLanguage("hi"); });

  // ============================================================
  // VOICE INPUT (Web Speech API — built into Chrome/Edge, free)
  // ============================================================
  var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognizer = null;
  var isListening = false;

  if (SpeechRecognitionCtor) {
    recognizer = new SpeechRecognitionCtor();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    recognizer.onstart = function () {
      isListening = true;
      micBtn.classList.add("bm-mic-listening");
      input.placeholder = STRINGS[currentLang].listening;
    };
    recognizer.onresult = function (event) {
      var transcript = event.results[0][0].transcript;
      input.value = transcript;
    };
    recognizer.onerror = function (event) {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        addBotText(STRINGS[currentLang].micDenied);
      }
    };
    recognizer.onend = function () {
      isListening = false;
      micBtn.classList.remove("bm-mic-listening");
      input.placeholder = STRINGS[currentLang].placeholder;
      if (input.value.trim()) handleSend();
    };
  } else {
    micBtn.disabled = true;
    micBtn.title = STRINGS.en.micUnsupported;
  }

  micBtn.addEventListener("click", function () {
    if (!recognizer) {
      addBotText(STRINGS[currentLang].micUnsupported);
      return;
    }
    if (isListening) {
      recognizer.stop();
      return;
    }
    recognizer.lang = currentLang === "hi" ? "hi-IN" : "en-IN";
    try {
      recognizer.start();
    } catch (e) {
      // start() throws if called twice in a row too quickly — safe to ignore
    }
  });

  // ============================================================
  // EXISTING WIDGET BEHAVIOR (unchanged)
  // ============================================================
  function open() {
    root.classList.add("bm-open");
    if (!greeted) {
      addBotText(STRINGS[currentLang].greeting);
      renderChips();
      greeted = true;
    }
    setTimeout(function () { input.focus(); }, 200);
  }
  function close() { root.classList.remove("bm-open"); }
  function toggleFull() {
    isFull = !isFull;
    root.classList.toggle("bm-full", isFull);
    expandIcon.innerHTML = isFull
      ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    STRINGS[currentLang].suggestions.forEach(function (s) {
      var chip = document.createElement("button");
      chip.className = "bm-chip"; chip.textContent = s;
      chip.onclick = function () { handleSend(s); };
      chipsEl.appendChild(chip);
    });
  }

  function addUserMsg(text) {
    var wrap = document.createElement("div");
    wrap.className = "bm-msg bm-user";
    wrap.innerHTML = '<div class="bm-bubble"></div>';
    wrap.querySelector(".bm-bubble").textContent = text;
    body.appendChild(wrap);
    scrollDown();
  }
  function addBotText(text) {
    var wrap = document.createElement("div");
    wrap.className = "bm-msg bm-bot";
    wrap.innerHTML = '<div class="bm-avatar">BM</div><div class="bm-bubble"></div>';
    wrap.querySelector(".bm-bubble").textContent = text;
    body.appendChild(wrap);
    scrollDown();
  }
  function addTyping() {
    var wrap = document.createElement("div");
    wrap.className = "bm-msg bm-bot"; wrap.id = "bmTypingRow";
    wrap.innerHTML = '<div class="bm-avatar">BM</div><div class="bm-typing"><span></span><span></span><span></span></div>';
    body.appendChild(wrap);
    scrollDown();
  }
  function removeTyping() {
    var t = document.getElementById("bmTypingRow");
    if (t) t.remove();
  }

  function addOfflineCard(r) {
    var card = document.createElement("div");
    card.className = "bm-result-card";
    var alliedHtml = "";
    if (r.allied && r.allied.length) {
      alliedHtml = '<div class="bm-allied"><p class="bm-allied-label">Allied Standards</p>' +
        r.allied.map(function (a) { return '<div class="bm-allied-item"><b>' + a[0] + '</b> \u2014 ' + a[1] + '</div>'; }).join("") +
        '</div>';
    }
    card.innerHTML =
      '<div class="bm-result-top">' +
        '<div class="bm-seal"><div class="bm-seal-ring"><span class="bm-seal-text">' + r.is + '</span></div></div>' +
        '<div><h4 class="bm-result-title">' + r.title + '</h4><p class="bm-result-scope">' + r.scope + '</p></div>' +
      '</div>' +
      '<span class="bm-tag">\u2713 ' + r.cert + '</span>' +
      alliedHtml;
    body.appendChild(card);
    scrollDown();
  }

  function addLiveCard(r) {
    var card = document.createElement("div");
    card.className = "bm-live-card";

    var citesHtml = "";
    if (r.citations && r.citations.length) {
      citesHtml = '<div class="bm-live-cites">' +
        r.citations.map(function (c) { return '<span class="bm-cite-chip">' + escapeHtml(c) + '</span>'; }).join("") +
        '</div>';
    }

    card.innerHTML =
      '<p class="bm-live-answer"></p>' +
      citesHtml +
      '<div class="bm-live-footer">' +
        '<span class="bm-confidence"></span>' +
        '<div class="bm-feedback">' +
          '<button class="bm-fb-btn" data-fb="up" aria-label="Helpful" title="Helpful">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M7 11v9H4v-9h3Zm3.5 0 2.7-6.4a1.5 1.5 0 0 1 2.75.6l-.5 4.3H19a2 2 0 0 1 1.95 2.45l-1.3 5.6A2 2 0 0 1 17.7 20H10.5v-9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
          '</button>' +
          '<button class="bm-fb-btn" data-fb="down" aria-label="Not helpful" title="Not helpful">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M17 13V4h3v9h-3Zm-3.5 0-2.7 6.4a1.5 1.5 0 0 1-2.75-.6l.5-4.3H5a2 2 0 0 1-1.95-2.45l1.3-5.6A2 2 0 0 1 6.3 4h7.2v9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<span class="bm-fb-thanks"></span>';

    card.querySelector(".bm-live-answer").textContent = r.answer;
    card.querySelector(".bm-confidence").textContent = r.confidence || "";

    var btnUp = card.querySelector('[data-fb="up"]');
    var btnDown = card.querySelector('[data-fb="down"]');
    var thanksEl = card.querySelector(".bm-fb-thanks");

    if (!FEEDBACK_API_URL || r.log_id === undefined || r.log_id === null) {
      btnUp.style.display = "none";
      btnDown.style.display = "none";
    } else {
      btnUp.addEventListener("click", function () { sendFeedback(r.log_id, "up", btnUp, btnDown, thanksEl); });
      btnDown.addEventListener("click", function () { sendFeedback(r.log_id, "down", btnUp, btnDown, thanksEl); });
    }

    body.appendChild(card);
    scrollDown();
  }

  function addResultCard(result) {
    if (result.mode === "offline_not_found") {
      addBotText(STRINGS[currentLang].notFound);
      return;
    }
    if (result.mode === "offline") {
      addOfflineCard(result);
      return;
    }
    addLiveCard(result);
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function scrollDown() { body.scrollTop = body.scrollHeight; }

  async function handleSend(text) {
    var q = (text || input.value).trim();
    if (!q) return;
    input.value = "";
    chipsEl.innerHTML = "";
    addUserMsg(q);
    addTyping();
    sendBtn.disabled = true;
    try {
      var result = await getAnswer(q);
      removeTyping();
      addResultCard(result);
    } catch (e) {
      removeTyping();
      addBotText(STRINGS[currentLang].genericError + " (" + e.message + ")");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  expandBtn.addEventListener("click", toggleFull);
  sendBtn.addEventListener("click", function () { handleSend(); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") handleSend(); });
})();