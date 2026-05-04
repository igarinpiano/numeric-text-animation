// build.js — run with: node build.js
import * as esbuild from 'esbuild';

const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  sourcemap: true,
};

await Promise.all([
  // ESM (import 用)
  esbuild.build({ ...shared, format: 'esm', outfile: 'dist/numeric-text.js' }),
  // CJS (require 用)
  esbuild.build({ ...shared, format: 'cjs', outfile: 'dist/numeric-text.cjs' }),
  // ブラウザ向け minified UMD (CDN / script タグ用)
  esbuild.build({
    ...shared,
    format: 'iife',
    globalName: 'NumericText',
    outfile: 'dist/numeric-text.min.js',
    minify: true,
    footer: {
      js: 'if(typeof NumericText!=="undefined")NumericText=NumericText.default||NumericText;'
    },
  }),
]);

console.log('✓ dist/ built');
