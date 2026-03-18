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
      
      // Position Lock (X & Y)
      updatePosition(e.touches[0].clientX, e.touches[0].clientY);
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isGrabbing) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      velocity = currentY - lastY;
      lastY = currentY;
      
      // DYNAMIC SENSITIVITY ENGINE (v3.2)
      // High sensitivity at center, precision at edges
      const screenCenterX = window.innerWidth / 2;
      const maxDist = screenCenterX;
      const distFromCenter = Math.abs(currentX - screenCenterX);
      const normalizedDist = Math.max(0, Math.min(1, distFromCenter / maxDist));
      
      // Speed Prism: Center boost (up to 20x) vs Edge precision (1x - 5x)
      // Sensitivity is inverse to distance from center
      const dynamicSensitivity = 1 + (1 - normalizedDist) * 20; 
      
      const deltaY = currentY - startY;
      const targetScroll = startScroll + (deltaY * dynamicSensitivity);
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, behavior: 'auto' });
        
        // Track thumb in 2D space
        updatePosition(currentX, currentY);
        updateVisuals();
        
        // Visual indicator: Aura size scale based on sensitivity boost
        const auraScale = 1 + (1 - normalizedDist) * 0.5;
        if (wheel) wheel.style.setProperty('--tw-aura-scale', auraScale);
      });
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (!isGrabbing) return;
      isGrabbing = false;
      wheel.classList.remove('active');
      document.body.classList.remove('thumb-wheel-active');
      
      // Elastic return to center right
      wheel.style.left = 'auto';
      wheel.style.right = '12px';
      wheel.style.top = '50%';
      wheel.style.transform = 'translateY(-50%)';
      
      if (Math.abs(velocity) > 2) {
        applyMomentum();
      } else {
        resetTimer();
      }
    });

    function updatePosition(x, y) {
      if (wheel) {
        wheel.style.right = 'auto'; // Disable default right alignment
        wheel.style.left = `${x}px`;
        wheel.style.top = `${y}px`;
        wheel.style.transform = 'translate(-50%, -50%)'; // Center on point
      }
    }

    function updateVisuals() {
      const winHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = Math.min(100, Math.max(0, (window.scrollY / winHeight) * 100));
      if (label) label.textContent = Math.round(pct) + "%";
      
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
