#!/usr/bin/env node
// Refactor-equivalence report: does <candidate.html> contain the same CSS/JS/markup as <reference.html>,
// modulo comments, whitespace, statement ordering across files, and the BAL.* constant extraction?
// Usage: node tests/codecmp.js <reference.html> [candidate.html=index.html]
// Method: strip comments, split JS into trimmed lines, substitute BAL.<path> with the literal value from
// src/js/balance.js, then compare the two line MULTISETS. Prints every line present on only one side.
'use strict';
const fs = require('fs');
const path = require('path');

function stripComments(code) {
  let out = '', i = 0, q = null;
  while (i < code.length) {
    const c = code[i], n = code[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += n; i += 2; continue; }
      if (c === q) q = null;
      i++;
    } else if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; }
    else if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') i++; }
    else if (c === '/' && n === '*') { i = code.indexOf('*/', i + 2) + 2; }
    else { out += c; i++; }
  }
  return out;
}
const parts = (html) => ({
  css: (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '',
  js: (html.match(/<script>([\s\S]*)<\/script>/) || [])[1] || '',
  shell: html.replace(/<style>[\s\S]*?<\/style>/, '<style/>').replace(/<script>[\s\S]*<\/script>/, '<script/>').replace(/<!--[\s\S]*?-->\n?/g, ''),
});

const [refPath, candPath = path.join(__dirname, '..', 'index.html')] = process.argv.slice(2);
const A = parts(fs.readFileSync(refPath, 'utf8')), B = parts(fs.readFileSync(candPath, 'utf8'));

// BAL substitution
const balSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'balance.js'), 'utf8');
const BAL = new Function(balSrc + '\n;return BAL;')();
// resolve BAL.a.b.c; stop at the first non-object value (so BAL.merchant.floors.includes -> [3,6] + ".includes")
const resolve = (p) => {
  const keys = p.split('.').slice(1);
  let v = BAL;
  for (let i = 0; i < keys.length; i++) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return [v, keys.slice(i)];
    v = v[keys[i]];
  }
  return [v, []];
};
const lookup = (p) => resolve(p)[0];
let balRefs = 0;
const subst = (js) => js
  .replace(/\.\.\.BAL((?:\.\w+)+)/g, (m, p) => { balRefs++; return lookup('BAL' + p).join(','); })
  .replace(/BAL((?:\.\w+)+)/g, (m, p) => { balRefs++; const [v, rest] = resolve('BAL' + p); return (Array.isArray(v) ? JSON.stringify(v) : String(v)) + rest.map((k) => '.' + k).join(''); });

const lines = (js) => stripComments(js).split('\n').map((l) => l.trim()).filter(Boolean);
// the BAL definition block itself is new by design: exclude it from the comparison
const la = lines(A.js), lb = lines(subst(B.js.replace(/const BAL = \{[\s\S]*?\n\};\n/, '')));
const count = (arr) => arr.reduce((m, l) => (m.set(l, (m.get(l) || 0) + 1), m), new Map());
const ca = count(la), cb = count(lb);
const onlyA = [], onlyB = [];
for (const [l, n] of ca) { const d = n - (cb.get(l) || 0); for (let i = 0; i < d; i++) onlyA.push(l); }
for (const [l, n] of cb) { const d = n - (ca.get(l) || 0); for (let i = 0; i < d; i++) onlyB.push(l); }

const norm = (s) => stripComments(s).replace(/\s+/g, '');
console.log('JS lines: reference ' + la.length + ', candidate ' + lb.length + ' (BAL refs substituted: ' + balRefs + ')');
console.log('CSS identical (comments/whitespace ignored): ' + (norm(A.css) === norm(B.css)));
console.log('HTML shell identical (generated-file comment ignored): ' + (A.shell === B.shell));
console.log('JS lines only in reference: ' + onlyA.length + '\n' + onlyA.map((l) => '  - ' + l.slice(0, 230)).join('\n'));
console.log('JS lines only in candidate: ' + onlyB.length + '\n' + onlyB.map((l) => '  + ' + l.slice(0, 230)).join('\n'));
