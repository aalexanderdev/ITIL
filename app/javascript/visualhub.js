/**
 * OpenITIL - VisualHub & WCAG 2.2 Accessibility Suite Engine
 * Native Web Speech API & Vanilla JS Assistive Technology
 */

(function () {
  const STORAGE_KEY = "openitil_visualhub_prefs";

  const defaultState = {
    darkMode: false,
    highContrast: false,
    grayscale: false,
    invert: false,
    fontSize: "normal", // 'normal' | 'large' | 'extralarge'
    lineSpacing: false,
    readableFont: false,
    focusRing: false,
    largeCursor: false,
    readingGuide: false,
    ttsSpeed: 1.0,
    ttsLang: "es-ES",
    pointToRead: false
  };

  let state = Object.assign({}, defaultState);
  let voices = [];
  let currentUtterance = null;
  let isSpeaking = false;
  let isPaused = false;
  let pointToReadTimer = null;

  // Load state from localStorage
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        state = Object.assign({}, defaultState, JSON.parse(saved));
      }
    } catch (e) {
      console.warn("VisualHub: Error loading prefs", e);
    }
  }

  // Save state
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("VisualHub: Error saving prefs", e);
    }
  }

  // Apply state to document
  function applyState() {
    const root = document.documentElement;

    root.classList.toggle("vh-dark-mode", !!state.darkMode);
    root.classList.toggle("vh-high-contrast", !!state.highContrast);
    root.classList.toggle("vh-grayscale", !!state.grayscale);
    root.classList.toggle("vh-invert", !!state.invert);
    root.classList.toggle("vh-large-text", state.fontSize === "large");
    root.classList.toggle("vh-extra-large-text", state.fontSize === "extralarge");
    root.classList.toggle("vh-line-spacing", !!state.lineSpacing);
    root.classList.toggle("vh-readable-font", !!state.readableFont);
    root.classList.toggle("vh-focus-ring", !!state.focusRing);
    root.classList.toggle("vh-large-cursor", !!state.largeCursor);
    root.classList.toggle("vh-reading-guide-active", !!state.readingGuide);

    // Update active button classes in panel if open
    updatePanelUI();
  }

  // Text-to-Speech Engine
  function initVoices() {
    if ("speechSynthesis" in window) {
      voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () {
        voices = window.speechSynthesis.getVoices();
      };
    }
  }

  function getBestVoice(lang) {
    if (!voices.length && "speechSynthesis" in window) {
      voices = window.speechSynthesis.getVoices();
    }
    const prefix = (lang || state.ttsLang || "es").split("-")[0].toLowerCase();
    const exact = voices.find(v => v.lang.replace("_", "-").toLowerCase() === (lang || state.ttsLang || "es-es").toLowerCase());
    if (exact) return exact;

    const matched = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    return matched || voices[0] || null;
  }

  function speakText(text) {
    if (!("speechSynthesis" in window) || !text || !text.trim()) return;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!cleanText) return;

    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.rate = state.ttsSpeed || 1.0;
    currentUtterance.lang = state.ttsLang || "es-ES";

    const voice = getBestVoice(state.ttsLang);
    if (voice) currentUtterance.voice = voice;

    currentUtterance.onstart = function () {
      isSpeaking = true;
      isPaused = false;
      showAudioPlayer(cleanText);
    };

    currentUtterance.onend = function () {
      isSpeaking = false;
      isPaused = false;
      hideAudioPlayer();
    };

    currentUtterance.onerror = function () {
      isSpeaking = false;
      isPaused = false;
      hideAudioPlayer();
    };

    window.speechSynthesis.speak(currentUtterance);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      isPaused = false;
      hideAudioPlayer();
    }
  }

  function toggleSpeechPause() {
    if (!("speechSynthesis" in window)) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      isPaused = false;
      updatePlayerUI();
    } else if (isSpeaking) {
      window.speechSynthesis.pause();
      isPaused = true;
      updatePlayerUI();
    }
  }

  function showAudioPlayer(textPreview) {
    const player = document.getElementById("vh-a11y-player");
    if (!player) return;

    const textEl = player.querySelector(".vh-player-text");
    if (textEl) {
      textEl.textContent = textPreview.length > 40 ? textPreview.substring(0, 40) + "..." : textPreview;
    }
    updatePlayerUI();
    player.classList.add("active");
  }

  function hideAudioPlayer() {
    const player = document.getElementById("vh-a11y-player");
    if (player) {
      player.classList.remove("active");
    }
  }

  function updatePlayerUI() {
    const toggleBtn = document.getElementById("vh-player-toggle");
    const speedBtn = document.getElementById("vh-player-speed");
    if (toggleBtn) {
      toggleBtn.innerHTML = isPaused
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
      toggleBtn.setAttribute("aria-label", isPaused ? "Reanudar" : "Pausar");
    }
    if (speedBtn) {
      speedBtn.textContent = (state.ttsSpeed || 1.0) + "x";
    }
  }

  function readSelectedOrSmartContent() {
    const sel = window.getSelection() ? window.getSelection().toString() : "";
    if (sel && sel.trim().length > 0) {
      speakText(sel);
      return;
    }

    // Smart fallback: Ticket content or main header
    const ticketDesc = document.querySelector(".ticket-description, .card-body p");
    const titleEl = document.querySelector("h1, .page-title, .auth-title");

    if (ticketDesc && ticketDesc.textContent.trim()) {
      const title = titleEl ? titleEl.textContent.trim() + ". " : "";
      speakText(title + ticketDesc.textContent.trim());
    } else if (titleEl) {
      speakText(titleEl.textContent.trim());
    } else {
      speakText("Bienvenido a OpenITIL. Utilice Alt más A para opciones de accesibilidad.");
    }
  }

  // Panel UI sync
  function updatePanelUI() {
    document.querySelectorAll("[data-vh-action]").forEach(btn => {
      const action = btn.getAttribute("data-vh-action");
      let isActive = false;

      if (action === "dark-mode") isActive = state.darkMode;
      else if (action === "high-contrast") isActive = state.highContrast;
      else if (action === "grayscale") isActive = state.grayscale;
      else if (action === "invert") isActive = state.invert;
      else if (action === "large-text") isActive = state.fontSize === "large";
      else if (action === "extra-large-text") isActive = state.fontSize === "extralarge";
      else if (action === "line-spacing") isActive = state.lineSpacing;
      else if (action === "readable-font") isActive = state.readableFont;
      else if (action === "focus-ring") isActive = state.focusRing;
      else if (action === "large-cursor") isActive = state.largeCursor;
      else if (action === "reading-guide") isActive = state.readingGuide;
      else if (action === "point-to-read") isActive = state.pointToRead;

      btn.classList.toggle("active", !!isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  // Toggle modal
  function toggleModal(force) {
    const modal = document.getElementById("vh-a11y-modal");
    if (!modal) return;

    const shouldOpen = force !== undefined ? force : !modal.classList.contains("active");
    if (shouldOpen) {
      modal.classList.add("active");
      updatePanelUI();
      const firstBtn = modal.querySelector("button");
      if (firstBtn) firstBtn.focus();
    } else {
      modal.classList.remove("active");
      const trigger = document.getElementById("vh-a11y-trigger");
      if (trigger) trigger.focus();
    }
  }

  // Event handlers
  function bindEvents() {
    // Reading guide mouse movement
    const guide = document.getElementById("vh-reading-guide");
    window.addEventListener("mousemove", e => {
      if (state.readingGuide && guide) {
        guide.style.top = e.clientY + "px";
      }
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", e => {
      // Alt + A -> Toggle accessibility panel
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        toggleModal();
      }
      // Alt + R -> Toggle Read / TTS
      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        if (isSpeaking) {
          toggleSpeechPause();
        } else {
          readSelectedOrSmartContent();
        }
      }
      // Escape -> Emergency halt speech or close modal
      if (e.key === "Escape") {
        const modal = document.getElementById("vh-a11y-modal");
        if (modal && modal.classList.contains("active")) {
          toggleModal(false);
        } else if (isSpeaking) {
          stopSpeech();
        }
      }
    });

    // Point-to-Read (hover / focus)
    document.addEventListener("mouseover", e => {
      if (!state.pointToRead || isSpeaking) return;
      const target = e.target.closest("p, h1, h2, h3, .card-title, .badge");
      if (!target || target.closest("#vh-a11y-modal, #vh-a11y-player")) return;

      clearTimeout(pointToReadTimer);
      pointToReadTimer = setTimeout(() => {
        if (state.pointToRead && target.textContent.trim().length > 3) {
          speakText(target.textContent.trim());
        }
      }, 400);
    });

    document.addEventListener("mouseout", () => {
      clearTimeout(pointToReadTimer);
    });

    // Delegated clicks for actions
    document.addEventListener("click", e => {
      // Trigger button
      const trigger = e.target.closest("#vh-a11y-trigger");
      if (trigger) {
        toggleModal();
        return;
      }

      // Close modal
      if (e.target.closest("#vh-a11y-close") || e.target.id === "vh-a11y-modal") {
        toggleModal(false);
        return;
      }

      // Action buttons in panel
      const actionBtn = e.target.closest("[data-vh-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-vh-action");
        handleAction(action);
        return;
      }

      // Audio player controls
      if (e.target.closest("#vh-player-toggle")) {
        toggleSpeechPause();
        return;
      }
      if (e.target.closest("#vh-player-stop")) {
        stopSpeech();
        return;
      }
      if (e.target.closest("#vh-player-speed")) {
        cycleSpeed();
        return;
      }
      if (e.target.closest("#vh-speak-all")) {
        readSelectedOrSmartContent();
        return;
      }
      if (e.target.closest("#vh-reset-all")) {
        resetAll();
        return;
      }
    });
  }

  function handleAction(action) {
    if (action === "dark-mode") {
      state.darkMode = !state.darkMode;
    } else if (action === "high-contrast") {
      state.highContrast = !state.highContrast;
    } else if (action === "grayscale") {
      state.grayscale = !state.grayscale;
    } else if (action === "invert") {
      state.invert = !state.invert;
    } else if (action === "large-text") {
      state.fontSize = state.fontSize === "large" ? "normal" : "large";
    } else if (action === "extra-large-text") {
      state.fontSize = state.fontSize === "extralarge" ? "normal" : "extralarge";
    } else if (action === "line-spacing") {
      state.lineSpacing = !state.lineSpacing;
    } else if (action === "readable-font") {
      state.readableFont = !state.readableFont;
    } else if (action === "focus-ring") {
      state.focusRing = !state.focusRing;
    } else if (action === "large-cursor") {
      state.largeCursor = !state.largeCursor;
    } else if (action === "reading-guide") {
      state.readingGuide = !state.readingGuide;
    } else if (action === "point-to-read") {
      state.pointToRead = !state.pointToRead;
    }

    saveState();
    applyState();
  }

  function cycleSpeed() {
    const speeds = [0.75, 1.0, 1.25, 1.5];
    let idx = speeds.indexOf(state.ttsSpeed || 1.0);
    idx = (idx + 1) % speeds.length;
    state.ttsSpeed = speeds[idx];
    saveState();
    updatePlayerUI();
  }

  function resetAll() {
    state = Object.assign({}, defaultState);
    saveState();
    applyState();
    stopSpeech();
  }

  // Quick toggle dark mode (usable from header or sidebar)
  window.toggleOpenITILDarkMode = function () {
    state.darkMode = !state.darkMode;
    saveState();
    applyState();
  };

  // Initialization
  function init() {
    loadState();
    applyState();
    initVoices();
  }

  // Run on first load and on Turbo navigation
  document.addEventListener("DOMContentLoaded", () => {
    init();
    bindEvents();
  });
  document.addEventListener("turbo:load", () => {
    applyState();
  });
})();
