#!/usr/bin/env node
// Assembles src/ into the single self-contained index.html (no dependencies).
// Usage: node build.js [outfile]   (default: ./index.html)
'use strict';
const fs = require('fs');
const path = require('path');

// All modules share ONE closure scope (they are concatenated inside a single IIFE),
// so ORDER MATTERS for top-level `const`/`let` and load-time statements.
// Function declarations hoist and may be used from any file; data tables and
// shared state must come before the first file that executes code using them.
const JS_ORDER = [
  'balance', 'content', 'core', 'util', 'world', 'records', 'save',
  'audio', 'effects', 'items', 'perks', 'fov', 'mapgen',
  'mods', 'enemies', 'combat', 'features', 'abilities', 'player', 'run', 'walk',
  'modals', 'help', 'title', 'screens', 'hud', 'input', 'inspect', 'auto', 'minimap', 'render',
  'main',
];

const NOTICE = '<!-- GENERATED FILE - DO NOT EDIT. Built from src/ by `node build.js`; edit src/ and rebuild instead. -->';

function build() {
  const src = path.join(__dirname, 'src');
  const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');
  const dir = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
  const missing = JS_ORDER.filter((n) => !dir.includes(n));
  const unlisted = dir.filter((n) => !JS_ORDER.includes(n));
  if (missing.length || unlisted.length) {
    throw new Error('JS_ORDER mismatch. missing files: [' + missing + '] not in JS_ORDER: [' + unlisted + ']');
  }
  const js = "(function(){\n'use strict';\n" + JS_ORDER.map((n) => read('js/' + n + '.js').replace(/\s+$/, '')).join('\n\n') + '\n})();';
  if (/<\/script/i.test(js)) throw new Error('JS contains "</script", which would break the inline script');
  const css = read('styles.css').replace(/\s+$/, '');
  const tpl = read('index.template.html').replace(/<!--TEMPLATE[\s\S]*?-->\n/, '');
  for (const ph of ['{{GENERATED}}', '{{STYLES}}', '{{SCRIPT}}']) {
    if (tpl.split(ph).length !== 2) throw new Error('template must contain ' + ph + ' exactly once');
  }
  // function replacers: JS/CSS text may contain "$&" etc.
  return tpl.replace('{{GENERATED}}', () => NOTICE).replace('{{STYLES}}', () => css).replace('{{SCRIPT}}', () => js);
}

module.exports = { build, JS_ORDER };
if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'index.html'));
  const html = build();
  fs.writeFileSync(out, html);
  console.log('built ' + path.relative(process.cwd(), out) + ' (' + html.length + ' bytes)');
}
