/* The conversion game. Design and reasoning: ../writing-test.md
 *
 * A classic script, not an ES module, so index.html opens from file:// —
 * Chrome blocks module imports and fetch() there, and opening the file directly
 * is how this gets demoed and screenshotted. It exposes one global; the site
 * embed calls EuspellGame.mount(element, window.EUSPELL_PARAGRAPHS).
 *
 * No lexicon at runtime. Scoring compares against the stored reference, so the
 * whole payload is web/paragraphs.js.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------- scoring */

  /**
   * One word's verdict. Pure, and exported for testing — this is the part with
   * real logic, and a browser is a poor place to check it.
   *
   * `none` is everything that was never in play: roughly 80% of the text, left
   * uncoloured so colour marks the exceptions rather than the page.
   * `blue` can only arise on a context-dependent word, since a single-euspelling
   * entry always changes — so blue IS that class, in the half of cases where
   * the sentence wanted the traditional form.
   */
  function classify(token, typed) {
    var expected = token.e;
    var traditional = token.t;
    var answer = (typed === undefined || typed === null) ? '' : typed;
    if (answer === expected) {
      if (expected !== traditional) return 'green';
      return token.c ? 'blue' : 'none';
    }
    if (answer === traditional) return 'orange'; // should have changed, did not
    return 'red';
  }

  /** Why a red is red — the four errors colour deliberately does not separate.
   *
   * Order matters. The wrong-reading test has to come first: when a diatone's
   * expected form is the TRADITIONAL one, e === t, and checking that first
   * would report "this word never changes" about a word that plainly does —
   * the exact mirror of blue, mislabelled. Out-of-scope therefore means no
   * euspelling at all, which is e === t on a word that is not context-dependent.
   */
  function redKind(token, typed) {
    if (token.a && token.a.indexOf(typed) !== -1) return 'wrong-reading';
    if (token.e === token.t && !token.c) return 'out-of-scope';
    return 'invented';
  }

  function tally(tokens, answers, usedHint) {
    var t = {
      blue: 0, green: 0, orange: 0, red: 0, none: 0,
      needed: 0, changedByPlayer: 0, wrongReading: 0,
      commonRight: 0, reformRight: 0, context: 0, contextRight: 0,
      usedHint: !!usedHint,
    };
    tokens.forEach(function (tok, i) {
      if (typeof tok === 'string') return;
      var typed = answers[i];
      var verdict = classify(tok, typed);
      t[verdict] += 1;
      if (tok.e !== tok.t) t.needed += 1;
      if (typed !== tok.t) t.changedByPlayer += 1;
      if (verdict === 'red' && redKind(tok, typed) === 'wrong-reading') t.wrongReading += 1;
      if (verdict === 'green') { if (tok.k) t.commonRight += 1; else t.reformRight += 1; }
      if (tok.c) { t.context += 1; if (verdict === 'blue' || verdict === 'green') t.contextRight += 1; }
    });
    // The legend IS the scoring model: none drops out, and blue correctly
    // raises the denominator — leaving `records` alone was a decision.
    var inPlay = t.blue + t.green + t.orange + t.red;
    t.inPlay = inPlay;
    t.percent = inPlay ? Math.round((100 * (t.blue + t.green)) / inPlay) : 100;
    return t;
  }

  /* ------------------------------------------------------------ rendering */

  function mount(root, data) {
    var paragraphs = (data && data.paragraphs) || [];
    if (!paragraphs.length) { root.textContent = 'No paragraphs loaded.'; return; }

    var state = { index: -1, hint: false, usedHint: false, usedConvert: false, scored: false };

    root.innerHTML =
      '<div class="game">' +
      '  <p class="passage" id="passage"></p>' +
      '  <div class="bar">' +
      '    <button type="button" data-act="start">Start</button>' +
      '    <button type="button" data-act="hint" class="toggle">Hint</button>' +
      '    <button type="button" data-act="convert">Convert</button>' +
      '    <button type="button" data-act="revert">Revert</button>' +
      '    <button type="button" data-act="score">Score</button>' +
      '  </div>' +
      '  <pre class="readout" id="readout" aria-live="polite"></pre>' +
      '  <div class="panel" id="panel" aria-live="polite"></div>' +
      '  <p class="attrib" id="attrib"></p>' +
      '</div>';

    var passage = root.querySelector('#passage');
    var readout = root.querySelector('#readout');
    var panel = root.querySelector('#panel');
    var attrib = root.querySelector('#attrib');
    var hintBtn = root.querySelector('[data-act="hint"]');

    function current() { return paragraphs[state.index]; }

    /** Draw the paragraph. `field` true = editable words, false = plain text. */
    function draw(getText, field) {
      var para = current();
      passage.innerHTML = '';
      para.tokens.forEach(function (tok, i) {
        if (typeof tok === 'string') {
          passage.appendChild(document.createTextNode(tok));
          return;
        }
        var span = document.createElement('span');
        span.className = 'w';
        span.dataset.i = String(i);
        span.textContent = getText(tok);
        if (field) {
          span.contentEditable = 'plaintext-only';
          span.spellcheck = false;
          // Autocorrect turns euspell back into English on some platforms.
          span.setAttribute('autocorrect', 'off');
          span.setAttribute('autocapitalize', 'off');
        }
        if (tok.c) span.classList.add('ctx');
        passage.appendChild(span);
      });
    }

    function answers() {
      var out = {};
      passage.querySelectorAll('.w').forEach(function (el) {
        out[Number(el.dataset.i)] = el.textContent.trim();
      });
      return out;
    }

    function clearMarks() {
      passage.querySelectorAll('.w').forEach(function (el) {
        el.classList.remove('blue', 'green', 'orange', 'red', 'hint');
      });
      readout.textContent = '';
      panel.textContent = '';
      state.scored = false;
    }

    function applyHint() {
      var para = current();
      passage.querySelectorAll('.w').forEach(function (el) {
        var tok = para.tokens[Number(el.dataset.i)];
        // Underlines the words that NEED changing — which is why a diatone in
        // its unchanged reading goes unmarked, and the hint quietly tells the
        // player to leave the hardest word alone. See problem 5 in the note.
        el.classList.toggle('hint', state.hint && tok.e !== tok.t);
      });
      hintBtn.classList.toggle('on', state.hint);
    }

    function start() {
      var next = state.index;
      if (paragraphs.length > 1) {
        while (next === state.index) next = Math.floor(Math.random() * paragraphs.length);
      } else next = 0;
      state.index = next;
      state.hint = false;
      state.usedHint = false;
      state.usedConvert = false;
      draw(function (tok) { return tok.t; }, true);
      clearMarks();
      applyHint();
      var p = current();
      attrib.textContent = [p.title, p.author, p.year].filter(Boolean).join(' — ');
    }

    function score() {
      var para = current();
      var given = answers();
      passage.querySelectorAll('.w').forEach(function (el) {
        var i = Number(el.dataset.i);
        var verdict = classify(para.tokens[i], given[i]);
        el.classList.remove('blue', 'green', 'orange', 'red');
        if (verdict !== 'none') el.classList.add(verdict);
        el.contentEditable = 'false';
      });
      state.scored = true;

      var t = tally(para.tokens, given, state.usedHint);
      var lines = [
        pad('changes found', (t.green) + ' of ' + t.needed),
        pad('of your ' + t.changedByPlayer + ' changes',
          t.red + ' wrong' + (t.wrongReading ? '   (' + t.wrongReading + ' right word, wrong reading)' : '')),
        pad('common / reform', t.commonRight + ' / ' + t.reformRight),
        pad('context words', t.contextRight + ' of ' + t.context + (t.usedHint ? '   (after hints)' : '')),
        '',
        pad('score', t.percent + '%' + (t.usedHint || state.usedConvert ? '   (assisted)' : '')),
      ];
      readout.textContent = lines.join('\n');
      panel.textContent = 'Click any coloured word for an explanation.';
    }

    function pad(label, value) {
      var l = label + '                        '.slice(0, Math.max(1, 24 - label.length));
      return l + value;
    }

    function explain(tok, typed) {
      var verdict = classify(tok, typed);
      if (verdict === 'none') return '';
      if (verdict === 'green') return '“' + tok.t + '” becomes “' + tok.e + '”. Correct.';
      if (verdict === 'blue') {
        return '“' + tok.t + '” is right here — this word has more than one euspelling and ' +
          'the sentence wanted the traditional form' +
          (tok.a ? '. The other reading is “' + tok.a.join('”, “') + '”.' : '.');
      }
      if (verdict === 'orange') return 'Missed: “' + tok.t + '” becomes “' + tok.e + '”.';
      var kind = redKind(tok, typed);
      if (kind === 'out-of-scope') return '“' + tok.t + '” does not change in euspell.';
      if (kind === 'wrong-reading') {
        return 'Right word, wrong reading. Expected “' + tok.e + '”; “' + typed +
          '” is the other reading of “' + tok.t + '”.';
      }
      return 'Expected “' + tok.e + '”. “' + typed + '” is not a euspelling of “' + tok.t + '”.';
    }

    passage.addEventListener('click', function (e) {
      if (!state.scored) return;
      var el = e.target.closest ? e.target.closest('.w') : null;
      if (!el) return;
      var tok = current().tokens[Number(el.dataset.i)];
      panel.textContent = explain(tok, el.textContent.trim());
    });

    // Enter would split a word into two nodes and break the alignment scoring
    // depends on; the paragraph is fixed text with editable words in it.
    passage.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') e.preventDefault();
    });

    root.querySelector('.bar').addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.act;
      if (!act) return;
      if (act === 'start') return start();
      if (act === 'hint') {
        state.hint = !state.hint;
        if (state.hint) state.usedHint = true;
        return applyHint();
      }
      if (act === 'convert') {
        state.usedConvert = true;
        draw(function (tok) { return tok.e; }, false);
        clearMarks();
        passage.querySelectorAll('.w').forEach(function (el) {
          var tok = current().tokens[Number(el.dataset.i)];
          if (tok.e !== tok.t) el.classList.add('hint');
        });
        panel.textContent = 'The converted paragraph, with the changed words underlined.';
        return undefined;
      }
      if (act === 'revert') {
        state.hint = false;
        draw(function (tok) { return tok.t; }, true);
        clearMarks();
        applyHint();
        return undefined;
      }
      if (act === 'score') return score();
      return undefined;
    });

    start();
  }

  global.EuspellGame = { mount: mount, classify: classify, redKind: redKind, tally: tally };
}(typeof window !== 'undefined' ? window : globalThis));
