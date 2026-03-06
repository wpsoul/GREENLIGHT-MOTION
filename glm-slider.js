/*! GLM Slider — Carousel addon with drag, loop, snap, and optional inertia */
(function (root) {
  'use strict';

  const instances = new WeakMap();

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function parseBool(value, fallback) {
    if (value == null) return fallback;
    if (value === '' || value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return fallback;
  }

  function resolveElement(value, scope) {
    if (!value) return null;
    if (value.nodeType === 1) return value;
    return (scope || document).querySelector(value);
  }

  function blendForDuration(durationSec, dtSec) {
    const duration = Math.max(durationSec || 0, 0.001);
    return 1 - Math.pow(0.01, dtSec / duration);
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function parseNumberPair(value, fallbackMin, fallbackMax) {
    if (value == null || value === '') return [fallbackMin, fallbackMax];
    const matches = String(value).match(/-?\d*\.?\d+/g);
    if (!matches || !matches.length) return [fallbackMin, fallbackMax];
    const first = parseFloat(matches[0]);
    const second = parseFloat(matches[1] != null ? matches[1] : matches[0]);
    const min = Number.isFinite(first) ? first : fallbackMin;
    const max = Number.isFinite(second) ? second : fallbackMax;
    return min <= max ? [min, max] : [max, min];
  }

  function slider(rootEl, opts) {
    opts = opts || {};
    rootEl = typeof rootEl === 'string' ? document.querySelector(rootEl) : rootEl;
    if (!rootEl) return { kill() {} };
    if (instances.has(rootEl)) return instances.get(rootEl);

    const viewport = resolveElement(opts.viewport, rootEl) || rootEl.querySelector('[data-glm-slider-viewport]') || rootEl;
    const track = resolveElement(opts.track, rootEl) || rootEl.querySelector('[data-glm-slider-track]') || viewport.firstElementChild;
    if (!viewport || !track) return { kill() {} };

    const originalItems = Array.from(track.children).filter(node => node.nodeType === 1);
    if (!originalItems.length) return { kill() {} };

    const prevInlineOverflow = viewport.style.overflow;
    const prevInlineTouchAction = viewport.style.touchAction;
    const prevTrackWillChange = track.style.willChange;
    const prevTrackTransform = track.style.transform;

    const prevItemInline = new Map();
    originalItems.forEach(item => {
      prevItemInline.set(item, {
        flex: item.style.flex,
        width: item.style.width,
      });
    });

    const perRowDesktop = Math.max(parseInt(opts.perRow, 10) || 1, 1);
    const perRowTablet = Math.max(parseInt(opts.perRowTablet, 10) || perRowDesktop, 1);
    const perRowMobile = Math.max(parseInt(opts.perRowMobile, 10) || perRowTablet, 1);
    const tabletBreakpoint = parseInt(opts.tabletBreakpoint, 10) || 1024;
    const mobileBreakpoint = parseInt(opts.mobileBreakpoint, 10) || 768;
    const loop = !!opts.loop;
    const snap = !!opts.snap;
    const freeScroll = !!opts.freeScroll;
    const dragEase = Number.isFinite(opts.ease) ? opts.ease : 0.24;
    const arrowDuration = Number.isFinite(opts.speed) ? opts.speed : 0.8;
    const snapDuration = Number.isFinite(opts.snapSpeed) ? opts.snapSpeed : 1;
    const inertiaEnabled = !!opts.inertia;
    const inertiaDecay = Number.isFinite(opts.inertiaDecay) ? opts.inertiaDecay : 0.92;
    const minVelocity = Number.isFinite(opts.minVelocity) ? opts.minVelocity : 20;
    const scrollStep = Math.max(parseInt(opts.scroll, 10) || 1, 1);
    const snapStep = Math.max(parseInt(opts.scrollSnap, 10) || 1, 1);
    const inertiaProp = opts.inertiaProp || '';
    const inertiaUnits = opts.inertiaUnits != null ? String(opts.inertiaUnits) : '';
    const inertiaStrength = Number.isFinite(opts.inertiaStrength) ? opts.inertiaStrength : 0.035;
    const [inertiaMin, inertiaMax] = parseNumberPair(opts.inertiaMinMax, -7, 7);

    const leftArrow = resolveElement(opts.leftArrow);
    const rightArrow = resolveElement(opts.rightArrow);

    let activePointerId = null;
    let dragging = false;
    let inertiaActive = false;
    let snapActive = false;
    let position = 0;
    let targetPosition = 0;
    let snapTarget = 0;
    let snapStartPosition = 0;
    let snapElapsed = 0;
    let activeSnapDuration = snapDuration;
    let velocity = 0;
    let startPointerX = 0;
    let startPosition = 0;
    let lastPointerX = 0;
    let lastPointerTime = 0;
    let lastWheelTime = 0;
    let lastFrameTime = 0;
    let lastMotionPosition = 0;
    let motionVelocity = 0;
    let rafId = null;
    let wheelSnapTimer = null;

    let clones = [];
    let renderedItems = originalItems.slice();
    let perRow = 1;
    let gap = 0;
    let itemWidth = 0;
    let slideStride = 0;
    let maxStartIndex = 0;
    let maxOffset = 0;
    let originalSpan = 0;
    let cloneOffset = 0;
    let hasLooping = false;
    let snapPoints = [{ itemIndex: 0, offset: 0 }];

    function emitUpdate() {
      rootEl.dispatchEvent(new CustomEvent('glm:sliderupdate', {
        detail: {
          position: getRenderedPosition(),
          rawPosition: position,
          velocity: motionVelocity,
          dragVelocity: velocity,
          isDragging: dragging,
          isInertia: inertiaActive,
          isSnapping: snapActive,
        }
      }));
    }

    function applyInertiaProp() {
      if (!inertiaProp) return;
      const next = clamp(motionVelocity * inertiaStrength, inertiaMin, inertiaMax);
      if (inertiaProp.startsWith('--') || inertiaProp.indexOf('-') !== -1) {
        rootEl.style.setProperty(inertiaProp, `${next}${inertiaUnits}`);
      } else {
        rootEl.style[inertiaProp] = `${next}${inertiaUnits}`;
      }
    }

    function clearWheelSnap() {
      if (!wheelSnapTimer) return;
      clearTimeout(wheelSnapTimer);
      wheelSnapTimer = null;
    }

    function getPerRow() {
      const width = root.innerWidth || window.innerWidth;
      if (width <= mobileBreakpoint) return perRowMobile;
      if (width <= tabletBreakpoint) return perRowTablet;
      return perRowDesktop;
    }

    function getGap() {
      const styles = getComputedStyle(track);
      return parseFloat(styles.columnGap || styles.gap || '0') || 0;
    }

    function clearClones() {
      clones.forEach(node => node.remove());
      clones = [];
      renderedItems = originalItems.slice();
    }

    function buildLoopClones() {
      clearClones();
      if (!hasLooping) return;

      const prepend = originalItems.map(item => {
        const clone = item.cloneNode(true);
        clone.setAttribute('data-glm-slider-clone', 'true');
        return clone;
      });
      const append = originalItems.map(item => {
        const clone = item.cloneNode(true);
        clone.setAttribute('data-glm-slider-clone', 'true');
        return clone;
      });

      prepend.forEach(node => track.insertBefore(node, track.firstChild));
      append.forEach(node => track.appendChild(node));
      clones = prepend.concat(append);
      renderedItems = Array.from(track.children).filter(node => node.nodeType === 1);
    }

    function clampPosition(value) {
      if (hasLooping) return value;
      return clamp(value, 0, maxOffset);
    }

    function normalizeLoopValue(value) {
      if (!hasLooping || !originalSpan) return clampPosition(value);
      return ((value - cloneOffset) % originalSpan + originalSpan) % originalSpan + cloneOffset;
    }

    function closestEquivalent(value, reference) {
      if (!hasLooping || !originalSpan) return value;
      const turns = Math.round((reference - value) / originalSpan);
      return value + turns * originalSpan;
    }

    function getRenderedPosition() {
      return hasLooping ? normalizeLoopValue(position) : clampPosition(position);
    }

    function render() {
      const renderedPosition = getRenderedPosition();
      track.style.transform = `translate3d(${-renderedPosition}px, 0, 0)`;
    }

    function stopFrame() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function startFrame() {
      if (!rafId) {
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(step);
      }
    }

    function normalizeItemIndex(index) {
      if (hasLooping) return ((index % originalItems.length) + originalItems.length) % originalItems.length;
      return clamp(index, 0, maxStartIndex);
    }

    function itemIndexToOffset(index) {
      const normalized = normalizeItemIndex(index);
      if (hasLooping) return normalized * slideStride;
      return Math.min(normalized * slideStride, maxOffset);
    }

    function itemIndexToPosition(index, reference) {
      const offset = itemIndexToOffset(index);
      const base = offset + (hasLooping ? cloneOffset : 0);
      return hasLooping ? closestEquivalent(base, reference != null ? reference : position) : base;
    }

    function getNearestItemIndex() {
      if (!slideStride) return 0;
      const local = hasLooping ? normalizeLoopValue(position) - cloneOffset : clampPosition(position);
      return normalizeItemIndex(Math.round(local / slideStride));
    }

    function getNearestSnapPoint() {
      const local = hasLooping ? normalizeLoopValue(position) - cloneOffset : clampPosition(position);
      let nearest = snapPoints[0];
      let minDist = Infinity;

      for (let i = 0; i < snapPoints.length; i++) {
        const point = snapPoints[i];
        const dist = Math.abs(point.offset - local);
        if (dist < minDist) {
          minDist = dist;
          nearest = point;
        }
      }

      return nearest;
    }

    function goToItem(index, durationSec) {
      snapStartPosition = position;
      snapElapsed = 0;
      snapTarget = itemIndexToPosition(index, position);
      targetPosition = snapTarget;
      activeSnapDuration = durationSec != null ? durationSec : snapDuration;
      snapActive = true;
      inertiaActive = false;
      velocity = 0;
      startFrame();
    }

    function step(now) {
      const dtSec = Math.max((now - lastFrameTime) / 1000, 1 / 120);
      lastFrameTime = now;
      rafId = null;
      let keepRunning = false;

      if (dragging) {
        position += (targetPosition - position) * dragEase;
        if (Math.abs(targetPosition - position) > 0.1) {
          keepRunning = true;
        } else {
          position = targetPosition;
        }
      } else if (inertiaActive) {
        const frameDecay = Math.pow(inertiaDecay, dtSec / (1 / 60));
        position = clampPosition(position + velocity * dtSec);
        if (!hasLooping && (position <= 0 || position >= maxOffset)) velocity = 0;
        velocity *= frameDecay;
        if (Math.abs(velocity) < minVelocity) {
          velocity = 0;
          inertiaActive = false;
          if (snap) {
            goToItem(getNearestSnapPoint().itemIndex, snapDuration);
            return;
          }
        } else {
          keepRunning = true;
        }
      } else if (snapActive) {
        snapElapsed += dtSec;
        const progress = clamp(snapElapsed / Math.max(activeSnapDuration, 0.001), 0, 1);
        const eased = easeInOutSine(progress);
        position = snapStartPosition + (snapTarget - snapStartPosition) * eased;
        if (progress >= 1) {
          position = snapTarget;
          snapActive = false;
        } else {
          keepRunning = true;
        }
      }

      const motionBefore = lastMotionPosition;
      render();
      motionVelocity = (position - motionBefore) / dtSec;
      lastMotionPosition = position;
      applyInertiaProp();
      emitUpdate();

      if (keepRunning || dragging || inertiaActive || snapActive) {
        startFrame();
      }
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== activePointerId) return;
      const deltaX = e.clientX - startPointerX;
      targetPosition = clampPosition(startPosition - deltaX);

      const now = performance.now();
      const dtSec = Math.max((now - lastPointerTime) / 1000, 1 / 120);
      const pointerVelocity = -(e.clientX - lastPointerX) / dtSec;
      velocity += (pointerVelocity - velocity) * 0.35;
      lastPointerX = e.clientX;
      lastPointerTime = now;
      startFrame();
    }

    function endDrag(e) {
      if (!dragging) return;
      if (e && activePointerId != null && e.pointerId !== activePointerId) return;

      dragging = false;
      activePointerId = null;
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', endDrag);
      root.removeEventListener('pointercancel', endDrag);

      if (viewport.releasePointerCapture && e) {
        try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      }

      inertiaActive = inertiaEnabled && Math.abs(velocity) >= minVelocity;
      if (!inertiaActive && snap) {
        goToItem(getNearestSnapPoint().itemIndex, snapDuration);
        return;
      }

      if (!inertiaActive) {
        position = targetPosition;
        motionVelocity = 0;
        lastMotionPosition = position;
      }

      startFrame();
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (originalItems.length <= perRow && !hasLooping) return;

      dragging = true;
      inertiaActive = false;
      snapActive = false;
      activePointerId = e.pointerId;
      startPointerX = e.clientX;
      startPosition = position;
      targetPosition = position;
      velocity = 0;
      lastPointerX = e.clientX;
      lastPointerTime = performance.now();

      if (viewport.setPointerCapture) {
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      }

      root.addEventListener('pointermove', onPointerMove);
      root.addEventListener('pointerup', endDrag);
      root.addEventListener('pointercancel', endDrag);
      startFrame();
      e.preventDefault();
    }

    function buildSnapPoints() {
      const points = [];
      const seen = new Set();

      if (hasLooping) {
        for (let i = 0; i < originalItems.length; i += snapStep) {
          const idx = normalizeItemIndex(i);
          if (seen.has(idx)) continue;
          seen.add(idx);
          points.push({ itemIndex: idx, offset: idx * slideStride });
        }
      } else {
        for (let i = 0; i <= maxStartIndex; i += snapStep) {
          const idx = clamp(i, 0, maxStartIndex);
          if (seen.has(idx)) continue;
          seen.add(idx);
          points.push({ itemIndex: idx, offset: itemIndexToOffset(idx) });
        }
        if (!seen.has(maxStartIndex)) {
          points.push({ itemIndex: maxStartIndex, offset: itemIndexToOffset(maxStartIndex) });
        }
      }

      snapPoints = points.length ? points : [{ itemIndex: 0, offset: 0 }];
    }

    function refresh() {
      const currentIndex = getNearestItemIndex();

      gap = getGap();
      perRow = Math.max(getPerRow(), 1);
      itemWidth = Math.max((viewport.clientWidth - gap * (perRow - 1)) / perRow, 0);
      slideStride = itemWidth + gap;
      maxStartIndex = Math.max(0, originalItems.length - perRow);
      maxOffset = Math.max(0, maxStartIndex * slideStride);
      originalSpan = originalItems.length * slideStride;
      hasLooping = loop && originalItems.length > perRow;
      cloneOffset = hasLooping ? originalSpan : 0;

      buildLoopClones();
      renderedItems.forEach(item => {
        item.style.flex = `0 0 ${itemWidth}px`;
        item.style.width = `${itemWidth}px`;
      });

      buildSnapPoints();

      const anchor = itemIndexToPosition(currentIndex, position || itemIndexToPosition(currentIndex, cloneOffset));
      position = anchor;
      targetPosition = anchor;
      snapStartPosition = anchor;
      snapTarget = anchor;
      snapElapsed = 0;
      motionVelocity = 0;
      lastMotionPosition = position;
      render();
      applyInertiaProp();
      emitUpdate();
    }

    function onResize() {
      refresh();
    }

    function onLeftClick(e) {
      if (e) e.preventDefault();
      goToItem(getNearestItemIndex() - scrollStep, arrowDuration);
    }

    function onRightClick(e) {
      if (e) e.preventDefault();
      goToItem(getNearestItemIndex() + scrollStep, arrowDuration);
    }

    function onDragStart(e) {
      e.preventDefault();
    }

    function onSelectStart(e) {
      if (dragging) e.preventDefault();
    }

    function normalizeWheelDelta(e) {
      const dominant = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!dominant) return 0;
      if (e.deltaMode === 1) return dominant * 16;
      if (e.deltaMode === 2) return dominant * Math.max(viewport.clientWidth, 1);
      return dominant;
    }

    function onWheel(e) {
      if (!freeScroll || dragging) return;
      if (originalItems.length <= perRow && !hasLooping) return;

      const delta = normalizeWheelDelta(e);
      if (!delta) return;

      const nextPosition = clampPosition(position + delta);
      const moved = hasLooping || Math.abs(nextPosition - position) > 0.01;

      if (!moved) return;

      e.preventDefault();
      clearWheelSnap();
      snapActive = false;
      inertiaActive = false;

      const now = performance.now();
      const dtSec = Math.max((now - lastWheelTime) / 1000, 1 / 60);
      lastWheelTime = now;

      velocity = (nextPosition - position) / dtSec;
      position = nextPosition;
      targetPosition = nextPosition;
      motionVelocity = velocity;
      lastMotionPosition = position;
      render();
      applyInertiaProp();
      emitUpdate();

      if (snap) {
        wheelSnapTimer = setTimeout(() => {
          wheelSnapTimer = null;
          velocity = 0;
          goToItem(getNearestSnapPoint().itemIndex, snapDuration);
        }, 140);
      }
    }

    viewport.style.overflow = 'hidden';
    viewport.style.touchAction = 'pan-y';
    track.style.willChange = 'transform';
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    rootEl.addEventListener('mouseleave', endDrag);
    rootEl.addEventListener('dragstart', onDragStart);
    rootEl.addEventListener('selectstart', onSelectStart);
    if (leftArrow) leftArrow.addEventListener('click', onLeftClick);
    if (rightArrow) rightArrow.addEventListener('click', onRightClick);
    window.addEventListener('resize', onResize);

    refresh();

    const api = {
      next() { onRightClick(); return api; },
      prev() { onLeftClick(); return api; },
      to(index) { goToItem(index, arrowDuration); return api; },
      refresh() { refresh(); return api; },
      kill() {
        stopFrame();
        endDrag();
        clearWheelSnap();
        clearClones();
        viewport.removeEventListener('pointerdown', onPointerDown);
        viewport.removeEventListener('wheel', onWheel);
        rootEl.removeEventListener('mouseleave', endDrag);
        rootEl.removeEventListener('dragstart', onDragStart);
        rootEl.removeEventListener('selectstart', onSelectStart);
        window.removeEventListener('resize', onResize);
        if (leftArrow) leftArrow.removeEventListener('click', onLeftClick);
        if (rightArrow) rightArrow.removeEventListener('click', onRightClick);
        viewport.style.overflow = prevInlineOverflow;
        viewport.style.touchAction = prevInlineTouchAction;
        track.style.willChange = prevTrackWillChange;
        track.style.transform = prevTrackTransform;
        if (inertiaProp) {
          if (inertiaProp.startsWith('--') || inertiaProp.indexOf('-') !== -1) rootEl.style.removeProperty(inertiaProp);
          else rootEl.style[inertiaProp] = '';
        }
        originalItems.forEach(item => {
          const prev = prevItemInline.get(item);
          if (!prev) return;
          item.style.flex = prev.flex;
          item.style.width = prev.width;
        });
        instances.delete(rootEl);
      }
    };

    instances.set(rootEl, api);
    return api;
  }

  function initSliders() {
    const els = document.querySelectorAll('[data-glm-slider]');
    els.forEach(el => {
      if (instances.has(el)) return;
      slider(el, {
        perRow: el.getAttribute('data-glm-slider-row'),
        perRowTablet: el.getAttribute('data-glm-slider-row-tablet'),
        perRowMobile: el.getAttribute('data-glm-slider-row-mobile'),
        leftArrow: el.getAttribute('data-glm-slider-left-arrow'),
        rightArrow: el.getAttribute('data-glm-slider-right-arrow'),
        loop: parseBool(el.getAttribute('data-glm-slider-loop'), false),
        snap: parseBool(el.getAttribute('data-glm-slider-snap'), false),
        freeScroll: parseBool(el.getAttribute('data-glm-slider-free-scroll'), false),
        inertia: parseBool(el.getAttribute('data-glm-slider-inertia'), false),
        inertiaProp: el.getAttribute('data-glm-slider-inertia-prop'),
        inertiaMinMax: el.getAttribute('data-glm-slider-inertia-minmax'),
        inertiaUnits: el.getAttribute('data-glm-slider-inertia-units'),
        inertiaStrength: parseFloat(el.getAttribute('data-glm-slider-inertia-strength')),
        speed: parseFloat(el.getAttribute('data-glm-slider-speed')),
        snapSpeed: parseFloat(el.getAttribute('data-glm-slider-snap-speed')),
        scroll: parseInt(el.getAttribute('data-glm-slider-scroll'), 10),
        scrollSnap: parseInt(el.getAttribute('data-glm-slider-scrollsnap'), 10),
      });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSliders);
    else initSliders();
  }

  if (typeof root.GLM !== 'undefined') {
    root.GLM.slider = slider;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = slider;
  }

  root.GLMSlider = slider;
})(typeof globalThis !== 'undefined' ? globalThis : this);
