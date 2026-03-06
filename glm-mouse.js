/*! GLM Mouse — Custom cursor addon */
(function (root) {
  'use strict';

  const instances = new WeakMap();

  function resolveElement(value, scope) {
    if (!value) return null;
    if (value.nodeType === 1) return value;
    return (scope || document).querySelector(value);
  }

  function parseBool(value) {
    return value === '' || value === 'true' || value === '1';
  }

  function mouse(el, opts = {}) {
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el) return { kill() {} };
    if (instances.has(el)) return instances.get(el);

    const template = resolveElement(opts.object, document);
    if (!template) return { kill() {} };

    const fade = !!opts.fade;
    const scaleAppearance = !!opts.scale;
    const scaleTargets = opts.scaleObject ? Array.from(document.querySelectorAll(opts.scaleObject)) : [];
    const previousCursor = el.style.cursor;
    const previousTargetCursors = scaleTargets.map(node => ({ node, cursor: node.style.cursor }));

    const cursor = document.createElement('div');
    cursor.className = 'glm-mouse-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    Object.assign(cursor.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      pointerEvents: 'none',
      zIndex: '2147483647',
      transform: 'translate3d(-9999px, -9999px, 0) scale(0.9)',
      transformOrigin: 'center center',
      opacity: fade ? '0' : '1',
      transition: fade ? 'opacity 180ms ease' : 'none',
      willChange: 'transform, opacity',
    });

    const content = template.cloneNode(true);
    content.removeAttribute('id');
    if (content.classList) content.classList.remove('mouse-cursor-template');
    content.style.display = 'block';
    cursor.appendChild(content);
    document.body.appendChild(cursor);

    let visible = false;
    let activePointer = false;
    let extraScale = 1;
    let currentX = -9999;
    let currentY = -9999;
    let targetX = -9999;
    let targetY = -9999;
    let currentScale = scaleAppearance ? 0.9 : 1;
    let targetScale = 1;
    let rafId = null;

    const requestFrame = () => {
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    const step = () => {
      currentX += (targetX - currentX) * 0.22;
      currentY += (targetY - currentY) * 0.22;
      currentScale += (targetScale - currentScale) * 0.18;

      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${currentScale})`;

      if (
        Math.abs(targetX - currentX) > 0.1 ||
        Math.abs(targetY - currentY) > 0.1 ||
        Math.abs(targetScale - currentScale) > 0.01
      ) {
        rafId = requestAnimationFrame(step);
      } else {
        currentX = targetX;
        currentY = targetY;
        currentScale = targetScale;
        rafId = null;
      }
    };

    const syncVisibility = () => {
      cursor.style.opacity = visible ? '1' : (fade ? '0' : '1');
      if (!visible && !fade) {
        targetX = -9999;
        targetY = -9999;
      }
      targetScale = (visible ? 1 : (scaleAppearance ? 0.9 : 1)) * extraScale;
      requestFrame();
    };

    const onMove = e => {
      activePointer = true;
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        visible = true;
        syncVisibility();
      } else {
        requestFrame();
      }
    };

    const onEnter = e => {
      visible = true;
      if (e) {
        targetX = e.clientX;
        targetY = e.clientY;
      }
      syncVisibility();
    };

    const onLeave = () => {
      visible = false;
      activePointer = false;
      syncVisibility();
    };

    const onScaleEnter = () => {
      extraScale = 1.22;
      targetScale = (visible ? 1 : (scaleAppearance ? 0.9 : 1)) * extraScale;
      requestFrame();
    };

    const onScaleLeave = () => {
      extraScale = 1;
      targetScale = (visible ? 1 : (scaleAppearance ? 0.9 : 1)) * extraScale;
      requestFrame();
    };

    el.style.cursor = 'none';
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    scaleTargets.forEach(({ style }, index) => {
      const node = scaleTargets[index];
      node.style.cursor = 'none';
      node.addEventListener('mouseenter', onScaleEnter);
      node.addEventListener('mouseleave', onScaleLeave);
    });

    const api = {
      kill() {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
        scaleTargets.forEach(node => {
          node.removeEventListener('mouseenter', onScaleEnter);
          node.removeEventListener('mouseleave', onScaleLeave);
        });
        previousTargetCursors.forEach(({ node, cursor: value }) => { node.style.cursor = value; });
        el.style.cursor = previousCursor;
        if (rafId) cancelAnimationFrame(rafId);
        cursor.remove();
        instances.delete(el);
      }
    };

    instances.set(el, api);
    return api;
  }

  function initMouseObjects() {
    const els = document.querySelectorAll('[data-glm-mouse-object]');
    els.forEach(el => {
      if (instances.has(el)) return;
      mouse(el, {
        object: el.getAttribute('data-glm-mouse-object'),
        fade: parseBool(el.getAttribute('data-glm-mouse-fade')),
        scale: parseBool(el.getAttribute('data-glm-mouse-scale')),
        scaleObject: el.getAttribute('data-glm-mouse-scale-object'),
      });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMouseObjects);
    else initMouseObjects();
  }

  if (typeof root.GLM !== 'undefined') {
    root.GLM.mouse = mouse;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = mouse;
  }

  root.GLMMouse = mouse;
})(typeof globalThis !== 'undefined' ? globalThis : this);
