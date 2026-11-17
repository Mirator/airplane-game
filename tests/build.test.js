// Build test: the committed index.html must equal a fresh build of src/, and must stay fully self-contained.
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const committed = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

describe('build', () => {
  it('committed index.html is identical to a fresh `node build.js`', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emberfall-')), 'index.html');
    execFileSync(process.execPath, [path.join(root, 'build.js'), tmp], { cwd: root });
    assert.equal(fs.readFileSync(tmp, 'utf8') === committed, true, 'index.html is stale: run `node build.js` and commit the result');
  });
  it('starts with the generated-file notice', () => {
    assert.match(committed.slice(0, 200), /GENERATED FILE - DO NOT EDIT/);
  });
  it('makes no external requests (no http(s)/protocol-relative URLs, src/href, @import, url())', () => {
    const noComments = committed.replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(noComments, /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
    assert.doesNotMatch(noComments, /<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=/i);
    assert.doesNotMatch(noComments, /@import|url\(/i);
  });
  it('is one inline <script> and one inline <style>', () => {
    assert.equal((committed.match(/<script\b/g) || []).length, 1);
    assert.equal((committed.match(/<style\b/g) || []).length, 1);
  });
});
