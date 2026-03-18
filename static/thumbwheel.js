/**
 * 🎡 ThumbWheel.js - Precision Mobile Navigation Engine
 * A universal standard for high-speed mobile scrolling.
 */

window.ThumbWheel = (function() {
  let isGrabbing = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let velocity = 0;
  let hideTimer = null;
  let rafId = null;
  let momentumRafId = null;
  
  let config = {
    sensitivity: 12,
    hideDelay: 2500,
    momentum: 0.92, // Friction (lower = faster stop)
    tickSpacing: 25   // Pixels between visual 'rotation' ticks
  };

  function init(userConfig = {}) {
    config = { ...config, ...userConfig };
    
    let wheel = document.getElementById('thumbWheel');
    if (!wheel) {
      wheel = document.createElement('div');
      wheel.id = 'thumbWheel';
      wheel.className = 'thumb-wheel hidden';
      
      // Inject Ticks for the 'Rotation' effect
      const ticksContainer = document.createElement('div');
      ticksContainer.className = 'thumb-wheel-ticks';
      for (let i = 0; i < 8; i++) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        ticksContainer.appendChild(tick);
      }
      wheel.appendChild(ticksContainer);
      
      wheel.innerHTML += '<span class="thumb-wheel-label" id="thumbLabel">0%</span>';
      document.body.appendChild(wheel);
    }

    const label = document.getElementById('thumbLabel');
    const ticks = wheel.querySelector('.thumb-wheel-ticks');

    window.addEventListener('scroll', () => {
      if (isGrabbing) return;
      show();
      resetTimer();
      updateVisuals();
    }, { passive: true });

    wheel.addEventListener('touchstart', (e) => {
      isGrabbing = true;
      startY = e.touches[0].clientY;
      lastY = startY;
      startScroll = window.scrollY;
      velocity = 0;
      
      if (momentumRafId) cancelAnimationFrame(momentumRafId);
      wheel.classList.add('active');
      document.body.classList.add('thumb-wheel-active');
      show();
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isGrabbing) return;
      
      const currentY = e.touches[0].clientY;
      velocity = currentY - lastY; // Simple velocity tracking
      lastY = currentY;
      
      const deltaY = currentY - startY;
      const targetScroll = startScroll + (deltaY * config.sensitivity);
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, behavior: 'auto' });
        updateVisuals();
      });
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (!isGrabbing) return;
      isGrabbing = false;
      wheel.classList.remove('active');
      document.body.classList.remove('thumb-wheel-active');
      
      // Start Momentum Loop
      if (Math.abs(velocity) > 2) {
        applyMomentum();
      } else {
        resetTimer();
      }
    });

    function updateVisuals() {
      // Update Percentage
      const winHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = Math.min(100, Math.max(0, (window.scrollY / winHeight) * 100));
      if (label) label.textContent = Math.round(pct) + "%";
      
      // Move Ticks to simulate rotation
      if (ticks) {
        const offset = (window.scrollY / 10) % config.tickSpacing;
        ticks.style.transform = `translateY(${offset}px)`;
      }
    }

    function applyMomentum() {
      if (isGrabbing) return;
      
      window.scrollBy(0, velocity * config.sensitivity * 0.5);
      velocity *= config.momentum;
      updateVisuals();
      
      if (Math.abs(velocity) > 0.1) {
        momentumRafId = requestAnimationFrame(applyMomentum);
      } else {
        resetTimer();
      }
    }
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
