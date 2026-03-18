window.ThumbWheel = (function() {
  let isGrabbing = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let velocity = 0;
  let rafId = null;
  let momentumRafId = null;
  
  let config = {
    sensitivity: 12,
    momentum: 0.92, // Friction (lower = faster stop)
    tickSpacing: 25   // Pixels between visual 'rotation' ticks
  };

  function init(userConfig = {}) {
    config = { ...config, ...userConfig };
    
    let wheel = document.getElementById('thumbWheel');
    if (!wheel) {
      wheel = document.createElement('div');
      wheel.id = 'thumbWheel';
      wheel.className = 'thumb-wheel'; // Remove .hidden
      
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

    // (SCROLL LISTENER REMOVED - ALWAYS VISIBLE)

    wheel.addEventListener('touchstart', (e) => {
      isGrabbing = true;
      startY = e.touches[0].clientY;
      lastY = startY;
      startScroll = window.scrollY;
      velocity = 0;
      
      if (momentumRafId) cancelAnimationFrame(momentumRafId);
      wheel.classList.add('active');
      document.body.classList.add('thumb-wheel-active');
      
      updatePosition(e.touches[0].clientX, e.touches[0].clientY);
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isGrabbing) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      velocity = currentY - lastY;
      lastY = currentY;
      
      const screenCenterX = window.innerWidth / 2;
      const distFromCenter = Math.abs(currentX - screenCenterX);
      const normalizedDist = Math.max(0, Math.min(1, distFromCenter / screenCenterX));
      const dynamicSensitivity = 1 + (1 - normalizedDist) * 20; 
      
      const deltaY = currentY - startY;
      const targetScroll = startScroll + (deltaY * dynamicSensitivity);
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, behavior: 'auto' });
        updatePosition(currentX, currentY);
        updateVisuals();
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
      
      wheel.style.left = 'auto';
      wheel.style.right = '12px';
      wheel.style.top = '50%';
      wheel.style.transform = 'translateY(-50%)';
      
      if (Math.abs(velocity) > 2) {
        applyMomentum();
      }
    });

    function updatePosition(x, y) {
      if (wheel) {
        wheel.style.right = 'auto';
        wheel.style.left = `${x}px`;
        wheel.style.top = `${y}px`;
        wheel.style.transform = 'translate(-50%, -50%)';
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
      window.scrollBy(0, velocity * 6);
      velocity *= config.momentum;
      updateVisuals();
      if (Math.abs(velocity) > 0.1) {
        momentumRafId = requestAnimationFrame(applyMomentum);
      }
    }
  }

  return { init };
})();

// Auto-init on load if using as a standalone script
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThumbWheel) window.ThumbWheel.init();
});
