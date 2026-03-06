/*! GLM Graggable — Draggable addon with optional boundaries */
(function (root) {
  'use strict';

  const instances = new WeakMap();

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function getMatrixCtor() {
    return root.DOMMatrix || root.WebKitCSSMatrix || null;
  }

  function readMatrix(el) {
    const MatrixCtor = getMatrixCtor();
    if (!MatrixCtor) return null;
    const transform = getComputedStyle(el).transform;
    return new MatrixCtor(transform && transform !== 'none' ? transform : 'matrix(1, 0, 0, 1, 0, 0)');
  }

  function writeMatrix(el, matrix, x, y) {
    const MatrixCtor = getMatrixCtor();
    if (!MatrixCtor || !matrix) {
      el.style.transform = `translate(${x}px, ${y}px)`;
      return;
    }
    const next = new MatrixCtor(matrix.toString());
    next.m41 = x;
    next.m42 = y;
    el.style.transform = next.toString();
  }

  function resolveBoundary(boundary) {
    if (!boundary) return null;
    if (typeof boundary === 'string') return document.querySelector(boundary);
    return boundary;
  }

  function draggable(el, opts) {
    opts = opts || {};
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el) return { kill() {} };
    if (instances.has(el)) return instances.get(el);

    const boundaryOpt = opts.boundary || null;
    const dragEase = opts.ease != null ? opts.ease : 0.22;
    const inertiaDecay = opts.inertiaDecay != null ? opts.inertiaDecay : 0.92;
    const minVelocity = opts.minVelocity != null ? opts.minVelocity : 6;
    const previousTouchAction = el.style.touchAction;
    const previousCursor = el.style.cursor;

    let activePointerId = null;
    let dragging = false;
    let inertiaActive = false;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let startX = 0;
    let startY = 0;
    let startPointerX = 0;
    let startPointerY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastPointerTime = 0;
    let minDx = -Infinity;
    let maxDx = Infinity;
    let minDy = -Infinity;
    let maxDy = Infinity;
    let baseMatrix = null;
    let rafId = null;

    const syncCurrentPosition = () => {
      const matrix = readMatrix(el);
      if (!matrix) return;
      currentX = matrix.m41 || 0;
      currentY = matrix.m42 || 0;
      targetX = currentX;
      targetY = currentY;
    };

    const clampToBounds = () => {
      const minX = startX + minDx;
      const maxX = startX + maxDx;
      const minY = startY + minDy;
      const maxY = startY + maxDy;

      if (Number.isFinite(minX) || Number.isFinite(maxX)) {
        const nextX = clamp(currentX, minX, maxX);
        if (nextX !== currentX) velocityX = 0;
        currentX = nextX;
        targetX = clamp(targetX, minX, maxX);
      }

      if (Number.isFinite(minY) || Number.isFinite(maxY)) {
        const nextY = clamp(currentY, minY, maxY);
        if (nextY !== currentY) velocityY = 0;
        currentY = nextY;
        targetY = clamp(targetY, minY, maxY);
      }
    };

    const stopFrame = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const startFrame = () => {
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    const step = now => {
      let keepRunning = false;

      if (dragging) {
        currentX += (targetX - currentX) * dragEase;
        currentY += (targetY - currentY) * dragEase;
        if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) keepRunning = true;
      } else if (inertiaActive) {
        const dtSec = Math.max((now - lastPointerTime) / 1000, 1 / 120);
        lastPointerTime = now;
        const frameDecay = Math.pow(inertiaDecay, dtSec / (1 / 60));

        currentX += velocityX * dtSec;
        currentY += velocityY * dtSec;
        velocityX *= frameDecay;
        velocityY *= frameDecay;

        if (Math.abs(velocityX) < minVelocity) velocityX = 0;
        if (Math.abs(velocityY) < minVelocity) velocityY = 0;
        if (velocityX !== 0 || velocityY !== 0) keepRunning = true;
        else inertiaActive = false;
      }

      clampToBounds();
      writeMatrix(el, baseMatrix, currentX, currentY);

      if (keepRunning) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = null;
      }
    };

    const onPointerMove = e => {
      if (!dragging || e.pointerId !== activePointerId) return;

      const dx = clamp(e.clientX - startPointerX, minDx, maxDx);
      const dy = clamp(e.clientY - startPointerY, minDy, maxDy);

      targetX = startX + dx;
      targetY = startY + dy;

      const now = performance.now();
      const dtSec = Math.max((now - lastPointerTime) / 1000, 1 / 120);
      const pointerVX = (e.clientX - lastPointerX) / dtSec;
      const pointerVY = (e.clientY - lastPointerY) / dtSec;
      velocityX += (pointerVX - velocityX) * 0.35;
      velocityY += (pointerVY - velocityY) * 0.35;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerTime = now;
      startFrame();
    };

    const endDrag = e => {
      if (e && activePointerId != null && e.pointerId !== activePointerId) return;
      if (!dragging) return;

      dragging = false;
      inertiaActive = Math.abs(velocityX) >= minVelocity || Math.abs(velocityY) >= minVelocity;
      activePointerId = null;
      el.style.cursor = 'grab';
      if (el.releasePointerCapture && e) {
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', endDrag);
      root.removeEventListener('pointercancel', endDrag);
      lastPointerTime = performance.now();
      if (inertiaActive) startFrame();
    };

    const onPointerDown = e => {
      if (e.button != null && e.button !== 0) return;

      const boundaryEl = resolveBoundary(boundaryOpt);
      const rect = el.getBoundingClientRect();
      const boundaryRect = boundaryEl ? boundaryEl.getBoundingClientRect() : null;

      syncCurrentPosition();
      baseMatrix = readMatrix(el);
      startX = currentX;
      startY = currentY;
      startPointerX = e.clientX;
      startPointerY = e.clientY;

      if (boundaryRect) {
        minDx = boundaryRect.left - rect.left;
        maxDx = boundaryRect.right - rect.right;
        minDy = boundaryRect.top - rect.top;
        maxDy = boundaryRect.bottom - rect.bottom;
      } else {
        minDx = -Infinity;
        maxDx = Infinity;
        minDy = -Infinity;
        maxDy = Infinity;
      }

      inertiaActive = false;
      velocityX = 0;
      velocityY = 0;
      dragging = true;
      activePointerId = e.pointerId;
      el.style.cursor = 'grabbing';
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerTime = performance.now();
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
      root.addEventListener('pointermove', onPointerMove);
      root.addEventListener('pointerup', endDrag);
      root.addEventListener('pointercancel', endDrag);
      startFrame();
      e.preventDefault();
    };

    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onPointerDown);

    const api = {
      kill() {
        endDrag();
        inertiaActive = false;
        stopFrame();
        el.removeEventListener('pointerdown', onPointerDown);
        el.style.touchAction = previousTouchAction;
        el.style.cursor = previousCursor;
        instances.delete(el);
      }
    };

    instances.set(el, api);
    return api;
  }

  function initDraggables() {
    const els = document.querySelectorAll('[data-glm-draggable]');
    els.forEach(el => {
      if (instances.has(el)) return;
      const boundary = el.getAttribute('data-glm-draggable');
      draggable(el, { boundary: boundary || null });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDraggables);
    else initDraggables();
  }

  if (typeof root.GLM !== 'undefined') {
    root.GLM.draggable = draggable;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = draggable;
  }

  root.GLMGraggable = draggable;
})(typeof globalThis !== 'undefined' ? globalThis : this);
