/**
 * NumericText.js
 * SwiftUI-style per-character slide animation for the web.
 * https://github.com/igarinpiano/numeric-text-animation
 * MIT License
 */

// ── CSS (injected once) ───────────────────────────────────────────────────────
// Only structural rules live here now. Every moving part — the vertical slide,
// the motion blur and the opacity cross-fade — is driven through the Web
// Animations API so each running animation can be read, retargeted and
// cancelled mid-flight. That is what lets a value change *during* an animation
// continue smoothly instead of snapping.

const STYLE_ID = '__nt_style__';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.nt-slot{display:inline-block;overflow:hidden;height:1em;line-height:1;will-change:transform,width}
.nt-track{display:flex;flex-direction:column;will-change:transform,filter}
.nt-face{height:1em;line-height:1em;display:block;white-space:pre;will-change:opacity}`;
  document.head.appendChild(s);
}

// ── WAAPI keyframe builders ────────────────────────────────────────────────────

// Spring-ish vertical slide (percent based → resolution independent). Played
// only for a *fresh* changed character. `up` reveals the new glyph by sliding
// the reel up; `dn` (the mirror) slides it down.
function bounceFrames(up) {
  return up
    ? [
        { transform: 'translateY(0)',      easing: 'cubic-bezier(.4,0,.55,.9)' },
        { transform: 'translateY(-53%)',   easing: 'cubic-bezier(.3,0,.7,1)', offset: 0.62 },
        { transform: 'translateY(-48%)',   easing: 'cubic-bezier(.3,0,.7,1)', offset: 0.78 },
        { transform: 'translateY(-50.5%)', easing: 'ease-out',                offset: 0.91 },
        { transform: 'translateY(-50%)' },
      ]
    : [
        { transform: 'translateY(-50%)', easing: 'cubic-bezier(.4,0,.55,.9)' },
        { transform: 'translateY(3%)',   easing: 'cubic-bezier(.3,0,.7,1)', offset: 0.62 },
        { transform: 'translateY(-2%)',  easing: 'cubic-bezier(.3,0,.7,1)', offset: 0.78 },
        { transform: 'translateY(.5%)',  easing: 'ease-out',                offset: 0.91 },
        { transform: 'translateY(0)' },
      ];
}

// A short blur pulse that peaks while the glyph is moving fastest and clears
// before it settles — SwiftUI's `numericText` uses the same trick, and it
// doubles as a mask that hides the reel's face-swap when a slide is retargeted.
function blurFrames(peakPx) {
  return [
    { filter: 'blur(0px)',         offset: 0 },
    { filter: `blur(${peakPx}px)`, offset: 0.3 },
    { filter: 'blur(0px)',         offset: 0.62 },
    { filter: 'blur(0px)',         offset: 1 },
  ];
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

/**
 * Parse a formatted number string into keyed character tokens.
 * Keys are stable across values so we can diff old vs new.
 * e.g. "1,234.56" → [{key:"d3",ch:"1"},{key:"sp4",ch:","}, ...]
 */
function parseNumeric(s) {
  const dotIdx = s.indexOf('.');
  const intPart = dotIdx >= 0 ? s.slice(0, dotIdx) : s;
  const decPart = dotIdx >= 0 ? s.slice(dotIdx + 1) : '';
  const tokens = [];
  let place = intPart.replace(/,/g, '').length - 1;
  for (const ch of intPart) {
    if (ch === ',') {
      tokens.push({ key: `sp${place + 1}`, ch: ',' });
    } else {
      tokens.push({ key: `d${place}`, ch });
      place--;
    }
  }
  if (dotIdx >= 0) {
    tokens.push({ key: 'dt', ch: '.' });
    [...decPart].forEach((ch, i) => tokens.push({ key: `df${i + 1}`, ch }));
  }
  return tokens;
}

/** Parse a string into keyed character tokens (one key per position). */
function parseString(s) {
  return [...s].map((ch, i) => ({ key: `s${i}`, ch }));
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function h(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function staticSlot(ch) {
  const slot = h('span', 'nt-slot');
  const face = h('span', 'nt-face');
  face.textContent = ch;
  slot.appendChild(face);
  return slot;
}

function animSlot(oldCh, newCh, up, delay) {
  const slot  = h('span', 'nt-slot');
  const track = h('span', 'nt-track');
  const f1    = h('span', 'nt-face');
  const f2    = h('span', 'nt-face');
  // up: old on top, new on bottom → slide up to reveal new
  // dn: new on top, old on bottom → slide down to reveal new (starts at -50%)
  if (up) { f1.textContent = oldCh; f2.textContent = newCh; }
  else    { f1.textContent = newCh; f2.textContent = oldCh; track.style.transform = 'translateY(-50%)'; }
  track.appendChild(f1);
  track.appendChild(f2);
  slot.appendChild(track);
  slot._nt = { track, up, delay, newCh, oldCh, oldFace: up ? f1 : f2, newFace: up ? f2 : f1 };
  return slot;
}

// ── NumericText class ─────────────────────────────────────────────────────────

export class NumericText {
  /**
   * @param {string|Element} target  CSS selector or DOM element
   * @param {object} [options]
   * @param {'integer'|'decimal'|'string'} [options.type='integer']
   * @param {number}  [options.decimals=0]  decimal places (type:'decimal' only)
   * @param {boolean} [options.bounce=true] true: spring bounce / false: ease only
   * @param {number}  [options.stagger=40]  ms delay per changed character (left→right)
   * @param {number}  [options.duration=400] base animation duration in ms
   * @param {boolean} [options.adaptive=true] shorten the duration toward
   *                                          `minDuration` when values arrive
   *                                          faster than `duration` (crisper
   *                                          under rapid updates)
   * @param {number}  [options.minDuration=200] floor for the adaptive duration
   * @param {number}  [options.blur=0.06]   motion-blur peak as a fraction of the
   *                                         text height (0 disables)
   * @param {boolean} [options.fade=true]   cross-fade opacity between old/new glyph
   * @param {string}  [options.pre='']       prefix text (not animated)
   * @param {string}  [options.suf='']       suffix text (not animated)
   */
  constructor(target, options = {}) {
    this._el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this._el) throw new Error(`NumericText: target not found — ${target}`);
    const {
      type = 'integer', decimals = 0,
      bounce = true, stagger = 40, duration = 400,
      adaptive = true, minDuration = 200,
      blur = 0.06, fade = true,
      pre = '', suf = '',
    } = options;
    this._type        = type;
    this._decimals    = decimals;
    this._bounce      = bounce;
    this._stagger     = stagger;
    this._duration    = duration;
    this._adaptive    = adaptive;
    this._minDuration = minDuration;
    this._blur        = blur;
    this._fade        = fade;
    this._pre         = pre;
    this._suf         = suf;
    this._value       = null;   // last set value (null = first call)
    this._lastSetTime = 0;      // timestamp of the last animated set (adaptive)
    this._slotMap     = new Map(); // key → slot element
    this._gen         = 0;         // animation generation (invalidates stale cleanups)
    injectStyles();
    // Ensure the container is inline-flex so slots sit side by side
    this._el.style.display = 'inline-flex';
    this._el.style.alignItems = 'baseline';
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Set a new value. First call sets without animation.
   * Subsequent calls animate the transition (interruptible).
   */
  set(value) {
    const prev = this._value;
    this._value = value;
    if (prev === null) {
      this._render(value);
    } else {
      this._animate(value, prev);
    }
  }

  /** Get the current value. */
  get value() { return this._value; }

  /**
   * Change options after construction (e.g. toggle bounce at runtime).
   * Triggers no animation.
   */
  configure(options = {}) {
    Object.assign(this, {
      _bounce:      options.bounce      ?? this._bounce,
      _stagger:     options.stagger     ?? this._stagger,
      _duration:    options.duration    ?? this._duration,
      _adaptive:    options.adaptive    ?? this._adaptive,
      _minDuration: options.minDuration ?? this._minDuration,
      _blur:        options.blur        ?? this._blur,
      _fade:        options.fade        ?? this._fade,
    });
  }

  // ── Static helpers ──────────────────────────────────────────────────────────

  /**
   * Auto-initialise all elements matching `selector`.
   * Reads config from data attributes:
   *   data-nt="integer|decimal|string"
   *   data-nt-bounce="true|false"
   *   data-nt-stagger="40"
   *   data-nt-duration="400"
   *   data-nt-adaptive="true|false"
   *   data-nt-min-duration="200"
   *   data-nt-blur="0.06"
   *   data-nt-fade="true|false"
   *   data-nt-pre="¥"
   *   data-nt-suf="円"
   *   data-nt-decimals="2"
   *
   * @returns {NumericText[]} instances
   */
  static autoInit(selector = '[data-nt]') {
    return [...document.querySelectorAll(selector)].map(el => {
      const d = el.dataset;
      const nt = new NumericText(el, {
        type:        d.nt     || 'integer',
        bounce:      d.ntBounce  !== 'false',
        stagger:     Number(d.ntStagger  || 40),
        duration:    Number(d.ntDuration || 400),
        adaptive:    d.ntAdaptive !== 'false',
        minDuration: Number(d.ntMinDuration || 200),
        blur:        d.ntBlur !== undefined ? Number(d.ntBlur) : 0.06,
        fade:        d.ntFade !== 'false',
        decimals:    Number(d.ntDecimals || 0),
        pre:         d.ntPre  || '',
        suf:         d.ntSuf  || '',
      });
      nt.set(el.textContent.trim());
      return nt;
    });
  }

  /**
   * Watch an element's textContent via MutationObserver.
   * Any time external code writes `el.textContent = newValue`,
   * NumericText intercepts and animates.
   *
   * @param {string|Element} target
   * @param {object} [options] same as constructor options
   * @returns {NumericText} instance
   */
  static observe(target, options = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const nt = new NumericText(el, options);
    nt.set(el.textContent.trim());

    const observer = new MutationObserver(() => {
      // Read raw text before NumericText re-renders
      const raw = el.textContent.trim();
      if (raw !== String(nt.value)) nt.set(raw);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return nt;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  _format(v) {
    if (this._type === 'integer') return Math.round(+v).toLocaleString('en-US');
    if (this._type === 'decimal') return (+v).toFixed(this._decimals);
    return String(v);
  }

  _parse(s) {
    return this._type === 'string' ? parseString(s) : parseNumeric(s);
  }

  /** Cancel every WAAPI handle attached to a slot (idempotent). */
  _cancelSlot(slot) {
    const kill = a => { if (a) { try { a.cancel(); } catch (_) { /* ignore */ } } };
    kill(slot._flipAnim);
    kill(slot._widthAnim);
    const nt = slot._nt;
    if (nt) { kill(nt.anim); kill(nt.blurAnim); kill(nt.oldFaceAnim); kill(nt.newFaceAnim); }
  }

  _makePre() {
    const span = h('span');
    span.dataset.ntFix = 'pre';
    Object.assign(span.style, { fontSize: '.42em', alignSelf: 'flex-start', paddingTop: '.17em', marginRight: '1px', opacity: '.6' });
    span.textContent = this._pre;
    return span;
  }

  _makeSuf() {
    const span = h('span');
    span.dataset.ntFix = 'suf';
    Object.assign(span.style, { fontSize: '.38em', alignSelf: 'flex-end', paddingBottom: '.1em', marginLeft: '3px', opacity: '.6' });
    span.textContent = this._suf;
    return span;
  }

  _render(value) {
    const el = this._el;
    // Cancel anything still in flight so a re-render never leaks animations.
    for (const [, slot] of this._slotMap) this._cancelSlot(slot);
    el.innerHTML = '';
    this._slotMap.clear();

    if (this._pre) el.appendChild(this._makePre());

    for (const { key, ch } of this._parse(this._format(value))) {
      const slot = staticSlot(ch);
      el.appendChild(slot);
      this._slotMap.set(key, slot);
    }

    if (this._suf) el.appendChild(this._makeSuf());
  }

  _animate(newVal, oldVal) {
    const el     = this._el;
    const EASE_H = 'cubic-bezier(.4,0,.2,1)';  // horizontal slides
    const EASE_V = 'cubic-bezier(.34,0,.64,1)'; // vertical glide (retarget)
    const blurR  = this._blur;
    const fade   = this._fade;
    const gen    = ++this._gen;               // supersedes every earlier animation

    // Adaptive duration: when values arrive faster than the base duration, run
    // shorter (down to minDuration) so the digits keep up crisply instead of
    // lagging behind a burst of updates. The stagger shrinks with it so a short
    // animation isn't dominated by per-digit delay. A single update after a
    // pause always plays the full duration.
    const baseD = this._duration;
    const now   = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const gap   = now - this._lastSetTime;
    this._lastSetTime = now;
    const D = this._adaptive
      ? Math.round(Math.max(this._minDuration, Math.min(baseD, gap)))
      : baseD;
    const stagger = this._adaptive ? this._stagger * (D / baseD) : this._stagger;

    const newFmt    = this._format(newVal);
    const oldFmt    = this._format(oldVal);
    const newTokens = this._parse(newFmt);
    const newKeys   = new Set(newTokens.map(t => t.key));
    const oldMap    = new Map(this._parse(oldFmt).map(t => [t.key, t]));
    const isNum     = this._type !== 'string';
    const globalUp  = isNum ? (+newVal > +oldVal) : null;

    // Which characters changed?
    const changed = new Set();
    for (const { key, ch } of newTokens) {
      const old = oldMap.get(key);
      if (!old || old.ch !== ch) changed.add(key);
    }

    // ── Snapshot: old X positions + live vertical offset of anything moving ──
    // Read the *rendered* translateY of every running track (WAAPI values show
    // up in getComputedStyle) so a freshly-built reel can start exactly where
    // the interrupted one was — no snap. Slots whose glyph did NOT change but
    // were still mid-slide are queued to keep gliding to rest instead of being
    // cut to a static glyph.
    const oldX   = new Map();
    const carryY = new Map();
    const settle = new Set();
    for (const [k, slot] of this._slotMap) {
      oldX.set(k, slot.getBoundingClientRect().left);
      const nt = slot._nt;
      if (nt && nt.track && nt.anim && nt.anim.playState === 'running') {
        const tr = getComputedStyle(nt.track).transform;
        if (tr && tr !== 'none') {
          try { carryY.set(k, new DOMMatrixReadOnly(tr).m42); } catch (_) { /* ignore */ }
        }
        if (!changed.has(k) && newKeys.has(k)) settle.add(k);
      }
      this._cancelSlot(slot);
    }

    // keys that animate = changed ∪ still-moving-but-unchanged
    const animKeys = new Set(changed);
    for (const k of settle) animKeys.add(k);

    // Stagger index (left→right, changed chars only)
    let staggerIdx = 0;
    const staggerMap = new Map();
    for (const { key } of newTokens) {
      if (changed.has(key)) staggerMap.set(key, staggerIdx++);
    }

    // ── Rebuild DOM ─────────────────────────────────────────────────
    const preEl = [...el.children].find(c => c.dataset && c.dataset.ntFix === 'pre');
    const sufEl = [...el.children].find(c => c.dataset && c.dataset.ntFix === 'suf');
    el.innerHTML = '';
    if (this._pre) el.appendChild(preEl || this._makePre());
    this._slotMap.clear();
    const animSlots = [];

    for (const { key, ch } of newTokens) {
      const old = oldMap.get(key);
      let slot;
      if (!animKeys.has(key)) {
        slot = staticSlot(ch);
      } else {
        const isSettle = settle.has(key) && !changed.has(key);
        const oldCh = isSettle ? ch : (old?.ch ?? ' ');
        const up = isSettle ? false
          : (globalUp !== null ? globalUp
            : (ch.codePointAt(0) > (old?.ch.codePointAt(0) ?? 0)));
        const delay = (staggerMap.get(key) || 0) * stagger;
        slot = animSlot(oldCh, ch, up, delay);
        slot._nt.key = key;
        slot._nt.settle = isSettle;
        slot._nt.interrupted = carryY.has(key);
        slot._nt.carryY = carryY.get(key);
        // Pin the reel to the carried offset immediately so it can't flash the
        // rest position for a frame before the WAAPI animation takes over.
        if (slot._nt.interrupted) slot._nt.track.style.transform = `translateY(${slot._nt.carryY}px)`;
        animSlots.push(slot);
      }
      el.appendChild(slot);
      this._slotMap.set(key, slot);
    }
    if (this._suf) el.appendChild(sufEl || this._makeSuf());

    // ── Width measurement (batched reflows) ─────────────────────────
    for (const s of animSlots) s._nt.oldFace.style.display = 'none';
    for (const s of animSlots) s._nW = s.getBoundingClientRect().width;
    for (const s of animSlots) s._nt.oldFace.style.display = '';
    for (const s of animSlots) { const r = s.getBoundingClientRect(); s._oW = r.width; s._h = r.height; }

    // Slots whose old glyph is wider → animate the shrink so the row reflows smoothly.
    const shrinkSlots = animSlots.filter(s => s._oW - s._nW > 0.5);
    for (const s of shrinkSlots) s.style.width = s._oW + 'px';

    // ── FLIP: horizontal deltas (measured with shrink widths still locked) ──
    const flipList = [];
    for (const [key, slot] of this._slotMap) {
      if (!oldX.has(key)) continue;
      const dx = oldX.get(key) - slot.getBoundingClientRect().left;
      if (Math.abs(dx) > 0.5) flipList.push({ slot, dx });
    }

    // ── Fire every animation synchronously through WAAPI ────────────
    // Starting here (rather than after a rAF) means a slot's `anim` handle
    // exists the instant _animate returns, so a retarget that lands one frame
    // later always finds a running animation to read and cancel.
    for (const { slot, dx } of flipList) {
      slot._flipAnim = slot.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
        { duration: D, easing: EASE_H, fill: 'both' },
      );
    }
    for (const s of shrinkSlots) {
      s._widthAnim = s.animate(
        [{ width: s._oW + 'px' }, { width: s._nW + 'px' }],
        { duration: D, easing: EASE_H, fill: 'both' },
      );
    }
    for (const s of animSlots) {
      const nt = s._nt;
      const { track, up, delay, oldFace, newFace } = nt;
      const faceH  = s._h || 16;
      const endPx  = up ? -faceH : 0;
      const peakPx = blurR > 0 ? faceH * blurR : 0;
      const contentChanged = nt.oldCh !== nt.newCh;

      // Vertical slide. A retargeted reel glides from its captured position
      // with a plain ease (a re-aimed spring should settle, not restart its
      // bounce); a fresh changed reel plays the full spring/ease.
      let vFrames, vTiming;
      if (nt.interrupted) {
        vFrames = [{ transform: `translateY(${nt.carryY}px)` }, { transform: `translateY(${endPx}px)` }];
        vTiming = { duration: Math.max(120, Math.round(D * 0.7)), delay: 0, easing: EASE_V, fill: 'both' };
      } else if (this._bounce && !nt.settle) {
        vFrames = bounceFrames(up);
        vTiming = { duration: D, delay, easing: 'linear', fill: 'both' };
      } else {
        const startPx = up ? 0 : -faceH;
        vFrames = [{ transform: `translateY(${startPx}px)` }, { transform: `translateY(${endPx}px)` }];
        vTiming = { duration: D, delay, easing: EASE_V, fill: 'both' };
      }
      nt.anim = track.animate(vFrames, vTiming);

      // Motion blur + opacity cross-fade only when the glyph actually changes
      // (a pure settle keeps the same character, so blurring/fading it would
      // just flicker).
      if (contentChanged && peakPx > 0) {
        nt.blurAnim = track.animate(
          blurFrames(peakPx),
          { duration: vTiming.duration, delay: vTiming.delay, easing: 'linear', fill: 'both' },
        );
      }
      if (contentChanged && fade) {
        nt.oldFaceAnim = oldFace.animate(
          [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 0, offset: 1 }],
          { duration: vTiming.duration, delay: vTiming.delay, easing: 'linear', fill: 'both' },
        );
        nt.newFaceAnim = newFace.animate(
          [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 1, offset: 1 }],
          { duration: vTiming.duration, delay: vTiming.delay, easing: 'linear', fill: 'both' },
        );
      }
    }

    // ── Cleanup after everything finishes ───────────────────────────
    // Guarded by the generation token: only the most recent _animate ever
    // renders the final static result, so a stale timer can never wipe a newer
    // in-flight animation (the old value-equality guard failed when a value
    // repeated). _render is used because it produces a correct static result
    // even when rAF was throttled in a background tab.
    const maxDelay = Math.max(0, (staggerIdx - 1) * stagger);
    setTimeout(() => {
      if (this._gen === gen) this._render(newVal);
    }, D + maxDelay + 120);
  }
}

export default NumericText;
