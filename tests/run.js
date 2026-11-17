#!/usr/bin/env node
// Runs the whole fast suite (everything except tests/sim.js). Exit code is non-zero if any test fails.
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const files = ['build.test.js', 'mapgen.test.js', 'smoke.test.js', 'save.test.js', 'kits.test.js', 'features.test.js'].map((f) => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
