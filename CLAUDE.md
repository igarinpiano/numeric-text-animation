# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`numeric-text-animation` is a zero-dependency vanilla-JS library (single file: `src/index.js`) that animates a text/number element's value with a SwiftUI `numericText`-style per-character slide, motion blur, and cross-fade. It ships as ESM, CJS, and a minified IIFE for `<script>`/CDN use.

## Commands

```sh
npm install
npm run build   # node build.js — esbuild bundles src/index.js → dist/ (esm, cjs, iife+min), with sourcemaps
npm run dev      # same build, but --watch
```

There is no test suite and no lint config in this repo — don't invent `npm test`/`npm run lint` commands or assume CI runs them. Verify behavior by exercising the demo pages in a browser (see below).

Publishing to npm is manual only: GitHub Actions workflow `.github/workflows/npm-publish.yml` is `workflow_dispatch`-only (no push/tag trigger) and uses OIDC Trusted Publishing, not a token. It builds `dist/` from source as part of the publish job, so `dist/` does not strictly need to be committed up to date for a release to work — but it currently is committed, so keep it in sync with `src/` when you change source (`npm run build`) rather than leaving it stale.

## Local preview / manual testing

Demo pages (`demo/index.html`, `demo/stress.html`) import `../src/index.js` directly via a native ES module `<script type="module">`, so they must be served over HTTP, not opened as `file://`:

```sh
python3 -m http.server 8123   # from repo root
# http://localhost:8123/demo/index.html   — full interactive playground ("Signal Lab")
# http://localhost:8123/demo/stress.html  — retarget/interruption stress test w/ blur/fade/duration sliders
```

**Gotcha:** `python3 -m http.server` sends no `Cache-Control` header, so the browser can silently serve a stale cached `src/index.js` after an edit. Hard-reload, or serve with a handler that sends `Cache-Control: no-store`, or cache-bust ad-hoc probes with `import('/src/index.js?v='+Date.now())`.

`demo/index.html` on GitHub Pages imports the repo's own `../src/index.js` (not the jsdelivr CDN build), so the published demo reflects whatever is on the Pages-published branch at the last Pages rebuild — it does not track the npm/CDN release.

Because animation state depends on `requestAnimationFrame`/WAAPI timelines, a backgrounded tab/window pauses the document timeline and throttles timers — don't trust time-based animation observations made while the page isn't foregrounded. For deterministic frame inspection, drive a `track`'s animation clock manually (`anim.currentTime = ms`, then read `getComputedStyle(track).transform`) rather than waiting on wall-clock timers.

## Architecture

Everything lives in **one class**, `NumericText` in `src/index.js`. There is no framework, no build-time codegen, no other source modules — read this file top to bottom to understand the whole library.

### The core animation model: keyed-token diffing + FLIP + WAAPI

1. **Tokenize.** `.set(value)` formats the value to a string (`_format`), then splits it into keyed character tokens:
   - `parseNumeric` keys by decimal place (`d3`, `d2`, ... for integer digits counting from the decimal point, `sp{place}` for thousands-separator commas, `dt` for the decimal point, `df1`, `df2`... for fractional digits). Keys are stable across values of different lengths so digits that represent "the same place" diff correctly even when the number of digits changes (e.g. 999 → 1000).
   - `parseString` keys by position (`s0`, `s1`, ...) — used for `type: 'string'`, where magnitude comparison doesn't apply.
2. **Diff old vs new** by key to find which characters actually changed (`changed` set in `_animate`). Unchanged characters render as plain static slots (`staticSlot`) and never touch WAAPI.
3. **Each changed character becomes a two-face "reel"**: a `.nt-slot` (clipping viewport) containing a `.nt-track` (flex column with old glyph + new glyph as `.nt-face` children) that slides vertically via WAAPI `track.animate(...)` to reveal the new glyph — the actual odometer effect. Direction (`up`) is global for numeric types (whole value increased vs decreased) but per-character for `type: 'string'` (compares code points, since strings have no single "increased/decreased").
4. **Horizontal repositioning uses FLIP**: because digit counts and glyph widths change, static and animated slots may shift horizontally. Positions are measured *before* the DOM is rebuilt (`oldX`), then the new layout is measured, and the deltas are played as WAAPI `translateX` animations from old→0.
5. **Width tweening** is measured with old/new faces shown one at a time (not together) so a narrowing and a widening glyph animate symmetrically instead of only ever growing to `max(oldWidth, newWidth)`.
6. **Motion blur + cross-fade** are separate parallel WAAPI animations (`blurAnim`, `oldFaceAnim`, `newFaceAnim`) layered on top of the slide, only for characters whose glyph actually changed (a "settling" reel that's just finishing a still-running slide skips these so it doesn't flicker).

### Interruptibility — the part most bugs live in

Calling `.set()` again while a previous transition is still animating must retarget smoothly, never snap. The mechanism:

- An animation **generation counter** (`this._gen`) is bumped on every `_animate()` call. The deferred cleanup `setTimeout` at the end of `_animate` only calls `_render(newVal)` (the final static DOM) if `this._gen` still matches the generation it captured — so a stale timer from an interrupted animation can never clobber a newer one.
- Before rebuilding the DOM for a new `.set()`, `_animate` does a **two-pass measure-then-cancel**: first it reads every slot's live bounding rect (`oldX`) and, for any track mid-slide, its *live rendered* `translateY` via `getComputedStyle` (`carryY`) — this is what lets a re-aimed reel continue from its actual current visual position instead of restarting. Only after all slots are measured does it cancel their WAAPI animations (`_cancelSlot`). Measuring and cancelling in a single pass is deliberately avoided: cancelling a slot's width animation reverts its width immediately, which reflows every slot to its right, corrupting `oldX` for slots not yet measured.
- A reel that's mid-slide but whose *character itself* didn't change in this round (`settle`, tracked separately from `changed`) is still carried into the new animation set so it finishes gliding to rest instead of being cut off.
- A retargeted (interrupted) reel plays a plain ease from its carried position (`vFrames` built from `carryY`) rather than replaying the full spring/bounce curve — re-aiming should settle, not restart the bounce.

If you touch `_animate`, preserve the ordering: **measure all → cancel all → rebuild DOM → measure widths → measure FLIP deltas → fire all WAAPI animations synchronously** (not after a `requestAnimationFrame`) — firing synchronously means a slot's `anim` handle exists the instant `.set()` returns, so an immediate subsequent `.set()` always finds a running animation to read/cancel.

### Public API surface — do not invent options

`README.md`'s "Using with AI coding assistants" section (and the constructor JSDoc in `src/index.js`) is the authoritative list of constructor options (`type`, `decimals`, `bounce`, `stagger`, `duration`, `adaptive`, `minDuration`, `blur`, `fade`, `pre`, `suf`), instance methods (`.set()`, `.value` getter, `.configure()` — which only accepts `bounce`/`stagger`/`duration`/`adaptive`/`minDuration`/`blur`/`fade`, not `type`/`decimals`/`pre`/`suf`), and static methods (`NumericText.autoInit()`, `NumericText.observe()`). Keep `README.md`, the constructor JSDoc, and actual behavior in sync when adding/renaming an option — this file is copy-pasted verbatim by users into other AI assistants as a source of truth, so drift here is user-visible breakage.

### Build output

`build.js` uses esbuild to produce three artifacts from the single `src/index.js` entry point, all with sourcemaps: `dist/numeric-text-animation.js` (ESM), `dist/numeric-text-animation.cjs` (CJS), `dist/numeric-text-animation.min.js` (minified IIFE, global `NumericText`, for `<script>`/CDN use). The npm package ships both `dist/` and `src/` (`files` in `package.json`). These are committed to the repo — regenerate with `npm run build` after editing `src/index.js`, don't hand-edit `dist/`.
