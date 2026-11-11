#!/usr/bin/env node
// Usage: node tools/generate.js
// Reads people.json, draws a valid assignment, writes data.js (public, encrypted)
// and codes.txt (secret – hand each person only their own line).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'people.json'), 'utf8'));
const names = people.map(p => p.name.trim());

if (people.length < 3) throw new Error('At least 3 people are needed.');
if (new Set(names.map(n => n.toLowerCase())).size !== names.length) throw new Error('Names must be unique.');

// `node tools/generate.js --wishlists` keeps the existing draw and codes, only refreshes wishlists.
if (process.argv.includes('--wishlists')) {
  const file = path.join(root, 'data.js');
  const old = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^window\.SORSOLAS = /, '').replace(/;\s*$/, ''));
  const oldNames = old.people.map(p => p.name).sort().join('|');
  if (oldNames !== names.slice().sort().join('|')) throw new Error('Names changed - a new draw is required (run without --wishlists).');
  old.people = people.map(p => ({ name: p.name.trim(), wishlist: p.wishlist || [] }));
  fs.writeFileSync(file, 'window.SORSOLAS = ' + JSON.stringify(old, null, 1) + ';\n');
  console.log('Wishlists updated; draw and codes unchanged.');
  process.exit(0);
}

const ITER = 200000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

// Partners may never draw each other.
const partnerOf = {};
for (const p of people) {
  if (!p.partner) continue;
  const q = people.find(x => x.name.trim() === p.partner.trim());
  if (!q || (q.partner || '').trim() !== p.name.trim()) throw new Error(`Partner link for ${p.name} must exist and be mutual.`);
  partnerOf[p.name.trim()] = p.partner.trim();
}
// Random shuffle (Fisher-Yates, cryptographic RNG) repeated until no two neighbours are partners.
// One single cycle: order[i] gives to order[i+1]. Nobody draws themselves, everybody gives
// exactly once and is drawn exactly once. (No two people draw each other either.)
let order, tries = 0;
do {
  if (++tries > 100000) throw new Error('No valid draw exists for these constraints.');
  order = names.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
} while (order.some((g, i) => partnerOf[g] === order[(i + 1) % order.length]));
const pairs = order.map((giver, i) => ({ giver, receiver: order[(i + 1) % order.length] }));

const newCode = () => {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
};
const used = new Set();
const globalSalt = crypto.randomBytes(16);

const entries = [];
const codeLines = [];
for (const pair of pairs) {
  let code;
  do { code = newCode(); } while (used.has(code));
  used.add(code);
  const bits = crypto.pbkdf2Sync(code.replace('-', ''), globalSalt, ITER, 48, 'sha256');
  const id = bits.subarray(0, 16).toString('hex');
  const key = bits.subarray(16, 48);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(pair), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  entries.push({ id, iv: iv.toString('base64'), ct: ct.toString('base64') });
  codeLines.push(`${pair.giver.padEnd(20)} ${code}`);
}
entries.sort((a, b) => a.id.localeCompare(b.id)); // hide the draw order

const data = {
  iterations: ITER,
  salt: globalSalt.toString('base64'),
  entries,
  people: people.map(p => ({ name: p.name.trim(), wishlist: p.wishlist || [] })),
};
fs.writeFileSync(path.join(root, 'data.js'), 'window.SORSOLAS = ' + JSON.stringify(data, null, 1) + ';\n');
fs.writeFileSync(path.join(root, 'codes.txt'),
  '# SECRET - do not publish. Name / personal code. (Pairings are deliberately NOT listed.)\n' + codeLines.join('\n') + '\n');
console.log(`Done: ${people.length} people drawn. data.js written (public), codes.txt written (secret).`);
