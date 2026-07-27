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
| `duration` | `number` | `400` | base animation duration in ms |
| `adaptive` | `boolean` | `true` | shorten the duration toward `minDuration` when values arrive faster than `duration`, so digits keep up crisply during a burst |
| `minDuration` | `number` | `200` | floor for the adaptive duration |
| `blur` | `number` | `0.06` | motion-blur peak as a fraction of text height — `0` disables |
| `fade` | `boolean` | `true` | cross-fade opacity between the old and new glyph |
| `decimals` | `number` | `0` | decimal places (type `'decimal'` only) |
| `pre` | `string` | `''` | prefix e.g. `'¥'` (not animated) |
| `suf` | `string` | `''` | suffix e.g. `'円'` (not animated) |

> **Interrupting an animation is safe.** Calling `.set()` again while a previous
> transition is still running retargets every affected digit from its current
> position — the slide, blur and cross-fade all continue smoothly. Rapid or
> chaotic updates never snap. With `adaptive` on (the default), a fast burst of
> updates also runs shorter (down to `minDuration`) so the digits stay in step
> with the incoming values instead of lagging behind.

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

Supported attributes: `data-nt`, `data-nt-bounce`, `data-nt-stagger`, `data-nt-duration`, `data-nt-adaptive`, `data-nt-min-duration`, `data-nt-blur`, `data-nt-fade`, `data-nt-decimals`, `data-nt-pre`, `data-nt-suf`.

### `NumericText.observe(target, options?)`

Watch an element's `textContent` via `MutationObserver`. Any external write to the element triggers the animation automatically.

```js
NumericText.observe('#counter', { bounce: true });
document.querySelector('#counter').textContent = '14800'; // → animated
```

---

## Using with AI coding assistants

Paste the block below into an AI coding assistant (Claude, ChatGPT, Copilot, etc.)
to have it use this library correctly — it pins down the exact option names and
defaults so the assistant doesn't invent options that don't exist.

<details>
<summary>Copy-paste prompt template (Japanese)</summary>

```
数値やテキストの切り替えアニメーションには numeric-text-animation（NumericText.js）を
使ってください。SwiftUI の numericText に似た、1文字ずつスライドするアニメーションです。

- インストール: npm install numeric-text-animation
- import: import NumericText from 'numeric-text-animation';
- 基本の使い方: `new NumericText(target, options)` でインスタンスを作り、`.set(value)` で
  値を更新する。1回目の .set() はアニメーションなしの初期表示、2回目以降は自動でアニメー
  ションする。.set() はアニメーション中に何度呼んでも安全（割り込み時も途中位置から滑らか
  に追従し、スナップしない）ので、連打やライブ更新にそのまま使ってよい。
- target: CSSセレクタ文字列、または DOM要素

options（すべて省略可。他のオプション名は存在しないので使わないこと）:
  - type: 'integer' | 'decimal' | 'string'（既定 'integer'）
    integer/decimal は桁の位で比較し、変化した桁"全部"が同じ方向へ動く（オドメーター式）。
    string は文字ごとに独立して比較される（大小比較ができない文字列向け。日本語や絵文字も可）。
  - decimals: number（既定 0）— type:'decimal' のときの小数桁数
  - bounce: boolean（既定 true）— true=バネのようなオーバーシュート、false=イージングのみ
  - stagger: number, ms（既定 40）— 変化した桁ごとの左→右の遅延
  - duration: number, ms（既定 400）— 基本のアニメーション時間
  - adaptive: boolean（既定 true）— .set() が duration より短い間隔で連続呼び出しされた
    とき、自動で minDuration まで短縮して追従する（連打・ライブ更新時にキレよく見せたい
    ならオン、常に一定の尺で再生したいならオフ）
  - minDuration: number, ms（既定 200）— adaptive 有効時の下限
  - blur: number（既定 0.06）— 変化中の文字にかけるモーションブラーの強さ（文字の高さに
    対する比率。0 で無効）
  - fade: boolean（既定 true）— 新旧文字のクロスフェード
  - pre: string（既定 ''）— アニメーションしない接頭辞（例: '¥'）
  - suf: string（既定 ''）— アニメーションしない接尾辞（例: '円', '%'）

インスタンスメソッド:
  - .set(value) — 値を更新（アニメーション）
  - .value — 現在の値（getter）
  - .configure(options) — bounce/stagger/duration/adaptive/minDuration/blur/fade のみ
    実行時に変更可能（アニメーションは発火しない）。type/decimals/pre/suf はコンストラクタ
    でのみ指定可能で、configure() では変更できない（無視される）。変えたい場合は新しい
    インスタンスを作り直すこと。

静的メソッド:
  - NumericText.autoInit(selector = '[data-nt]') — data-nt / data-nt-bounce /
    data-nt-stagger / data-nt-duration / data-nt-adaptive / data-nt-min-duration /
    data-nt-blur / data-nt-fade / data-nt-decimals / data-nt-pre / data-nt-suf
    属性を読み取って一括初期化する
  - NumericText.observe(target, options) — MutationObserver で textContent の変更を
    自動検知してアニメーションする

サンプルコード:

import NumericText from 'numeric-text-animation';

const price = new NumericText('#price', {
  type: 'integer',
  pre: '¥',
  bounce: true,
});

price.set(2980);   // 初期表示（アニメーションなし）
price.set(14800);  // ここでアニメーションして切り替わる

上記の options 一覧・デフォルト値・メソッドシグネチャを正として実装し、存在しない
オプション名やメソッドを作らないこと。
```

</details>

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
