(function () {
  "use strict";

  // Prevents execution inside modal dialogs, iframes, or auxiliary popups
  function isModalOrPopupContext() {
    // 1. Inside an iframe or subframe (GLPI modal dialogs use iframes)
    try {
      if (window.self !== window.top) {
        return true;
      }
    } catch (e) {
      // Cross-origin iframe or restricted sandbox
      return true;
    }

    // 2. Auxiliary popup window opened by another GLPI window
    try {
      if (window.opener && window.opener !== window) {
        return true;
      }
    } catch (e) {}

    // 3. GLPI modal/popup URL parameters
    try {
      const search = window.location.search || "";
      if (
        search.includes("_in_modal=") ||
        search.includes("in_modal=") ||
        search.includes("displaytype=modal") ||
        search.includes("popup=1") ||
        search.includes("helpdesk_modal=")
      ) {
        return true;
      }
    } catch (e) {}

    // 4. Modal body markers in GLPI
    if (
      document.body &&
      (document.body.classList.contains("in-modal") ||
        document.body.classList.contains("modal-body") ||
        document.body.getAttribute("data-in-modal") === "1")
    ) {
      return true;
    }

    return false;
  }

  if (isModalOrPopupContext()) {
    return;
  }

  const AJAX_BASE = "/chat/ajax/";

  let csrfToken = null;
  // Current user ID from token.php
  let currentUsersId = null;
  let currentConversation = null;
  let lastMessageId = 0;
  let renderedMessageIds = new Set();
  let lastRenderedDayTimestamp = null;
  let lastKnownUnreadTotal = 0;
  // Unread messages mentioning this user, used for mention sound priority
  let lastKnownMentionUnreadTotal = 0;
  let conversationsLoadedOnce = false;

  let presenceTimer = null;
  let onlineUsersTimer = null;
  let conversationsTimer = null;
  let messagesTimer = null;

  // Read receipts state
  let currentParticipants = null;
  let messageReceiptEls = new Map();
  let receiptsPanelEl = null;

  // Keyboard navigation active row ID (data-row-id)
  let keyboardActiveRowId = null;

  // Reactions state
  let reactionsFeatureEnabled = false;
  const REACTION_EMOJI = "👍";
  let messageReactionEls = new Map();
  let messageReactionsData = new Map();

  // Online presence feature toggle (from token.php)
  let presenceFeatureEnabled = true;

  // Notification sound toggle (from token.php)
  let notificationSoundEnabled = true;

  // Current user display name, used for mention detection
  let currentOwnName = "";

  // Emoji picker availability toggles and IndexedDB support check
  let emojiEntityEnabled = false;
  let emojiAllowedConversationTypes = [];
  let emojiIndexedDBAvailable = false;

  // Checks if IndexedDB is available in the current browser context
  function checkIndexedDBAvailable() {
    try {
      return typeof window.indexedDB === "object" && window.indexedDB !== null;
    } catch (e) {
      return false;
    }
  }

  // Cached emoji-picker module and element
  let emojiPickerModuleLoaded = false;
  let emojiPickerEl = null;

  // Attachment feature state
  let attachmentFeatureEnabled = false;
  let attachmentAllowedConversationTypes = [];
  let attachmentMaxSizeMb = 2;
  let attachmentMaxSizeBytes = 2 * 1024 * 1024;
  let attachmentAllowedExtensions = [];
  let glpiCsrfToken = "";
  let pendingAttachmentFile = null;

  // @mentions autocomplete state
  let currentMentionableUsers = [];
  let mentionSuggestionsEl = null;
  let mentionActiveIndex = -1;
  let mentionTriggerStart = null;

  // :emoji autocomplete state
  let emojiSuggestionsEl = null;
  let emojiSuggestionList = [];
  let emojiActiveIndex = -1;
  let emojiTriggerStart = null;
  let emojiDatabasePromise = null;
  let emojiSearchSeq = 0;

  function currentMentionNames() {
    if (!currentMentionableUsers.length) return [];
    const localized = __("everyone", "Todos");
    const broadcastNames = Array.from(
      new Set(["Todos", "Everyone", "All", "Tous", localized]),
    );
    return currentMentionableUsers
      .map((u) => u.name)
      .concat(broadcastNames);
  }

  // Read receipt section toggles (from token.php)
  let receiptSectionsEnabled = {
    receipts_show_not_read: true,
    receipts_show_read: true,
    receipts_show_delivered: true,
    receipts_show_sent: true,
  };

  // Whether to show the "Reaccionado por" section in the receipts panel
  let reactionsShowReactedBy = false;

  // Message-to-ticket conversion state and permissions
  let ticketConversion = {
    can_convert: false,
    on_received: false,
    on_sent: false,
    requester_mode: "converter",
    categories: [],
  };
  // Map of message ID to converted ticket details
  let messageTicketMap = new Map();

  function ticketUrl(id) {
    return "/tickets/" + id;
  }

  // Checks whether the ticket conversion button can be shown for a message
  function canShowTicketConversion(m) {
    if (!ticketConversion.can_convert) return false;
    return m.mine ? ticketConversion.on_sent : ticketConversion.on_received;
  }

  // Polling intervals in ms (loaded from token.php)
  let MESSAGES_POLL_MS = 2000;
  let CONVERSATIONS_POLL_MS = 10000;
  let ONLINE_USERS_POLL_MS = 30000;
  let PRESENCE_POLL_MS = 30000;

  // Clamps polling interval to allowed boundaries
  function clampPollMs(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // Applies configured polling intervals from token.php
  function applyPollIntervals(data) {
    if (!data) return;
    MESSAGES_POLL_MS = clampPollMs(
      data.poll_messages_ms,
      1000,
      30000,
      MESSAGES_POLL_MS,
    );
    CONVERSATIONS_POLL_MS = clampPollMs(
      data.poll_conversations_ms,
      3000,
      120000,
      CONVERSATIONS_POLL_MS,
    );
    ONLINE_USERS_POLL_MS = clampPollMs(
      data.poll_online_users_ms,
      3000,
      300000,
      ONLINE_USERS_POLL_MS,
    );
    PRESENCE_POLL_MS = clampPollMs(
      data.poll_presence_ms,
      3000,
      300000,
      PRESENCE_POLL_MS,
    );
  }

  // Localized string dictionary (loaded dynamically from token.php)
  let i18n = {};
  function __(key, fallback) {
    return i18n && typeof i18n[key] === "string" ? i18n[key] : fallback || key;
  }

  function formatStr(template, ...args) {
    let i = 0;
    return String(template).replace(/%[sd]/g, () =>
      args[i++] !== undefined ? args[i - 1] : "",
    );
  }

  // Typing indicator toggle and state
  let typingIndicatorEnabled = true;
  let lastTypingSentTime = 0;

  function sendTypingPing(isTyping = true) {
    if (!typingIndicatorEnabled || !currentConversation || !currentConversation.id) return;
    api("messages.php", {
      action: "typing",
      conversation_id: currentConversation.id,
      status: isTyping ? "typing" : "stop",
    }).catch(() => {});
  }

  function handleTypingActivity() {
    if (!typingIndicatorEnabled || !currentConversation || !currentConversation.id) return;
    const now = Date.now();
    if (now - lastTypingSentTime > 2500) {
      lastTypingSentTime = now;
      sendTypingPing(true);
    }
  }

  function updateTypingIndicator(typingUsers) {
    if (!ui || !ui.threadView) return;
    const indicatorEl = ui.threadView.querySelector(
      ".plugin-chat-typing-indicator",
    );
    const textEl = ui.threadView.querySelector(".plugin-chat-typing-text");
    if (!indicatorEl || !textEl) return;

    if (
      !typingIndicatorEnabled ||
      !currentConversation ||
      !Array.isArray(typingUsers) ||
      typingUsers.length === 0
    ) {
      indicatorEl.style.display = "none";
      textEl.textContent = "";
      return;
    }

    let message = "";
    if (typingUsers.length === 1) {
      message = formatStr(
        __("user_typing", "%s está escribiendo…"),
        typingUsers[0],
      );
    } else if (typingUsers.length === 2) {
      message = formatStr(
        __("users_typing_two", "%s y %s están escribiendo…"),
        typingUsers[0],
        typingUsers[1],
      );
    } else {
      message = __("users_typing_many", "Varios usuarios están escribiendo…");
    }

    textEl.textContent = message;
    indicatorEl.style.display = "flex";
  }

  // Maximum message length (loaded from token.php)
  let maxMessageLength = 2000;

  function updateInputCounter(input) {
    if (!ui) return;
    const counter = ui.threadView.querySelector(".plugin-chat-input-counter");
    if (!counter || !input) return;
    const len = input.value.length;
    const threshold = Math.floor(maxMessageLength * 0.85);
    if (len >= threshold) {
      counter.textContent = len + " / " + maxMessageLength;
      counter.style.display = "inline-block";
      if (len >= maxMessageLength) {
        counter.classList.add("is-limit");
      } else {
        counter.classList.remove("is-limit");
      }
    } else {
      counter.style.display = "none";
      counter.classList.remove("is-limit");
    }
  }

  function applyTranslations() {
    if (!ui) return;
    if (ui.launcher) ui.launcher.title = __("chat", "Chat");
    if (ui.search)
      ui.search.placeholder = __(
        "search_conversations",
        "Buscar conversaciones...",
      );
    const userSearch =
      ui.newChatView &&
      ui.newChatView.querySelector(".plugin-chat-user-search");
    if (userSearch)
      userSearch.placeholder = __("search_users", "Buscar usuario...");
    const input =
      ui.threadView && ui.threadView.querySelector(".plugin-chat-input");
    if (input) input.placeholder = __("type_message", "Escribe un mensaje...");
    const closeBtn = ui.header && ui.header.querySelector(".plugin-chat-close");
    if (closeBtn) closeBtn.title = __("close", "Cerrar");
    const pinBtn = ui.header && ui.header.querySelector(".plugin-chat-pin-btn");
    if (pinBtn)
      pinBtn.title = panelPinned
        ? __("unpin_panel", "Desfijar panel")
        : __("pin_panel", "Fijar el chat");
    const newBtn = ui.header && ui.header.querySelector(".plugin-chat-new");
    if (newBtn) newBtn.title = __("new_chat", "Nueva conversación");
    const starBtn =
      ui.panel && ui.panel.querySelector(".plugin-chat-star");
    if (starBtn)
      starBtn.title =
        currentConversation && currentConversation.featured
          ? __("unstar_conversation", "Quitar de destacados")
          : __("star_conversation", "Destacar conversación");
    const attachBtn =
      ui.threadView && ui.threadView.querySelector(".plugin-chat-attach-btn");
    if (attachBtn) attachBtn.title = __("attach_file", "Adjuntar archivo");
    const emojiBtn =
      ui.threadView && ui.threadView.querySelector(".plugin-chat-emoji-btn");
    if (emojiBtn) emojiBtn.title = __("emojis", "Emojis");
    const sendBtn =
      ui.threadView && ui.threadView.querySelector(".plugin-chat-send");
    if (sendBtn) sendBtn.title = __("send", "Enviar");
    const backBtns =
      ui.panel && ui.panel.querySelectorAll(".plugin-chat-back");
    if (backBtns) {
      backBtns.forEach((btn) => (btn.title = __("back", "Volver")));
    }
    const brandTitles =
      ui.panel && ui.panel.querySelectorAll(".plugin-chat-brand-title");
    if (brandTitles && brandTitles[0]) {
      brandTitles[0].textContent = __("chat", "Chat");
    }
    const removeAttachBtn =
      ui.threadView &&
      ui.threadView.querySelector(".plugin-chat-staged-remove-btn");
    if (removeAttachBtn)
      removeAttachBtn.title = __("remove_attachment", "Quitar archivo");
    const hintBtn =
      ui.threadView &&
      ui.threadView.querySelector(".plugin-chat-shortcuts-hint");
    if (hintBtn) {
      const fullHint = __(
        "shortcuts_hint",
        "Ctrl + Alt + ? → Mostrar atajos",
      );
      const parts = fullHint.split(/\s*(?:→|\u2192)\s*/);
      const keySpan = hintBtn.querySelector(".plugin-chat-shortcuts-hint-key");
      const labelSpan = hintBtn.querySelector(
        ".plugin-chat-shortcuts-hint-label",
      );
      if (keySpan && parts[0]) keySpan.textContent = parts[0];
      if (labelSpan && parts[1]) labelSpan.textContent = " \u2192 " + parts[1];
    }

    const sectionMap = {
      online: {
        label: __("online", "EN LÍNEA"),
        empty: __("no_online_users", "No hay nadie más en línea"),
      },
      featured: {
        label: __("featured", "DESTACADOS"),
        empty: __("no_featured", "No hay conversaciones destacadas"),
      },
      group: {
        label: __("groups", "GRUPO"),
        empty: __("no_groups", "No hay grupos"),
      },
      private: {
        label: __("private", "PRIVADO"),
        empty: __("no_private", "No hay conversaciones privadas"),
      },
    };
    Object.keys(sectionMap).forEach((secKey) => {
      const secEl =
        ui.listView &&
        ui.listView.querySelector('[data-section="' + secKey + '"]');
      if (secEl) {
        const labelEl = secEl.querySelector(".plugin-chat-section-label");
        if (labelEl) labelEl.textContent = sectionMap[secKey].label;
        const emptyEl = secEl.querySelector(".plugin-chat-empty");
        if (emptyEl) emptyEl.textContent = sectionMap[secKey].empty;
      }
    });
  }

  // Shared AudioContext for synthesizer notifications
  let sharedAudioCtx = null;

  function getAudioContext() {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtxClass();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }

  function playNotificationSound() {
    if (!notificationSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      // The browser may block audio until the user interacts
    }
  }

  // Plays a chime notification for incoming @mentions (A5 -> E5 descending)
  function playMentionSound() {
    if (!notificationSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [880, 659.25];
      const fadeIn = 0.015;
      notes.forEach((freq, i) => {
        const start = now + i * 0.17;
        const duration = 0.4;

        const fundamental = ctx.createOscillator();
        const fundamentalGain = ctx.createGain();
        fundamental.type = "sine";
        fundamental.frequency.value = freq;
        fundamentalGain.gain.setValueAtTime(0.0001, start);
        fundamentalGain.gain.linearRampToValueAtTime(0.18, start + fadeIn);
        fundamentalGain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + duration,
        );
        fundamental.connect(fundamentalGain).connect(ctx.destination);
        fundamental.start(start);
        fundamental.stop(start + duration);

        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        overtone.type = "sine";
        overtone.frequency.value = freq * 2;
        overtoneGain.gain.setValueAtTime(0.0001, start);
        overtoneGain.gain.linearRampToValueAtTime(0.05, start + fadeIn);
        overtoneGain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + duration * 0.55,
        );
        overtone.connect(overtoneGain).connect(ctx.destination);
        overtone.start(start);
        overtone.stop(start + duration * 0.55);
      });
    } catch (e) {
      // The browser may block audio until the user interacts
    }
  }

  // Checks if a message mentions the current user or @Todos/@Everyone
  function messageMentionsMe(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    const localized = __("everyone", "Todos").toLowerCase();
    if (
      lower.indexOf("@todos") !== -1 ||
      lower.indexOf("@everyone") !== -1 ||
      lower.indexOf("@all") !== -1 ||
      lower.indexOf("@tous") !== -1 ||
      lower.indexOf("@" + localized) !== -1
    ) {
      return true;
    }
    if (!currentOwnName) return false;
    return lower.indexOf("@" + currentOwnName.toLowerCase()) !== -1;
  }

  // Clamps panel width within configured limits (320-420px)
  const CHAT_MIN_PANEL_WIDTH = 320;
  const CHAT_MAX_PANEL_WIDTH = 420;
  function clampPanelWidth(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return 380;
    return Math.min(CHAT_MAX_PANEL_WIDTH, Math.max(CHAT_MIN_PANEL_WIDTH, n));
  }

  // Validates hex color format (#rrggbb)
  function isValidHexColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  // Theme and docking state
  let panelPinned = false;
  let currentPanelWidthPx = 380;

  function applyAppearance(panelEl, data) {
    if (!panelEl || !data) return;
    currentPanelWidthPx = clampPanelWidth(data.panel_width_px);
    panelEl.style.setProperty("--chat-panel-width", currentPanelWidthPx + "px");
    if (isValidHexColor(data.bubble_color)) {
      panelEl.style.setProperty("--chat-bubble-color", data.bubble_color);
    }
    if (isValidHexColor(data.mention_color)) {
      panelEl.style.setProperty("--chat-mention-color", data.mention_color);
    }
    if (isValidHexColor(data.launcher_color)) {
      panelEl.style.setProperty("--chat-launcher-color", data.launcher_color);
      if (ui && ui.launcher) {
        ui.launcher.style.setProperty(
          "--chat-launcher-color",
          data.launcher_color,
        );
      }
      if (ui && ui.shortcutBtn) {
        ui.shortcutBtn.style.setProperty(
          "--chat-launcher-color",
          data.launcher_color,
        );
      }
      if (ui && ui.shortcutMenu) {
        ui.shortcutMenu.style.setProperty(
          "--chat-launcher-color",
          data.launcher_color,
        );
      }
    }
    if (data.font_size) {
      var fs = String(data.font_size);
      var legacyScales = { small: 0.85, normal: 1, medium: 1.15, large: 1.3, xlarge: 1.45 };
      if (legacyScales[fs]) {
        panelEl.dataset.fontSize = fs;
        panelEl.style.setProperty("--chat-font-scale", legacyScales[fs]);
      } else {
        var num = parseFloat(fs);
        if (!isNaN(num) && num >= 10 && num <= 24) {
          panelEl.dataset.fontSize = String(Math.round(num));
          panelEl.style.setProperty("--chat-font-scale", (num / 13).toFixed(4));
        }
      }
    }
    // Sets panel width CSS variable and caches numeric width
    if (panelPinned) {
      applyPinnedLayout(!!ui && ui.panel.style.display !== "none");
    }
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Unicode emoji pattern supporting flags, keycaps, skin tone modifiers, and ZWJ sequences
  const EMOJI_REGEX =
    /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])+|\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

  // Appends text while wrapping any embedded emojis in inline spans for optical scaling
  function appendFormattedText(container, text) {
    if (!text) return;
    const rx = new RegExp(EMOJI_REGEX.source, "gu");
    let cursor = 0;
    let match;
    while ((match = rx.exec(text)) !== null) {
      if (match.index > cursor) {
        container.appendChild(
          document.createTextNode(text.slice(cursor, match.index)),
        );
      }
      const span = document.createElement("span");
      span.className = "plugin-chat-inline-emoji";
      span.textContent = match[0];
      container.appendChild(span);
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) {
      container.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  // Counts emojis if the string consists strictly of emojis and whitespace
  function getEmojiOnlyCount(text) {
    if (!text) return 0;
    const clean = text.trim();
    if (!clean) return 0;

    const withoutEmojis = clean.replace(EMOJI_REGEX, "").replace(/\s/g, "");
    if (withoutEmojis.length > 0) return 0;

    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        const segments = [...segmenter.segment(clean)].filter((s) =>
          /\S/.test(s.segment),
        );
        return segments.length;
      } catch (e) {
        // Fallback below
      }
    }
    const matches = clean.match(EMOJI_REGEX);
    return matches ? matches.length : 0;
  }

  // Formats message content with clickable URLs, highlighted @mentions, and scaled emojis
  function renderMessageContent(text, mentionNames) {
    const container = document.createElement("div");
    container.className = "plugin-chat-message-content";

    const names = (mentionNames || []).filter(Boolean);
    // Longest names first, so "Juan Pérez Gómez" is matched whole
    // instead of stopping early at "Juan Pérez" when both exist.
    names.sort((a, b) => b.length - a.length);
    const mentionAlternation = names.map(escapeRegExp).join("|");

    const pattern = mentionAlternation
      ? "(?<url>(https?://|www\\.)[^\\s<]+)|(?<mention>@(?:" +
        mentionAlternation +
        ")(?![\\p{L}\\p{N}_]))"
      : "(?<url>(https?://|www\\.)[^\\s<]+)";
    const regex = new RegExp(pattern, "giu");

    let cursor = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) {
        appendFormattedText(
          container,
          text.slice(cursor, match.index),
        );
      }

      if (match.groups && match.groups.mention) {
        const span = document.createElement("span");
        span.className = "plugin-chat-mention";
        span.textContent = match.groups.mention;
        container.appendChild(span);
        cursor = match.index + match[0].length;
        continue;
      }

      let url = match.groups ? match.groups.url : match[0];
      let trailing = "";
      const trailMatch = url.match(/[.,;:!?)]+$/);
      if (trailMatch) {
        trailing = trailMatch[0];
        url = url.slice(0, url.length - trailing.length);
      }

      const href = url.toLowerCase().startsWith("http")
        ? url
        : "https://" + url;
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "plugin-chat-link";
      a.textContent = url;
      container.appendChild(a);

      if (trailing) appendFormattedText(container, trailing);
      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      appendFormattedText(container, text.slice(cursor));
    }

    return container;
  }

  // Formats a Unix timestamp to locale time (HH:MM)
  function formatMessageTime(ts) {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const time = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return day + "/" + month + " " + time;
  }

  // Numeric "which day is this" value (local midnight, as a timestamp),
  // used to both detect a day change AND enforce that day dividers
  // never move backward - see the monotonic check in renderMessages().
  function dayTimestampOf(ts) {
    if (!ts) return null;
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  // Human readable divider label, e.g. "Hoy", "Ayer", "3 de agosto"
  function formatDateDivider(ts) {
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return "";
    const today = new Date();
    const todayMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const targetMidnight = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    if (targetMidnight === todayMidnight) {
      return __("today", "Hoy");
    }
    if (targetMidnight === todayMidnight - 86400000) {
      return __("yesterday", "Ayer");
    }
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  }

  // ---------- helpers ----------

  // Base API helper for AJAX requests
  function api(file, params) {
    const url = new URL(AJAX_BASE + file, window.location.origin);
    const merged = Object.assign({}, params || {});
    if (csrfToken) {
      merged._chat_csrf = csrfToken;
    }
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz) {
        merged.client_tz = browserTz;
      }
    } catch (e) {}
    Object.keys(merged).forEach((k) => url.searchParams.set(k, merged[k]));
    return fetch(url.toString(), {
      credentials: "same-origin",
      cache: "no-store",
    }).then((r) => r.json());
  }

  // Sends message content via custom header to avoid URL length limits
  function apiWithContent(file, params, content) {
    const url = new URL(AJAX_BASE + file, window.location.origin);
    const merged = Object.assign({}, params || {});
    if (csrfToken) {
      merged._chat_csrf = csrfToken;
    }
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz) {
        merged.client_tz = browserTz;
      }
    } catch (e) {}
    Object.keys(merged).forEach((k) => url.searchParams.set(k, merged[k]));
    return fetch(url.toString(), {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Chat-Content": encodeURIComponent(content) },
    }).then((r) => r.json());
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  const ICONS = {
    close:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    person:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    starOutline:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starFilled:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    chatBubble:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><circle cx="8.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    checkSingle:
      '<svg width="14" height="14" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8l4 4L19 2"/></svg>',
    checkDouble:
      '<svg width="18" height="14" viewBox="0 0 24 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8l4 4L15 2"/><path d="M6 8l4 4L23 2"/></svg>',
    externalLink:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    grid: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    // Docks the panel to the edge of the screen instead of floating
    // as an overlay - see the .plugin-chat-pin-btn wiring in init().
    // A simple thumbtack, matching the pin control GLPI's own saved-
    // searches panel already uses for the same "keep this expanded"
    // concept.
    pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>',
    // Trigger for the emoji picker (see loadEmojiPicker() in init()) -
    // a plain smiley outline, matching the line-icon style already
    // used everywhere else in this file (pin, gear-less header,
    // star...), not a colored/native emoji glyph, so it stays
    // consistent regardless of the OS/browser's own emoji font.
    emoji:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 10.5h.01"/><path d="M15.5 10.5h.01"/><path d="M8 14.5c1 1.2 2.4 1.8 4 1.8s3-.6 4-1.8"/></svg>',
    attachment:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    file:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    download:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    chevronDown:
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  };

  // Generates a 1-2 letter avatar initial from a display name
  function initialsFromName(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    let letters = parts[0].charAt(0);
    if (parts.length > 1) letters += parts[parts.length - 1].charAt(0);
    return letters.toUpperCase();
  }

  function avatarEl(name, extraClass) {
    return el("div", {
      class: "plugin-chat-avatar " + (extraClass || ""),
      text: initialsFromName(name),
    });
  }

  function iconEl(name, extraClass) {
    const span = el("span", {
      class: "plugin-chat-icon " + (extraClass || ""),
    });
    span.innerHTML = ICONS[name] || "";
    return span;
  }

  // ---------- UI scaffolding ----------

  function buildLauncher() {
    const launcher = el("div", {
      id: "plugin-chat-launcher",
      class: "plugin-chat-launcher",
    });
    const btn = el(
      "button",
      {
        class: "plugin-chat-launcher-btn",
        type: "button",
        title: __("chat", "Chat"),
      },
      [iconEl("chatBubble")],
    );
    const badge = el("span", {
      class: "plugin-chat-launcher-badge",
      style: "display:none",
    });
    btn.appendChild(badge);
    btn.addEventListener("click", togglePanel);
    launcher.appendChild(btn);
    document.body.appendChild(launcher);
    return { launcher, badge };
  }

  // Builds launcher shortcut buttons and menu
  let shortcutMenuOpen = false;

  function buildShortcutButton() {
    const btn = el(
      "button",
      {
        class: "plugin-chat-shortcut-btn is-floating",
        type: "button",
        style: "display:none",
        title: __("shortcut_single", "Acceso directo"),
      },
      [iconEl("externalLink")],
    );
    document.body.appendChild(btn);

    const menu = el("div", {
      class: "plugin-chat-shortcut-menu",
      style: "display:none",
    });
    document.body.appendChild(menu);

    return { btn, menu };
  }

  function closeShortcutMenu(menu) {
    if (!menu) return;
    menu.style.display = "none";
    shortcutMenuOpen = false;
    document.removeEventListener("mousedown", onShortcutMenuOutsideClick, true);
  }

  function onShortcutMenuOutsideClick(e) {
    if (!ui || !ui.shortcutMenu) return;
    if (
      ui.shortcutMenu.contains(e.target) ||
      (ui.shortcutBtn && ui.shortcutBtn.contains(e.target))
    ) {
      return;
    }
    closeShortcutMenu(ui.shortcutMenu);
  }

  function openShortcutMenu(btn, menu) {
    // Positions the shortcut menu popup
    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    menu.style.left = left + "px";

    // Docked (in-header) anchors sit near the top, so the menu drops
    // below them; floating ones sit near the bottom, so it opens
    // upward instead - either way, away from the nearest edge.
    if (btn.classList.contains("is-docked")) {
      menu.style.top = rect.bottom + 6 + "px";
      menu.style.bottom = "auto";
    } else {
      menu.style.bottom = window.innerHeight - rect.top + 6 + "px";
      menu.style.top = "auto";
    }

    menu.style.display = "block";
    shortcutMenuOpen = true;
    document.addEventListener("mousedown", onShortcutMenuOutsideClick, true);
  }

  function applyShortcutButtons(btn, menu, buttons) {
    if (!btn || !menu) return;
    const list = Array.isArray(buttons)
      ? buttons.filter((b) => b && b.url)
      : [];

    closeShortcutMenu(menu);
    btn.onclick = null;

    if (!list.length) {
      btn.style.display = "none";
      return;
    }

    if (list.length === 1) {
      const only = list[0];
      btn.title = only.label || __("shortcut_single", "Acceso directo");
      btn.innerHTML = "";
      btn.appendChild(iconEl("externalLink"));
      btn.onclick = () =>
        window.open(only.url, "_blank", "noopener,noreferrer");
      btn.style.display = "flex";
      return;
    }

    btn.title = __("shortcut_multi", "Accesos directos");
    btn.innerHTML = "";
    btn.appendChild(iconEl("grid"));
    btn.style.display = "flex";

    menu.innerHTML = "";
    list.forEach((b) => {
      const item = el("button", {
        class: "plugin-chat-shortcut-menu-item",
        type: "button",
        text: b.label || __("shortcut_single", "Acceso directo"),
      });
      item.addEventListener("click", () => {
        window.open(b.url, "_blank", "noopener,noreferrer");
        closeShortcutMenu(menu);
      });
      menu.appendChild(item);
    });

    btn.onclick = () => {
      if (shortcutMenuOpen) {
        closeShortcutMenu(menu);
      } else {
        openShortcutMenu(btn, menu);
      }
    };
  }

  // Moves the shortcut button between its two homes without recreating
  // it, so its click handler and enabled state carry over untouched.
  function setShortcutButtonDocked(btn, header, docked) {
    if (!btn) return;
    if (docked) {
      const newChatBtn = header && header.querySelector(".plugin-chat-new");
      if (newChatBtn) {
        header.insertBefore(btn, newChatBtn);
      } else if (header) {
        header.appendChild(btn);
      }
      btn.classList.remove("is-floating");
      btn.classList.add("is-docked", "plugin-chat-icon-btn");
    } else {
      document.body.appendChild(btn);
      btn.classList.remove("is-docked", "plugin-chat-icon-btn");
      btn.classList.add("is-floating");
    }
  }

  function buildPanel() {
    const backdrop = el("div", {
      id: "plugin-chat-backdrop",
      class: "plugin-chat-backdrop",
      style: "display:none",
    });
    document.body.appendChild(backdrop);

    const panel = el("div", {
      id: "plugin-chat-panel",
      class: "plugin-chat-panel",
      style: "display:none",
    });

    // Unified Header: contextual sections for List, Thread, and New Chat views
    const headerList = el("div", { class: "plugin-chat-header-list" }, [
      el(
        "button",
        {
          class: "plugin-chat-close plugin-chat-icon-btn",
          type: "button",
          title: __("close", "Cerrar"),
        },
        [iconEl("close")],
      ),
      el("span", {
        class: "plugin-chat-brand-title",
        text: __("chat", "Chat"),
      }),
      el("span", { class: "plugin-chat-header-spacer" }),
    ]);

    const headerThread = el(
      "div",
      { class: "plugin-chat-header-thread", style: "display:none" },
      [
        el("button", {
          class: "plugin-chat-back plugin-chat-icon-btn",
          type: "button",
          title: __("back", "Volver"),
          text: "\u2190",
        }),
        avatarEl("", "plugin-chat-thread-avatar"),
        el("div", { class: "plugin-chat-thread-title-wrap" }, [
          el("span", { class: "plugin-chat-thread-title" }),
        ]),
      ],
    );

    const headerNew = el(
      "div",
      { class: "plugin-chat-header-new", style: "display:none" },
      [
        el("button", {
          class: "plugin-chat-back plugin-chat-icon-btn",
          type: "button",
          title: __("back", "Volver"),
          text: "\u2190",
        }),
        el("span", {
          class: "plugin-chat-brand-title",
          text: __("new_chat", "Nueva conversación"),
        }),
        el("span", { class: "plugin-chat-header-spacer" }),
      ],
    );

    const starBtn = el(
      "button",
      {
        class:
          "plugin-chat-star plugin-chat-icon-btn plugin-chat-icon-btn-chip",
        type: "button",
        style: "display:none",
        title: __("star_conversation", "Destacar conversación"),
      },
      [iconEl("starOutline")],
    );

    const newBtn = el(
      "button",
      {
        class:
          "plugin-chat-new plugin-chat-icon-btn plugin-chat-icon-btn-chip",
        type: "button",
        title: __("new_chat", "Nueva conversación"),
      },
      [iconEl("person")],
    );

    const pinBtn = el(
      "button",
      {
        class: "plugin-chat-pin-btn plugin-chat-icon-btn",
        type: "button",
        title: __("pin_panel", "Fijar el chat"),
      },
      [iconEl("pin")],
    );

    const threadCloseBtn = el(
      "button",
      {
        class:
          "plugin-chat-close plugin-chat-icon-btn plugin-chat-thread-close-btn",
        type: "button",
        style: "display:none",
        title: __("close", "Cerrar"),
      },
      [iconEl("close")],
    );

    const header = el("div", { class: "plugin-chat-header" }, [
      headerList,
      headerThread,
      headerNew,
      starBtn,
      newBtn,
      pinBtn,
      threadCloseBtn,
    ]);

    const search = el("input", {
      class: "plugin-chat-search",
      type: "text",
      placeholder: __("search_conversations", "Búsqueda"),
    });

    const listView = el("div", { class: "plugin-chat-list-view" }, [
      section(
        "online",
        __("online", "EN LÍNEA"),
        __("no_online_users", "No hay nadie más en línea"),
      ),
      section(
        "featured",
        __("featured", "DESTACADOS"),
        __("no_featured", "No hay conversaciones destacadas"),
      ),
      section("group", __("groups", "GRUPO"), __("no_groups", "No hay grupos")),
      section(
        "private",
        __("private", "PRIVADO"),
        __("no_private", "No hay conversaciones privadas"),
      ),
    ]);

    const newChatView = el(
      "div",
      { class: "plugin-chat-new-view", style: "display:none" },
      [
        el("input", {
          class: "plugin-chat-user-search",
          type: "text",
          placeholder: __("search_users", "Buscar usuario..."),
        }),
        el("div", { class: "plugin-chat-user-results" }),
      ],
    );

    const threadView = el(
      "div",
      { class: "plugin-chat-thread-view", style: "display:none" },
      [
        el("div", { class: "plugin-chat-messages" }),
        el(
          "div",
          { class: "plugin-chat-typing-indicator", style: "display:none" },
          [
            el("span", { class: "plugin-chat-typing-dots" }, [
              el("span", { class: "plugin-chat-typing-dot" }),
              el("span", { class: "plugin-chat-typing-dot" }),
              el("span", { class: "plugin-chat-typing-dot" }),
            ]),
            el("span", { class: "plugin-chat-typing-text" }),
          ],
        ),
        el("div", { class: "plugin-chat-composer" }, [
          el("div", { class: "plugin-chat-composer-main" }, [
            el(
              "div",
              {
                class: "plugin-chat-staged-attachment",
                style: "display:none",
              },
              [
                iconEl("file", "plugin-chat-staged-file-icon"),
                el("span", { class: "plugin-chat-staged-file-name" }),
                el("span", { class: "plugin-chat-staged-file-size" }),
                el(
                  "button",
                  {
                    class: "plugin-chat-staged-remove-btn",
                    type: "button",
                    title: __("remove_attachment", "Quitar archivo"),
                  },
                  [iconEl("close")],
                ),
              ],
            ),
            el("textarea", {
              class: "plugin-chat-input",
              rows: "2",
              placeholder: __("type_message", "Escribe un mensaje..."),
              maxlength: String(maxMessageLength),
            }),
            el("input", {
              type: "file",
              class: "plugin-chat-file-input",
              style: "display:none",
            }),
          ]),
          el("div", { class: "plugin-chat-composer-actions" }, [
            el("span", {
              class: "plugin-chat-input-counter",
              style: "display:none",
            }),
            el(
              "button",
              {
                class: "plugin-chat-attach-btn",
                type: "button",
                title: __("attach_file", "Adjuntar archivo"),
                style: "display:none",
              },
              [iconEl("attachment")],
            ),
            el(
              "button",
              {
                class: "plugin-chat-emoji-btn",
                type: "button",
                title: __("emojis", "Emojis"),
                style: "display:none",
              },
              [iconEl("emoji")],
            ),
            el(
              "button",
              {
                class: "plugin-chat-send",
                type: "button",
                title: __("send", "Enviar"),
              },
              [iconEl("send")],
            ),
          ]),
        ]),
        el("button", { class: "plugin-chat-shortcuts-hint", type: "button" }, [
          el("span", {
            class: "plugin-chat-shortcuts-hint-key",
            text: "Ctrl + Alt + ?",
          }),
          el("span", {
            class: "plugin-chat-shortcuts-hint-label",
            text: " \u2192 " + __("shortcuts_title", "Mostrar atajos"),
          }),
        ]),
      ],
    );

    panel.appendChild(header);
    panel.appendChild(search);
    panel.appendChild(listView);
    panel.appendChild(newChatView);
    panel.appendChild(threadView);

    document.body.appendChild(panel);

    return {
      panel,
      backdrop,
      header,
      headerList,
      headerThread,
      headerNew,
      search,
      listView,
      newChatView,
      threadView,
    };
  }

  const COLLAPSED_STORAGE_KEY = "glpi_plugin_chat_collapsed_sections";

  function getCollapsedSections() {
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setSectionCollapsed(key, collapsed) {
    const states = getCollapsedSections();
    states[key] = !!collapsed;
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(states));
    } catch (e) {}

    const secEl =
      ui &&
      ui.listView &&
      ui.listView.querySelector('[data-section="' + key + '"]');
    if (secEl) {
      secEl.classList.toggle("is-collapsed", !!collapsed);
      const header = secEl.querySelector(".plugin-chat-section-header");
      if (header) {
        header.setAttribute("aria-expanded", String(!collapsed));
      }
    }
  }

  function toggleSectionCollapse(key) {
    const secEl =
      ui &&
      ui.listView &&
      ui.listView.querySelector('[data-section="' + key + '"]');
    if (!secEl) return;
    const isCurrentlyCollapsed = secEl.classList.contains("is-collapsed");
    setSectionCollapsed(key, !isCurrentlyCollapsed);
  }

  function section(key, label, emptyText) {
    const chevron = el("span", { class: "plugin-chat-section-chevron" }, [
      iconEl("chevronDown"),
    ]);
    const titleWrap = el("div", { class: "plugin-chat-section-title-wrap" }, [
      chevron,
      el("span", { class: "plugin-chat-section-label", text: label }),
    ]);
    const unreadBadge = el("span", {
      class: "plugin-chat-section-unread",
      style: "display:none",
      text: "0",
    });
    const countBadge = el("span", {
      class: "plugin-chat-section-badge",
      text: "0",
    });
    const badgesWrap = el("div", { class: "plugin-chat-section-badges" }, [
      unreadBadge,
      countBadge,
    ]);

    const header = el(
      "div",
      {
        class: "plugin-chat-section-header",
        role: "button",
        tabindex: "0",
        "aria-expanded": "true",
        title: __("toggle_section", "Plegar / desplegar sección"),
      },
      [titleWrap, badgesWrap],
    );

    const sectionEl = el(
      "div",
      { class: "plugin-chat-section", "data-section": key },
      [
        header,
        el("div", { class: "plugin-chat-section-body" }, [
          el("div", {
            class: "plugin-chat-empty",
            text: emptyText || __("no_conversations", "No hay conversaciones"),
          }),
        ]),
      ],
    );

    header.addEventListener("click", () => {
      toggleSectionCollapse(key);
    });

    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSectionCollapse(key);
      }
    });

    const collapsedMap = getCollapsedSections();
    if (collapsedMap[key]) {
      sectionEl.classList.add("is-collapsed");
      header.setAttribute("aria-expanded", "false");
    }

    return sectionEl;
  }

  // Scrolls to a section in the conversation list with highlight effect
  function goToSection(key) {
    if (!ui) return;
    if (
      ui.threadView.style.display !== "none" ||
      ui.newChatView.style.display !== "none"
    ) {
      showListView();
    }
    const sectionEl = ui.listView.querySelector('[data-section="' + key + '"]');
    if (!sectionEl) return;

    // Auto-expand section if it was collapsed so the user can see and select rows
    if (sectionEl.classList.contains("is-collapsed")) {
      setSectionCollapsed(key, false);
    }

    sectionEl.scrollIntoView({ block: "start", behavior: "smooth" });

    const headerEl = sectionEl.querySelector(".plugin-chat-section-header");
    if (headerEl) {
      headerEl.classList.remove("plugin-chat-section-flash");
      void headerEl.offsetWidth;
      headerEl.classList.add("plugin-chat-section-flash");
      setTimeout(
        () => headerEl.classList.remove("plugin-chat-section-flash"),
        900,
      );
    }

    const firstRow = sectionEl.querySelector(".plugin-chat-conv-row");
    if (firstRow) {
      setActiveRow(firstRow);
    }
  }

  // Returns all currently visible conversation and online user rows
  function getVisibleRows() {
    if (!ui) return [];
    return Array.from(
      ui.listView.querySelectorAll(".plugin-chat-conv-row"),
    ).filter((row) => {
      if (row.style.display === "none") return false;
      const sectionParent = row.closest(".plugin-chat-section");
      if (sectionParent && sectionParent.classList.contains("is-collapsed"))
        return false;
      return true;
    });
  }

  // Updates active row visual highlight and accessibility state
  function setActiveRow(row) {
    if (!ui) return;
    ui.listView
      .querySelectorAll(".plugin-chat-conv-row-active")
      .forEach((r) => {
        r.classList.remove("plugin-chat-conv-row-active");
      });
    if (!row) {
      keyboardActiveRowId = null;
      return;
    }
    row.classList.add("plugin-chat-conv-row-active");
    row.scrollIntoView({ block: "nearest" });
    keyboardActiveRowId = row.dataset.rowId || null;
  }

  // Moves active keyboard selection by delta
  function moveActiveRow(direction) {
    const rows = getVisibleRows();
    if (!rows.length) return;
    const currentIndex = rows.findIndex(
      (r) => r.dataset.rowId === keyboardActiveRowId,
    );
    const nextIndex =
      currentIndex === -1
        ? direction > 0
          ? 0
          : rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, currentIndex + direction));
    setActiveRow(rows[nextIndex]);
  }

  // Activates currently selected row
  function openActiveRow() {
    const row = getVisibleRows().find(
      (r) => r.dataset.rowId === keyboardActiveRowId,
    );
    if (row) row.click();
  }

  function reapplyActiveRowHighlight() {
    if (!keyboardActiveRowId || !ui) return;
    const row = getVisibleRows().find(
      (r) => r.dataset.rowId === keyboardActiveRowId,
    );
    if (row) {
      row.classList.add("plugin-chat-conv-row-active");
    } else {
      keyboardActiveRowId = null;
    }
  }

  // Switches to the list view (if needed - the search field is hidden
  // in the other two views, see showNewChatView()/showThreadView())
  // and focuses it - Ctrl+Alt+F (see init()).
  function focusListSearch() {
    if (!ui) return;
    if (
      ui.threadView.style.display !== "none" ||
      ui.newChatView.style.display !== "none"
    ) {
      showListView();
    }
    ui.search.focus();
  }

  // ---------- state / rendering ----------

  let ui = null;

  // Synchronizes chat panel header height with GLPI's native top navbar (+1px to match native border alignment)
  function syncHeaderHeight() {
    try {
      const glpiHeader = document.querySelector(
        'header.navbar.sticky-lg-top, header.navbar, header[data-testid="main-header"], .navbar.topbar'
      );
      if (glpiHeader) {
        const rect = glpiHeader.getBoundingClientRect();
        if (rect && rect.height > 0) {
          const h = Math.round(rect.height) + 1;
          document.documentElement.style.setProperty(
            "--chat-header-height",
            h + "px"
          );
        }
      }
    } catch (e) {
      // Graceful fallback to CSS default
    }
  }

  // Adjusts page body margin when chat panel is docked/pinned
  function applyPinnedLayout(panelIsOpen) {
    if (panelIsOpen && panelPinned) {
      document.body.classList.add("plugin-chat-pinned-active");
      document.body.style.marginRight = currentPanelWidthPx + "px";
      syncHeaderHeight();
    } else {
      document.body.classList.remove("plugin-chat-pinned-active");
      document.body.style.marginRight = "";
    }
  }

  function applyPinnedState() {
    if (!ui) return;
    ui.panel.classList.toggle("is-pinned", panelPinned);
    const pinBtn = ui.panel.querySelector(".plugin-chat-pin-btn");
    if (pinBtn) {
      pinBtn.classList.toggle("is-active", panelPinned);
      pinBtn.title = panelPinned
        ? __("unpin_panel", "Desfijar panel")
        : __("pin_panel", "Fijar el chat");
    }
    try {
      localStorage.setItem("plugin_chat_pinned", panelPinned ? "1" : "0");
    } catch (e) {
      // Private browsing / storage disabled for this origin - the
      // preference just won't survive a reload; no functional harm
      // to the current session either way.
    }
    const panelOpen = ui.panel.style.display !== "none";
    // Pinned: never show the dimming backdrop - this is a permanent
    // docked sidebar now, not a dismissible overlay, and there's
    // nothing to click "outside" of to close it anymore.
    ui.backdrop.style.display = panelOpen && !panelPinned ? "block" : "none";
    applyPinnedLayout(panelOpen);
  }

  function togglePanel() {
    if (!ui) return;
    closeReceiptsPanel();
    closeShortcutsPanel();
    closeEmojiPicker();
    setActiveRow(null);
    if (ui.shortcutMenu) closeShortcutMenu(ui.shortcutMenu);
    const visible = ui.panel.style.display !== "none";
    ui.panel.style.display = visible ? "none" : "flex";
    // Pinned: never show the dimming backdrop, opening or closing -
    // see applyPinnedState() for why.
    ui.backdrop.style.display = !visible && !panelPinned ? "block" : "none";
    applyPinnedLayout(!visible);
    if (ui.shortcutBtn) {
      // Open (about to become visible=false -> now shown): dock into
      // the header. Closing: float back above the launcher.
      setShortcutButtonDocked(ui.shortcutBtn, ui.header, !visible);
    }
    if (!visible) {
      // Opening.
      syncHeaderHeight();
      showListView();
      resumeAllPolling();
    } else {
      // Closing.
      if (currentConversation && lastTypingSentTime > 0) {
        sendTypingPing(false);
      }
      lastTypingSentTime = 0;
      stopAllPolling();
    }
  }

  function showListView() {
    if (!ui) return;
    if (currentConversation && lastTypingSentTime > 0) {
      sendTypingPing(false);
    }
    lastTypingSentTime = 0;
    updateTypingIndicator([]);

    if (ui.headerList) ui.headerList.style.display = "flex";
    if (ui.headerThread) ui.headerThread.style.display = "none";
    if (ui.headerNew) ui.headerNew.style.display = "none";

    const starBtn = ui.header && ui.header.querySelector(".plugin-chat-star");
    if (starBtn) starBtn.style.display = "none";
    const newBtn = ui.header && ui.header.querySelector(".plugin-chat-new");
    if (newBtn) newBtn.style.display = "";
    const threadCloseBtn =
      ui.header && ui.header.querySelector(".plugin-chat-thread-close-btn");
    if (threadCloseBtn) threadCloseBtn.style.display = "none";

    ui.listView.style.display = "block";
    ui.newChatView.style.display = "none";
    ui.threadView.style.display = "none";
    ui.search.style.display = "block";
    stopMessagesPolling();
    closeReceiptsPanel();
    closeEmojiPicker();
    closeMentionSuggestions();
    closeEmojiSuggestions();
    clearPendingAttachment();
    currentConversation = null;
  }

  function showNewChatView() {
    if (!ui) return;
    if (currentConversation && lastTypingSentTime > 0) {
      sendTypingPing(false);
    }
    lastTypingSentTime = 0;
    updateTypingIndicator([]);

    setActiveRow(null);
    closeEmojiPicker();
    closeEmojiSuggestions();
    clearPendingAttachment();

    if (ui.headerList) ui.headerList.style.display = "none";
    if (ui.headerThread) ui.headerThread.style.display = "none";
    if (ui.headerNew) ui.headerNew.style.display = "flex";

    const starBtn = ui.header && ui.header.querySelector(".plugin-chat-star");
    if (starBtn) starBtn.style.display = "none";
    const newBtn = ui.header && ui.header.querySelector(".plugin-chat-new");
    if (newBtn) newBtn.style.display = "none";
    const threadCloseBtn =
      ui.header && ui.header.querySelector(".plugin-chat-thread-close-btn");
    if (threadCloseBtn) threadCloseBtn.style.display = "";

    ui.listView.style.display = "none";
    ui.newChatView.style.display = "block";
    ui.threadView.style.display = "none";
    ui.search.style.display = "none";

    const userSearch = ui.newChatView.querySelector(".plugin-chat-user-search");
    if (userSearch) {
      setTimeout(() => userSearch.focus(), 0);
    }
  }

  function showThreadView(conv) {
    if (!ui) return;
    if (
      currentConversation &&
      currentConversation.id &&
      currentConversation.id !== conv.id &&
      lastTypingSentTime > 0
    ) {
      sendTypingPing(false);
    }
    lastTypingSentTime = 0;
    updateTypingIndicator([]);

    setActiveRow(null);
    clearPendingAttachment();

    if (ui.headerList) ui.headerList.style.display = "none";
    if (ui.headerThread) ui.headerThread.style.display = "flex";
    if (ui.headerNew) ui.headerNew.style.display = "none";

    const newBtn = ui.header && ui.header.querySelector(".plugin-chat-new");
    if (newBtn) newBtn.style.display = "none";
    const threadCloseBtn =
      ui.header && ui.header.querySelector(".plugin-chat-thread-close-btn");
    if (threadCloseBtn) threadCloseBtn.style.display = "";

    ui.listView.style.display = "none";
    ui.newChatView.style.display = "none";
    ui.threadView.style.display = "flex";
    ui.search.style.display = "none";

    currentConversation = conv;
    lastMessageId = 0;
    renderedMessageIds = new Set();
    lastRenderedDayTimestamp = null;
    currentParticipants = null;
    messageReceiptEls = new Map();
    messageReactionEls = new Map();
    messageReactionsData = new Map();
    currentMentionableUsers = [];
    closeMentionSuggestions();
    closeEmojiSuggestions();
    closeReceiptsPanel();

    const titleEl = ui.panel.querySelector(".plugin-chat-thread-title");
    if (titleEl) {
      titleEl.textContent = conv.name;
      titleEl.title = conv.name;
    }
    const avatarEl = ui.panel.querySelector(".plugin-chat-thread-avatar");
    if (avatarEl) avatarEl.textContent = initialsFromName(conv.name);

    ui.threadView.querySelector(".plugin-chat-messages").innerHTML = "";

    const starBtn = ui.panel.querySelector(".plugin-chat-star");
    if (starBtn) {
      if (conv.id) {
        starBtn.style.display = "";
        renderStarButton(starBtn, !!conv.featured);
      } else {
        starBtn.style.display = "none";
      }
    }

    applyEmojiAvailability(conv);
    applyAttachmentAvailability(conv);

    const composerInput = ui.threadView.querySelector(".plugin-chat-input");
    const sendBtn = ui.threadView.querySelector(".plugin-chat-send");
    if (composerInput) composerInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    if (conv.id) {
      loadMessages(true);
      startMessagesPolling();
      api("messages.php", { action: "mark_read", conversation_id: conv.id });
    } else {
      stopMessagesPolling();
    }

    // Focuses the composer input once visible
    if (composerInput) {
      setTimeout(() => composerInput.focus(), 0);
    }
  }

  function renderStarButton(btn, featured) {
    if (!btn) return;
    btn.innerHTML = "";
    btn.appendChild(iconEl(featured ? "starFilled" : "starOutline"));
    btn.title = featured
      ? __("unstar_conversation", "Quitar de destacados")
      : __("star_conversation", "Destacar conversación");
    btn.classList.toggle("is-featured", featured);
  }

  function toggleFeatured(conv, onUpdated) {
    if (!conv || !conv.id) return;
    api("conversations.php", {
      action: "toggle_featured",
      conversation_id: conv.id,
    }).then((res) => {
      if (res.success) {
        conv.featured = res.featured;
        if (onUpdated) onUpdated(res.featured);
        refreshConversations();
      }
    });
  }

  function renderConversations(data) {
    if (!ui) return;
    let totalUnread = 0;
    let notifyUnread = 0;
    let notifyMentionUnread = 0;
    const emptyMap = {
      featured: __("no_featured", "No hay conversaciones destacadas"),
      group: __("no_groups", "No hay grupos"),
      private: __("no_private", "No hay conversaciones privadas"),
    };
    ["featured", "group", "private"].forEach((key) => {
      const sectionEl = ui.listView.querySelector(
        '[data-section="' + key + '"]',
      );
      if (!sectionEl) return;
      const body = sectionEl.querySelector(".plugin-chat-section-body");
      const badge = sectionEl.querySelector(".plugin-chat-section-badge");
      const unreadBadge = sectionEl.querySelector(
        ".plugin-chat-section-unread",
      );
      const items = data[key] || [];
      let sectionUnread = 0;

      body.innerHTML = "";
      if (items.length === 0) {
        body.appendChild(
          el("div", {
            class: "plugin-chat-empty",
            text:
              emptyMap[key] || __("no_conversations", "No hay conversaciones"),
          }),
        );
      } else {
        items.forEach((conv) => {
          const starBtn = el("button", {
            class: "plugin-chat-icon-btn plugin-chat-row-star",
            type: "button",
            title: conv.featured
              ? __("unstar_conversation", "Quitar de destacados")
              : __("star_conversation", "Destacar conversación"),
          });
          renderStarButton(starBtn, !!conv.featured);
          starBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFeatured(conv, (featured) =>
              renderStarButton(starBtn, featured),
            );
          });

          const nameChildren = [
            el("span", { class: "plugin-chat-conv-name", text: conv.name }),
          ];

          const right = el("span", { class: "plugin-chat-conv-row-right" });
          if (conv.unread > 0) {
            sectionUnread += conv.unread;
            right.appendChild(
              el("span", {
                class: "plugin-chat-conv-unread",
                text: String(conv.unread),
              }),
            );
          }
          right.appendChild(starBtn);

          const row = el(
            "div",
            {
              class: "plugin-chat-conv-row",
              "data-row-id": key + ":" + conv.id,
            },
            [
              el("div", { class: "plugin-chat-conv-name-wrap" }, nameChildren),
              right,
            ],
          );
          row.addEventListener("click", () => showThreadView(conv));
          body.appendChild(row);

          if (!currentConversation || conv.id !== currentConversation.id) {
            notifyUnread += conv.unread;
            // conv.mentioned only exists on group entries (see
            // ajax/conversations.php) - undefined everywhere
            // else, which is falsy and simply skipped here.
            if (conv.mentioned) {
              notifyMentionUnread += conv.unread;
            }
          }
        });
      }

      badge.textContent = String(items.length);
      const totalSecUnread =
        data[key + "_unread"] !== undefined
          ? data[key + "_unread"]
          : sectionUnread;
      if (unreadBadge) {
        if (totalSecUnread > 0) {
          unreadBadge.textContent = String(totalSecUnread);
          unreadBadge.style.display = "inline-block";
        } else {
          unreadBadge.style.display = "none";
        }
      }
      totalUnread += data[key + "_unread"] || sectionUnread || 0;
    });

    reapplyActiveRowHighlight();

    // Plays priority sound for mentions if new mentions arrived,
    // otherwise standard sound for unread messages if increased.
    if (conversationsLoadedOnce) {
      if (notifyMentionUnread > lastKnownMentionUnreadTotal) {
        playMentionSound();
      } else if (notifyUnread > lastKnownUnreadTotal) {
        playNotificationSound();
      }
    }
    lastKnownUnreadTotal = notifyUnread;
    lastKnownMentionUnreadTotal = notifyMentionUnread;
    conversationsLoadedOnce = true;

    ui.badge.textContent = String(totalUnread);
    ui.badge.style.display = totalUnread > 0 ? "inline-block" : "none";
  }

  function openPrivateChatWithUser(u) {
    api("conversations.php", {
      action: "find_private",
      target_id: u.id,
    })
      .then((res) => {
        if (res && res.id) {
          showThreadView({ id: res.id, name: u.name });
        } else {
          showThreadView({
            id: null,
            target_id: u.id,
            name: u.name,
            is_group: false,
            is_self: false,
            is_draft: true,
          });
        }
      })
      .catch((err) => {
        console.error("[chat] find_private failed", err);
        showThreadView({
          id: null,
          target_id: u.id,
          name: u.name,
          is_group: false,
          is_self: false,
          is_draft: true,
        });
      });
  }

  function renderOnlineUsers(users) {
    if (!ui) return;
    const sectionEl = ui.listView.querySelector('[data-section="online"]');
    if (!sectionEl) return;
    const body = sectionEl.querySelector(".plugin-chat-section-body");
    const badge = sectionEl.querySelector(".plugin-chat-section-badge");

    body.innerHTML = "";
    if (!users.length) {
      body.appendChild(
        el("div", {
          class: "plugin-chat-empty",
          text: __("no_online_users", "No hay nadie más en línea"),
        }),
      );
    } else {
      users.forEach((u) => {
        const row = el(
          "div",
          {
            class: "plugin-chat-conv-row plugin-chat-online-row",
            "data-row-id": "online:" + u.id,
          },
          [
            el("span", { class: "plugin-chat-online-dot" }),
            el("span", { class: "plugin-chat-conv-name", text: u.name }),
          ],
        );
        row.addEventListener("click", () => {
          openPrivateChatWithUser(u);
        });
        body.appendChild(row);
      });
    }
    badge.textContent = String(users.length);
    reapplyActiveRowHighlight();
  }

  function renderMessages(messages, append) {
    if (!ui) return;
    const box = ui.threadView.querySelector(".plugin-chat-messages");
    if (!append) {
      box.innerHTML = "";
      lastRenderedDayTimestamp = null;
    }

    const sortedMessages = messages.slice().sort((a, b) => {
      const idDiff = a.id - b.id;
      return idDiff !== 0 ? idDiff : a.date - b.date;
    });

    sortedMessages.forEach((m) => {
      lastMessageId = Math.max(lastMessageId, m.id);

      if (renderedMessageIds.has(m.id)) {
        return;
      }
      renderedMessageIds.add(m.id);

      const dayTimestamp = dayTimestampOf(m.date);
      if (
        dayTimestamp !== null &&
        (lastRenderedDayTimestamp === null ||
          dayTimestamp > lastRenderedDayTimestamp)
      ) {
        box.appendChild(
          el("div", { class: "plugin-chat-date-divider" }, [
            el("span", { text: formatDateDivider(m.date) }),
          ]),
        );
        lastRenderedDayTimestamp = dayTimestamp;
      }

      const receiptEl = m.mine
        ? el("span", { class: "plugin-chat-message-receipt is-sent" })
        : null;
      if (receiptEl) {
        receiptEl.innerHTML = ICONS.checkSingle;
      }

      const bubbleChildren = [];
      if (m.attachment) {
        if (m.attachment.is_image) {
          const img = el("img", {
            class: "plugin-chat-attachment-img",
            src: m.attachment.download_url,
            alt: m.attachment.filename,
            title: m.attachment.filename + " (" + m.attachment.formatted_size + ")",
            loading: "lazy",
          });
          img.addEventListener("click", (e) => {
            e.stopPropagation();
            openImagePreviewModal(m.attachment.download_url, m.attachment.filename);
          });
          bubbleChildren.push(
            el("div", { class: "plugin-chat-attachment-image-wrap" }, [img]),
          );
        } else {
          const docCard = el(
            "a",
            {
              class: "plugin-chat-attachment-card",
              href: m.attachment.download_url + "&download=1",
              target: "_blank",
              rel: "noopener,noreferrer",
              title: m.attachment.filename + " (" + m.attachment.formatted_size + ")",
            },
            [
              iconEl("file", "plugin-chat-attachment-file-icon"),
              el("div", { class: "plugin-chat-attachment-info" }, [
                el("span", {
                  class: "plugin-chat-attachment-name",
                  text: m.attachment.filename,
                }),
                el("span", {
                  class: "plugin-chat-attachment-size",
                  text: m.attachment.formatted_size,
                }),
              ]),
              iconEl("download", "plugin-chat-attachment-download-icon"),
            ],
          );
          bubbleChildren.push(docCard);
        }
      }

      const isDefaultPlaceholder =
        m.attachment && m.content === "📎 " + m.attachment.filename;
      if (m.content && !isDefaultPlaceholder) {
        bubbleChildren.push(renderMessageContent(m.content, currentMentionNames()));
      }

      const emojiOnlyCount =
        !m.attachment && !m.link_url && m.content
          ? getEmojiOnlyCount(m.content)
          : 0;
      let emojiClass = "";
      if (emojiOnlyCount === 1) {
        emojiClass = " is-single-emoji";
      } else if (emojiOnlyCount >= 2 && emojiOnlyCount <= 3) {
        emojiClass = " is-emoji-group";
      }

      const bubble = el(
        "div",
        {
          // 'has-link' - see the click handler right below.
          class:
            "plugin-chat-message " +
            (m.mine ? "mine" : "theirs") +
            (m.link_url ? " has-link" : "") +
            emojiClass,
        },
        bubbleChildren,
      );

      if (m.link_url) {
        bubble.addEventListener("click", () => {
          window.open(m.link_url, "_blank", "noopener,noreferrer");
        });
      }

      // Adds reaction button and hover actions
      const bubbleWrapChildren = [bubble];
      const canReact = reactionsFeatureEnabled && !m.mine;
      if (canReact) {
        const reactTrigger = el(
          "button",
          {
            class: "plugin-chat-react-trigger",
            type: "button",
            title: "Reaccionar",
          },
          [document.createTextNode(REACTION_EMOJI)],
        );
        reactTrigger.addEventListener("click", () => toggleReaction(m.id));
        bubbleWrapChildren.push(reactTrigger);
      }
      const bubbleWrap = el(
        "div",
        { class: "plugin-chat-bubble-wrap" },
        bubbleWrapChildren,
      );

      const reactionsRow = el("div", { class: "plugin-chat-reactions-row" });
      if (!canReact) {
        reactionsRow.classList.add("is-readonly");
      }
      messageReactionEls.set(m.id, reactionsRow);

      const meta = m.mine
        ? el("div", { class: "plugin-chat-message-meta" }, [
            el("span", {
              class: "plugin-chat-message-time",
              text: formatMessageTime(m.date),
            }),
            receiptEl,
          ])
        : el("div", { class: "plugin-chat-message-meta" }, [
            el("span", { class: "plugin-chat-message-author", text: m.author }),
            el("span", {
              class: "plugin-chat-message-time",
              text: formatMessageTime(m.date),
            }),
          ]);

      const col = el("div", { class: "plugin-chat-message-col" }, [
        meta,
        bubbleWrap,
        reactionsRow,
      ]);

      const row = el(
        "div",
        { class: "plugin-chat-message-row " + (m.mine ? "mine" : "theirs") },
        m.mine
          ? [col]
          : [avatarEl(m.author, "plugin-chat-message-avatar"), col],
      );

      box.appendChild(row);

      renderReactionsRow(m.id);

      if (m.mine && receiptEl) {
        messageReceiptEls.set(m.id, {
          date: m.date,
          users_id: m.users_id,
          el: receiptEl,
        });
      }

      // Binds right-click / contextmenu for message details panel
      const showReceipts = !!(
        m.mine &&
        currentConversation &&
        currentConversation.is_group
      );
      const showReactedBy = !!(m.mine && reactionsShowReactedBy);
      const canConvert = canShowTicketConversion(m);
      if (showReceipts || showReactedBy || canConvert) {
        bubble.classList.add("plugin-chat-has-receipts");
        bubble.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showReceiptsPanel(e, m, showReceipts, canConvert);
        });
      }
    });

    box.scrollTop = box.scrollHeight;
  }

  // ---------- read receipts ----------

  // Updates read receipt checkmark icons across all rendered messages
  function updateReadReceipts(participants) {
    currentParticipants = participants || null;

    messageReceiptEls.forEach((entry) => {
      if (!currentParticipants) {
        entry.el.style.display = "none";
        return;
      }

      // Computes read status indicator (sent, delivered, read)
      const others = currentParticipants.filter((p) => p.id !== entry.users_id);

      let state = "sent";
      if (others.length > 0) {
        const allRead = others.every(
          (p) => p.last_read && p.last_read >= entry.date,
        );
        const allDelivered = others.every(
          (p) =>
            (p.last_read && p.last_read >= entry.date) ||
            (p.last_seen && p.last_seen >= entry.date),
        );

        if (allRead) state = "read";
        else if (allDelivered) state = "delivered";
      }

      entry.el.style.display = "";
      entry.el.className = "plugin-chat-message-receipt is-" + state;
      entry.el.innerHTML =
        state === "sent" ? ICONS.checkSingle : ICONS.checkDouble;
    });
  }

  // ---------- reactions ----------

  function renderReactionsRow(id) {
    const rowEl = messageReactionEls.get(id);
    if (!rowEl) return;

    const data = messageReactionsData.get(id) || [];
    rowEl.innerHTML = "";

    if (!data.length) {
      rowEl.style.display = "none";
      return;
    }

    // Read-only on your own messages (see renderMessages) - the
    // pills still show who reacted and how many, just without a
    // click handler to toggle anything.
    const readonly = rowEl.classList.contains("is-readonly");

    rowEl.style.display = "flex";
    data.forEach((r) => {
      const pill = el("button", {
        type: "button",
        class: "plugin-chat-reaction-pill" + (r.mine ? " mine" : ""),
        title: readonly ? "" : r.mine ? "Quitar tu reacción" : "Reaccionar",
      });
      pill.appendChild(document.createTextNode(r.emoji + " "));
      pill.appendChild(
        el("span", {
          class: "plugin-chat-reaction-count",
          text: String(r.count),
        }),
      );
      if (readonly) {
        pill.disabled = true;
      } else {
        pill.addEventListener("click", () => toggleReaction(id));
      }
      rowEl.appendChild(pill);
    });
  }

  // Updates reaction pills from polling response
  function applyReactionsFromPoll(reactionsByMessageId) {
    const map = reactionsByMessageId || {};
    messageReactionEls.forEach((rowEl, id) => {
      messageReactionsData.set(id, map[id] || []);
      renderReactionsRow(id);
    });
  }

  // Toggles reaction on a message with optimistic UI update
  function toggleReaction(id) {
    if (!reactionsFeatureEnabled) return;

    const previous = messageReactionsData.get(id) || [];
    const existing = previous.find((r) => r.emoji === REACTION_EMOJI);

    let next;
    if (existing && existing.mine) {
      next = previous
        .map((r) =>
          r.emoji === REACTION_EMOJI
            ? { ...r, mine: false, count: Math.max(0, r.count - 1) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else if (existing) {
      next = previous.map((r) =>
        r.emoji === REACTION_EMOJI
          ? { ...r, mine: true, count: r.count + 1 }
          : r,
      );
    } else {
      next = previous.concat([{ emoji: REACTION_EMOJI, count: 1, mine: true }]);
    }

    messageReactionsData.set(id, next);
    renderReactionsRow(id);

    api("messages.php", {
      action: "toggle_reaction",
      conversation_id: currentConversation ? currentConversation.id : 0,
      message_id: id,
    })
      .then((res) => {
        if (!res || !res.success) {
          // The write failed server-side - roll back immediately
          // instead of leaving the optimistic state up for a couple
          // more seconds until the next poll silently corrects it.
          console.error("[chat] reaction toggle failed", res);
          messageReactionsData.set(id, previous);
          renderReactionsRow(id);
        }
      })
      .catch((err) => {
        console.error("[chat] reaction toggle request failed", err);
        messageReactionsData.set(id, previous);
        renderReactionsRow(id);
      });
  }

  // ---------- keyboard shortcuts panel ----------

  function getShortcutsList() {
    return [
      ["Ctrl + Alt + .", __("shortcut_open_close", "Abrir / cerrar el chat")],
      ["Esc", __("shortcut_esc", "Volver al nivel anterior / cerrar")],
      ["Ctrl + Alt + F", __("shortcut_search", "Enfocar el campo Búsqueda")],
      ["Ctrl + Alt + 1", __("shortcut_nav_online", "Ir a En línea")],
      ["Ctrl + Alt + 2", __("shortcut_nav_featured", "Ir a Destacados")],
      ["Ctrl + Alt + 3", __("shortcut_nav_groups", "Ir a Grupo")],
      ["Ctrl + Alt + 4", __("shortcut_nav_private", "Ir a Privado")],
      ["↑ / ↓", __("shortcut_arrow_nav", "Navegar la lista")],
      [
        "Enter",
        __("shortcut_enter_open", "Abrir la conversación seleccionada"),
      ],
      ["Ctrl + Alt + ? (o H)", __("shortcut_show_panel", "Mostrar este panel")],
    ];
  }

  let shortcutsPanelEl = null;

  function closeShortcutsPanel() {
    if (shortcutsPanelEl) {
      shortcutsPanelEl.remove();
      shortcutsPanelEl = null;
      document.removeEventListener(
        "mousedown",
        onShortcutsPanelOutsideClick,
        true,
      );
    }
  }

  function onShortcutsPanelOutsideClick(e) {
    if (shortcutsPanelEl && !shortcutsPanelEl.contains(e.target)) {
      closeShortcutsPanel();
    }
  }

  // Centered overlay (unlike the receipts panel, this isn't anchored to
  // a click point - it opens the same way whether triggered by the
  // keyboard combo or by clicking the composer hint).
  function openShortcutsPanel() {
    closeShortcutsPanel();

    const rows = getShortcutsList().map(([combo, label]) =>
      el("div", { class: "plugin-chat-shortcuts-row" }, [
        el("kbd", { class: "plugin-chat-shortcuts-key", text: combo }),
        el("span", { class: "plugin-chat-shortcuts-label", text: label }),
      ]),
    );

    shortcutsPanelEl = el("div", { class: "plugin-chat-shortcuts-panel" }, [
      el("div", { class: "plugin-chat-shortcuts-panel-header" }, [
        el("span", {
          class: "plugin-chat-shortcuts-panel-title",
          text: __("shortcuts_title", "Atajos de teclado"),
        }),
        el(
          "button",
          {
            class: "plugin-chat-icon-btn plugin-chat-shortcuts-close",
            type: "button",
            title: __("close", "Cerrar"),
          },
          [iconEl("close")],
        ),
      ]),
      el("div", { class: "plugin-chat-shortcuts-list" }, rows),
    ]);

    document.body.appendChild(shortcutsPanelEl);
    shortcutsPanelEl
      .querySelector(".plugin-chat-shortcuts-close")
      .addEventListener("click", closeShortcutsPanel);

    setTimeout(() => {
      document.addEventListener(
        "mousedown",
        onShortcutsPanelOutsideClick,
        true,
      );
    }, 0);
  }

  function toggleShortcutsPanel() {
    if (shortcutsPanelEl) {
      closeShortcutsPanel();
    } else {
      openShortcutsPanel();
    }
  }

  function closeReceiptsPanel() {
    if (receiptsPanelEl) {
      receiptsPanelEl.remove();
      receiptsPanelEl = null;
      document.removeEventListener(
        "mousedown",
        onReceiptsPanelOutsideClick,
        true,
      );
    }
  }

  function onReceiptsPanelOutsideClick(e) {
    if (receiptsPanelEl && !receiptsPanelEl.contains(e.target)) {
      closeReceiptsPanel();
    }
  }

  // Shows receipts and reactions detail panel on message right-click
  function showReceiptsPanel(event, m, showReceipts, canConvert) {
    closeReceiptsPanel();

    const sections = [];

    function section(title, names, enabled) {
      if (!enabled || !names.length) return null;
      const children = [
        el("div", { class: "plugin-chat-receipts-section-title", text: title }),
      ];
      names.forEach((n) =>
        children.push(
          el("div", { class: "plugin-chat-receipts-name", text: n }),
        ),
      );
      return el("div", { class: "plugin-chat-receipts-section" }, children);
    }

    function reposition() {
      if (!receiptsPanelEl) return;
      const rect = receiptsPanelEl.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width - 8;
      const maxTop = window.innerHeight - rect.height - 8;
      receiptsPanelEl.style.left =
        Math.min(event.clientX, Math.max(8, maxLeft)) + "px";
      receiptsPanelEl.style.top =
        Math.min(event.clientY, Math.max(8, maxTop)) + "px";
    }

    // Always first in the panel, per how this was asked for - above
    // "Leído por" / "No leído por" / everything else.
    const alreadyConverted = messageTicketMap.get(m.id);
    if (alreadyConverted) {
      const link = el("a", {
        class: "plugin-chat-ticket-link",
        text:
          "🎫 " +
          __("already_converted", "Ya convertido → Ticket #") +
          alreadyConverted.tickets_id,
        href: ticketUrl(alreadyConverted.tickets_id),
        target: "_blank",
        rel: "noopener noreferrer",
      });
      sections.push(
        el("div", { class: "plugin-chat-receipts-section" }, [link]),
      );
    } else if (canConvert) {
      sections.push(buildTicketConversionSection(m, reposition));
    }

    if (showReceipts && currentParticipants && currentParticipants.length) {
      // Groups participants into read, delivered, and sent categories
      const others = currentParticipants.filter((p) => p.id !== m.users_id);
      const read = [];
      const delivered = [];
      const sentOnly = [];
      others.forEach((p) => {
        if (p.last_read && p.last_read >= m.date) {
          read.push(p.name);
        } else if (p.last_seen && p.last_seen >= m.date) {
          delivered.push(p.name);
        } else {
          sentOnly.push(p.name);
        }
      });
      // Anyone in the group who hasn't read the message yet,
      // regardless of whether it's reached their device - shown as
      // a single quick overview list above the detailed breakdown.
      const notRead = delivered.concat(sentOnly);

      sections.push(
        section(
          __("not_read_by", "No leído por"),
          notRead,
          receiptSectionsEnabled.receipts_show_not_read,
        ),
        section(
          __("read_by", "Leído por"),
          read,
          receiptSectionsEnabled.receipts_show_read,
        ),
        section(
          __("delivered_to", "Entregado (no leído)"),
          delivered,
          receiptSectionsEnabled.receipts_show_delivered,
        ),
        section(
          __("sent_to", "Enviado (no entregado)"),
          sentOnly,
          receiptSectionsEnabled.receipts_show_sent,
        ),
      );
    }

    if (m.mine && reactionsShowReactedBy) {
      const reactionNames = (messageReactionsData.get(m.id) || []).flatMap(
        (r) => r.names || [],
      );
      sections.push(
        section(__("reacted_by", "Reaccionado por"), reactionNames, true),
      );
    }

    const visibleSections = sections.filter((s) => s !== null);
    if (!visibleSections.length) {
      visibleSections.push(
        el("div", {
          class: "plugin-chat-receipts-empty",
          text: __("no_info_yet", "Sin información todavía"),
        }),
      );
    }

    receiptsPanelEl = el(
      "div",
      { class: "plugin-chat-receipts-panel" },
      visibleSections,
    );
    document.body.appendChild(receiptsPanelEl);

    reposition();

    setTimeout(() => {
      document.addEventListener("mousedown", onReceiptsPanelOutsideClick, true);
    }, 0);
  }

  // The "Convertir en ticket" row: opens an inline category picker or converts directly.
  function buildTicketConversionSection(m, reposition) {
    const container = el("div", {
      class: "plugin-chat-receipts-section plugin-chat-ticket-convert",
    });
    const trigger = el("button", {
      type: "button",
      class: "plugin-chat-ticket-convert-btn",
      text: "🎫 " + __("convert_to_ticket", "Convertir en ticket"),
    });
    container.appendChild(trigger);

    const categories = ticketConversion.categories || [];
    let categoryList = null;

    if (categories.length) {
      categoryList = el("div", {
        class: "plugin-chat-ticket-categories",
        style: "display:none",
      });
      categories.forEach((cat) => {
        const catBtn = el("button", {
          type: "button",
          class: "plugin-chat-ticket-category-btn",
          text: cat.name,
        });
        catBtn.addEventListener("click", () =>
          openPrefilledTicketForm(m, cat.id),
        );
        categoryList.appendChild(catBtn);
      });
      container.appendChild(categoryList);
    }

    trigger.addEventListener("click", () => {
      if (!categoryList) {
        openPrefilledTicketForm(m, 0);
        return;
      }
      const opening = categoryList.style.display === "none";
      categoryList.style.display = opening ? "block" : "none";
      if (opening) reposition();
    });

    return container;
  }

  function openPrefilledTicketForm(m, categoryId) {
    const params = new URLSearchParams();
    let text = m.content || "";
    if (
      m.attachment &&
      m.attachment.filename &&
      (!text || !text.includes(m.attachment.filename))
    ) {
      text += (text ? "\n\n" : "") + "📎 " + m.attachment.filename;
    }
    params.set("ticket[description]", text);
    params.set("ticket[title]", "Ticket desde Chat: " + (text.length > 40 ? text.substring(0, 40) + "..." : text));
    if (categoryId) {
      params.set("ticket[ticket_category_id]", categoryId);
    }
    window.open("/tickets/new?" + params.toString(), "_blank");
    closeReceiptsPanel();
  }

  // ---------- data loading ----------

  function refreshOnlineUsers() {
    api("presence.php", { action: "online_users" }).then((data) => {
      if (!data.error) renderOnlineUsers(data.users || []);
    });
  }

  function refreshConversations() {
    api("conversations.php", { action: "list" }).then((data) => {
      if (!data.error) renderConversations(data);
    });
  }

  function loadMessages(initial) {
    if (!currentConversation || !currentConversation.id) return;
    api("messages.php", {
      action: "list",
      conversation_id: currentConversation.id,
      since_id: initial ? 0 : lastMessageId,
    })
      .then((data) => {
        if (data.error) return;

        // Refreshes participant list, receipts, reactions, and mentions data
        if (
          data.receipt_sections &&
          Object.keys(data.receipt_sections).length
        ) {
          receiptSectionsEnabled = data.receipt_sections;
        }
        currentMentionableUsers = data.mentionable_users || [];

        if (data.messages && data.messages.length) {
          const newFromOthers = initial
            ? []
            : data.messages.filter(
                (m) => !m.mine && !renderedMessageIds.has(m.id),
              );
          renderMessages(data.messages, !initial);
          if (newFromOthers.length) {
            const mentioned = newFromOthers.some((m) =>
              messageMentionsMe(m.content),
            );
            if (mentioned) {
              playMentionSound();
            } else {
              playNotificationSound();
            }
          }
        }

        updateReadReceipts(
          Object.prototype.hasOwnProperty.call(data, "participants")
            ? data.participants
            : null,
        );

        applyReactionsFromPoll(data.reactions);
        reactionsShowReactedBy = !!data.reactions_show_reacted_by;

        messageTicketMap = new Map();
        if (data.ticket_conversions) {
          Object.keys(data.ticket_conversions).forEach((id) => {
            messageTicketMap.set(Number(id), data.ticket_conversions[id]);
          });
        }

        updateTypingIndicator(data.typing_users || []);
      })
      .catch((err) => {
        console.error("[chat] loadMessages failed", err);
      });
  }

  // Vendor assets base path for emoji-picker-element
  const VENDOR_BASE =
    (window.CFG_GLPI && CFG_GLPI.root_doc ? CFG_GLPI.root_doc : "") +
    "/plugins/chat/public/js/vendor/";

  // Maps conversation to its type key ('group' | 'self' | 'private')
  function conversationTypeOf(conv) {
    if (!conv) return null;
    if (conv.is_group) return "group";
    if (conv.is_self) return "self";
    return "private";
  }

  // Determines whether emoji feature is permitted for given/current conversation
  function isEmojiFeatureActive(conv) {
    const targetConv = conv || currentConversation;
    if (!targetConv) return false;
    const type = conversationTypeOf(targetConv);
    return (
      emojiEntityEnabled &&
      emojiIndexedDBAvailable &&
      type !== null &&
      emojiAllowedConversationTypes.indexOf(type) !== -1
    );
  }

  // Determines whether emoji picker is enabled for current conversation
  function applyEmojiAvailability(conv) {
    if (!ui) return;
    const composer = ui.threadView.querySelector(".plugin-chat-composer");
    const emojiBtn = ui.threadView.querySelector(".plugin-chat-emoji-btn");
    if (!composer || !emojiBtn) return;

    const shouldShow = isEmojiFeatureActive(conv);

    emojiBtn.style.display = shouldShow ? "inline-flex" : "none";
    composer.classList.toggle("no-emoji", !shouldShow);

    if (!shouldShow) {
      closeEmojiPicker();
      closeEmojiSuggestions();
    }
  }

  // Determines whether attachment upload button is enabled for current conversation
  function applyAttachmentAvailability(conv) {
    if (!ui) return;
    const attachBtn = ui.threadView.querySelector(".plugin-chat-attach-btn");
    if (!attachBtn) return;

    const type = conversationTypeOf(conv);
    const shouldShow =
      attachmentFeatureEnabled &&
      type !== null &&
      attachmentAllowedConversationTypes.indexOf(type) !== -1;

    attachBtn.style.display = shouldShow ? "inline-flex" : "none";
    if (!shouldShow) {
      clearPendingAttachment();
    }
  }

  function stageAttachmentFile(file) {
    if (!file || !ui) return;

    if (file.size > attachmentMaxSizeBytes) {
      const errTemplate = __(
        "file_too_large",
        "El archivo supera el tamaño máximo permitido (%s).",
      );
      alert(errTemplate.replace("%s", attachmentMaxSizeMb + " MB"));
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    if (
      attachmentAllowedExtensions.length > 0 &&
      attachmentAllowedExtensions.indexOf(ext) === -1
    ) {
      alert(__("file_type_not_allowed", "Tipo de archivo no permitido."));
      return;
    }

    pendingAttachmentFile = file;

    const stagedWrap = ui.threadView.querySelector(
      ".plugin-chat-staged-attachment",
    );
    if (stagedWrap) {
      const nameEl = stagedWrap.querySelector(".plugin-chat-staged-file-name");
      const sizeEl = stagedWrap.querySelector(".plugin-chat-staged-file-size");
      if (nameEl) {
        nameEl.textContent = file.name;
        nameEl.title = file.name;
      }
      if (sizeEl) sizeEl.textContent = formatBytes(file.size);
      stagedWrap.style.display = "flex";
    }

    const input = ui.threadView.querySelector(".plugin-chat-input");
    if (input) input.focus();
  }

  function clearPendingAttachment() {
    pendingAttachmentFile = null;
    if (!ui) return;
    const fileInput = ui.threadView.querySelector(".plugin-chat-file-input");
    if (fileInput) fileInput.value = "";
    const stagedWrap = ui.threadView.querySelector(
      ".plugin-chat-staged-attachment",
    );
    if (stagedWrap) stagedWrap.style.display = "none";
  }

  function formatBytes(bytes) {
    if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + " MB";
    }
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function openImagePreviewModal(url, filename) {
    const existing = document.querySelector(".plugin-chat-lightbox");
    if (existing) existing.remove();

    const lightbox = el("div", { class: "plugin-chat-lightbox" }, [
      el("div", { class: "plugin-chat-lightbox-content" }, [
        el(
          "button",
          {
            class: "plugin-chat-lightbox-close",
            type: "button",
            title: __("close", "Cerrar"),
          },
          [iconEl("close")],
        ),
        el("img", { src: url, alt: filename || "" }),
        el("div", {
          class: "plugin-chat-lightbox-caption",
          text: filename || "",
        }),
      ]),
    ]);

    lightbox.addEventListener("click", (e) => {
      if (e.target.tagName !== "IMG") {
        lightbox.remove();
      }
    });
    document.body.appendChild(lightbox);
  }

  async function uploadAttachmentAndSend(convId, textContent, file) {
    if (!ui) return;
    const formData = new FormData();
    formData.append("action", "send_file");
    formData.append("conversation_id", String(convId));
    formData.append("content", textContent);
    formData.append("file", file);
    if (csrfToken) {
      formData.append("_chat_csrf", csrfToken);
    }
    if (glpiCsrfToken) {
      formData.append("_glpi_csrf_token", glpiCsrfToken);
    }

    const sendBtn = ui.threadView.querySelector(".plugin-chat-send");
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    try {
      const url = new URL(AJAX_BASE + "messages.php", window.location.origin);
      const resp = await fetch(url.toString(), {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const res = await resp.json();
      if (res && res.success && res.id) {
        clearPendingAttachment();
        const nowTs = Math.floor(Date.now() / 1000);
        renderMessages(
          [
            {
              id: res.id,
              mine: true,
              author: "",
              content: textContent || ("📎 " + file.name),
              attachment: res.attachment || null,
              date: nowTs,
            },
          ],
          true,
        );
      } else {
        console.error("[chat] attachment upload failed", res);
        const input = ui.threadView.querySelector(".plugin-chat-input");
        if (input && textContent && !input.value) {
          input.value = textContent;
          autoResizeInput(input);
        }
        let errMsg = __("message_send_failed", "No se pudo enviar el archivo.");
        if (res && res.error === "file_too_large") {
          errMsg = __(
            "file_too_large",
            "El archivo supera el tamaño máximo permitido (%s).",
          ).replace("%s", attachmentMaxSizeMb + " MB");
        } else if (res && res.error === "file_extension_not_allowed") {
          errMsg = __("file_type_not_allowed", "Tipo de archivo no permitido.");
        } else if (res && res.error === "attachments_not_allowed_for_conversation_type") {
          errMsg = __(
            "attachments_not_allowed_for_conv",
            "Los archivos adjuntos no están habilitados para este tipo de conversación. Verifica la configuración en Plugins > Chat y guarda los cambios.",
          );
        } else if (res && res.error === "forbidden") {
          errMsg = __(
            "forbidden_conversation",
            "No tienes permiso para acceder o enviar archivos en esta conversación.",
          );
        } else if (res && res.error === "attachments_disabled") {
          errMsg = __(
            "attachments_disabled",
            "Los archivos adjuntos están desactivados en la configuración del plugin.",
          );
        } else if (res && res.error) {
          errMsg = __("message_send_failed", "No se pudo enviar el archivo.") + " (" + res.error + ")";
        }
        alert(errMsg);
      }
    } catch (err) {
      console.error("[chat] upload network error", err);
      const input = ui.threadView.querySelector(".plugin-chat-input");
      if (input && textContent && !input.value) {
        input.value = textContent;
        autoResizeInput(input);
      }
      alert(__("message_send_failed", "No se pudo enviar el archivo."));
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
      }
    }
  }

  function isGLPIDarkTheme() {
    const doc = document.documentElement;
    const body = document.body;
    if (
      (doc && (doc.getAttribute("data-glpi-theme-dark") === "1" || doc.classList.contains("vh-dark-mode") || doc.classList.contains("dark"))) ||
      (body && (body.classList.contains("vh-dark-mode") || body.classList.contains("dark") || body.classList.contains("theme-dark")))
    ) return true;
    const glpiTheme = (
      (doc && doc.getAttribute("data-glpi-theme")) ||
      (body && body.getAttribute("data-glpi-theme")) ||
      ""
    ).toLowerCase();
    if (["dark", "darker", "auror_dark", "midnight"].includes(glpiTheme)) return true;
    if (
      (doc && doc.getAttribute("data-bs-theme") === "dark") ||
      (body && body.getAttribute("data-bs-theme") === "dark")
    ) return true;
    if (
      (doc && doc.getAttribute("data-theme") === "dark") ||
      (body && body.getAttribute("data-theme") === "dark")
    ) return true;
    return false;
  }

  function syncDarkTheme() {
    const isDark = isGLPIDarkTheme();
    if (ui && ui.panel) {
      ui.panel.classList.toggle("chat-dark-theme", isDark);
      ui.panel.setAttribute("data-bs-theme", isDark ? "dark" : "light");
    }
    if (ui && ui.launcher) {
      ui.launcher.classList.toggle("chat-dark-theme", isDark);
      ui.launcher.setAttribute("data-bs-theme", isDark ? "dark" : "light");
    }
    if (ui && ui.backdrop) {
      ui.backdrop.classList.toggle("chat-dark-theme", isDark);
    }
    if (emojiPickerEl) {
      emojiPickerEl.classList.toggle("dark", isDark);
    }
  }

  // Loads and inserts the emoji picker custom element
  async function loadEmojiPicker() {
    if (!emojiPickerModuleLoaded) {
      await import(VENDOR_BASE + "emoji-picker-element/picker.js");
      emojiPickerModuleLoaded = true;
    }

    if (!emojiPickerEl) {
      emojiPickerEl = document.createElement("emoji-picker");
      // Our own vendored Spanish (CLDR) dataset - NOT the
      // library's jsDelivr CDN default, which this GLPI instance
      // may have no route to at all. See NOTICE.md.
      emojiPickerEl.setAttribute(
        "data-source",
        VENDOR_BASE + "emoji-picker-element-data/es-cldr-data.json",
      );
      emojiPickerEl.setAttribute("locale", "es");
      emojiPickerEl.classList.add("plugin-chat-emoji-picker");
      emojiPickerEl.classList.toggle("dark", isGLPIDarkTheme());
      emojiPickerEl.style.setProperty(
        "--indicator-color",
        "var(--chat-bubble-color, var(--chat-teal))",
      );
      document.body.appendChild(emojiPickerEl);

      emojiPickerEl.addEventListener("emoji-click", (event) => {
        insertEmojiIntoComposer(event.detail.unicode);
        closeEmojiPicker();
      });
    }

    return emojiPickerEl;
  }

  // Returns or initializes the cached Database instance for querying emojis
  async function getEmojiDatabase() {
    if (!emojiDatabasePromise) {
      emojiDatabasePromise = (async () => {
        try {
          const picker = await loadEmojiPicker();
          return picker && picker.database ? picker.database : null;
        } catch (err) {
          console.warn("[chat] failed to initialize emoji database", err);
          return null;
        }
      })();
    }
    return emojiDatabasePromise;
  }

  // Inserts emoji character at cursor position in composer input
  function insertEmojiIntoComposer(unicode) {
    if (!ui) return;
    const input = ui.threadView.querySelector(".plugin-chat-input");
    if (!input) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value =
      input.value.slice(0, start) + unicode + input.value.slice(end);

    const cursor = start + unicode.length;
    input.focus();
    input.setSelectionRange(cursor, cursor);
    autoResizeInput(input);
  }

  // Positions emoji picker popover
  function positionEmojiPicker(triggerBtn) {
    if (!emojiPickerEl || !triggerBtn) return;
    emojiPickerEl.classList.toggle("dark", isGLPIDarkTheme());
    const rect = triggerBtn.getBoundingClientRect();
    const pickerWidth = 320;
    const pickerHeight = 360;
    const left = Math.max(
      8,
      Math.min(rect.right - pickerWidth, window.innerWidth - pickerWidth - 8),
    );
    const top = Math.max(8, rect.top - pickerHeight - 8);
    emojiPickerEl.style.left = left + "px";
    emojiPickerEl.style.top = top + "px";
    emojiPickerEl.style.display = "block";
  }

  function closeEmojiPicker() {
    if (emojiPickerEl) {
      emojiPickerEl.style.display = "none";
    }
    document.removeEventListener("mousedown", onEmojiPickerOutsideClick, true);
  }

  function onEmojiPickerOutsideClick(e) {
    if (!emojiPickerEl || emojiPickerEl.style.display === "none") return;
    if (emojiPickerEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".plugin-chat-emoji-btn")) return;
    closeEmojiPicker();
  }

  // Toggles emoji picker popover
  function toggleEmojiPicker(triggerBtn) {
    if (emojiPickerEl && emojiPickerEl.style.display !== "none") {
      closeEmojiPicker();
      return;
    }

    loadEmojiPicker().then((picker) => {
      positionEmojiPicker(triggerBtn);
      setTimeout(() => {
        document.addEventListener("mousedown", onEmojiPickerOutsideClick, true);
      }, 0);
    });
  }

  function ensureActiveConversation(onReady) {
    if (currentConversation && currentConversation.id) {
      onReady(currentConversation.id);
      return;
    }
    if (!currentConversation || !currentConversation.target_id) {
      return;
    }
    api("conversations.php", {
      action: "create_private",
      target_id: currentConversation.target_id,
    })
      .then((res) => {
        if (res && res.id) {
          currentConversation.id = res.id;
          currentConversation.is_draft = false;
          const starBtn = ui.panel.querySelector(".plugin-chat-star");
          if (starBtn) {
            starBtn.style.display = "";
            renderStarButton(starBtn, !!currentConversation.featured);
          }
          startMessagesPolling();
          refreshConversations();
          onReady(res.id);
        } else {
          alert(__("message_send_failed", "No se pudo enviar el mensaje."));
        }
      })
      .catch((err) => {
        console.error("[chat] ensureActiveConversation error", err);
        alert(__("message_send_failed", "No se pudo enviar el mensaje."));
      });
  }

  function sendCurrentMessage() {
    if (!ui || !currentConversation) return;
    const input = ui.threadView.querySelector(".plugin-chat-input");
    const content = input.value.trim();
    if (!content && !pendingAttachmentFile) return;

    if (content.length > maxMessageLength) {
      const errTemplate = __(
        "message_too_long",
        "El mensaje excede el límite de %d caracteres.",
      );
      alert(errTemplate.replace("%d", maxMessageLength));
      input.focus();
      return;
    }

    ensureActiveConversation((convId) => {
      closeMentionSuggestions();
      closeEmojiSuggestions();
      lastTypingSentTime = 0;
      input.value = "";
      updateInputCounter(input);
      autoResizeInput(input);

      if (pendingAttachmentFile) {
        const fileToSend = pendingAttachmentFile;
        uploadAttachmentAndSend(convId, content, fileToSend);
        return;
      }

      apiWithContent(
        "messages.php",
        {
          action: "send",
          conversation_id: convId,
        },
        content,
      )
        .then((res) => {
          if (res && res.success && res.id) {
            const nowTs = Math.floor(Date.now() / 1000);
            renderMessages(
              [
                {
                  id: res.id,
                  mine: true,
                  author: "",
                  content: content,
                  date: nowTs,
                },
              ],
              true,
            );
          } else {
            console.error("[chat] message send failed", res);
            input.value = content;
            updateInputCounter(input);
            autoResizeInput(input);
            if (res && res.error === "message_too_long") {
              const errTemplate = __(
                "message_too_long",
                "El mensaje excede el límite de %d caracteres.",
              );
              alert(errTemplate.replace("%d", maxMessageLength));
            }
          }
        })
        .catch((err) => {
          console.error("[chat] message send network error", err);
          input.value = content;
          updateInputCounter(input);
          autoResizeInput(input);
        });
    });
  }

  // @mentions composer autocomplete suggestions
  let mentionSuggestionUsers = [];

  function openOrUpdateMentionSuggestions(textarea) {
    // Same signal as currentMentionNames(): keyed off the actual
    // mentionable-users list rather than currentConversation.is_group.
    if (!currentConversation || !currentMentionableUsers.length) {
      closeMentionSuggestions();
      return;
    }

    const value = textarea.value;
    const caret = textarea.selectionStart;
    const uptoCaret = value.slice(0, caret);
    const atIndex = uptoCaret.lastIndexOf("@");

    // No "@" before the caret, or whitespace between it and the caret
    // (mention was already "closed" by a space) - not composing a
    // mention right now.
    if (atIndex === -1 || /\s/.test(uptoCaret.slice(atIndex + 1))) {
      closeMentionSuggestions();
      return;
    }
    // "@" must start a fresh word (start of message, or preceded by
    // whitespace) so this doesn't trigger mid-word (e.g. an email).
    if (atIndex > 0 && !/\s/.test(value[atIndex - 1])) {
      closeMentionSuggestions();
      return;
    }

    const query = uptoCaret.slice(atIndex + 1).toLowerCase();
    const localizedEveryone = __("everyone", "Todos");
    const candidates = [{ id: 0, name: localizedEveryone }].concat(
      currentMentionableUsers,
    );
    const filtered = candidates.filter((u) =>
      u.name.toLowerCase().includes(query),
    );

    if (!filtered.length) {
      closeMentionSuggestions();
      return;
    }

    mentionTriggerStart = atIndex;
    closeEmojiSuggestions();
    renderMentionSuggestions(textarea, filtered);
  }

  function renderMentionSuggestions(textarea, users) {
    if (!mentionSuggestionsEl) {
      mentionSuggestionsEl = el("div", {
        class: "plugin-chat-mention-suggestions",
      });
      textarea.parentElement.appendChild(mentionSuggestionsEl);
    }
    mentionSuggestionsEl.innerHTML = "";
    mentionSuggestionUsers = users;
    mentionActiveIndex = 0;

    users.forEach((u, i) => {
      const row = el("div", {
        class: "plugin-chat-mention-suggestion" + (i === 0 ? " is-active" : ""),
        text: u.name,
      });
      // mousedown (not click) + preventDefault so this fires before
      // the textarea would otherwise blur - without it, the blur
      // closes the dropdown before the click ever registers.
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectMentionSuggestion(textarea, u);
      });
      mentionSuggestionsEl.appendChild(row);
    });

    mentionSuggestionsEl.style.display = "block";
  }

  function moveMentionActive(delta) {
    if (!mentionSuggestionsEl || !mentionSuggestionUsers.length) return;
    const rows = mentionSuggestionsEl.querySelectorAll(
      ".plugin-chat-mention-suggestion",
    );
    if (rows[mentionActiveIndex])
      rows[mentionActiveIndex].classList.remove("is-active");
    mentionActiveIndex =
      (mentionActiveIndex + delta + rows.length) % rows.length;
    rows[mentionActiveIndex].classList.add("is-active");
    rows[mentionActiveIndex].scrollIntoView({ block: "nearest" });
  }

  function confirmActiveMentionSuggestion(textarea) {
    const u = mentionSuggestionUsers[mentionActiveIndex];
    if (!u) return false;
    selectMentionSuggestion(textarea, u);
    return true;
  }

  function selectMentionSuggestion(textarea, user) {
    if (mentionTriggerStart === null) return;
    const value = textarea.value;
    const caret = textarea.selectionStart;
    const before = value.slice(0, mentionTriggerStart);
    const after = value.slice(caret);
    const inserted = "@" + user.name + " ";

    textarea.value = before + inserted + after;
    const newCaret = before.length + inserted.length;
    textarea.setSelectionRange(newCaret, newCaret);
    textarea.focus();
    autoResizeInput(textarea);
    closeMentionSuggestions();
  }

  function closeMentionSuggestions() {
    if (mentionSuggestionsEl) {
      mentionSuggestionsEl.style.display = "none";
      mentionSuggestionsEl.innerHTML = "";
    }
    mentionSuggestionUsers = [];
    mentionActiveIndex = -1;
    mentionTriggerStart = null;
  }

  // :emoji composer autocomplete suggestions
  const COMMON_EMOJI_SHORTCODES = [
    // Naturaleza / Árboles / Plantas
    { code: "tree", emoji: "🌲", desc: "árbol" },
    { code: "arbol", emoji: "🌲", desc: "árbol" },
    { code: "evergreen_tree", emoji: "🌲", desc: "árbol perenne" },
    { code: "deciduous_tree", emoji: "🌳", desc: "árbol caducifolio" },
    { code: "palm_tree", emoji: "🌴", desc: "palmera" },
    { code: "palmera", emoji: "🌴", desc: "palmera" },
    { code: "christmas_tree", emoji: "🎄", desc: "árbol de navidad" },
    { code: "seedling", emoji: "🌱", desc: "brote" },
    { code: "herb", emoji: "🌿", desc: "hierba" },
    { code: "clover", emoji: "🍀", desc: "trébol" },
    { code: "trebol", emoji: "🍀", desc: "trébol" },
    { code: "four_leaf_clover", emoji: "🍀", desc: "trébol de cuatro hojas" },
    { code: "leaves", emoji: "🍃", desc: "hojas al viento" },
    { code: "fallen_leaf", emoji: "🍂", desc: "hoja caída" },
    { code: "flower", emoji: "🌸", desc: "flor" },
    { code: "flor", emoji: "🌸", desc: "flor" },
    { code: "cherry_blossom", emoji: "🌸", desc: "flor de cerezo" },
    { code: "rose", emoji: "🌹", desc: "rosa" },
    { code: "rosa", emoji: "🌹", desc: "rosa" },
    { code: "sunflower", emoji: "🌻", desc: "girasol" },
    { code: "girasol", emoji: "🌻", desc: "girasol" },
    { code: "sun", emoji: "☀️", desc: "sol" },
    { code: "sol", emoji: "☀️", desc: "sol" },
    { code: "sunny", emoji: "☀️", desc: "soleado" },
    { code: "moon", emoji: "🌙", desc: "luna" },
    { code: "luna", emoji: "🌙", desc: "luna" },
    { code: "cloud", emoji: "☁️", desc: "nube" },
    { code: "nube", emoji: "☁️", desc: "nube" },
    { code: "rain", emoji: "🌧️", desc: "lluvia" },
    { code: "lluvia", emoji: "🌧️", desc: "lluvia" },
    { code: "rainbow", emoji: "🌈", desc: "arcoíris" },
    { code: "arcoiris", emoji: "🌈", desc: "arcoíris" },
    { code: "zap", emoji: "⚡", desc: "rayo" },
    { code: "rayo", emoji: "⚡", desc: "rayo" },
    { code: "lightning", emoji: "⚡", desc: "relámpago" },
    { code: "fire", emoji: "🔥", desc: "fuego" },
    { code: "fuego", emoji: "🔥", desc: "fuego" },
    { code: "flame", emoji: "🔥", desc: "llama" },
    { code: "ocean", emoji: "🌊", desc: "ola de mar" },
    { code: "water", emoji: "💧", desc: "gota de agua" },
    { code: "agua", emoji: "💧", desc: "agua" },
    { code: "snowflake", emoji: "❄️", desc: "copo de nieve" },
    { code: "nieve", emoji: "❄️", desc: "nieve" },

    // Caritas y Expresiones
    { code: "smile", emoji: "😄", desc: "sonrisa" },
    { code: "sonrisa", emoji: "😄", desc: "sonrisa" },
    { code: "smiley", emoji: "😃", desc: "cara sonriente" },
    { code: "grinning", emoji: "😀", desc: "cara alegre" },
    { code: "grin", emoji: "😁", desc: "dientes" },
    { code: "joy", emoji: "😂", desc: "llorar de risa" },
    { code: "risa", emoji: "😂", desc: "risa" },
    { code: "rofl", emoji: "🤣", desc: "carcajada" },
    { code: "sweat_smile", emoji: "😅", desc: "sonrisa con sudor" },
    { code: "laughing", emoji: "😆", desc: "carcajada con ojos cerrados" },
    { code: "wink", emoji: "😉", desc: "guiño" },
    { code: "guino", emoji: "😉", desc: "guiño" },
    { code: "blush", emoji: "😊", desc: "sonrojo / feliz" },
    { code: "innocent", emoji: "😇", desc: "ángel / inocente" },
    { code: "angel", emoji: "😇", desc: "ángel" },
    { code: "heart_eyes", emoji: "😍", desc: "ojos de corazón" },
    { code: "enamorado", emoji: "😍", desc: "enamorado" },
    { code: "kissing_heart", emoji: "😘", desc: "beso con corazón" },
    { code: "beso", emoji: "😘", desc: "beso" },
    { code: "yum", emoji: "😋", desc: "delicioso" },
    { code: "stuck_out_tongue", emoji: "😛", desc: "sacando la lengua" },
    { code: "lengua", emoji: "😛", desc: "lengua" },
    { code: "stuck_out_tongue_winking_eye", emoji: "😜", desc: "lengua y guiño" },
    { code: "sunglasses", emoji: "😎", desc: "gafas de sol / guay" },
    { code: "gafas", emoji: "😎", desc: "gafas de sol" },
    { code: "nerd", emoji: "🤓", desc: "empollón / friki" },
    { code: "friki", emoji: "🤓", desc: "friki" },
    { code: "thinking", emoji: "🤔", desc: "pensativo" },
    { code: "pensando", emoji: "🤔", desc: "pensando" },
    { code: "duda", emoji: "🤔", desc: "duda" },
    { code: "salute", emoji: "🫡", desc: "saludo militar" },
    { code: "saludo", emoji: "🫡", desc: "saludo" },
    { code: "shrug", emoji: "🤷", desc: "encogerse de hombros" },
    { code: "facepalm", emoji: "🤦", desc: "mano en la frente" },
    { code: "pleading", emoji: "🥺", desc: "suplicante / por favor" },
    { code: "porfavor", emoji: "🥺", desc: "por favor" },
    { code: "cry", emoji: "😢", desc: "llanto triste" },
    { code: "llorando", emoji: "😢", desc: "llorando" },
    { code: "triste", emoji: "😢", desc: "triste" },
    { code: "sob", emoji: "😭", desc: "llanto inconsolable" },
    { code: "scream", emoji: "😱", desc: "grito de miedo" },
    { code: "miedo", emoji: "😱", desc: "miedo" },
    { code: "angry", emoji: "😠", desc: "enfadado" },
    { code: "enfadado", emoji: "😠", desc: "enfadado" },
    { code: "rage", emoji: "😡", desc: "furia / rabia" },
    { code: "rabia", emoji: "😡", desc: "rabia" },
    { code: "exploding_head", emoji: "🤯", desc: "cabeza explotando" },
    { code: "boom", emoji: "💥", desc: "explosión" },
    { code: "partying", emoji: "🥳", desc: "de fiesta" },
    { code: "fiesta", emoji: "🥳", desc: "fiesta" },
    { code: "celebracion", emoji: "🥳", desc: "celebración" },
    { code: "neutral_face", emoji: "😐", desc: "neutral / serio" },
    { code: "sleeping", emoji: "😴", desc: "durmiendo" },
    { code: "dormir", emoji: "😴", desc: "dormir" },
    { code: "zzz", emoji: "💤", desc: "sueño" },
    { code: "mask", emoji: "😷", desc: "mascarilla" },
    { code: "sick", emoji: "🤒", desc: "enfermo" },
    { code: "enfermo", emoji: "🤒", desc: "enfermo" },
    { code: "dizzy_face", emoji: "😵", desc: "mareado" },
    { code: "cowboy", emoji: "🤠", desc: "vaquero" },
    { code: "clown", emoji: "🤡", desc: "payaso" },
    { code: "payaso", emoji: "🤡", desc: "payaso" },
    { code: "skull", emoji: "💀", desc: "calavera" },
    { code: "calavera", emoji: "💀", desc: "calavera" },
    { code: "poop", emoji: "💩", desc: "caca con ojos" },
    { code: "ghost", emoji: "👻", desc: "fantasma" },
    { code: "fantasma", emoji: "👻", desc: "fantasma" },
    { code: "alien", emoji: "👽", desc: "alienígena" },
    { code: "robot", emoji: "🤖", desc: "robot" },

    // Gestos y Manos
    { code: "thumbsup", emoji: "👍", desc: "pulgar arriba" },
    { code: "+1", emoji: "👍", desc: "pulgar arriba (+1)" },
    { code: "pulgar_arriba", emoji: "👍", desc: "pulgar arriba" },
    { code: "like", emoji: "👍", desc: "me gusta" },
    { code: "bien", emoji: "👍", desc: "bien" },
    { code: "ok", emoji: "👌", desc: "de acuerdo / ok" },
    { code: "ok_hand", emoji: "👌", desc: "señal de ok" },
    { code: "thumbsdown", emoji: "👎", desc: "pulgar abajo" },
    { code: "-1", emoji: "👎", desc: "pulgar abajo (-1)" },
    { code: "pulgar_abajo", emoji: "👎", desc: "pulgar abajo" },
    { code: "dislike", emoji: "👎", desc: "no me gusta" },
    { code: "mal", emoji: "👎", desc: "mal" },
    { code: "clap", emoji: "👏", desc: "aplausos" },
    { code: "aplausos", emoji: "👏", desc: "aplausos" },
    { code: "wave", emoji: "👋", desc: "saludo con la mano" },
    { code: "hola", emoji: "👋", desc: "hola" },
    { code: "adios", emoji: "👋", desc: "adiós" },
    { code: "raised_hands", emoji: "🙌", desc: "manos levantadas" },
    { code: "pray", emoji: "🙏", desc: "por favor / rezo / gracias" },
    { code: "gracias", emoji: "🙏", desc: "gracias" },
    { code: "handshake", emoji: "🤝", desc: "apretón de manos / acuerdo" },
    { code: "acuerdo", emoji: "🤝", desc: "acuerdo" },
    { code: "point_up", emoji: "☝️", desc: "índice arriba" },
    { code: "point_down", emoji: "👇", desc: "índice abajo" },
    { code: "point_left", emoji: "👈", desc: "índice izquierda" },
    { code: "point_right", emoji: "👉", desc: "índice derecha" },
    { code: "punch", emoji: "👊", desc: "puño" },
    { code: "puno", emoji: "👊", desc: "puño" },
    { code: "victory", emoji: "✌️", desc: "paz / victoria" },
    { code: "paz", emoji: "✌️", desc: "paz" },
    { code: "v", emoji: "✌️", desc: "victoria" },
    { code: "crossed_fingers", emoji: "🤞", desc: "dedos cruzados / suerte" },
    { code: "suerte", emoji: "🤞", desc: "suerte" },
    { code: "love_you", emoji: "🤟", desc: "te quiero" },
    { code: "call_me", emoji: "🤙", desc: "llámame" },
    { code: "eyes", emoji: "👀", desc: "ojos atentos" },
    { code: "ojos", emoji: "👀", desc: "ojos" },
    { code: "muscle", emoji: "💪", desc: "fuerza / músculo" },
    { code: "fuerza", emoji: "💪", desc: "fuerza" },

    // Corazones y Sentimientos
    { code: "heart", emoji: "❤️", desc: "corazón rojo" },
    { code: "corazon", emoji: "❤️", desc: "corazón rojo" },
    { code: "amor", emoji: "❤️", desc: "amor" },
    { code: "red_heart", emoji: "❤️", desc: "corazón rojo" },
    { code: "blue_heart", emoji: "💙", desc: "corazón azul" },
    { code: "green_heart", emoji: "💚", desc: "corazón verde" },
    { code: "yellow_heart", emoji: "💛", desc: "corazón amarillo" },
    { code: "purple_heart", emoji: "💜", desc: "corazón morado" },
    { code: "black_heart", emoji: "🖤", desc: "corazón negro" },
    { code: "white_heart", emoji: "🤍", desc: "corazón blanco" },
    { code: "broken_heart", emoji: "💔", desc: "corazón roto" },
    { code: "corazon_roto", emoji: "💔", desc: "corazón roto" },
    { code: "heart_on_fire", emoji: "❤️‍🔥", desc: "corazón en llamas" },
    { code: "sparkles", emoji: "✨", desc: "destellos / brillo" },
    { code: "brillo", emoji: "✨", desc: "brillo" },
    { code: "star", emoji: "⭐", desc: "estrella" },
    { code: "estrella", emoji: "⭐", desc: "estrella" },
    { code: "star2", emoji: "🌟", desc: "estrella brillante" },

    // Símbolos, IT, Oficina y Soporte
    { code: "rocket", emoji: "🚀", desc: "cohete" },
    { code: "cohete", emoji: "🚀", desc: "cohete" },
    { code: "check", emoji: "✅", desc: "verificado / check" },
    { code: "white_check_mark", emoji: "✅", desc: "marca de verificación" },
    { code: "heavy_check_mark", emoji: "✔️", desc: "check" },
    { code: "listo", emoji: "✅", desc: "listo" },
    { code: "hecho", emoji: "✅", desc: "hecho" },
    { code: "x", emoji: "❌", desc: "cruz / error" },
    { code: "cross_mark", emoji: "❌", desc: "cruz" },
    { code: "error", emoji: "❌", desc: "error" },
    { code: "warning", emoji: "⚠️", desc: "advertencia / aviso" },
    { code: "aviso", emoji: "⚠️", desc: "aviso" },
    { code: "alerta", emoji: "⚠️", desc: "alerta" },
    { code: "100", emoji: "💯", desc: "cien puntos" },
    { code: "cien", emoji: "💯", desc: "cien" },
    { code: "tada", emoji: "🎉", desc: "celebración / sorpresa" },
    { code: "party", emoji: "🎉", desc: "fiesta" },
    { code: "bell", emoji: "🔔", desc: "campana / notificación" },
    { code: "campana", emoji: "🔔", desc: "campana" },
    { code: "coffee", emoji: "☕", desc: "café" },
    { code: "cafe", emoji: "☕", desc: "café" },
    { code: "beer", emoji: "🍺", desc: "cerveza" },
    { code: "cerveza", emoji: "🍺", desc: "cerveza" },
    { code: "bug", emoji: "🐛", desc: "error / bug" },
    { code: "bicho", emoji: "🐛", desc: "bicho" },
    { code: "bulb", emoji: "💡", desc: "bombilla / idea" },
    { code: "idea", emoji: "💡", desc: "idea" },
    { code: "computer", emoji: "💻", desc: "ordenador portátil" },
    { code: "laptop", emoji: "💻", desc: "portátil" },
    { code: "pc", emoji: "💻", desc: "ordenador" },
    { code: "phone", emoji: "📱", desc: "teléfono móvil" },
    { code: "movil", emoji: "📱", desc: "móvil" },
    { code: "lock", emoji: "🔒", desc: "candado cerrado" },
    { code: "bloqueado", emoji: "🔒", desc: "bloqueado" },
    { code: "unlock", emoji: "🔓", desc: "candado abierto" },
    { code: "desbloqueado", emoji: "🔓", desc: "desbloqueado" },
    { code: "key", emoji: "🔑", desc: "llave" },
    { code: "llave", emoji: "🔑", desc: "llave" },
    { code: "wrench", emoji: "🔧", desc: "llave inglesa / ajuste" },
    { code: "herramienta", emoji: "🔧", desc: "herramienta" },
    { code: "gear", emoji: "⚙️", desc: "engranaje / configuración" },
    { code: "config", emoji: "⚙️", desc: "configuración" },
    { code: "ticket", emoji: "🎫", desc: "ticket" },
    { code: "boleto", emoji: "🎫", desc: "ticket / boleto" },
    { code: "clock", emoji: "🕒", desc: "reloj" },
    { code: "reloj", emoji: "🕒", desc: "reloj" },
    { code: "tiempo", emoji: "🕒", desc: "tiempo" },
    { code: "hourglass", emoji: "⌛", desc: "reloj de arena" },
    { code: "espera", emoji: "⌛", desc: "espera" },
    { code: "calendar", emoji: "📅", desc: "calendario / fecha" },
    { code: "calendario", emoji: "📅", desc: "calendario" },
    { code: "memo", emoji: "📝", desc: "nota / memorándum" },
    { code: "nota", emoji: "📝", desc: "nota" },
    { code: "pencil", emoji: "✏️", desc: "lápiz / editar" },
    { code: "lapiz", emoji: "✏️", desc: "lápiz" },
    { code: "email", emoji: "✉️", desc: "correo electrónico" },
    { code: "correo", emoji: "✉️", desc: "correo" },
    { code: "mail", emoji: "✉️", desc: "mensaje de correo" },
    { code: "link", emoji: "🔗", desc: "enlace" },
    { code: "enlace", emoji: "🔗", desc: "enlace" },
    { code: "package", emoji: "📦", desc: "paquete" },
    { code: "paquete", emoji: "📦", desc: "paquete" },
    { code: "trophy", emoji: "🏆", desc: "trofeo / éxito" },
    { code: "trofeo", emoji: "🏆", desc: "trofeo" },
    { code: "pin", emoji: "📌", desc: "chincheta" },
    { code: "chincheta", emoji: "📌", desc: "chincheta" },
    { code: "paperclip", emoji: "📎", desc: "clip / adjunto" },
    { code: "adjunto", emoji: "📎", desc: "adjunto" },
    { code: "trash", emoji: "🗑️", desc: "papelera / borrar" },
    { code: "papelera", emoji: "🗑️", desc: "papelera" },
    { code: "search", emoji: "🔍", desc: "buscar / lupa" },
    { code: "lupa", emoji: "🔍", desc: "lupa" },
    { code: "recycle", emoji: "♻️", desc: "reciclar" },
    { code: "globe", emoji: "🌐", desc: "globo terráqueo / web" },
    { code: "web", emoji: "🌐", desc: "web" },
    { code: "chart", emoji: "📈", desc: "gráfico ascendente" },
    { code: "grafico", emoji: "📈", desc: "gráfico" },

    // Animales
    { code: "cat", emoji: "🐱", desc: "gato" },
    { code: "gato", emoji: "🐱", desc: "gato" },
    { code: "dog", emoji: "🐶", desc: "perro" },
    { code: "perro", emoji: "🐶", desc: "perro" },
    { code: "monkey", emoji: "🐵", desc: "mono" },
    { code: "mono", emoji: "🐵", desc: "mono" },
    { code: "fox", emoji: "🦊", desc: "zorro" },
    { code: "bear", emoji: "🐻", desc: "oso" },
    { code: "panda", emoji: "🐼", desc: "panda" },
    { code: "lion", emoji: "🦁", desc: "león" },
    { code: "tiger", emoji: "🐯", desc: "tigre" },
    { code: "penguin", emoji: "🐧", desc: "pingüino" },
    { code: "pinguino", emoji: "🐧", desc: "pingüino" },
    { code: "bird", emoji: "🐦", desc: "pájaro" },
    { code: "pajaro", emoji: "🐦", desc: "pájaro" },
    { code: "fish", emoji: "🐟", desc: "pez" },
    { code: "pez", emoji: "🐟", desc: "pez" },

    // Comida
    { code: "apple", emoji: "🍎", desc: "manzana" },
    { code: "manzana", emoji: "🍎", desc: "manzana" },
    { code: "banana", emoji: "🍌", desc: "plátano" },
    { code: "platano", emoji: "🍌", desc: "plátano" },
    { code: "pizza", emoji: "🍕", desc: "pizza" },
    { code: "burger", emoji: "🍔", desc: "hamburguesa" },
    { code: "cake", emoji: "🎂", desc: "tarta / pastel" },
    { code: "tarta", emoji: "🎂", desc: "tarta" },

    // Transporte
    { code: "car", emoji: "🚗", desc: "coche" },
    { code: "coche", emoji: "🚗", desc: "coche" },
    { code: "airplane", emoji: "✈️", desc: "avión" },
    { code: "avion", emoji: "✈️", desc: "avión" },
    { code: "train", emoji: "🚆", desc: "tren" },
    { code: "tren", emoji: "🚆", desc: "tren" },
    { code: "bike", emoji: "🚲", desc: "bicicleta" },
    { code: "bici", emoji: "🚲", desc: "bicicleta" }
  ];

  async function searchEmojisForAutocomplete(query) {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const matched = [];
    const seen = new Set();

    // 1. Fast in-memory shortcodes (exact prefix matches first, then contains)
    const prefixMatches = [];
    const containsMatches = [];

    for (let i = 0; i < COMMON_EMOJI_SHORTCODES.length; i++) {
      const item = COMMON_EMOJI_SHORTCODES[i];
      const code = item.code.toLowerCase();
      if (code.startsWith(q)) {
        prefixMatches.push(item);
      } else if (code.includes(q)) {
        containsMatches.push(item);
      }
    }

    const memoryMatches = prefixMatches.concat(containsMatches);
    for (let i = 0; i < memoryMatches.length; i++) {
      const item = memoryMatches[i];
      if (!seen.has(item.emoji)) {
        seen.add(item.emoji);
        matched.push({
          unicode: item.emoji,
          name: ":" + item.code + ":",
          desc: item.desc || "",
        });
        if (matched.length >= 8) break;
      }
    }

    // 2. Query IndexedDB Spanish dataset if we need more results or to enrich
    if (matched.length < 8) {
      try {
        const db = await getEmojiDatabase();
        if (db) {
          const dbResults = await db.getEmojiBySearchQuery(q);
          if (Array.isArray(dbResults)) {
            for (let i = 0; i < dbResults.length; i++) {
              const r = dbResults[i];
              if (r && r.unicode && !seen.has(r.unicode)) {
                seen.add(r.unicode);
                const shortcode =
                  r.shortcodes && r.shortcodes[0]
                    ? ":" + r.shortcodes[0] + ":"
                    : r.annotation
                    ? ":" + r.annotation.replace(/\s+/g, "_") + ":"
                    : "";
                matched.push({
                  unicode: r.unicode,
                  name: shortcode,
                  desc: r.annotation || "",
                });
                if (matched.length >= 8) break;
              }
            }
          }
        }
      } catch (err) {
        // Non-blocking: IndexedDB error or not ready yet
      }
    }

    return matched.slice(0, 8);
  }

  function openOrUpdateEmojiSuggestions(textarea) {
    if (!isEmojiFeatureActive()) {
      closeEmojiSuggestions();
      return;
    }

    const value = textarea.value;
    const caret = textarea.selectionStart;
    const uptoCaret = value.slice(0, caret);
    const colonIndex = uptoCaret.lastIndexOf(":");

    // No ":" before caret
    if (colonIndex === -1) {
      closeEmojiSuggestions();
      return;
    }

    // ":" must start a fresh word (start of message, or preceded by whitespace)
    if (colonIndex > 0 && !/\s/.test(value[colonIndex - 1])) {
      closeEmojiSuggestions();
      return;
    }

    const rawQuery = uptoCaret.slice(colonIndex + 1);

    // Whitespace or secondary colon aborts (e.g. ": smile" or "::")
    if (/\s|:/.test(rawQuery)) {
      closeEmojiSuggestions();
      return;
    }

    // Require at least 2 characters to avoid popping up on smileys like :) :( :D :P
    if (rawQuery.length < 2) {
      closeEmojiSuggestions();
      return;
    }

    emojiTriggerStart = colonIndex;
    const thisSeq = ++emojiSearchSeq;

    searchEmojisForAutocomplete(rawQuery).then((items) => {
      // Guard against stale asynchronous responses
      if (thisSeq !== emojiSearchSeq) return;
      if (
        textarea.selectionStart !== caret ||
        emojiTriggerStart !== colonIndex
      ) {
        return;
      }
      if (!items || !items.length) {
        closeEmojiSuggestions();
        return;
      }
      closeMentionSuggestions();
      renderEmojiSuggestions(textarea, items);
    });
  }

  function renderEmojiSuggestions(textarea, list) {
    if (!emojiSuggestionsEl) {
      emojiSuggestionsEl = el("div", {
        class: "plugin-chat-emoji-suggestions",
      });
      textarea.parentElement.appendChild(emojiSuggestionsEl);
    }
    emojiSuggestionsEl.innerHTML = "";
    emojiSuggestionList = list;
    emojiActiveIndex = 0;

    list.forEach((item, i) => {
      const row = el(
        "div",
        {
          class:
            "plugin-chat-emoji-suggestion" + (i === 0 ? " is-active" : ""),
        },
        [
          el("span", { class: "plugin-chat-emoji-glyph", text: item.unicode }),
          el("span", { class: "plugin-chat-emoji-name", text: item.name }),
          item.desc
            ? el("span", { class: "plugin-chat-emoji-desc", text: item.desc })
            : null,
        ].filter(Boolean),
      );
      // mousedown (not click) + preventDefault so this fires before blur
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectEmojiSuggestion(textarea, item);
      });
      emojiSuggestionsEl.appendChild(row);
    });

    emojiSuggestionsEl.style.display = "block";
  }

  function moveEmojiActive(delta) {
    if (!emojiSuggestionsEl || !emojiSuggestionList.length) return;
    const rows = emojiSuggestionsEl.querySelectorAll(
      ".plugin-chat-emoji-suggestion",
    );
    if (rows[emojiActiveIndex]) {
      rows[emojiActiveIndex].classList.remove("is-active");
    }
    emojiActiveIndex = (emojiActiveIndex + delta + rows.length) % rows.length;
    if (rows[emojiActiveIndex]) {
      rows[emojiActiveIndex].classList.add("is-active");
      rows[emojiActiveIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function confirmActiveEmojiSuggestion(textarea) {
    const item = emojiSuggestionList[emojiActiveIndex];
    if (!item) return false;
    selectEmojiSuggestion(textarea, item);
    return true;
  }

  function selectEmojiSuggestion(textarea, item) {
    if (emojiTriggerStart === null) return;
    const value = textarea.value;
    const caret = textarea.selectionStart;
    const before = value.slice(0, emojiTriggerStart);
    const after = value.slice(caret);
    const inserted = item.unicode + " ";

    textarea.value = before + inserted + after;
    const newCaret = before.length + inserted.length;
    textarea.setSelectionRange(newCaret, newCaret);
    textarea.focus();
    autoResizeInput(textarea);
    closeEmojiSuggestions();
  }

  function closeEmojiSuggestions() {
    if (emojiSuggestionsEl) {
      emojiSuggestionsEl.style.display = "none";
      emojiSuggestionsEl.innerHTML = "";
    }
    emojiSuggestionList = [];
    emojiActiveIndex = -1;
    emojiTriggerStart = null;
  }

  function autoResizeInput(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    // Kept in sync with .plugin-chat-input's max-height in chat.css.
    const maxHeight = 160;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
  }

  function searchUsers(term) {
    if (!ui) return;
    const results = ui.newChatView.querySelector(".plugin-chat-user-results");
    if (!term) {
      results.innerHTML = "";
      return;
    }
    api("conversations.php", { action: "search_users", term: term }).then(
      (data) => {
        results.innerHTML = "";
        (data.users || []).forEach((u) => {
          const row = el("div", {
            class: "plugin-chat-conv-row",
            text: u.name,
          });
          row.addEventListener("click", () => {
            openPrivateChatWithUser(u);
          });
          results.appendChild(row);
        });
      },
    );
  }

  // ---------- polling ----------

  // Starts online presence heartbeat
  function startPresenceHeartbeat() {
    // Only ever called once today (init()), but guarded the same way
    // as the other start*Polling() functions for consistency - cheap
    // insurance against a future second call site leaking a timer.
    if (presenceTimer) clearInterval(presenceTimer);
    const beat = () => api("presence.php", { action: "heartbeat" });
    beat();
    presenceTimer = setInterval(beat, PRESENCE_POLL_MS);
  }

  function startOnlineUsersPolling() {
    if (onlineUsersTimer) clearInterval(onlineUsersTimer);
    refreshOnlineUsers();
    onlineUsersTimer = setInterval(refreshOnlineUsers, ONLINE_USERS_POLL_MS);
  }

  function startConversationsPolling() {
    if (conversationsTimer) clearInterval(conversationsTimer);
    conversationsTimer = setInterval(
      refreshConversations,
      CONVERSATIONS_POLL_MS,
    );
  }

  function startMessagesPolling() {
    stopMessagesPolling();
    messagesTimer = setInterval(() => loadMessages(false), MESSAGES_POLL_MS);
  }

  function stopMessagesPolling() {
    if (messagesTimer) clearInterval(messagesTimer);
    messagesTimer = null;
  }

  // Pauses polling when tab is hidden
  function stopAllPolling() {
    if (onlineUsersTimer) clearInterval(onlineUsersTimer);
    if (conversationsTimer) clearInterval(conversationsTimer);
    onlineUsersTimer = null;
    conversationsTimer = null;
    stopMessagesPolling();
  }

  // Restarts polling and refreshes once immediately, so coming back to
  // the tab doesn't mean waiting a full interval to catch up. Presence
  // heartbeat isn't touched here either - it was never stopped.
  function resumeAllPolling() {
    if (!csrfToken) return; // token.php hasn't resolved yet - init() will start polling once it does

    if (presenceFeatureEnabled) {
      startOnlineUsersPolling();
    }
    startConversationsPolling();
    refreshConversations();

    if (currentConversation && currentConversation.id && ui && ui.threadView.style.display !== "none") {
      loadMessages(false);
      startMessagesPolling();
    }
  }

  // ---------- init ----------

  function init() {
    if (isModalOrPopupContext()) {
      return;
    }
    if (
      document.getElementById("plugin-chat-launcher") ||
      document.getElementById("plugin-chat-panel") ||
      document.querySelector(".plugin-chat-launcher") ||
      document.querySelector(".plugin-chat-panel")
    ) {
      return;
    }

    ui = Object.assign({}, buildLauncher(), buildPanel());
    const shortcut = buildShortcutButton();
    ui.shortcutBtn = shortcut.btn;
    ui.shortcutMenu = shortcut.menu;

    // Initializes chat widget DOM and event listeners
    emojiIndexedDBAvailable = checkIndexedDBAvailable();

    // Global keyboard shortcuts (Alt+C, Ctrl+Alt+1..4, Ctrl+Alt+N/F/?)
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.altKey && e.code === "Period") {
        e.preventDefault();
        togglePanel();
        return;
      }

      if (!ui || ui.panel.style.display === "none") return;

      if (
        e.ctrlKey &&
        e.altKey &&
        (e.key === "?" ||
          (e.code === "Slash" && e.shiftKey) ||
          e.code === "KeyH")
      ) {
        e.preventDefault();
        toggleShortcutsPanel();
        return;
      }

      if (e.ctrlKey && e.altKey && e.code === "KeyF") {
        e.preventDefault();
        focusListSearch();
        return;
      }

      const sectionByCode = {
        Digit1: "online",
        Digit2: "featured",
        Digit3: "group",
        Digit4: "private",
      };
      if (e.ctrlKey && e.altKey && sectionByCode[e.code]) {
        e.preventDefault();
        goToSection(sectionByCode[e.code]);
        return;
      }

      // Keyboard arrow navigation in conversation list
      if (
        ui.listView.style.display !== "none" &&
        keyboardActiveRowId !== null
      ) {
        if (e.code === "ArrowDown" || e.code === "ArrowUp") {
          e.preventDefault();
          moveActiveRow(e.code === "ArrowDown" ? 1 : -1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          openActiveRow();
        }
      }
    });

    ui.panel
      .querySelectorAll(".plugin-chat-close")
      .forEach((btn) => btn.addEventListener("click", togglePanel));
    ui.backdrop.addEventListener("click", togglePanel);
    ui.panel
      .querySelector(".plugin-chat-pin-btn")
      .addEventListener("click", () => {
        panelPinned = !panelPinned;
        applyPinnedState();
      });
    ui.panel
      .querySelector(".plugin-chat-new")
      .addEventListener("click", showNewChatView);
    ui.panel
      .querySelectorAll(".plugin-chat-back")
      .forEach((btn) => btn.addEventListener("click", showListView));
    ui.panel
      .querySelector(".plugin-chat-star")
      .addEventListener("click", () => {
        if (!currentConversation) return;
        const starBtn = ui.panel.querySelector(".plugin-chat-star");
        toggleFeatured(currentConversation, (featured) =>
          renderStarButton(starBtn, featured),
        );
      });
    ui.panel
      .querySelector(".plugin-chat-send")
      .addEventListener("click", sendCurrentMessage);
    ui.panel
      .querySelector(".plugin-chat-emoji-btn")
      .addEventListener("click", (e) => {
        toggleEmojiPicker(e.currentTarget);
      });
    ui.panel
      .querySelector(".plugin-chat-shortcuts-hint")
      .addEventListener("click", toggleShortcutsPanel);

    const attachBtn = ui.panel.querySelector(".plugin-chat-attach-btn");
    const fileInput = ui.panel.querySelector(".plugin-chat-file-input");
    const stagedRemoveBtn = ui.panel.querySelector(
      ".plugin-chat-staged-remove-btn",
    );

    if (attachBtn && fileInput) {
      attachBtn.addEventListener("click", () => {
        fileInput.click();
      });
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          stageAttachmentFile(e.target.files[0]);
        }
      });
    }

    if (stagedRemoveBtn) {
      stagedRemoveBtn.addEventListener("click", () => {
        clearPendingAttachment();
      });
    }

    const chatInput = ui.panel.querySelector(".plugin-chat-input");

    chatInput.addEventListener("keydown", (e) => {
      const emojiSuggestionsOpen =
        emojiSuggestionsEl &&
        emojiSuggestionsEl.style.display !== "none" &&
        emojiSuggestionList.length;
      if (emojiSuggestionsOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveEmojiActive(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveEmojiActive(-1);
          return;
        }
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
          e.preventDefault();
          confirmActiveEmojiSuggestion(chatInput);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeEmojiSuggestions();
          return;
        }
      }

      const suggestionsOpen =
        mentionSuggestionsEl &&
        mentionSuggestionsEl.style.display !== "none" &&
        mentionSuggestionUsers.length;
      if (suggestionsOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveMentionActive(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveMentionActive(-1);
          return;
        }
        // Shift+Enter should always fall through to "insert a
        // newline" (below), even while suggestions are open - only
        // plain Enter or Tab confirms the highlighted mention.
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
          e.preventDefault();
          confirmActiveMentionSuggestion(chatInput);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMentionSuggestions();
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCurrentMessage();
      }
    });

    chatInput.addEventListener("input", () => {
      autoResizeInput(chatInput);
      updateInputCounter(chatInput);
      handleTypingActivity();
      try {
        openOrUpdateMentionSuggestions(chatInput);
      } catch (err) {
        // Never let a mention-detection issue break typing/sending -
        // worst case, the dropdown just doesn't show.
        console.error("[chat] mention suggestions error", err);
      }
      try {
        openOrUpdateEmojiSuggestions(chatInput);
      } catch (err) {
        console.error("[chat] emoji suggestions error", err);
      }
    });

    chatInput.addEventListener("blur", () => {
      setTimeout(closeMentionSuggestions, 100);
      setTimeout(closeEmojiSuggestions, 100);
    });

    chatInput.addEventListener("paste", (e) => {
      if (!attachmentFeatureEnabled || !currentConversation) return;
      const type = conversationTypeOf(currentConversation);
      if (!type || attachmentAllowedConversationTypes.indexOf(type) === -1) return;

      const clipboard = e.clipboardData || window.clipboardData;
      if (!clipboard || !clipboard.items) return;

      for (let i = 0; i < clipboard.items.length; i++) {
        const item = clipboard.items[i];
        if (item.type && item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const filename =
              "captura_" +
              new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") +
              ".png";
            const file = new File([blob], filename, { type: blob.type });
            stageAttachmentFile(file);
            break;
          }
        }
      }
    });

    const threadView = ui.threadView;
    threadView.addEventListener("dragover", (e) => {
      if (!attachmentFeatureEnabled || !currentConversation) return;
      const type = conversationTypeOf(currentConversation);
      if (!type || attachmentAllowedConversationTypes.indexOf(type) === -1) return;
      e.preventDefault();
      threadView.classList.add("is-dragging-file");
    });
    threadView.addEventListener("dragleave", (e) => {
      if (e.relatedTarget && threadView.contains(e.relatedTarget)) return;
      threadView.classList.remove("is-dragging-file");
    });
    threadView.addEventListener("drop", (e) => {
      threadView.classList.remove("is-dragging-file");
      if (!attachmentFeatureEnabled || !currentConversation) return;
      const type = conversationTypeOf(currentConversation);
      if (!type || attachmentAllowedConversationTypes.indexOf(type) === -1) return;
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        stageAttachmentFile(e.dataTransfer.files[0]);
      }
    });

    ui.panel
      .querySelector(".plugin-chat-user-search")
      .addEventListener("input", (e) => {
        searchUsers(e.target.value.trim());
      });

    ui.panel
      .querySelector(".plugin-chat-search")
      .addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        ui.panel.querySelectorAll(".plugin-chat-conv-row").forEach((row) => {
          const name = row.querySelector(".plugin-chat-conv-name");
          const text = (
            name ? name.textContent : row.textContent
          ).toLowerCase();
          row.style.display = text.includes(term) ? "" : "none";
        });
      });

    // Esc key navigation: closes popovers, subviews, and panel progressively
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !ui) return;

      const lightbox = document.querySelector(".plugin-chat-lightbox");
      if (lightbox) {
        e.preventDefault();
        e.stopPropagation();
        lightbox.remove();
        return;
      }

      if (receiptsPanelEl) {
        e.preventDefault();
        e.stopPropagation();
        closeReceiptsPanel();
        return;
      }

      if (shortcutsPanelEl) {
        e.preventDefault();
        e.stopPropagation();
        closeShortcutsPanel();
        return;
      }

      const panelOpen = ui.panel.style.display !== "none";
      if (!panelOpen) return;

      e.preventDefault();
      e.stopPropagation();

      if (
        ui.threadView.style.display !== "none" ||
        ui.newChatView.style.display !== "none"
      ) {
        showListView();
      } else {
        togglePanel();
      }
    });

    // Pauses/resumes online-users, conversations, and messages polling
    // with the tab's visibility. Presence heartbeat is started once
    // below and left running regardless - see startPresenceHeartbeat.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAllPolling();
      } else {
        resumeAllPolling();
      }
    });

    api("token.php", {}).then((data) => {
      if (data && data.i18n) {
        i18n = Object.assign({}, i18n, data.i18n);
      }
      if (data && typeof data.max_message_length === "number") {
        maxMessageLength = data.max_message_length;
        if (chatInput) {
          chatInput.setAttribute("maxlength", String(maxMessageLength));
        }
      }
      applyTranslations();
      applyPollIntervals(data);
      applyAppearance(ui.panel, data);
      presenceFeatureEnabled = !(data && data.presence_enabled === false);
      typingIndicatorEnabled = !(
        data && data.typing_indicator_enabled === false
      );
      if (!presenceFeatureEnabled) {
        const onlineSection = ui.listView.querySelector(
          '[data-section="online"]',
        );
        if (onlineSection) onlineSection.style.display = "none";
      }

      // Loads initial configuration from token.php and starts polling
      emojiEntityEnabled = !!(data && data.emoji_enabled === true);
      emojiAllowedConversationTypes =
        data && Array.isArray(data.emoji_allowed_conversation_types)
          ? data.emoji_allowed_conversation_types
          : [];

      notificationSoundEnabled = !(
        data && data.notification_sound_enabled === false
      );
      currentOwnName =
        data && typeof data.own_name === "string" ? data.own_name : "";

      if (data && data.csrf_token) {
        csrfToken = data.csrf_token;
        if (presenceFeatureEnabled) {
          startPresenceHeartbeat();
        }
        if (!document.hidden) {
          resumeAllPolling();
        }
      }
      if (data && data.users_id) {
        currentUsersId = data.users_id;
      }
      applyShortcutButtons(
        shortcut.btn,
        shortcut.menu,
        data && data.shortcut_buttons,
      );
      reactionsFeatureEnabled = !!(data && data.reactions_enabled);
      if (data && data.ticket_conversion) {
        ticketConversion = data.ticket_conversion;
      }

      attachmentFeatureEnabled = !!(data && data.attachment_enabled);
      attachmentAllowedConversationTypes =
        data && Array.isArray(data.attachment_allowed_conversation_types)
          ? data.attachment_allowed_conversation_types
          : [];
      attachmentMaxSizeMb = (data && data.attachment_max_size_mb) || 2;
      attachmentMaxSizeBytes =
        (data && data.attachment_max_size_bytes) ||
        attachmentMaxSizeMb * 1024 * 1024;
      attachmentAllowedExtensions =
        data && Array.isArray(data.attachment_allowed_extensions)
          ? data.attachment_allowed_extensions
          : [];
      if (data && data.glpi_csrf_token) {
        glpiCsrfToken = data.glpi_csrf_token;
      }
    });

    // Handles user logout by marking offline
    window.addEventListener("beforeunload", () => {
      if (csrfToken && presenceFeatureEnabled) {
        const offlineUrl =
          AJAX_BASE +
          "presence.php?action=offline&_chat_csrf=" +
          encodeURIComponent(csrfToken);
        fetch(offlineUrl, {
          method: "GET",
          keepalive: true,
          credentials: "same-origin",
        });
      }
    });

    try {
      if (localStorage.getItem("plugin_chat_pinned") === "1") {
        panelPinned = true;
        applyPinnedState();
        togglePanel();
      }
    } catch (e) {
      // Private browsing / storage disabled - starts closed and
      // unpinned, same as any first-time visit.
    }
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz && !document.cookie.includes("plugin_chat_tz=")) {
        document.cookie = "plugin_chat_tz=" + encodeURIComponent(browserTz) + "; path=/; SameSite=Lax";
      }
    } catch (e) {}
    syncHeaderHeight();
    window.addEventListener("resize", syncHeaderHeight);
    if (window.ResizeObserver) {
      try {
        const glpiHeader = document.querySelector(
          'header.navbar.sticky-lg-top, header.navbar, header[data-testid="main-header"], .navbar.topbar'
        );
        if (glpiHeader) {
          new ResizeObserver(syncHeaderHeight).observe(glpiHeader);
        }
      } catch (e) {}
    }

    syncDarkTheme();
    if (window.MutationObserver) {
      try {
        const themeObserver = new MutationObserver(syncDarkTheme);
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: [
            "data-glpi-theme",
            "data-glpi-theme-dark",
            "data-bs-theme",
            "data-theme",
            "class",
          ],
        });
        if (document.body) {
          themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: [
              "data-glpi-theme",
              "data-glpi-theme-dark",
              "data-bs-theme",
              "data-theme",
              "class",
            ],
          });
        }
      } catch (e) {}
    }
  }

  function cleanupDuplicates() {
    const launchers = document.querySelectorAll(
      ".plugin-chat-launcher, #plugin-chat-launcher"
    );
    if (launchers.length > 1) {
      for (let i = 1; i < launchers.length; i++) {
        launchers[i].remove();
      }
    }
    const panels = document.querySelectorAll(
      ".plugin-chat-panel, #plugin-chat-panel"
    );
    if (panels.length > 1) {
      for (let i = 1; i < panels.length; i++) {
        panels[i].remove();
      }
    }
    const backdrops = document.querySelectorAll(
      ".plugin-chat-backdrop, #plugin-chat-backdrop"
    );
    if (backdrops.length > 1) {
      for (let i = 1; i < backdrops.length; i++) {
        backdrops[i].remove();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("turbo:load", function () {
    cleanupDuplicates();
    if (
      !document.getElementById("plugin-chat-launcher") &&
      !document.querySelector(".plugin-chat-launcher")
    ) {
      init();
    } else {
      syncHeaderHeight();
      syncDarkTheme();
    }
  });

  document.addEventListener("turbo:before-cache", function () {
    if (ui) {
      if (ui.shortcutMenu) closeShortcutMenu(ui.shortcutMenu);
      closeReceiptsPanel();
      closeShortcutsPanel();
      closeEmojiPicker();
    }
  });
})();
