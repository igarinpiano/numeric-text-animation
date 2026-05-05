// src/index.js
var STYLE_ID = "__nt_style__";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
.nt-slot{display:inline-block;overflow:hidden;height:1em;line-height:1}
.nt-track{display:flex;flex-direction:column}
.nt-face{height:1em;display:flex;align-items:center;white-space:pre}
@keyframes _nt-up{
  0%  {transform:translateY(0);animation-timing-function:cubic-bezier(.4,0,.55,.9)}
  62% {transform:translateY(-53%);animation-timing-function:cubic-bezier(.3,0,.7,1)}
  78% {transform:translateY(-48%);animation-timing-function:cubic-bezier(.3,0,.7,1)}
  91% {transform:translateY(-50.5%);animation-timing-function:ease-out}
  100%{transform:translateY(-50%)}
}
@keyframes _nt-dn{
  0%  {transform:translateY(-50%);animation-timing-function:cubic-bezier(.4,0,.55,.9)}
  62% {transform:translateY(3%);animation-timing-function:cubic-bezier(.3,0,.7,1)}
  78% {transform:translateY(-2%);animation-timing-function:cubic-bezier(.3,0,.7,1)}
  91% {transform:translateY(.5%);animation-timing-function:ease-out}
  100%{transform:translateY(0)}
}`;
  document.head.appendChild(s);
}
function parseNumeric(s) {
  const dotIdx = s.indexOf(".");
  const intPart = dotIdx >= 0 ? s.slice(0, dotIdx) : s;
  const decPart = dotIdx >= 0 ? s.slice(dotIdx + 1) : "";
  const tokens = [];
  let place = intPart.replace(/,/g, "").length - 1;
  for (const ch of intPart) {
    if (ch === ",") {
      tokens.push({ key: `sp${place + 1}`, ch: "," });
    } else {
      tokens.push({ key: `d${place}`, ch });
      place--;
    }
  }
  if (dotIdx >= 0) {
    tokens.push({ key: "dt", ch: "." });
    [...decPart].forEach((ch, i) => tokens.push({ key: `df${i + 1}`, ch }));
  }
  return tokens;
}
function parseString(s) {
  return [...s].map((ch, i) => ({ key: `s${i}`, ch }));
}
function h(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}
function staticSlot(ch) {
  const slot = h("span", "nt-slot");
  const face = h("span", "nt-face");
  face.textContent = ch;
  slot.appendChild(face);
  return slot;
}
function animSlot(oldCh, newCh, up, delay) {
  const slot = h("span", "nt-slot");
  const track = h("span", "nt-track");
  const f1 = h("span", "nt-face");
  const f2 = h("span", "nt-face");
  if (up) {
    f1.textContent = oldCh;
    f2.textContent = newCh;
  } else {
    f1.textContent = newCh;
    f2.textContent = oldCh;
    track.style.transform = "translateY(-50%)";
  }
  track.appendChild(f1);
  track.appendChild(f2);
  slot.appendChild(track);
  slot._nt = { track, up, delay, newCh, oldFace: up ? f1 : f2, newFace: up ? f2 : f1 };
  return slot;
}
var NumericText = class _NumericText {
  /**
   * @param {string|Element} target  CSS selector or DOM element
   * @param {object} [options]
   * @param {'integer'|'decimal'|'string'} [options.type='integer']
   * @param {number}  [options.decimals=0]  decimal places (type:'decimal' only)
   * @param {boolean} [options.bounce=true] true: spring bounce / false: ease only
   * @param {number}  [options.stagger=40]  ms delay per changed character (left→right)
   * @param {number}  [options.duration=400] animation duration in ms
   * @param {string}  [options.pre='']       prefix text (not animated)
   * @param {string}  [options.suf='']       suffix text (not animated)
   */
  constructor(target, options = {}) {
    this._el = typeof target === "string" ? document.querySelector(target) : target;
    if (!this._el) throw new Error(`NumericText: target not found \u2014 ${target}`);
    const {
      type = "integer",
      decimals = 0,
      bounce = true,
      stagger = 40,
      duration = 400,
      pre = "",
      suf = ""
    } = options;
    this._type = type;
    this._decimals = decimals;
    this._bounce = bounce;
    this._stagger = stagger;
    this._duration = duration;
    this._pre = pre;
    this._suf = suf;
    this._value = null;
    this._slotMap = /* @__PURE__ */ new Map();
    injectStyles();
    this._el.style.display = "inline-flex";
    this._el.style.alignItems = "baseline";
  }
  // ── Public API ──────────────────────────────────────────────────────────────
  /**
   * Set a new value. First call sets without animation.
   * Subsequent calls animate the transition.
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
  get value() {
    return this._value;
  }
  /**
   * Change options after construction (e.g. toggle bounce at runtime).
   * Triggers no animation.
   */
  configure(options = {}) {
    Object.assign(this, {
      _bounce: options.bounce ?? this._bounce,
      _stagger: options.stagger ?? this._stagger,
      _duration: options.duration ?? this._duration
    });
  }
  // ── Static helpers ──────────────────────────────────────────────────────────
  /**
   * Auto-initialise all elements matching `selector`.
   * Reads config from data attributes:
   *   data-nt="integer|decimal|string"
   *   data-nt-bounce="true|false"
   *   data-nt-stagger="40"
   *   data-nt-pre="¥"
   *   data-nt-suf="円"
   *   data-nt-decimals="2"
   *
   * @returns {NumericText[]} instances
   */
  static autoInit(selector = "[data-nt]") {
    return [...document.querySelectorAll(selector)].map((el) => {
      const d = el.dataset;
      const nt = new _NumericText(el, {
        type: d.nt || "integer",
        bounce: d.ntBounce !== "false",
        stagger: Number(d.ntStagger || 40),
        duration: Number(d.ntDuration || 400),
        decimals: Number(d.ntDecimals || 0),
        pre: d.ntPre || "",
        suf: d.ntSuf || ""
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
    const el = typeof target === "string" ? document.querySelector(target) : target;
    const nt = new _NumericText(el, options);
    nt.set(el.textContent.trim());
    const observer = new MutationObserver(() => {
      const raw = el.textContent.trim();
      if (raw !== String(nt.value)) nt.set(raw);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return nt;
  }
  // ── Internals ───────────────────────────────────────────────────────────────
  _format(v) {
    if (this._type === "integer") return Math.round(+v).toLocaleString("en-US");
    if (this._type === "decimal") return (+v).toFixed(this._decimals);
    return String(v);
  }
  _parse(s) {
    return this._type === "string" ? parseString(s) : parseNumeric(s);
  }
  _render(value) {
    const el = this._el;
    el.innerHTML = "";
    this._slotMap.clear();
    if (this._pre) {
      const span = h("span");
      Object.assign(span.style, { fontSize: ".42em", alignSelf: "flex-start", paddingTop: ".17em", marginRight: "1px", opacity: ".6" });
      span.textContent = this._pre;
      el.appendChild(span);
    }
    for (const { key, ch } of this._parse(this._format(value))) {
      const slot = staticSlot(ch);
      el.appendChild(slot);
      this._slotMap.set(key, slot);
    }
    if (this._suf) {
      const span = h("span");
      Object.assign(span.style, { fontSize: ".38em", alignSelf: "flex-end", paddingBottom: ".1em", marginLeft: "3px", opacity: ".6" });
      span.textContent = this._suf;
      el.appendChild(span);
    }
  }
  _animate(newVal, oldVal) {
    const el = this._el;
    const D = this._duration;
    const EASE_H = `cubic-bezier(.4,0,.2,1)`;
    const EASE_V = `cubic-bezier(.34,0,.64,1)`;
    const newFmt = this._format(newVal);
    const oldFmt = this._format(oldVal);
    const newTokens = this._parse(newFmt);
    const oldMap = new Map(this._parse(oldFmt).map((t) => [t.key, t]));
    const isNum = this._type !== "string";
    const globalUp = isNum ? +newVal > +oldVal : null;
    const changed = /* @__PURE__ */ new Set();
    for (const { key, ch } of newTokens) {
      const old = oldMap.get(key);
      if (!old || old.ch !== ch) changed.add(key);
    }
    let staggerIdx = 0;
    const staggerMap = /* @__PURE__ */ new Map();
    for (const { key } of newTokens) {
      if (changed.has(key)) staggerMap.set(key, staggerIdx++);
    }
    const oldX = /* @__PURE__ */ new Map();
    for (const [k, slot] of this._slotMap) oldX.set(k, slot.getBoundingClientRect().left);
    const preEl = el.querySelector("[data-nt-pre]") || [...el.children].find((c) => c.textContent === this._pre && !c.classList.contains("nt-slot"));
    const sufEl = [...el.children].find((c) => c.textContent === this._suf && !c.classList.contains("nt-slot"));
    el.innerHTML = "";
    if (preEl) el.appendChild(preEl);
    else if (this._pre) {
      const span = h("span");
      Object.assign(span.style, { fontSize: ".42em", alignSelf: "flex-start", paddingTop: ".17em", marginRight: "1px", opacity: ".6" });
      span.textContent = this._pre;
      el.appendChild(span);
    }
    this._slotMap.clear();
    const animSlots = [];
    for (const { key, ch } of newTokens) {
      const old = oldMap.get(key);
      const delay = (staggerMap.get(key) || 0) * this._stagger;
      const up = globalUp !== null ? globalUp : ch.codePointAt(0) > (old?.ch.codePointAt(0) ?? 0);
      let slot;
      if (!changed.has(key)) {
        slot = staticSlot(ch);
      } else {
        slot = animSlot(old?.ch ?? "\u2007", ch, up, delay);
        animSlots.push(slot);
      }
      el.appendChild(slot);
      this._slotMap.set(key, slot);
    }
    if (sufEl) el.appendChild(sufEl);
    else if (this._suf) {
      const span = h("span");
      Object.assign(span.style, { fontSize: ".38em", alignSelf: "flex-end", paddingBottom: ".1em", marginLeft: "3px", opacity: ".6" });
      span.textContent = this._suf;
      el.appendChild(span);
    }
    for (const s of animSlots) s._nt.oldFace.style.display = "none";
    for (const s of animSlots) s._nW = s.getBoundingClientRect().width;
    for (const s of animSlots) s._nt.oldFace.style.display = "";
    for (const s of animSlots) s._oW = s.getBoundingClientRect().width;
    const shrinkSlots = animSlots.filter((s) => s._oW - s._nW > 0.5);
    const flipList = [];
    for (const [key, slot] of this._slotMap) {
      if (!oldX.has(key)) continue;
      const dx = oldX.get(key) - slot.getBoundingClientRect().left;
      if (Math.abs(dx) > 0.5) flipList.push({ slot, dx });
    }
    for (const { slot, dx } of flipList) {
      slot.style.transition = "none";
      slot.style.transform = `translateX(${dx}px)`;
    }
    for (const s of shrinkSlots) {
      s.style.transition = "none";
      s.style.width = s._oW + "px";
    }
    el.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const { slot, dx } of flipList) {
        slot.style.transition = `transform ${D}ms ${EASE_H}`;
        slot.style.transform = "translateX(0)";
      }
      for (const s of shrinkSlots) {
        s.style.transition = `width ${D}ms ${EASE_H}`;
        s.style.width = s._nW + "px";
      }
      for (const s of animSlots) {
        const { track, up, delay } = s._nt;
        if (this._bounce) {
          track.style.animation = `${up ? "_nt-up" : "_nt-dn"} ${D}ms linear ${delay}ms both`;
        } else {
          track.style.transition = `transform ${D}ms ${EASE_V} ${delay}ms`;
          track.style.transform = up ? "translateY(-50%)" : "translateY(0)";
        }
      }
    }));
    const maxDelay = Math.max(0, (staggerIdx - 1) * this._stagger);
    setTimeout(() => {
      for (const s of animSlots) {
        if (!s.isConnected) continue;
        const { track, newCh } = s._nt;
        track.style.animation = track.style.transition = "none";
        track.style.transform = "";
        track.innerHTML = "";
        const face = h("span", "nt-face");
        face.textContent = newCh;
        track.appendChild(face);
        s.style.transition = s.style.width = "";
      }
      for (const { slot } of flipList) {
        if (!slot.isConnected) continue;
        slot.style.transition = slot.style.transform = "";
      }
    }, D + maxDelay + 80);
  }
};
var index_default = NumericText;
export {
  NumericText,
  index_default as default
};
//# sourceMappingURL=numeric-text-animation.js.map
