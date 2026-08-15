// Turns paragraphs/*.md into web/paragraphs.js — everything the drill needs at
// runtime, and nothing it does not.
//
//   node tools/build-data.mjs
//
// The drill loads NO lexicon. Scoring is a comparison against stored text, so
// the payload is the paragraphs plus a few flags per word — tens of KB against
// 13 MB for dist/lexicon.data. This is the only step that consults the lexicon,
// and its output is committed so a deploy needs no euspell_ext checkout.
//
// Emitted as a classic script assigning a global, NOT an ES module: Chrome
// blocks module imports and fetch() on file://, and opening index.html directly
// is how the page gets screenshotted and demoed offline.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '..');
const EXT = resolve(GAME, '..', 'euspell_ext');
const OUT = join(GAME, 'web');

// Same tokenizer shape as the validator: an apostrophe is part of the word, so
// `it'z` and `shepherd's` are single tokens.
const WORD = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

/* ------------------------------------------------------------------ lexicon */

function loadLexicon() {
  const lex = new Map();
  for (const [file, main] of [
    ['data/euspell_lexicon.csv', true],
    ['data/euspell_lexicon_contractions.csv', false],
  ]) {
    for (const line of readFileSync(join(EXT, file), 'utf8').split(/\r?\n/)) {
      const col = line.split(',');
      if (col.length < 4 || col[0] === 'Word' || col[0] === 'Contraction') continue;
      const encoding = Number(col[2]);
      if (!Number.isFinite(encoding)) continue;
      // converter.js returns the word unchanged when encoding % 10 === 0,
      // whatever the euspelling field holds — the 9xx abbreviations keep an
      // expansion there. Honour the guard or "Mister" reads as a euspelling.
      const spellings = encoding % 10 === 0
        ? []
        : col[3].split('|').filter((s) => s && s !== '[]');
      lex.set(col[0], { encoding, spellings, main });
    }
  }
  return lex;
}

/** The reflex set: the 100 most frequent words that always change. */
function loadCommon(lex) {
  const freq = join(GAME, '..', 'euspell_yt', 'unigram_freq.csv');
  const rows = [];
  for (const line of readFileSync(freq, 'utf8').split(/\r?\n/)) {
    const [word, count] = line.split(',');
    const entry = lex.get(word);
    if (!entry || !entry.spellings.length) continue;
    const changed = entry.spellings.filter((s) => s !== word);
    if (changed.length && changed.length === entry.spellings.length) {
      rows.push([Number(count) || 0, word]);
    }
  }
  rows.sort((a, b) => b[0] - a[0]);
  return new Set(rows.slice(0, 100).map(([, w]) => w));
}

/* ---------------------------------------------------------------- paragraphs */

function parse(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = m[2].replace(/<!--[\s\S]*?-->/g, '');
  const section = (name) =>
    new RegExp(`^##\\s+${name}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`, 'm').exec(body)?.[1].trim();
  return { meta, traditional: section('traditional'), euspell: section('euspell') };
}

/** Interleave words and the separators between them, for one text. */
function split(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    if (m.index > last) out.push({ sep: text.slice(last, m.index) });
    out.push({ word: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ sep: text.slice(last) });
  return out;
}

/**
 * One paragraph as the page wants it.
 *
 * Per word: t traditional, e expected, c context-dependent (the class that
 * needs a reading decided — bold in the legend, and the only place blue can
 * arise), k a top-100 reflex word, a the other spellings for the explanation.
 */
function build(entry, lex, common) {
  const left = split(entry.traditional);
  const right = split(entry.euspell);
  if (left.length !== right.length) {
    throw new Error(`${entry.meta.id}: token streams differ (${left.length} vs ${right.length})`);
  }

  const tokens = left.map((tok, i) => {
    if (tok.sep !== undefined) return tok.sep;
    const expected = right[i].word;
    const lexEntry = lex.get(tok.word.toLowerCase());
    const spellings = lexEntry?.spellings ?? [];
    const context = spellings.length >= 2 && lexEntry.encoding % 10 >= 2;
    const out = { t: tok.word, e: expected };
    if (context) {
      out.c = 1;
      const others = spellings.filter((s) => s.toLowerCase() !== expected.toLowerCase());
      if (others.length) out.a = others;
    }
    if (common.has(tok.word.toLowerCase())) out.k = 1;
    return out;
  });

  return {
    id: entry.meta.id,
    title: entry.meta.title,
    author: entry.meta.author,
    year: entry.meta.year || null,
    source: entry.meta.source || null,
    revision: entry.meta.revision || 'r1',
    tokens,
  };
}

/* --------------------------------------------------------------------- main */

const lex = loadLexicon();
const common = loadCommon(lex);
const files = readdirSync(join(GAME, 'paragraphs'))
  .filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md')
  .sort();

const paragraphs = [];
for (const file of files) {
  const entry = parse(readFileSync(join(GAME, 'paragraphs', file), 'utf8'));
  if (!entry?.traditional || !entry?.euspell) {
    console.warn(`  skipped ${file} — no traditional/euspell sections`);
    continue;
  }
  const built = build(entry, lex, common);
  paragraphs.push(built);
  const words = built.tokens.filter((t) => typeof t !== 'string');
  const edits = words.filter((w) => w.t !== w.e).length;
  const ctx = words.filter((w) => w.c).length;
  console.log(`  ${file.padEnd(42)} ${words.length} words, ${edits} edits, ${ctx} context`);
}

mkdirSync(OUT, { recursive: true });
const payload = { revision: 'r1', built: new Date().toISOString().slice(0, 10), paragraphs };
writeFileSync(
  join(OUT, 'paragraphs.js'),
  `// GENERATED by tools/build-data.mjs — do not edit.\n` +
  `window.EUSPELL_PARAGRAPHS = ${JSON.stringify(payload)};\n`,
  'utf8',
);

const bytes = readFileSync(join(OUT, 'paragraphs.js')).length;
console.log(`\nwrote web/paragraphs.js — ${paragraphs.length} paragraphs, ${(bytes / 1024).toFixed(1)} KB`);
