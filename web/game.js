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
   * uncolored so color marks the exceptions rather than the page.
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

  /** Why a red is red — the four errors color deliberately does not separate.
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

    // Size an editable input to its text, so the paragraph reads as prose rather
    // than a row of boxes. Measured with a hidden mirror that inherits the
    // passage's own font — pixel-accurate, where a canvas estimate under-sized
    // the input, and an input whose text OVERFLOWS only lets iOS place the caret
    // at the two scroll ends, never mid-word. ctx words render bold, so the
    // mirror is set bold to match. The mirror has no 'w' class, so it never
    // shows up in the '.w' queries used for reading and scoring.
    var mirror = document.createElement('span');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';
    function sizeInput(el, bold) {
      mirror.style.fontWeight = bold ? '700' : '400';
      mirror.textContent = el.value || '';
      el.style.width = (mirror.offsetWidth + 3) + 'px';
    }

    function current() { return paragraphs[state.index]; }

    /** Draw the paragraph. `field` true = editable words, false = plain text. */
    function draw(getText, field) {
      var para = current();
      passage.innerHTML = '';
      passage.appendChild(mirror); // hidden; sizeInput measures text against it
      para.tokens.forEach(function (tok, i) {
        if (typeof tok === 'string') {
          passage.appendChild(document.createTextNode(tok));
          return;
        }
        var el;
        if (field) {
          // A real <input>, not a contenteditable span. iOS Safari cannot place
          // the caret inside a short inline editable — it pins the caret to the
          // end and refuses mid-word edits — whereas inputs have first-class
          // caret handling. Autocorrect off, or the platform turns euspell back
          // into English. Scoring re-renders these as spans (see score) so the
          // wavy verdict underline can paint, which an <input>'s value cannot.
          el = document.createElement('input');
          el.type = 'text';
          el.value = getText(tok);
          el.spellcheck = false;
          el.setAttribute('autocorrect', 'off');
          el.setAttribute('autocapitalize', 'off');
          el.setAttribute('autocomplete', 'off');
        } else {
          el = document.createElement('span');
          el.textContent = getText(tok);
        }
        el.className = 'w';
        el.dataset.i = String(i);
        if (tok.c) el.classList.add('ctx');
        passage.appendChild(el);
        if (field) sizeInput(el, !!tok.c);
      });
    }

    function answers() {
      var out = {};
      passage.querySelectorAll('.w').forEach(function (el) {
        var v = el.tagName === 'INPUT' ? el.value : el.textContent;
        out[Number(el.dataset.i)] = v.trim();
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
      // Replace each editable input with a static span of what was typed, so
      // color and the wavy right/wrong underline render (an <input> paints
      // neither on its value), and the answer is frozen.
      Array.prototype.slice.call(passage.querySelectorAll('.w')).forEach(function (el) {
        var i = Number(el.dataset.i);
        var verdict = classify(para.tokens[i], given[i]);
        var span = document.createElement('span');
        span.className = 'w';
        span.dataset.i = String(i);
        span.textContent = given[i];
        if (para.tokens[i].c) span.classList.add('ctx');
        if (verdict !== 'none') span.classList.add(verdict);
        el.parentNode.replaceChild(span, el);
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
      panel.textContent = 'Click any colored word for an explanation.';
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

    // Grow or shrink an input to fit as the player edits it.
    passage.addEventListener('input', function (e) {
      if (e.target.tagName === 'INPUT' && e.target.classList.contains('w')) {
        sizeInput(e.target, e.target.classList.contains('ctx'));
      }
    });

    // Tap a word to select all of it, so the player can type the replacement.
    // iOS won't let the page select on focus — it collapses the selection when
    // it places its own tap-caret afterwards — so intercept the tap itself:
    // preventDefault on touchend stops that caret placement, then we focus and
    // select the whole value. EVERY quick, stationary tap re-selects, so tapping
    // is consistent and never lands in iOS's snap-to-end; a long-press/drag is
    // left alone, so the magnifier still positions a precise caret for fine edits.
    var tapAt = 0, tapMoved = false, tapX = 0, tapY = 0;
    passage.addEventListener('touchstart', function (e) {
      var el = e.target;
      if (el.tagName !== 'INPUT' || !el.classList.contains('w')) return;
      tapAt = Date.now(); tapMoved = false;
      var t = e.touches[0]; if (t) { tapX = t.clientX; tapY = t.clientY; }
    }, { passive: true });
    passage.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (t && (Math.abs(t.clientX - tapX) > 8 || Math.abs(t.clientY - tapY) > 8)) tapMoved = true;
    }, { passive: true });
    passage.addEventListener('touchend', function (e) {
      var el = e.target;
      if (el.tagName !== 'INPUT' || !el.classList.contains('w')) return;
      var quickTap = !tapMoved && (Date.now() - tapAt) < 350;
      if (quickTap) {
        e.preventDefault(); // stop iOS placing a caret, which would collapse the selection
        el.focus();
        var selectAll = function () { try { el.setSelectionRange(0, el.value.length); } catch (x) {} };
        selectAll();
        // iOS re-places its own tap-caret a tick later and collapses the
        // selection, so re-apply it across a couple of frames to win the race.
        setTimeout(selectAll, 0);
        setTimeout(selectAll, 40);
      }
    }, { passive: false });

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
