// ============================================================
// wikiRead — app.js
// TTS state machine + UI controller
// ============================================================

let isSpeaking = false;
let globalPlayMode = false;
let allParagraphs = [];
let currentParaIndex = -1;
let currentSpeakingEl = null;

// Gather all paragraphs in document order on load
document.addEventListener('DOMContentLoaded', () => {
  allParagraphs = Array.from(document.querySelectorAll('.article-para'));
  setupScrollSpy();
});

// ============================================================
// SPEAK CORE
// ============================================================

async function speakText(text, onDone) {
  isSpeaking = true;
  showMiniPlayer(text);

  try {
    const res = await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (data.status === 'desktop') {
      // Desktop testing mode: simulate a delay based on word count
      console.log('[Desktop TTS]:', text.substring(0, 80) + '...');
      const ms = Math.max(1500, (text.split(' ').length / 3) * 1000);
      await new Promise(r => setTimeout(r, ms));
    } else {
      // Termux: termux-tts-speak is called; estimate duration
      const ms = Math.max(1500, (text.split(' ').length / 3) * 1000);
      await new Promise(r => setTimeout(r, ms));
    }
  } catch (e) {
    console.error('Speak error:', e);
  }

  if (onDone) onDone();
}

async function stopSpeech() {
  isSpeaking = false;
  globalPlayMode = false;
  currentParaIndex = -1;

  if (currentSpeakingEl) {
    currentSpeakingEl.classList.remove('speaking');
    currentSpeakingEl = null;
  }

  document.getElementById('globalPlayBtn').textContent = '▶';
  document.getElementById('globalPlayBtn').classList.remove('playing');
  hideMiniPlayer();

  // Remove all playing states
  document.querySelectorAll('.section-play-btn.playing').forEach(b => b.classList.remove('playing'));
  document.querySelectorAll('.article-para.speaking').forEach(p => p.classList.remove('speaking'));

  try {
    await fetch('/stop', { method: 'POST' });
  } catch (e) {}
}

// ============================================================
// TAP-TO-LISTEN (single paragraph)
// ============================================================

async function speakParagraph(el) {
  if (!el) return;

  // If tapping the currently speaking para, stop
  if (currentSpeakingEl === el && isSpeaking) {
    await stopSpeech();
    return;
  }

  // Clear previous highlight
  if (currentSpeakingEl) currentSpeakingEl.classList.remove('speaking');

  currentSpeakingEl = el;
  el.classList.add('speaking');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateSectionLabel(el);

  const text = el.textContent.trim();
  globalPlayMode = false;

  await stopSpeech();
  currentSpeakingEl = el;
  el.classList.add('speaking');
  isSpeaking = true;
  showMiniPlayer(text);

  await fetch('/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).catch(() => {});

  // Estimate reading time then clean up
  const ms = Math.max(1500, (text.split(' ').length / 3) * 1000);
  await new Promise(r => setTimeout(r, ms));

  if (currentSpeakingEl === el) {
    el.classList.remove('speaking');
    currentSpeakingEl = null;
    isSpeaking = false;
    hideMiniPlayer();
  }
}

// ============================================================
// SECTION PLAY
// ============================================================

async function playSection(sectionIndex) {
  await stopSpeech();

  const sectionEl = document.getElementById(`section-${sectionIndex}`);
  if (!sectionEl) return;

  const btn = sectionEl.querySelector('.section-play-btn');
  const paragraphs = Array.from(sectionEl.querySelectorAll('.article-para'));

  if (!paragraphs.length) return;

  btn.classList.add('playing');
  globalPlayMode = true;

  for (const para of paragraphs) {
    if (!globalPlayMode) break;
    // Find index in allParagraphs for global tracking
    currentParaIndex = allParagraphs.indexOf(para);
    if (currentSpeakingEl) currentSpeakingEl.classList.remove('speaking');
    currentSpeakingEl = para;
    para.classList.add('speaking');
    para.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateSectionLabel(para);

    const text = para.textContent.trim();
    showMiniPlayer(text);
    isSpeaking = true;

    await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).catch(() => {});

    const ms = Math.max(1500, (text.split(' ').length / 3) * 1000);
    await new Promise(r => setTimeout(r, ms));

    if (currentSpeakingEl === para) para.classList.remove('speaking');
  }

  btn.classList.remove('playing');
  if (globalPlayMode) {
    // Move to next section
    const nextSection = document.getElementById(`section-${sectionIndex + 1}`);
    if (nextSection) {
      playSection(sectionIndex + 1);
    } else {
      stopSpeech();
    }
  }
}

// ============================================================
// GLOBAL PLAY (reads full article from start)
// ============================================================

async function toggleGlobalPlay() {
  const btn = document.getElementById('globalPlayBtn');

  if (globalPlayMode || isSpeaking) {
    await stopSpeech();
    btn.textContent = '▶';
    btn.classList.remove('playing');
    return;
  }

  btn.textContent = '⏸';
  btn.classList.add('playing');
  globalPlayMode = true;

  for (let i = 0; i < allParagraphs.length; i++) {
    if (!globalPlayMode) break;
    const para = allParagraphs[i];
    currentParaIndex = i;
    if (currentSpeakingEl) currentSpeakingEl.classList.remove('speaking');
    currentSpeakingEl = para;
    para.classList.add('speaking');
    para.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateSectionLabel(para);

    const text = para.textContent.trim();
    showMiniPlayer(text);
    isSpeaking = true;

    await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).catch(() => {});

    const ms = Math.max(1500, (text.split(' ').length / 3) * 1000);
    await new Promise(r => setTimeout(r, ms));
    if (currentSpeakingEl === para) para.classList.remove('speaking');
  }

  if (globalPlayMode) stopSpeech();
}

// ============================================================
// SUMMARY (Concept Capture)
// ============================================================

async function playSummary() {
  const btn = document.getElementById('conceptPlayBtn');
  if (!btn) return;

  if (isSpeaking && btn.classList.contains('playing')) {
    await stopSpeech();
    btn.textContent = '▶ Listen to Summary';
    btn.classList.remove('playing');
    return;
  }

  await stopSpeech();
  const paras = Array.from(document.querySelectorAll('#conceptBody p'));
  const fullText = paras.map(p => p.textContent.trim()).join(' ');

  btn.textContent = '⏸ Stop';
  btn.classList.add('playing');
  globalPlayMode = false;
  isSpeaking = true;
  showMiniPlayer(fullText);

  try {
    await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText })
    });
    const ms = Math.max(2000, (fullText.split(' ').length / 3) * 1000);
    await new Promise(r => setTimeout(r, ms));
  } catch (e) {}

  btn.textContent = '▶ Listen to Summary';
  btn.classList.remove('playing');
  isSpeaking = false;
  hideMiniPlayer();
}

// ============================================================
// UI UTILITIES
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

  // Update TOC active link
  document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
  const sectionId = section.id;
  const tocLink = document.querySelector(`.toc-link[href="#${sectionId}"]`);
  if (tocLink) tocLink.classList.add('active');
}

function scrollToSection(index) {
  const el = document.getElementById(`section-${index}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Scroll spy: update top bar section label as user scrolls
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
