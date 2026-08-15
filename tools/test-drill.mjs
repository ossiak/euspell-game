// Tests the drill's scoring without a browser.
//
//   node --test tools/test-drill.mjs
//
// classify/redKind/tally are pure and carry the whole argument of the legend, so
// they are checked here rather than by clicking. drill.js is a classic script;
// it is run in a vm with no DOM, which is fine because mount() is never called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', 'web');

// `window` has to be the sandbox itself: paragraphs.js assigns to window, and
// drill.js prefers window over globalThis, so they must be the same object.
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(WEB, 'drill.js'), 'utf8'), sandbox);
vm.runInContext(readFileSync(join(WEB, 'paragraphs.js'), 'utf8'), sandbox);
const { classify, redKind, tally } = sandbox.EuspellDrill;
const DATA = sandbox.EUSPELL_PARAGRAPHS;

const word = (t, e, extra) => Object.assign({ t, e }, extra);

test('the five states', () => {
  // Never in play: uncoloured, which is ~80% of the text.
  assert.equal(classify(word('the', 'the'), 'the'), 'none');
  // Correctly unchanged: only ever a context-dependent word, since a
  // single-euspelling entry always changes.
  assert.equal(classify(word('records', 'records', { c: 1 }), 'records'), 'blue');
  assert.equal(classify(word('of', 'ov'), 'ov'), 'green');
  assert.equal(classify(word('of', 'ov'), 'of'), 'orange');
  assert.equal(classify(word('of', 'ov'), 'ove'), 'red');
});

test('red separates four errors that colour deliberately does not', () => {
  assert.equal(redKind(word('cat', 'cat'), 'catt'), 'out-of-scope');
  assert.equal(
    redKind(word('records', 'records', { c: 1, a: ['recordz'] }), 'recordz'),
    'wrong-reading',
  );
  assert.equal(redKind(word('of', 'ov'), 'ove'), 'invented');
});

test('doing nothing does not score 80%', () => {
  // The denominator is the words in play, not every token — scored across all
  // tokens, leaving the paragraph untouched would score ~80% and the number
  // would mean nothing.
  const para = DATA.paragraphs[0];
  const untouched = {};
  para.tokens.forEach((tok, i) => { if (typeof tok !== 'string') untouched[i] = tok.t; });
  const t = tally(para.tokens, untouched, false);
  assert.equal(t.green, 0);
  assert.ok(t.percent < 30, `doing nothing scored ${t.percent}%`);
  assert.ok(t.inPlay > 10, `only ${t.inPlay} words in play`);
});

test('the reference answer scores 100%', () => {
  const para = DATA.paragraphs[0];
  const perfect = {};
  para.tokens.forEach((tok, i) => { if (typeof tok !== 'string') perfect[i] = tok.e; });
  const t = tally(para.tokens, perfect, false);
  assert.equal(t.percent, 100);
  assert.equal(t.red, 0);
  assert.equal(t.orange, 0);
  assert.equal(t.green + t.blue, t.inPlay);
});

test('blue is counted, and it raises the denominator', () => {
  // Leaving `records` alone was a decision, so it counts for and against.
  const tokens = [
    word('of', 'ov'),                                  // must change
    word('records', 'records', { c: 1, a: ['recordz'] }), // context, stays
    'the ',
  ];
  const right = tally(tokens, { 0: 'ov', 1: 'records' }, false);
  assert.equal(right.inPlay, 2);
  assert.equal(right.blue, 1);
  assert.equal(right.percent, 100);

  const wrong = tally(tokens, { 0: 'ov', 1: 'recordz' }, false);
  assert.equal(wrong.inPlay, 2);
  assert.equal(wrong.percent, 50);
  assert.equal(wrong.wrongReading, 1);
});

test('every built paragraph is scoreable and in-play is non-trivial', () => {
  for (const para of DATA.paragraphs) {
    const perfect = {};
    para.tokens.forEach((tok, i) => { if (typeof tok !== 'string') perfect[i] = tok.e; });
    const t = tally(para.tokens, perfect, false);
    assert.equal(t.percent, 100, `${para.id} does not score 100 on its own reference`);
    assert.ok(t.inPlay >= 12, `${para.id} has only ${t.inPlay} words in play`);
  }
});
