/*! GLM – Greenlight Motion v1.0.0 | Tiny animation framework */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define(factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GLM = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_EASE = 'power2.out';
  const DEFAULT_DURATION = 0.7;
  const DEFAULT_VIEW_THRESHOLD = 0.85;

  const PI = Math.PI;
  const HALF_PI = PI / 2;
  const TWO_PI = PI * 2;
  const TRANSFORM_PROPS = new Set([
    'translateX', 'translateY', 'translateZ',
    'rotate', 'rotateX', 'rotateY', 'rotateZ',
    'scale', 'scaleX', 'scaleY', 'scaleZ',
    'skewX', 'skewY',
  ]);
  const SCALE_PROPS = new Set(['scale', 'scaleX', 'scaleY', 'scaleZ']);
  const FILTER_PREFIX = 'filter-';
  const CLIP_PATH_PROP = 'clipPath';
  const CLIP_PATH_DEFAULT = 'inset(0% 0% 0% 0%)';
  const UNIT_DEFAULTS = {
    translateX: 'px', translateY: 'px', translateZ: 'px',
    rotate: 'deg', rotateX: 'deg', rotateY: 'deg', rotateZ: 'deg',
    skewX: 'deg', skewY: 'deg',
    'filter-blur': 'px', 'filter-drop-shadow': '', 'filter-hue-rotate': 'deg',
  };
  const PROP_ALIASES = {
    translatex: 'translateX',
    translatey: 'translateY',
    translatez: 'translateZ',
    rotatex: 'rotateX',
    rotatey: 'rotateY',
    rotatez: 'rotateZ',
    scalex: 'scaleX',
    scaley: 'scaleY',
    scalez: 'scaleZ',
    skewx: 'skewX',
    skewy: 'skewY',
    clippath: 'clipPath',
    'clip-path': 'clipPath',
    opacity: 'opacity',
  };

  // ─── EASING LIBRARY ───────────────────────────────────────────
  const easings = {
    'none': t => t,
    'linear': t => t,
    'power1.in': t => t * t,
    'power1.out': t => 1 - (1 - t) * (1 - t),
    'power1.inOut': t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
    'power2.in': t => t * t * t,
    'power2.out': t => 1 - (1 - t) ** 3,
    'power2.inOut': t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
    'power3.in': t => t ** 4,
    'power3.out': t => 1 - (1 - t) ** 4,
    'power3.inOut': t => t < .5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2,
    'power4.in': t => t ** 5,
    'power4.out': t => 1 - (1 - t) ** 5,
    'power4.inOut': t => t < .5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2,
    'back.in': t => { const c = 1.70158; return (c + 1) * t ** 3 - c * t * t; },
    'back.out': t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
    'back.inOut': t => {
      const c = 1.70158 * 1.525;
      return t < .5
        ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2
        : ((2 * t - 2) ** 2 * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
    },
    'elastic.in': t => t === 0 || t === 1 ? t : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * TWO_PI / 3),
    'elastic.out': t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * TWO_PI / 3) + 1,
    'elastic.inOut': t => {
      if (t === 0 || t === 1) return t;
      const c = TWO_PI / 4.5;
      return t < .5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c)) / 2 + 1;
    },
    'bounce.in': t => 1 - easings['bounce.out'](1 - t),
    'bounce.out': t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
      return n * (t -= 2.625 / d) * t + .984375;
    },
    'bounce.inOut': t => t < .5
      ? (1 - easings['bounce.out'](1 - 2 * t)) / 2
      : (1 + easings['bounce.out'](2 * t - 1)) / 2,
    'circ.in': t => 1 - Math.sqrt(1 - t * t),
    'circ.out': t => Math.sqrt(1 - (t - 1) ** 2),
    'circ.inOut': t => t < .5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
    'expo.in': t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    'expo.out': t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    'expo.inOut': t => {
      if (t === 0 || t === 1) return t;
      return t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    'sine.in': t => 1 - Math.cos(t * HALF_PI),
    'sine.out': t => Math.sin(t * HALF_PI),
    'sine.inOut': t => -(Math.cos(PI * t) - 1) / 2,
    'ease-in': t => t ** 3,
    'ease-out': t => 1 - (1 - t) ** 3,
    'ease-in-out': t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
    'steps': n => t => Math.floor(t * n) / n,
  };

  function cubicBezier(x1, y1, x2, y2) {
    const sz = 11, ss = 1 / (sz - 1), sv = new Float32Array(sz);
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slp = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    for (let i = 0; i < sz; i++) sv[i] = calc(i * ss, x1, x2);
    return t => {
      if (t === 0 || t === 1) return t;
      let lo = 0, s = 1;
      for (; s < sz - 1 && sv[s] <= t; s++) lo += ss;
      s--;
      const g = lo + ((t - sv[s]) / (sv[s + 1] - sv[s])) * ss;
      const sl = slp(g, x1, x2);
      let ct = g;
      if (sl >= .001) { for (let i = 0; i < 8; i++) { const d = slp(ct, x1, x2); if (d === 0) break; ct -= (calc(ct, x1, x2) - t) / d; } }
      else if (sl !== 0) { let a = lo, b = lo + ss; for (let i = 0; i < 10; i++) { ct = a + (b - a) / 2; if (calc(ct, x1, x2) - t > 0) b = ct; else a = ct; } }
      return calc(ct, y1, y2);
    };
  }

  function resolveEasing(name) {
    if (!name) return easings[DEFAULT_EASE];
    if (name === 'none') return easings.none;
    if (typeof name === 'function') return name;
    if (easings[name]) return easings[name];
    let m = name.match(/^cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)$/);
    if (m) return cubicBezier(+m[1], +m[2], +m[3], +m[4]);
    m = name.match(/^steps\(\s*(\d+)\s*\)$/);
    if (m) return easings.steps(+m[1]);
    return easings[DEFAULT_EASE];
  }

  // ─── UTILITIES ────────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  function parseValue(raw) {
    if (typeof raw === 'number') return { value: raw, unit: '' };
    const m = String(raw).match(/^(-?[\d.]+)\s*(%|px|em|rem|vh|vw|deg|rad|turn|s|ms)?$/);
    if (m) return { value: parseFloat(m[1]), unit: m[2] || '' };
    return { value: raw, unit: '' };
  }

  function parseComplexValue(raw) {
    const str = String(raw).trim();
    const re = /(-?\d*\.?\d+)\s*(%|px|em|rem|vh|vw|deg|rad|turn)?/g;
    const parts = [];
    const values = [];
    let lastIndex = 0;
    let match;

    while ((match = re.exec(str))) {
      parts.push(str.slice(lastIndex, match.index));
      values.push({ value: parseFloat(match[1]), unit: match[2] || '' });
      lastIndex = re.lastIndex;
    }
    parts.push(str.slice(lastIndex));

    if (!values.length) return null;
    return { raw: str, parts, values };
  }

  function canInterpolateComplex(from, to) {
    if (!from || !to) return false;
    if (from.parts.length !== to.parts.length || from.values.length !== to.values.length) return false;
    for (let i = 0; i < from.parts.length; i++) {
      if (from.parts[i] !== to.parts[i]) return false;
    }
    for (let i = 0; i < from.values.length; i++) {
      if (from.values[i].unit !== to.values[i].unit) return false;
    }
    return true;
  }

  function interpolateComplexValue(from, to, t) {
    if (!canInterpolateComplex(from, to)) return t < 1 ? from.raw : to.raw;
    let out = '';
    for (let i = 0; i < from.values.length; i++) {
      out += from.parts[i];
      out += round3(from.values[i].value + (to.values[i].value - from.values[i].value) * t) + to.values[i].unit;
    }
    out += from.parts[from.parts.length - 1];
    return out;
  }

  function normalizePropName(prop) {
    if (!prop) return prop;
    if (TRANSFORM_PROPS.has(prop) || prop.startsWith(FILTER_PREFIX) || prop === 'opacity' || prop === CLIP_PATH_PROP) return prop;
    const lower = String(prop).toLowerCase();
    if (PROP_ALIASES[lower]) return PROP_ALIASES[lower];
    if (lower.startsWith(FILTER_PREFIX)) return FILTER_PREFIX + lower.slice(FILTER_PREFIX.length);
    return prop;
  }

  // ─── ELEMENT TRANSFORM/FILTER STATE ────────────────────────
  // Instead of reading computed matrix, we track per-element state explicitly
  const _elState = new WeakMap();

  function _getState(el) {
    if (!_elState.has(el)) {
      const cs = getComputedStyle(el);
      const baseTransform = cs.transform && cs.transform !== 'none' ? cs.transform : '';
      const baseFilter = cs.filter && cs.filter !== 'none' ? cs.filter : '';
      _elState.set(el, {
        transforms: {},
        filters: {},
        baseTransform,
        baseFilter,
      });
    }
    return _elState.get(el);
  }

  function _writeStyles(el) {
    const st = _getState(el);
    const tp = [];
    for (const [k, tv] of Object.entries(st.transforms)) {
      const unit = tv.unit != null ? tv.unit : (UNIT_DEFAULTS[k] || '');
      tp.push(`${k}(${round3(tv.value)}${unit})`);
    }
    const composedTransform = [st.baseTransform, tp.join(' ')].filter(Boolean).join(' ').trim();
    el.style.transform = composedTransform;

    const fp = [];
    for (const [k, fv] of Object.entries(st.filters)) {
      const unit = fv.unit != null ? fv.unit : (UNIT_DEFAULTS['filter-' + k] || '');
      fp.push(`${k}(${round3(fv.value)}${unit})`);
    }
    const composedFilter = [st.baseFilter, fp.join(' ')].filter(Boolean).join(' ').trim();
    el.style.filter = composedFilter;
  }

  function _setProp(el, prop, numericValue, unitOverride) {
    const st = _getState(el);
    if (TRANSFORM_PROPS.has(prop)) {
      st.transforms[prop] = {
        value: numericValue,
        unit: unitOverride != null ? unitOverride : (UNIT_DEFAULTS[prop] || ''),
      };
    } else if (prop.startsWith(FILTER_PREFIX)) {
      st.filters[prop.slice(FILTER_PREFIX.length)] = {
        value: numericValue,
        unit: unitOverride != null ? unitOverride : (UNIT_DEFAULTS[prop] || ''),
      };
    } else if (prop === CLIP_PATH_PROP) {
      el.style.clipPath = typeof numericValue === 'string' ? numericValue : String(numericValue);
    } else {
      const unit = unitOverride != null ? unitOverride : (UNIT_DEFAULTS[prop] || '');
      el.style[prop] = round3(numericValue) + unit;
    }
  }

  function _flushEl(el) { _writeStyles(el); }

  function _getDefaultValue(prop) {
    if (SCALE_PROPS.has(prop)) return 1;
    if (prop === 'opacity') return 1;
    return 0;
  }

  function _getCurrentPropState(el, prop) {
    const normalizedProp = normalizePropName(prop);
    if (TRANSFORM_PROPS.has(normalizedProp)) {
      const st = _getState(el);
      const entry = st.transforms[normalizedProp];
      return {
        value: entry != null ? entry.value : _getDefaultValue(normalizedProp),
        unit: entry != null ? entry.unit : (UNIT_DEFAULTS[normalizedProp] || ''),
      };
    }
    if (normalizedProp.startsWith(FILTER_PREFIX)) {
      const st = _getState(el);
      const key = normalizedProp.slice(FILTER_PREFIX.length);
      const entry = st.filters[key];
      return {
        value: entry != null ? entry.value : 0,
        unit: entry != null ? entry.unit : (UNIT_DEFAULTS[normalizedProp] || ''),
      };
    }
    if (normalizedProp === CLIP_PATH_PROP) {
      const raw = getComputedStyle(el).clipPath;
      const value = raw && raw !== 'none' ? raw : CLIP_PATH_DEFAULT;
      return {
        value,
        raw: value,
        complex: parseComplexValue(value),
        unit: '',
      };
    }
    if (normalizedProp === 'opacity') {
      const inlineOpacity = parseFloat(el.style.opacity);
      const computedOpacity = parseFloat(getComputedStyle(el).opacity);
      const value = Number.isNaN(inlineOpacity)
        ? (Number.isNaN(computedOpacity) ? 1 : computedOpacity)
        : inlineOpacity;
      return { value, unit: '' };
    }
    const cs = getComputedStyle(el)[normalizedProp];
    const parsed = parseValue(cs);
    return {
      value: typeof parsed.value === 'number' ? parsed.value : 0,
      unit: parsed.unit || UNIT_DEFAULTS[normalizedProp] || '',
    };
  }

  function _snapshotProps(el, props) {
    const snapshot = {};
    for (const prop of Object.keys(props)) {
      const current = _getCurrentPropState(el, prop);
      snapshot[prop] = current.raw != null ? current.raw : (current.unit ? `${current.value}${current.unit}` : current.value);
    }
    return snapshot;
  }

  // ─── RAF TICKER ───────────────────────────────────────────────
  const _ticker = {
    _cbs: new Set(), _running: false, _last: 0,
    add(fn) { this._cbs.add(fn); if (!this._running) this._start(); },
    remove(fn) { this._cbs.delete(fn); if (!this._cbs.size) this._running = false; },
    _start() {
      this._running = true; this._last = performance.now();
      const loop = () => {
        if (!this._running) return;
        const now = performance.now(), dt = now - this._last;
        this._last = now;
        for (const cb of this._cbs) cb(now, dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };

  // ─── CORE TWEEN ───────────────────────────────────────────────
  class Tween {
    constructor(targets, props, opts = {}) {
      this.targets = typeof targets === 'string'
        ? Array.from(document.querySelectorAll(targets))
        : (Array.isArray(targets) ? targets : [targets]);
      this.duration = (opts.duration != null ? opts.duration : DEFAULT_DURATION) * 1000;
      this.delay = (opts.delay || 0) * 1000;
      this.ease = resolveEasing(opts.ease || opts.easing);
      this.yoyo = opts.yoyo || false;
      this.repeat = opts.repeat || 0;
      this.stagger = (opts.stagger || 0) * 1000;
      this.paused = opts.paused || false;
      this.reversed = false;
      this.onStart = opts.onStart || null;
      this.onUpdate = opts.onUpdate || null;
      this.onComplete = opts.onComplete || null;
      this.inertia = opts.inertia || false;
      this.inertiaDecay = opts.inertiaDecay || 0.92;

      this._propDefs = [];
      for (const [rawProp, v] of Object.entries(props)) {
        const prop = normalizePropName(rawProp);
        if (prop === CLIP_PATH_PROP) {
          const raw = String(v).trim();
          this._propDefs.push({
            prop,
            kind: 'complex',
            toRaw: raw,
            toComplex: parseComplexValue(raw),
          });
          continue;
        }
        const pv = parseValue(v);
        this._propDefs.push({
          prop,
          kind: 'numeric',
          toValue: pv.value,
          unit: pv.unit || UNIT_DEFAULTS[prop] || '',
        });
      }

      this._perTarget = null;
      this._elapsed = 0;
      this._started = false;
      this._done = false;
      this._repeatCount = 0;
      this._tickBound = this._tick.bind(this);
      if (!this.paused) this.play();
    }

    _init() {
      this._perTarget = this.targets.map(el => {
        const entries = this._propDefs.map(pd => {
          const current = _getCurrentPropState(el, pd.prop);
          if (pd.kind === 'complex') {
            return {
              prop: pd.prop,
              kind: 'complex',
              fromRaw: current.raw != null ? current.raw : CLIP_PATH_DEFAULT,
              toRaw: pd.toRaw,
              fromComplex: current.complex || parseComplexValue(current.raw || CLIP_PATH_DEFAULT),
              toComplex: pd.toComplex,
              current: current.raw != null ? current.raw : CLIP_PATH_DEFAULT,
            };
          }
          const fromVal = current.value;
          return {
            prop: pd.prop,
            kind: 'numeric',
            from: fromVal,
            to: typeof pd.toValue === 'number' ? pd.toValue : fromVal,
            unit: pd.unit || current.unit,
            velocity: 0,
            current: fromVal,
          };
        });
        return entries;
      });
      this._started = true;
      if (this.onStart) this.onStart();
    }

    _tick(now, dt) {
      if (this._done || this.paused) return;
      if (!this._started) this._init();

      this._elapsed += dt;
      const dtSec = Math.max(dt / 1000, 0.001);
      let allDone = true;

      this.targets.forEach((el, i) => {
        const stOff = i * this.stagger;
        const local = this._elapsed - this.delay - stOff;
        if (local < 0) { allDone = false; return; }

        let raw = clamp(local / this.duration, 0, 1);
        let prog = this.reversed ? 1 - raw : raw;
        if (this.yoyo && this._repeatCount % 2 === 1) prog = 1 - prog;
        const eased = this.ease(prog);

        const entries = this._perTarget[i];
        for (const e of entries) {
          if (e.kind === 'complex') {
            e.current = interpolateComplexValue(e.fromComplex, e.toComplex, eased);
            _setProp(el, e.prop, e.current);
            continue;
          }
          const prev = e.current;
          e.current = e.from + (e.to - e.from) * eased;
          if (this.inertia) e.velocity = (e.current - prev) / dtSec;
          _setProp(el, e.prop, e.current, e.unit);
        }
        _flushEl(el);

        if (raw >= 1) {
          if (this.repeat === -1 || this._repeatCount < this.repeat) {
            this._repeatCount++;
            this._elapsed = this.delay + stOff;
            allDone = false;
          }
        } else {
          allDone = false;
        }
      });

      if (this.onUpdate) this.onUpdate();

      if (allDone) {
        this.targets.forEach((el, i) => {
          const entries = this._perTarget[i];
          for (const e of entries) {
            if (e.kind === 'complex') {
              const finalVal = this.reversed ? e.fromRaw : e.toRaw;
              e.current = finalVal;
              _setProp(el, e.prop, finalVal);
              continue;
            }
            const finalVal = this.reversed ? e.from : e.to;
            e.current = finalVal;
            _setProp(el, e.prop, finalVal, e.unit);
          }
          _flushEl(el);
        });

        this._done = true;
        _ticker.remove(this._tickBound);
        if (this.inertia) this._runInertia();
        if (this.onComplete) this.onComplete();
      }
    }

    _runInertia() {
      const decay = this.inertiaDecay;
      const durationSec = Math.max(this.duration / 1000, 0.001);
      const minSeedVelocity = 12;
      const seedMultiplier = 0.08;
      const data = this.targets.map((el, i) =>
        ({
          el,
          entries: this._perTarget[i].map(e => {
            let velocity = e.velocity;
            if (Math.abs(velocity) < 0.5) {
              const projected = (e.to - e.from) / durationSec;
              if (projected !== 0) {
                velocity = Math.sign(projected) * Math.max(Math.abs(projected) * seedMultiplier, minSeedVelocity);
              }
            }
            return { ...e, velocity };
          }),
        })
      );

      let lastNow = performance.now();
      const step = now => {
        const dtSec = Math.max((now - lastNow) / 1000, 1 / 120);
        lastNow = now;
        const frameDecay = Math.pow(decay, dtSec / (1 / 60));
        let any = false;
        for (const d of data) {
          for (const e of d.entries) {
            if (e.kind === 'complex') continue;
            if (Math.abs(e.velocity) < 2) { e.velocity = 0; continue; }
            any = true;
            e.current += e.velocity * dtSec;
            e.velocity *= frameDecay;
            _setProp(d.el, e.prop, e.current, e.unit);
          }
          _flushEl(d.el);
        }
        if (any) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    play() { this.paused = false; this._done = false; _ticker.add(this._tickBound); return this; }
    pause() { this.paused = true; _ticker.remove(this._tickBound); return this; }

    reverse() {
      this.reversed = !this.reversed;
      this._elapsed = 0; this._started = false; this._done = false;
      return this.play();
    }

    restart() {
      this._elapsed = 0; this._done = false; this._started = false;
      this._repeatCount = 0; this.reversed = false;
      return this.play();
    }

    kill() { this._done = true; _ticker.remove(this._tickBound); }

    progress(p) {
      if (p === undefined) {
        const total = this.duration + this.delay + (this.targets.length - 1) * this.stagger;
        return total > 0 ? clamp(this._elapsed / total, 0, 1) : 0;
      }
      if (!this._started) this._init();
      const total = this.duration + this.delay + (this.targets.length - 1) * this.stagger;
      this._elapsed = p * total;

      this.targets.forEach((el, i) => {
        const stOff = i * this.stagger;
        const local = this._elapsed - this.delay - stOff;
        const raw = clamp(local / this.duration, 0, 1);
        const eased = this.ease(raw);
        const entries = this._perTarget[i];
        for (const e of entries) {
          if (e.kind === 'complex') {
            e.current = interpolateComplexValue(e.fromComplex, e.toComplex, eased);
            _setProp(el, e.prop, e.current);
            continue;
          }
          e.current = e.from + (e.to - e.from) * eased;
          _setProp(el, e.prop, e.current, e.unit);
        }
        _flushEl(el);
      });
      return this;
    }
  }

  // ─── SCROLL TRIGGER ───────────────────────────────────────────
  class ScrollTrigger {
    constructor(opts) {
      this.el = typeof opts.trigger === 'string' ? document.querySelector(opts.trigger) : opts.trigger;
      this.start = opts.start || 'top 80%';
      this.end = opts.end || 'bottom 20%';
      this.scrub = opts.scrub != null ? opts.scrub : false;
      this.markers = opts.markers || false;
      this.onEnter = opts.onEnter || null;
      this.onLeave = opts.onLeave || null;
      this.onUpdate = opts.onUpdate || null;
      this.tween = opts.animation || null;

      this._active = false;
      this._progress = 0;
      if (this.tween) this.tween.pause();
      if (this.markers) this._createMarkers();
      this._listen();
    }

    _edge(s, rect) {
      if (s === 'top') return rect.top;
      if (s === 'bottom') return rect.bottom;
      if (s === 'center') return rect.top + rect.height / 2;
      return rect.top + (parseFloat(s) || 0);
    }

    _vp(s, vh) {
      if (s === 'top') return 0;
      if (s === 'bottom') return vh;
      if (s === 'center') return vh / 2;
      if (s.endsWith('%')) return vh * parseFloat(s) / 100;
      return parseFloat(s) || 0;
    }

    _listen() {
      let ticking = false;
      const update = () => {
        ticking = false;
        if (!this.el) return;
        const rect = this.el.getBoundingClientRect();
        const vh = window.innerHeight;
        const sp = this.start.split(' '), ep = this.end.split(' ');
        const sOff = this._edge(sp[0] || 'top', rect) - this._vp(sp[1] || '80%', vh);
        const eOff = this._edge(ep[0] || 'bottom', rect) - this._vp(ep[1] || '20%', vh);
        const range = eOff - sOff;
        const progress = range !== 0 ? clamp(-sOff / range, 0, 1) : 0;
        const was = this._active;
        this._active = progress > 0 && progress < 1;

        if (this.scrub && this.tween) this.tween.progress(progress);
        if (!was && this._active && progress < .5 && this.onEnter) this.onEnter();
        if (was && !this._active && progress >= 1 && this.onLeave) this.onLeave();
        if (this.onUpdate) this.onUpdate({ progress, isActive: this._active });
        this._progress = progress;
        if (this.markers) {
          this._sm.style.top = this._vp(sp[1] || '80%', vh) + 'px';
          this._em.style.top = this._vp(ep[1] || '20%', vh) + 'px';
        }
      };
      this._handler = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      window.addEventListener('scroll', this._handler, { passive: true });
      requestAnimationFrame(update);
    }

    _createMarkers() {
      const mk = (l, c) => { const d = document.createElement('div'); d.textContent = l; Object.assign(d.style, { position: 'fixed', right: '0', padding: '2px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#fff', background: c, zIndex: '99999', pointerEvents: 'none' }); document.body.appendChild(d); return d; };
      this._sm = mk('start', '#0f0');
      this._em = mk('end', '#f00');
    }

    kill() {
      window.removeEventListener('scroll', this._handler);
      if (this._sm) this._sm.remove();
      if (this._em) this._em.remove();
    }
  }

  // ─── TEXT SPLIT ───────────────────────────────────────────────
  class TextSplit {
    constructor(el, opts = {}) {
      this.el = typeof el === 'string' ? document.querySelector(el) : el;
      this.type = opts.type || 'chars';
      this.mask = !!opts.mask;
      this.chars = []; this.words = []; this.lines = [];
      this._original = this.el.innerHTML;
      this._split();
    }

    _wrapMask(node, cls) {
      if (!this.mask) return node;
      const mask = document.createElement('span');
      mask.className = `glm-mask glm-${cls}-mask`;
      mask.style.display = 'inline-block';
      mask.style.overflow = 'hidden';
      mask.style.verticalAlign = 'top';
      mask.appendChild(node);
      return mask;
    }

    _split() {
      const text = this.el.textContent;
      this.el.innerHTML = '';
      const ws = (c, cls) => { const s = document.createElement('span'); s.className = 'glm-' + cls; s.style.display = 'inline-block'; s.textContent = c; return s; };

      if (this.type === 'chars' || this.type === 'both') {
        text.split(/(\s+)/).forEach(w => {
          if (/^\s+$/.test(w)) { this.el.appendChild(document.createTextNode(w)); return; }
          const wd = ws('', 'word'); wd.textContent = '';
          for (const ch of w) {
            const cs = ws(ch, 'char');
            wd.appendChild(this._wrapMask(cs, 'char'));
            this.chars.push(cs);
          }
          this.el.appendChild(wd); this.words.push(wd);
        });
      } else if (this.type === 'words') {
        text.split(/(\s+)/).forEach(w => {
          if (/^\s+$/.test(w)) { this.el.appendChild(document.createTextNode(w)); return; }
          const s = ws(w, 'word'); this.el.appendChild(this._wrapMask(s, 'word')); this.words.push(s);
        });
      } else if (this.type === 'lines') {
        const ct = document.createElement('span'); ct.style.display = 'inline';
        text.split(/(\s+)/).forEach(w => {
          if (/^\s+$/.test(w)) { ct.appendChild(document.createTextNode(w)); return; }
          const s = ws(w, 'word'); ct.appendChild(s); this.words.push(s);
        });
        this.el.appendChild(ct);
        requestAnimationFrame(() => {
          let top = -1, line = null; const lines = [];
          this.words.forEach(w => {
            const t = w.getBoundingClientRect().top;
            if (Math.abs(t - top) > 2) { line = document.createElement('span'); line.className = 'glm-line'; line.style.display = 'block'; line.style.overflow = 'hidden'; lines.push(line); top = t; }
            line.appendChild(w);
            if (w.nextSibling && w.nextSibling.nodeType === 3) line.appendChild(w.nextSibling);
          });
          this.el.innerHTML = '';
          lines.forEach(l => { this.el.appendChild(l); this.lines.push(l); });
        });
      }
    }

    revert() { this.el.innerHTML = this._original; this.chars = []; this.words = []; this.lines = []; }
  }

  // ─── TIMELINE ─────────────────────────────────────────────────
  class Timeline {
    constructor(opts = {}) {
      this._tw = []; this._dur = 0; this.paused = opts.paused || false;
      this.repeat = opts.repeat || 0; this.yoyo = opts.yoyo || false;
      this.onComplete = opts.onComplete || null;
    }

    to(targets, props, opts = {}, pos) {
      const off = pos !== undefined ? this._pos(pos) : this._dur;
      opts = { ...opts, paused: true, delay: (opts.delay || 0) + off / 1000 };
      const tw = new Tween(targets, props, opts);
      this._tw.push({ tween: tw, offset: off });
      const end = off + tw.duration + tw.delay;
      if (end > this._dur) this._dur = end;
      if (!this.paused) tw.play();
      return this;
    }

    _pos(p) {
      if (typeof p === 'number') return p * 1000;
      if (typeof p === 'string') {
        if (p.startsWith('+=')) return this._dur + parseFloat(p.slice(2)) * 1000;
        if (p.startsWith('-=')) return this._dur - parseFloat(p.slice(2)) * 1000;
        if (p.startsWith('<')) return Math.max(0, this._dur - (this._tw.length ? this._tw[this._tw.length - 1].tween.duration : 0));
      }
      return this._dur;
    }

    play() { this.paused = false; this._tw.forEach(t => t.tween.play()); return this; }
    pause() { this.paused = true; this._tw.forEach(t => t.tween.pause()); return this; }
    restart() { this._tw.forEach(t => t.tween.restart()); return this; }
    kill() { this._tw.forEach(t => t.tween.kill()); }
    progress(p) { this._tw.forEach(t => { t.tween.progress(clamp((p * this._dur - t.offset) / t.tween.duration, 0, 1)); }); return this; }
  }

  // ─── OBSERVER ─────────────────────────────────────────────────
  class Observer {
    constructor(el, opts = {}) {
      this.el = typeof el === 'string' ? document.querySelector(el) : el;
      this.type = opts.type || 'view';
      this.once = opts.once != null ? opts.once : true;
      this.rootMargin = opts.rootMargin || `0px 0px -${Math.round((1 - DEFAULT_VIEW_THRESHOLD) * 100)}% 0px`;
      this.onEnter = opts.onEnter || null;
      this.onLeave = opts.onLeave || null;
      this._active = false;
      if (this.type === 'view') this._view();
      else if (this.type === 'hover') this._hover();
      else if (this.type === 'click') this._click();
    }

    _view() {
      this._io = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting && !this._active) { this._active = true; if (this.onEnter) this.onEnter(e); if (this.once) this._io.disconnect(); }
          else if (!e.isIntersecting && this._active) { this._active = false; if (this.onLeave) this.onLeave(e); }
        }
      }, { rootMargin: this.rootMargin, threshold: 0 });
      this._io.observe(this.el);
    }

    _hover() {
      this.el.addEventListener('mouseenter', () => { this._active = true; if (this.onEnter) this.onEnter(); });
      this.el.addEventListener('mouseleave', () => { this._active = false; if (this.onLeave) this.onLeave(); });
    }

    _click() { this.el.addEventListener('click', () => { if (this.onEnter) this.onEnter(); }); }
    kill() { if (this._io) this._io.disconnect(); }
  }

  // ─── DATA ATTRIBUTE ENGINE ────────────────────────────────────

  function _applyFrom(els, props) {
    els.forEach(el => {
      for (const [rawKey, v] of Object.entries(props)) {
        const k = normalizePropName(rawKey);
        if (k === CLIP_PATH_PROP) {
          _setProp(el, k, String(v).trim());
          continue;
        }
        const pv = parseValue(v);
        const num = typeof pv.value === 'number' ? pv.value : 0;
        _setProp(el, k, num, pv.unit || UNIT_DEFAULTS[k] || '');
      }
      _flushEl(el);
    });
  }

  function _naturalEndProps(props) {
    const end = {};
    for (const rawKey of Object.keys(props)) {
      const k = normalizePropName(rawKey);
      if (k === 'opacity') end[k] = '1';
      else if (k === CLIP_PATH_PROP) end[k] = CLIP_PATH_DEFAULT;
      else if (SCALE_PROPS.has(k)) end[k] = '1';
      else end[k] = '0' + (UNIT_DEFAULTS[k] || '');
    }
    return end;
  }

  function _mouseFactorForProp(prop, nx, ny) {
    const magnitude = Math.min(Math.sqrt(nx * nx + ny * ny), 1);
    if (prop === 'translateX' || prop === 'rotateY' || prop === 'skewX') return nx;
    if (prop === 'translateY' || prop === 'rotateX' || prop === 'skewY') return ny;
    if (prop === 'rotate' || prop === 'rotateZ') return nx;
    if (prop === 'translateZ' || SCALE_PROPS.has(prop) || prop === 'opacity' || prop.startsWith(FILTER_PREFIX)) return magnitude;
    return magnitude;
  }

  function _initMouseTrigger(targets, props, triggerEl, opts = {}) {
    const follow = opts.animateOnce || false;
    const moveEase = 0.18;
    const idleResetMs = 320;
    let rafId = null;
    let idleTimer = null;
    let currentX = 0, currentY = 0;
    let targetX = 0, targetY = 0;

    const defs = targets.map(target => Object.entries(props).map(([rawProp, rawValue]) => {
      const prop = normalizePropName(rawProp);
      const current = _getCurrentPropState(target, prop);
      if (prop === CLIP_PATH_PROP || typeof parseValue(rawValue).value !== 'number') return null;
      const parsed = parseValue(rawValue);
      return {
        prop,
        base: current.value,
        to: parsed.value,
        unit: parsed.unit || current.unit || UNIT_DEFAULTS[prop] || '',
      };
    }).filter(Boolean));

    const clearIdleReset = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const requestReset = () => {
      if (follow) return;
      clearIdleReset();
      idleTimer = setTimeout(() => {
        targetX = 0;
        targetY = 0;
        requestFrame();
      }, idleResetMs);
    };

    const step = () => {
      currentX += (targetX - currentX) * moveEase;
      currentY += (targetY - currentY) * moveEase;

      targets.forEach((target, index) => {
        defs[index].forEach(def => {
          const factor = _mouseFactorForProp(def.prop, currentX, currentY);
          const next = def.base + (def.to - def.base) * factor;
          _setProp(target, def.prop, next, def.unit);
        });
        _flushEl(target);
      });

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        rafId = requestAnimationFrame(step);
      } else {
        currentX = targetX;
        currentY = targetY;
        rafId = null;
      }
    };

    const requestFrame = () => {
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    const onMove = e => {
      const rect = triggerEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetX = clamp(px, -1, 1);
      targetY = clamp(py, -1, 1);
      clearIdleReset();
      requestFrame();
      requestReset();
    };

    const onLeave = () => {
      clearIdleReset();
      if (follow) return;
      targetX = 0;
      targetY = 0;
      requestFrame();
    };

    triggerEl.addEventListener('mousemove', onMove);
    triggerEl.addEventListener('mouseleave', onLeave);
  }

  function _parse(el) {
    const a = el.attributes, p = {};
    let trigger = null, triggerTarget = null, easing = null, dur = null, delay = null;
    let stagger = false, staggerDelay = 0.1, split = null, mask = false;
    let inertia = false, inertiaDecay = 0.92;
    let scrubStart = null, scrubEnd = null, repeat = 0, yoyo = false, threshold = null;
    let animateOnce = false;

    for (let i = 0; i < a.length; i++) {
      const n = a[i].name, v = a[i].value;
      if (n.startsWith('data-glm-prop-'))         p[normalizePropName(n.slice(14))] = v;
      else if (n === 'data-glm-trigger-view')      { trigger = 'view'; if (v) triggerTarget = v; }
      else if (n === 'data-glm-trigger-scroll')    { trigger = 'scroll'; if (v) triggerTarget = v; }
      else if (n === 'data-glm-trigger-click')     { trigger = 'click'; if (v) triggerTarget = v; }
      else if (n === 'data-glm-trigger-hover')     { trigger = 'hover'; if (v) triggerTarget = v; }
      else if (n === 'data-glm-trigger-mouse')     { trigger = 'mouse'; if (v) triggerTarget = v; }
      else if (n === 'data-glm-easing')            easing = v;
      else if (n === 'data-glm-duration')          dur = parseFloat(v);
      else if (n === 'data-glm-delay')             delay = parseFloat(v);
      else if (n === 'data-glm-stagger')           stagger = true;
      else if (n === 'data-glm-stagger-delay')     staggerDelay = parseFloat(v);
      else if (n === 'data-glm-split')             split = v || 'chars';
      else if (n === 'data-glm-mask')              mask = v === '' || v === 'true' || v === '1';
      else if (n === 'data-glm-inertia')           { inertia = true; if (v) inertiaDecay = parseFloat(v); }
      else if (n === 'data-glm-scrub-start')       scrubStart = v;
      else if (n === 'data-glm-scrub-end')         scrubEnd = v;
      else if (n === 'data-glm-repeat')            repeat = v === 'infinite' ? -1 : parseInt(v);
      else if (n === 'data-glm-yoyo')              yoyo = true;
      else if (n === 'data-glm-threshold')         threshold = parseFloat(v);
      else if (n === 'data-glm-animate-once')      animateOnce = v === '' || v === 'true' || v === '1';
    }
    return { p, trigger, triggerTarget, easing, dur, delay, stagger, staggerDelay,
             split, mask, inertia, inertiaDecay, scrubStart, scrubEnd, repeat, yoyo, threshold, animateOnce };
  }

  function _rm(threshold) {
    const pct = Math.round((1 - (threshold != null ? threshold : DEFAULT_VIEW_THRESHOLD)) * 100);
    return `0px 0px -${pct}% 0px`;
  }

  function _initFromAttributes() {
    const sel = '[data-glm-trigger-view],[data-glm-trigger-scroll],[data-glm-trigger-click],[data-glm-trigger-hover],[data-glm-trigger-mouse],[data-glm-split]';
    const all = document.querySelectorAll(sel);
    const done = new Set();

    all.forEach(el => {
      if (done.has(el)) return;
      done.add(el);

      const d = _parse(el);
      const { p, trigger, triggerTarget, easing, dur, delay,
              stagger, staggerDelay, split, mask, inertia, inertiaDecay,
              scrubStart, scrubEnd, repeat, yoyo, threshold, animateOnce } = d;

      const isReveal = trigger === 'view' || trigger === 'scroll';
      const isInteractive = trigger === 'hover' || trigger === 'click' || trigger === 'mouse';
      const rootMargin = _rm(threshold);

      // TEXT SPLIT
      if (split) {
        const sp = new TextSplit(el, { type: split, mask });
        const targets = split === 'lines' ? sp.lines : split === 'words' ? sp.words : sp.chars;
        if (Object.keys(p).length && targets.length) {
          _applyFrom(targets, p);
          const end = _naturalEndProps(p);
          const inOpts = {
            duration: dur != null ? dur : DEFAULT_DURATION, delay: delay != null ? delay : 0,
            ease: easing, stagger: staggerDelay,
            paused: true, inertia, inertiaDecay,
          };
          const tw = new Tween(targets, end, inOpts);
          if (trigger === 'scroll') {
            new ScrollTrigger({ trigger: el, start: scrubStart || 'top 85%', end: scrubEnd || 'bottom 20%', scrub: true, animation: tw });
          } else {
            if (animateOnce) {
              new Observer(el, { type: 'view', once: true, rootMargin, onEnter: () => tw.restart() });
            } else {
              const twOut = new Tween(targets, p, { ...inOpts, delay: 0, paused: true });
              const stop = () => { tw.kill(); twOut.kill(); };
              new Observer(el, {
                type: 'view',
                once: false,
                rootMargin,
                onEnter: () => { stop(); tw.restart(); },
                onLeave: () => { stop(); twOut.restart(); },
              });
            }
          }
        }
        return;
      }

      let targets = [el];
      if (stagger) targets = Array.from(el.children);
      if (!Object.keys(p).length) return;

      if (isReveal) {
        _applyFrom(targets, p);
        const end = _naturalEndProps(p);
        const inOpts = {
          duration: dur != null ? dur : DEFAULT_DURATION, delay: delay != null ? delay : 0,
          ease: easing, stagger: stagger ? staggerDelay : 0,
          paused: true, inertia, inertiaDecay, repeat, yoyo,
        };
        const tw = new Tween(targets, end, inOpts);
        const tEl = triggerTarget ? document.querySelector(triggerTarget) : el;
        if (trigger === 'scroll') {
          new ScrollTrigger({ trigger: tEl || el, start: scrubStart || 'top 85%', end: scrubEnd || 'bottom 20%', scrub: true, animation: tw });
        } else {
          if (animateOnce) {
            new Observer(tEl || el, { type: 'view', once: true, rootMargin, onEnter: () => tw.restart() });
          } else {
            const twOut = new Tween(targets, p, { ...inOpts, delay: 0, paused: true });
            const stop = () => { tw.kill(); twOut.kill(); };
            new Observer(tEl || el, {
              type: 'view',
              once: false,
              rootMargin,
              onEnter: () => { stop(); tw.restart(); },
              onLeave: () => { stop(); twOut.restart(); },
            });
          }
        }
      } else if (isInteractive) {
        const baseOpts = {
          duration: dur != null ? dur : DEFAULT_DURATION,
          delay: delay != null ? delay : 0,
          ease: easing,
          paused: true,
          inertia,
          inertiaDecay,
          repeat,
          yoyo,
        };
        const tEl = triggerTarget ? document.querySelector(triggerTarget) : el;
        if (trigger === 'click') {
          const tw = new Tween(targets, p, {
            ...baseOpts,
            stagger: stagger ? staggerDelay : 0,
          });
          (tEl || el).addEventListener('click', () => tw.restart());
        } else if (trigger === 'mouse') {
          _initMouseTrigger(targets, p, tEl || el, { animateOnce });
        } else {
          const initialStates = targets.map(target => _snapshotProps(target, p));
          let activeTweens = [];
          const stop = () => {
            activeTweens.forEach(tw => tw.kill());
            activeTweens = [];
          };
          const run = propFactory => {
            stop();
            activeTweens = targets.map((target, index) => new Tween(target, propFactory(index), {
              ...baseOpts,
              delay: (baseOpts.delay || 0) + (stagger ? staggerDelay * index : 0),
            }));
            activeTweens.forEach(tw => tw.play());
          };
          (tEl || el).addEventListener('mouseenter', () => run(() => p));
          (tEl || el).addEventListener('mouseleave', () => run(index => initialStates[index]));
        }
      } else {
        new Tween(targets, p, {
          duration: dur != null ? dur : DEFAULT_DURATION, delay: delay != null ? delay : 0,
          ease: easing, stagger: stagger ? staggerDelay : 0,
          inertia, inertiaDecay, repeat, yoyo,
        });
      }
    });
  }

  // ─── SMOOTH SCROLL ────────────────────────────────────────────
  function smoothScroll(opts = {}) {
    const ct = opts.content ? document.querySelector(opts.content) : null;
    const lr = opts.lerp || 0.08;
    let cur = window.scrollY, run = true;
    if (ct) { document.body.style.height = ct.scrollHeight + 'px'; ct.style.position = 'fixed'; ct.style.top = '0'; ct.style.left = '0'; ct.style.width = '100%'; }
    const tick = () => { if (!run) return; const tgt = window.scrollY; cur += (tgt - cur) * lr; if (Math.abs(cur - tgt) < .5) cur = tgt; if (ct) ct.style.transform = `translateY(${-cur}px)`; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const rs = () => { if (ct) document.body.style.height = ct.scrollHeight + 'px'; };
    window.addEventListener('resize', rs);
    return { kill() { run = false; window.removeEventListener('resize', rs); if (ct) { ct.style.cssText = ''; document.body.style.height = ''; } } };
  }

  // ─── AUTO-INIT ────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    const run = () => requestAnimationFrame(_initFromAttributes);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  // ─── PUBLIC API ───────────────────────────────────────────────
  function _setAPI(targets, props) {
    const els = typeof targets === 'string' ? Array.from(document.querySelectorAll(targets)) : (Array.isArray(targets) ? targets : [targets]);
    els.forEach(el => {
      for (const [rawKey, v] of Object.entries(props)) {
        const k = normalizePropName(rawKey);
        if (k === CLIP_PATH_PROP) {
          _setProp(el, k, String(v).trim());
          continue;
        }
        const pv = parseValue(v);
        const num = typeof pv.value === 'number' ? pv.value : 0;
        _setProp(el, k, num, pv.unit || UNIT_DEFAULTS[k] || '');
      }
      _flushEl(el);
    });
  }

  const GLM = {
    version: '1.0.0',
    easings,
    to(targets, props, opts) { return new Tween(targets, props, opts); },
    from(targets, fromProps, opts) {
      const els = typeof targets === 'string' ? Array.from(document.querySelectorAll(targets)) : (Array.isArray(targets) ? targets : [targets]);
      _applyFrom(els, fromProps);
      const end = _naturalEndProps(fromProps);
      return new Tween(els, end, opts);
    },
    fromTo(targets, fromProps, toProps, opts) {
      const els = typeof targets === 'string' ? Array.from(document.querySelectorAll(targets)) : (Array.isArray(targets) ? targets : [targets]);
      _applyFrom(els, fromProps);
      return new Tween(els, toProps, opts);
    },
    timeline(opts) { return new Timeline(opts); },
    scrollTrigger(opts) { return new ScrollTrigger(opts); },
    splitText(el, opts) { return new TextSplit(el, opts); },
    observe(el, opts) { return new Observer(el, opts); },
    smoothScroll,
    set: _setAPI,
    registerEasing(name, fn) { easings[name] = fn; },
    init: _initFromAttributes,
  };

  return GLM;
});
