/*! GLM Magnetic — Cursor-following magnetic effect addon */
(function (root) {
  'use strict';

  function lerp(a, b, n) { return a + (b - a) * n; }

  function magnetic(el, opts = {}) {
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el) return { kill() {} };

    const strength = opts.strength || 0.3;
    const ease = opts.ease || 0.1;
    const maxDist = opts.maxDistance || Infinity;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    let rafId = null;

    const animate = () => {
      currentX = lerp(currentX, targetX, ease);
      currentY = lerp(currentY, targetY, ease);

      if (Math.abs(currentX - targetX) < 0.1 && Math.abs(currentY - targetY) < 0.1) {
        currentX = targetX;
        currentY = targetY;
        el.style.transform = `translate(${currentX}px, ${currentY}px)`;
        rafId = null;
        return;
      }

      el.style.transform = `translate(${currentX}px, ${currentY}px)`;
      rafId = requestAnimationFrame(animate);
    };

    const requestFrame = () => {
      if (!rafId) rafId = requestAnimationFrame(animate);
    };

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (maxDist !== Infinity && dist > maxDist) {
        targetX = 0;
        targetY = 0;
      } else {
        targetX = dx * strength;
        targetY = dy * strength;
      }
      requestFrame();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      requestFrame();
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    return {
      kill() {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
        if (rafId) cancelAnimationFrame(rafId);
        el.style.transform = '';
      }
    };
  }

  if (typeof root.GLM !== 'undefined') {
    root.GLM.magnetic = magnetic;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = magnetic;
  }

  root.GLMMagnetic = magnetic;

})(typeof globalThis !== 'undefined' ? globalThis : this);
