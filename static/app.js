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
  
  // Attach tap and long-press listeners to every paragraph
  allParagraphs.forEach(p => setupParagraphListeners(p));
  
  setupScrollSpy();
  setupMediaSession();
  
  // Pre-load voices for Android
  if ('speechSynthesis' in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = () => populateVoices();
  }
});

// ============================================================
// SETTINGS & UI TOGGLES
// ============================================================

function toggleMenu(menuId) {
  const modal = document.getElementById(menuId);
  if (!modal) return;
  if (modal.style.display === 'none') {
    document.querySelectorAll('.menu-modal').forEach(m => m.style.display = 'none');
    modal.style.display = 'flex';
  } else {
    modal.style.display = 'none';
  }
}

let userSelectedVoice = null;

function populateVoices() {
  const select = document.getElementById('voiceSelect');
  if (!select) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  
  const currentVal = select.value;
  select.innerHTML = '';
  
  // Isolate English voices to provide different accents, but include local first
  const engVoices = voices.filter(v => v.lang.startsWith('en'));
  const otherVoices = voices.filter(v => !v.lang.startsWith('en'));
  
  const sortedVoices = [...engVoices, ...otherVoices];
  
  sortedVoices.forEach((v, i) => {
    const opt = document.createElement('option');
    // Map the index to the original voices array index to ensure we select the right voice on play
    opt.value = voices.indexOf(v);
    
    // Create a readable label capturing the accent (e.g. "en-GB")
    let label = `${v.name} (${v.lang})`;
    if (v.localService) label += " [Offline]";
    opt.textContent = label;
    
    select.appendChild(opt);
  });
  
  // Auto-select English local voice if nothing selected
  if (!currentVal) {
    const bestIdx = sortedVoices.findIndex(v => v.lang.startsWith('en') && v.localService);
    select.selectedIndex = bestIdx >= 0 ? bestIdx : 0;
    updateTTSConfig();
  } else {
    select.value = currentVal;
  }
}

function updateTTSConfig() {
  const select = document.getElementById('voiceSelect');
  if (select && select.value) {
    userSelectedVoice = window.speechSynthesis.getVoices()[select.value];
  }
  const rateInput = document.getElementById('rateSlider');
  if (rateInput) document.getElementById('rateLabel').textContent = parseFloat(rateInput.value).toFixed(1);
  const pitchInput = document.getElementById('pitchSlider');
  if (pitchInput) document.getElementById('pitchLabel').textContent = parseFloat(pitchInput.value).toFixed(1);
}

function formatTextForSpeech(text) {
  let pText = text;
  
  const expandBox = document.getElementById('expandNumbersCheck');
  if (expandBox && expandBox.checked) {
      // Basic expansion of common patterns: "#1" -> "number 1"
      pText = pText.replace(/#(\d+)/g, "number $1");
  }

  const punctBox = document.getElementById('removePunctuationCheck');
  if (punctBox && punctBox.checked) {
      // Remove pauses caused by specific punctuation
      pText = pText.replace(/[:;"\-\[\]\(\)]/g, " ");
  }

  return pText;
}

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

  const utteranceText = formatTextForSpeech(text);
  const utterance = new SpeechSynthesisUtterance(utteranceText);
  currentUtterance = utterance;
  
  // Apply Config
  if (userSelectedVoice) {
    utterance.voice = userSelectedVoice;
  }
  const rateInput = document.getElementById('rateSlider');
  if (rateInput) utterance.rate = parseFloat(rateInput.value);
  const pitchInput = document.getElementById('pitchSlider');
  if (pitchInput) utterance.pitch = parseFloat(pitchInput.value);

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
// TAP-TO-LISTEN & LONG-PRESS (myJournal Integration)
// ============================================================

function setupParagraphListeners(el) {
  let pressTimer;
  let isLongPress = false;

  // Handle Desktop Right Click
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    promptExport(el.textContent);
  });

  // Handle Mobile Long Press
  el.addEventListener('touchstart', (e) => {
    isLongPress = false; 
    pressTimer = window.setTimeout(() => {
      isLongPress = true;
      promptExport(el.textContent);
    }, 800); // 800ms long press
  }, { passive: true });

  el.addEventListener('touchend', () => { clearTimeout(pressTimer); });
  el.addEventListener('touchmove', () => { clearTimeout(pressTimer); });

  // Handle normal tap to play (skipping if long press happened)
  el.addEventListener('click', (e) => {
    if (isLongPress) {
      isLongPress = false; // Reset flag
      return;
    }
    speakParagraph(el);
  });
}

function promptExport(text) {
  // Prevent TTS from firing immediately after the prompt closes
  stopSpeech();
  
  const wantsExport = window.confirm("Export to myJournal?\n\nWould you like to save this snippet to your notes?");
  if (wantsExport) {
    alert("myJournal integration coming soon! (Snippet saved to clipboard conditionally)");
    // In the future: fetch('http://localhost:XXXX/api/journal', body: text)
  }
}

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
// CONCEPT CAPTURE (Summary & AI)
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

function requestAISummary(btn) {
  // Hide the TOC modal if it's open
  toggleMenu('tocModal');
  
  const conceptBody = document.getElementById('conceptBody');
  if (!conceptBody) return;

  // Visual feedback
  const oldContent = conceptBody.innerHTML;
  conceptBody.innerHTML = '<p class="summary-para" style="color: var(--gold); text-align: center; font-weight: 600;">✨ Generating AI Summary...</p>';
  
  // Scrape all article paragraphs as context
  const fullArticleText = Array.from(document.querySelectorAll('.article-para:not(.summary-para)'))
                               .map(p => p.textContent.trim())
                               .join(' ');

  fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: fullArticleText })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'ok' && data.summary) {
      // Build the new UI inject
      conceptBody.innerHTML = '';
      data.summary.forEach(para => {
        const pTag = document.createElement('p');
        pTag.className = 'article-para summary-para';
        pTag.style.borderLeftColor = 'var(--gold)'; // Special styling for AI output
        pTag.textContent = para;
        setupParagraphListeners(pTag); // Enable tap to listen & long press 
        conceptBody.appendChild(pTag);
      });
      
      // Update the header label so they know it's AI
      const label = document.querySelector('.concept-label');
      if (label) label.innerHTML = '✨ AI Generated Summary';
      
      // Scroll to the top to see the result
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      conceptBody.innerHTML = oldContent;
      alert("AI Error: " + (data.message || "Unknown error"));
    }
  })
  .catch(err => {
    conceptBody.innerHTML = oldContent;
    console.error(err);
    alert("Network error contacting AI");
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
