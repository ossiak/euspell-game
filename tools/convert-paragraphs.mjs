// Turns a plain candidates file into paragraphs/NNN-*.md, with the euspell side
// produced by the REAL engine.
//
//   node tools/convert-paragraphs.mjs sample_paragraphs1.txt
//
// This is the step that makes 100 hand-checked paragraphs tractable. Converting
// them by hand is a week of tedium and produces mistakes nobody can see;
// converting them with the engine and READING the result is an afternoon, and
// the reviewer is auditing a machine rather than racing it. Every file it writes
// is a draft — `checked:` stays blank until a human has read both sides.
//
// Input format: blocks separated by blank lines, each a heading line
// ("Author - Title") followed by the passage on any number of lines.
//
// The engine runs headless on build/lib/dom-shim.js in euspell_ext. It is the
// same code path the extension uses, semantic disambiguators included, so
// `records` and `bow` come out resolved by context rather than defaulted.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '..');
const EXT = resolve(GAME, '..', 'euspell_ext');
const OUT = join(GAME, 'paragraphs');

const { installDomShim, el, tx } = await import(
  `file:///${join(EXT, 'build/lib/dom-shim.js').replace(/\\/g, '/')}`
);
installDomShim();
const { walkTextNodes } = await import(
  `file:///${join(EXT, 'src/content/dom-walker.js').replace(/\\/g, '/')}`
);
const { convert } = await import(
  `file:///${join(EXT, 'src/content/converter.js').replace(/\\/g, '/')}`
);

/** Convert a paragraph exactly as the extension would convert a <p>. */
function toEuspell(text) {
  const p = el('p', tx(text));
  walkTextNodes(p, convert);
  return p.childNodes.map((c) => c.nodeValue).join('');
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const args = process.argv.slice(2);
const force = args.includes('--force');
const source = args.find((a) => !a.startsWith('--')) ?? 'sample_paragraphs1.txt';
const raw = readFileSync(resolve(GAME, source), 'utf8');

// A file round-tripped through a non-UTF-8 step loses its dashes to U+FFFD.
// Repairing it silently would bake a guess into the corpus, so say so instead.
const damaged = (raw.match(/�/g) ?? []).length;
if (damaged) {
  console.warn(
    `[convert] ${damaged} U+FFFD in ${source} — the file lost characters to an ` +
    'encoding step. Treating each as an em dash; re-export to be sure.\n',
  );
}
const text = raw.replace(/�/g, '—');

mkdirSync(OUT, { recursive: true });
const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const today = new Date().toISOString().slice(0, 10);

blocks.forEach((block, i) => {
  const [heading, ...rest] = block.split('\n');
  const [author, title] = heading.split(/\s+-\s+/);
  // Passages copied from a typeset page carry hard line wraps, and a compound
  // that broke at its hyphen ("charred-\nlooking") must rejoin without a space
  // or it becomes two words and a stray dash.
  const body = rest
    .map((l) => l.trim())
    .reduce((acc, line) => (acc.endsWith('-') ? acc + line : `${acc} ${line}`), '')
    .replace(/\s+/g, ' ')
    .trim();
  const id = String(i + 1).padStart(3, '0');
  const name = `${id}-${slug(author ?? 'unknown')}-${slug(title ?? 'untitled')}.md`;

  const front = [
    '---',
    `id: ${id}`,
    `title: ${title ?? ''}`,
    `author: ${author ?? ''}`,
    'year:',            // left blank: the generator must not invent provenance
    'death:',
    'source:',
    'revision: r1',
    `checked:`,         // blank until a human has read both sides
    '---',
  ].join('\n');

  // Never clobber a file that already exists. The engine's output is a draft
  // and the whole point of the workflow is that a human corrects it — twice
  // already, for `bonez` and `shepherd'z`, both genuine engine errors. A
  // generator that overwrites review work destroys the only part of this
  // process a machine cannot redo.
  const path = join(OUT, name);
  if (existsSync(path) && !force) {
    console.log(`  skipped paragraphs/${name}  (exists — pass --force to overwrite)`);
    return;
  }

  writeFileSync(
    path,
    `${front}\n\n## traditional\n\n${body}\n\n## euspell\n\n${toEuspell(body)}\n`,
    'utf8',
  );
  console.log(`  wrote paragraphs/${name}  (${body.split(/\s+/).length} words)`);
});

console.log(
  `\n${blocks.length} block(s) processed. Fill in year/death/source, read both sides, ` +
  'then set `checked:` and run tools/check-paragraphs.py.',
);
