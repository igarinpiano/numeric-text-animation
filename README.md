# numeric-text-animation

SwiftUI-style per-character slide animation for the web.

**[Live Demo](https://igarinpiano.github.io/numeric-text-animation/demo/)**

```
npm install numeric-text-animation
```

---

## Features

- 🔢 Per-digit animation — only **changed** characters move
- 🌊 Spring bounce **or** cubic-bezier ease (switchable at runtime)
- 💨 SwiftUI-style motion **blur** + opacity cross-fade on each changing glyph
- ⚡ Fully **interruptible** — change the value mid-animation and every digit
  glides on from where it was, never snapping to the start or the end
- ↔️ Proportional-font support — static chars slide horizontally via FLIP
- 📐 Decimal, integer, and arbitrary string support
- ⚙️ Zero dependencies — ~3 KB gzip

---

## Quick start

### CDN (no build step)

```html
<script type="module">
  import NumericText from 'https://cdn.jsdelivr.net/gh/igarinpiano/numeric-text-animation/src/index.js';

  const nt = new NumericText('#el', { type: 'integer', bounce: true, pre: '¥' });
  nt.set(2980);   // first call — no animation
  nt.set(14800);  // animated
</script>
```

### npm

```js
import NumericText from 'numeric-text-animation';

const nt = new NumericText('#price', {
  type:    'integer',
  bounce:  true,
  stagger: 40,
  pre:     '¥',
});
nt.set(2980);
nt.set(14800);
```

---

## API

### `new NumericText(target, options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `type` | `'integer'` \| `'decimal'` \| `'string'` | `'integer'` | Value format |
| `bounce` | `boolean` | `true` | `true` = spring bounce, `false` = ease only |
| `stagger` | `number` | `40` | ms delay per character (left → right) |
| `duration` | `number` | `400` | animation duration in ms |
| `blur` | `number` | `0.06` | motion-blur peak as a fraction of text height — `0` disables |
| `fade` | `boolean` | `true` | cross-fade opacity between the old and new glyph |
| `decimals` | `number` | `0` | decimal places (type `'decimal'` only) |
| `pre` | `string` | `''` | prefix e.g. `'¥'` (not animated) |
| `suf` | `string` | `''` | suffix e.g. `'円'` (not animated) |

> **Interrupting an animation is safe.** Calling `.set()` again while a previous
> transition is still running retargets every affected digit from its current
> position — the slide, blur and cross-fade all continue smoothly. Rapid or
> chaotic updates never snap.

### `.set(value)`

Set a new value. First call initialises without animation.

### `.configure(options)`

Change options after construction — useful for toggling `bounce` at runtime.

```js
nt.configure({ bounce: false });
```

### `NumericText.autoInit(selector?)`

Auto-initialise elements via data attributes.

```html
<span data-nt="integer" data-nt-pre="¥" data-nt-bounce="true">2980</span>
```

```js
NumericText.autoInit('[data-nt]');
```

Supported attributes: `data-nt`, `data-nt-bounce`, `data-nt-stagger`, `data-nt-duration`, `data-nt-blur`, `data-nt-fade`, `data-nt-decimals`, `data-nt-pre`, `data-nt-suf`.

### `NumericText.observe(target, options?)`

Watch an element's `textContent` via `MutationObserver`. Any external write to the element triggers the animation automatically.

```js
NumericText.observe('#counter', { bounce: true });
document.querySelector('#counter').textContent = '14800'; // → animated
```

---

## Build

```sh
npm install
npm run build   # → dist/
```

Outputs:

- `dist/numeric-text-animation.js` — ESM
- `dist/numeric-text-animation.cjs` — CommonJS
- `dist/numeric-text-animation.min.js` — IIFE minified (script tag / CDN)

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE) for details.
