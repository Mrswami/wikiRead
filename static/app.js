// ============================================================
// wikiRead — app.js
// Speech Synthesis Engine + UI Controller
// ============================================================

let isSpeaking = false;
let globalPlayMode = false;
let allParagraphs = [];
let currentParaIndex = -1;
let currentSpeakingEl = null;
let currentUtterance = null;
let isSummaryPlaying = false;

// Gather all paragraphs in document order on load
document.addEventListener('DOMContentLoaded', () => {
  allParagraphs = Array.from(document.querySelectorAll('.article-para'));
  setupScrollSpy();
  setupMediaSession();
  
  // Pre-load voices for Android
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
});

// ============================================================
// TTS CORE (Web Speech API)
// ============================================================

function speakText(text, containerEl, onDone) {
  if (!('speechSynthesis' in window)) {
    console.error("Speech Synthesis not supported");
    if (onDone) onDone();
    return;
  }

  isSpeaking = true;
  showMiniPlayer(text);
  window.speechSynthesis.cancel(); // Instantly stop anything else

  // PREPARE WORD HIGHLIGHTING
  // If a container is provided (like a paragraph), wrap each word in a <span>
  if (containerEl) {
    const tokens = text.match(/\S+|\s+/g) || [];
    containerEl.innerHTML = '';
    tokens.forEach((token) => {
      if (token.trim() === '') {
        containerEl.appendChild(document.createTextNode(token));
      } else {
        const span = document.createElement('span');
        span.textContent = token;
        containerEl.appendChild(span);
      }
    });
  }

  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;
  
  // Pick the best natural voice on Android
  const voices = window.speechSynthesis.getVoices();
  const bestVoice = voices.find(v => v.localService && v.lang.startsWith('en')) || voices[0];
  if (bestVoice) utterance.voice = bestVoice;

  // WORD HIGHLIGHTING EVENT
  utterance.onboundary = (event) => {
    if (event.name === 'word' && containerEl) {
      let passedChars = 0;
      let highlighted = false;
      for (const node of containerEl.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          passedChars += node.textContent.length;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          node.classList.remove('word-highlight');
          const wordLen = node.textContent.length;
          // Synchronize spoken word with the span based on character index
          if (!highlighted && event.charIndex >= passedChars && event.charIndex < passedChars + wordLen) {
            node.classList.add('word-highlight');
            highlighted = true;
          }
          passedChars += wordLen;
        }
      }
    }
  };

  utterance.onend = () => {
    cleanupHighlighting(containerEl, text);
    if (onDone) onDone();
  };

  utterance.onerror = (e) => {
    // Only fire done if it wasn't a manual cancellation
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
       cleanupHighlighting(containerEl, text);
       if (onDone) onDone();
    }
  };

  window.speechSynthesis.speak(utterance);
}

function cleanupHighlighting(containerEl, originalText) {
  if (containerEl && document.body.contains(containerEl)) {
    // Strip the spans and return the paragraph to pure text
    containerEl.textContent = originalText;
  }
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  
  isSpeaking = false;
  globalPlayMode = false;
  isSummaryPlaying = false;
  
  if (currentSpeakingEl) {
    currentSpeakingEl.classList.remove('speaking');
    cleanupHighlighting(currentSpeakingEl, currentSpeakingEl.textContent);
    currentSpeakingEl = null;
  }
  
  const gBtn = document.getElementById('globalPlayBtn');
  if (gBtn) {
    gBtn.textContent = '▶';
    gBtn.classList.remove('playing');
  }

  const sBtn = document.getElementById('conceptPlayBtn');
  if (sBtn) {
    sBtn.textContent = '▶ Listen to Summary';
    sBtn.classList.remove('playing');
  }

  document.querySelectorAll('.section-play-btn.playing').forEach(b => b.classList.remove('playing'));
  document.querySelectorAll('.article-para.speaking').forEach(p => p.classList.remove('speaking'));
  
  hideMiniPlayer();
}

// ============================================================
// TAP-TO-LISTEN
// ============================================================

function speakParagraph(el) {
  if (!el) return;

  if (currentSpeakingEl === el && isSpeaking) {
    stopSpeech();
    return;
  }

  stopSpeech();

  currentSpeakingEl = el;
  el.classList.add('speaking');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateSectionLabel(el);

  const text = el.textContent.trim();
  currentParaIndex = allParagraphs.indexOf(el);

  speakText(text, el, () => {
    if (currentSpeakingEl === el) {
      el.classList.remove('speaking');
      currentSpeakingEl = null;
      isSpeaking = false;
      hideMiniPlayer();
    }
  });
}

// ============================================================
// CONTINUOUS GLOBAL PLAY
// ============================================================

function toggleGlobalPlay() {
  const btn = document.getElementById('globalPlayBtn');

  if (globalPlayMode || isSpeaking) {
    stopSpeech();
    return;
  }

  btn.textContent = '⏸';
  btn.classList.add('playing');
  globalPlayMode = true;

  // Start from the current paragraph, or the top if none selected
  let startIndex = currentParaIndex >= 0 ? currentParaIndex : 0;
  playSequence(allParagraphs, startIndex);
}

function playSection(sectionIndex) {
  const sectionEl = document.getElementById(`section-${sectionIndex}`);
  if (!sectionEl) return;
  const paragraphs = Array.from(sectionEl.querySelectorAll('.article-para'));
  if (!paragraphs.length) return;

  stopSpeech();
  
  const btn = sectionEl.querySelector('.section-play-btn');
  btn.classList.add('playing');
  globalPlayMode = true;

  playSequence(paragraphs, 0, () => {
    btn.classList.remove('playing');
    // Once section is done, optionally jump to next section here if you prefer
    stopSpeech();
  });
}

function playSequence(paras, index, onComplete) {
  if (!globalPlayMode || index >= paras.length) {
    if (onComplete) onComplete();
    else stopSpeech();
    return;
  }

  const para = paras[index];
  currentParaIndex = allParagraphs.indexOf(para);
  
  if (currentSpeakingEl) {
      currentSpeakingEl.classList.remove('speaking');
      cleanupHighlighting(currentSpeakingEl, currentSpeakingEl.textContent);
  }
  
  currentSpeakingEl = para;
  para.classList.add('speaking');
  para.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateSectionLabel(para);

  const text = para.textContent.trim();
  
  speakText(text, para, () => {
    if (globalPlayMode && currentSpeakingEl === para) {
      para.classList.remove('speaking');
      playSequence(paras, index + 1, onComplete);
    }
  });
}

// ============================================================
// CONCEPT CAPTURE (Summary)
// ============================================================

function playSummary() {
  const btn = document.getElementById('conceptPlayBtn');
  if (!btn) return;

  if (isSpeaking && isSummaryPlaying) {
    stopSpeech();
    return;
  }

  stopSpeech();
  const paras = Array.from(document.querySelectorAll('#conceptBody p'));
  const fullText = paras.map(p => p.textContent.trim()).join(' ');

  btn.textContent = '⏸ Stop';
  btn.classList.add('playing');
  isSummaryPlaying = true;
  
  speakText(fullText, null, () => {
    btn.textContent = '▶ Listen to Summary';
    btn.classList.remove('playing');
    isSummaryPlaying = false;
    hideMiniPlayer();
  });
}

// ============================================================
// OS MEDIA PLAYER INTEGRATION (Lock Screen Controls)
// ============================================================

function setupMediaSession() {
  if ('mediaSession' in navigator) {
    const thumbEl = document.querySelector('.article-thumb');
    const titleEl = document.querySelector('.article-title');
    
    // Register the article to the OS Media Player
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: titleEl ? titleEl.textContent : 'wikiRead',
          artist: 'Wikipedia Audio Version',
          album: 'wikiRead Open Learning',
          artwork: thumbEl ? [{ src: thumbEl.src, sizes: '512x512', type: 'image/jpeg' }] : []
        });

        // Hook up the physical/lock-screen buttons
        navigator.mediaSession.setActionHandler('play', () => toggleGlobalPlay());
        navigator.mediaSession.setActionHandler('pause', () => stopSpeech());
        navigator.mediaSession.setActionHandler('stop', () => stopSpeech());
    } catch (e) { console.error("MediaSession error:", e); }
  }
}

// ============================================================
// UI COMPONENTS
// ============================================================

function showMiniPlayer(text) {
  const player = document.getElementById('miniPlayer');
  const textEl = document.getElementById('miniPlayerText');
  if (player) player.style.display = 'flex';
  if (textEl) textEl.textContent = text.substring(0, 80) + (text.length > 80 ? '...' : '');
}

function hideMiniPlayer() {
  const player = document.getElementById('miniPlayer');
  if (player) player.style.display = 'none';
}

function updateSectionLabel(paraEl) {
  const section = paraEl.closest('.article-section');
  if (!section) return;
  const heading = section.querySelector('.section-heading');
  const label = document.getElementById('currentSectionLabel');
  if (heading && label) label.textContent = heading.textContent;

  document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
  const tocLink = document.querySelector(`.toc-link[href="#${section.id}"]`);
  if (tocLink) tocLink.classList.add('active');
}

function scrollToSection(index) {
  const el = document.getElementById(`section-${index}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setupScrollSpy() {
  const sections = document.querySelectorAll('.article-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isSpeaking) {
        const heading = entry.target.querySelector('.section-heading');
        const label = document.getElementById('currentSectionLabel');
        if (heading && label) label.textContent = heading.textContent;

        document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
        const tocLink = document.querySelector(`.toc-link[href="#${entry.target.id}"]`);
        if (tocLink) tocLink.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

  sections.forEach(s => observer.observe(s));
}
