#!/usr/bin/env node
// Timeline stamp: appends one line to TIMELINE.tsv so the time each stage of a feature took can be read off later.
//   node tests/stamp.js "<feature>" "<stage>" start|end ["note"]
// Stages (keep these names): criteria, build, release-check, review, playthrough, fix, mutate-new, balance, publish
'use strict';
const fs = require('node:fs'), path = require('node:path');
const [feature, stage, ev, note] = process.argv.slice(2);
if (!feature || !stage || !/^(start|end)$/.test(ev || '')) { console.error('usage: node tests/stamp.js "<feature>" "<stage>" start|end ["note"]'); process.exit(2); }
const f = path.join(__dirname, '..', 'TIMELINE.tsv');
if (!fs.existsSync(f)) fs.writeFileSync(f, 'utc\tfeature\tstage\tevent\tnote\n');
fs.appendFileSync(f, [new Date().toISOString().slice(0, 19) + 'Z', feature, stage, ev, note || ''].join('\t').replace(/\n/g, ' ') + '\n');
// with "end": print how long the stage took (from its last "start")
if (ev === 'end') {
  const rows = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const s = rows.filter((r) => r[1] === feature && r[2] === stage && r[3] === 'start').pop();
  if (s) console.log(stage + ': ' + Math.round((Date.now() - Date.parse(s[0])) / 60000) + ' min');
}
