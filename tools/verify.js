#!/usr/bin/env node
// Usage: node tools/verify.js [--show]
// Independently decrypts data.js with every code in codes.txt and checks the rules.
// Pairings are NOT printed unless --show is given (so the organiser's surprise stays intact).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'people.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/^window\.SORSOLAS = /, '').replace(/;\s*$/, ''));
const lines = fs.readFileSync(path.join(root, 'codes.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
const show = process.argv.includes('--show');
const problems = [];
const bad = m => problems.push(m);

const result = {};
for (const line of lines) {
  const m = line.match(/^(.+?)\s+([A-Z0-9]{4}-[A-Z0-9]{4})\s*$/);
  if (!m) { bad(`Unreadable line in codes.txt: ${line}`); continue; }
  const [, name, code] = m;
  const bits = crypto.pbkdf2Sync(code.replace('-', ''), Buffer.from(D.salt, 'base64'), D.iterations, 48, 'sha256');
  const e = D.entries.find(x => x.id === bits.subarray(0, 16).toString('hex'));
  if (!e) { bad(`${name}: code does not match any entry in data.js`); continue; }
  try {
    const ct = Buffer.from(e.ct, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', bits.subarray(16, 48), Buffer.from(e.iv, 'base64'));
    d.setAuthTag(ct.subarray(ct.length - 16));
    const r = JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8'));
    if (r.giver !== name) bad(`${name}: the code belongs to ${r.giver}`);
    result[name] = r.receiver;
  } catch (err) { bad(`${name}: decryption failed`); }
}

const names = people.map(p => p.name);
const partner = Object.fromEntries(people.filter(p => p.partner).map(p => [p.name, p.partner]));
const codes = lines.map(l => l.trim().split(/\s+/).pop());
const check = (ok, text) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + text); if (!ok) bad(text); };

console.log(`People: ${names.length}, codes: ${lines.length}, entries in data.js: ${D.entries.length}`);
check(lines.length === names.length && names.every(n => n in result), 'Every person has a working code');
check(new Set(codes).size === codes.length, 'All codes are different');
check(D.entries.length === names.length, 'data.js contains exactly one entry per person');
check(names.every(n => result[n] && result[n] !== n), 'Nobody draws themselves');
check(names.every(n => result[n] !== partner[n]), 'Nobody draws their partner');
check(names.every(n => !(result[result[n]] === n)), 'Nobody draws a person who draws them back');
const received = Object.values(result);
check(new Set(received).size === names.length && names.every(n => received.includes(n)), 'Everybody is drawn exactly once');
check(JSON.stringify(D.people.map(p => p.name).sort()) === JSON.stringify(names.slice().sort()), 'Names on the website match people.json');

if (show) for (const n of names) console.log(`  ${n} -> ${result[n]}`);
console.log(problems.length ? `\nRESULT: ${problems.length} PROBLEM(S) FOUND` : '\nRESULT: ALL CHECKS PASSED');
process.exit(problems.length ? 1 : 0);
