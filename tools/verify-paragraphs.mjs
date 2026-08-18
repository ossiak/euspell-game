// Re-derives each paragraph's euspell block with the real engine and reports
// where the stored text differs.
//
//   node tools/verify-paragraphs.mjs          # report only
//   node tools/verify-paragraphs.mjs --fix    # rewrite the euspell blocks
//
// The game scores a player's answer against the STORED euspell text, so any
// divergence from what the engine produces marks a correct answer wrong. That
// makes the stored block a cache of engine output, not an editorial choice, and
// this is how the cache is checked.
//
// check-paragraphs.py catches the subset it can see from the lexicon — a word
// that always changes but was left alone. It cannot judge a context-dependent
// word, because both spellings are legitimate entries; only the engine knows
// which one this sentence takes. Hence a second tool rather than a bigger first.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '..');
const EXT = resolve(GAME, '..', 'euspell_ext');
const DIR = join(GAME, 'paragraphs');

const url = (p) => `file:///${join(EXT, p).replace(/\\/g, '/')}`;
const { installDomShim, el, tx } = await import(url('build/lib/dom-shim.js'));
installDomShim();
const { walkTextNodes } = await import(url('src/content/dom-walker.js'));
const { convert } = await import(url('src/content/converter.js'));

function toEuspell(text) {
  const p = el('p', tx(text));
  walkTextNodes(p, convert);
  return p.childNodes.map((c) => c.nodeValue).join('');
}

const fix = process.argv.includes('--fix');
const files = readdirSync(DIR).filter((f) => /^\d{3}-.*\.md$/.test(f)).sort();

let bad = 0;
for (const f of files) {
  const path = join(DIR, f);
  const src = readFileSync(path, 'utf8');
  const m = src.match(/## traditional\s*\n([\s\S]*?)\n## euspell\s*\n([\s\S]*)$/);
  if (!m) {
    console.log(`${f}\n  ! could not find both sections`);
    bad++;
    continue;
  }
  const traditional = m[1].trim();
  const stored = m[2].trim();
  const expected = toEuspell(traditional).trim();
  if (stored === expected) continue;

  bad++;
  const a = stored.split(/\s+/);
  const b = expected.split(/\s+/);
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diffs.push(`${i + 1}: stored ${a[i] ?? '—'} / engine ${b[i] ?? '—'}`);
  }
  console.log(`${f}  (${diffs.length} word${diffs.length === 1 ? '' : 's'})`);
  for (const d of diffs.slice(0, 6)) console.log(`  ${d}`);
  if (diffs.length > 6) console.log(`  … and ${diffs.length - 6} more`);

  if (fix) {
    writeFileSync(path, src.slice(0, m.index) + `## traditional\n\n${traditional}\n\n## euspell\n\n${expected}\n`, 'utf8');
  }
}

console.log(`\n${files.length - bad} of ${files.length} match the engine`);
if (bad && !fix) console.log('Run with --fix to rewrite the euspell blocks from the engine.');
process.exit(bad && !fix ? 1 : 0);
