/**
 * 🎡 ThumbWheel.js - Precision Mobile Navigation Engine
 * A universal standard for high-speed mobile scrolling.
 */

window.ThumbWheel = (function() {
  let isGrabbing = false;
  let startY = 0;
  let startScroll = 0;
  let hideTimer = null;
  let rafId = null;
  let config = {
    sensitivity: 12,
    hideDelay: 2500,
    accentColor: '#3680b0'
  };

  function init(userConfig = {}) {
    config = { ...config, ...userConfig };
    
    // Create DOM if not already present
    let wheel = document.getElementById('thumbWheel');
    if (!wheel) {
      wheel = document.createElement('div');
      wheel.id = 'thumbWheel';
      wheel.className = 'thumb-wheel hidden';
      wheel.innerHTML = '<span class="thumb-wheel-label" id="thumbLabel">0%</span>';
      document.body.appendChild(wheel);
    }

    const label = document.getElementById('thumbLabel');

    // Show on scroll
    window.addEventListener('scroll', () => {
      if (isGrabbing) return;
      show();
      resetTimer();
    }, { passive: true });

    // Touch Start
    wheel.addEventListener('touchstart', (e) => {
      isGrabbing = true;
      startY = e.touches[0].clientY;
      startScroll = window.scrollY;
      
      wheel.classList.add('active');
      document.body.classList.add('thumb-wheel-active');
      show();
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // Touch Move (The Engine)
    window.addEventListener('touchmove', (e) => {
      if (!isGrabbing) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      const targetScroll = startScroll + (deltaY * config.sensitivity);
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        window.scrollTo({
          top: targetScroll,
          behavior: 'auto'
        });
        
        const winHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const pct = Math.min(100, Math.max(0, (window.scrollY / winHeight) * 100));
        if (label) label.textContent = Math.round(pct) + "%";
      });
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // Touch End
    window.addEventListener('touchend', () => {
      if (!isGrabbing) return;
      isGrabbing = false;
      wheel.classList.remove('active');
      document.body.classList.remove('thumb-wheel-active');
      if (rafId) cancelAnimationFrame(rafId);
      resetTimer();
    });
  }

  function show() {
    const wheel = document.getElementById('thumbWheel');
    if (wheel) wheel.classList.remove('hidden');
  }

  function resetTimer() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isGrabbing) {
        const wheel = document.getElementById('thumbWheel');
        if (wheel) wheel.classList.add('hidden');
      }
    }, config.hideDelay);
  }

  return { init };
})();

// Auto-init on load if using as a standalone script
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThumbWheel) window.ThumbWheel.init();
});
