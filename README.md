# numeric-text-animation

SwiftUI-style per-character slide animation for the web.

**[Live Demo](https://igarinpiano.github.io/numeric-text-animation/demo/)**

```
npm install numeric-text
```

---

## Features

- 🔢 Per-digit animation — only **changed** characters move
- 🌊 Spring bounce **or** cubic-bezier ease (switchable at runtime)
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
import NumericText from 'numeric-text';

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
| `decimals` | `number` | `0` | decimal places (type `'decimal'` only) |
| `pre` | `string` | `''` | prefix e.g. `'¥'` (not animated) |
| `suf` | `string` | `''` | suffix e.g. `'円'` (not animated) |

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

Supported attributes: `data-nt`, `data-nt-bounce`, `data-nt-stagger`, `data-nt-duration`, `data-nt-decimals`, `data-nt-pre`, `data-nt-suf`.

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

- `dist/numeric-text.js` — ESM
- `dist/numeric-text.cjs` — CommonJS
- `dist/numeric-text.min.js` — IIFE minified (script tag / CDN)

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE) for details.
