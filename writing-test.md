# The conversion drill — a Euspell writing test

**14 August 2026.** A design note on the text-based game that tests whether a
player can *write* euspell, as distinct from
[game-concept.md](game-concept.md)'s *Beat the classifier*, which tests whether
they can reason about it. The two are complementary: this one drills the
orthography, that one argues the case.

The specification below is as proposed, with the numbers and the open problems
that came out of measuring it.

---

## The specification

100 paragraphs from recently-public-domain literature, stored as **original and
euspell, manually checked**. One is chosen at random and shown in traditional
spelling. The player converts it by editing.

**Buttons.** `Start`, `Hint`, `Convert`, `Revert`, `Score`.

| Button | Behaviour |
| --- | --- |
| `Start` | Loads a new paragraph in traditional spelling; releases `Hint` |
| `Hint` | **Two-state.** Pressed: underlines the words that need changing, without showing the changes. Released: clears them |
| `Convert` | Shows the converted paragraph **with the changed words underlined**, as `Hint` underlines them |
| `Revert` | Returns the text to traditional spelling; releases `Hint` |
| `Score` | Percent correct, colouring words by the legend |

All but `Hint` are stateless.

**Legend** — foreground colour on white, default black. Three channels, because
one is not enough (problem 6):

| State | Colour | Hex | Error mark |
| --- | --- | --- | --- |
| Never needs changing | none | `#000000` | — |
| Correctly unchanged | blue | `#1D4ED8` | — |
| Correctly changed | green | `#15803D` | — |
| Incorrectly unchanged | orange | `#B45309` | wavy underline |
| Incorrectly changed | red | `#B91C1C` | wavy underline |

**Plus: context-dependent words are bold, in every state.**

- **Colour** carries the full five-way state.
- **The wavy underline** carries the one binary that matters — right or wrong —
  in a channel that survives colour blindness and greyscale. It is the
  spell-checker convention, and it does not collide with the *solid* underline
  `Hint` and `Convert` use. (Clear the hint underlines when `Score` is showing,
  so the two never stack.)
- **Bold** marks the words that required a reading to be decided, so their
  failures are as visible as their successes (problem 4).

Every hex above clears WCAG AA on white; the obvious `#FFA500` and `#FF0000` do
not, at 1.97:1 and 4.00:1. `#1D4ED8` is used in preference to the brand
`#0000FF` so that a semantic is not tied to the accent colour.

Leaving the ~80% that was never in play uncoloured is the right instinct: colour
marks the exceptions, not the page.

The blue is doing more work than it looks. It can only arise on a word whose
lexicon entry carries **two or more euspellings, one of them the original** —
`records`, `use`, `read`, `does` — because a single-euspelling entry always
changes. So blue *is* the context-dependent class, in the half of cases where
the sentence called for the unchanged member. Every blue word is therefore also
bold; the converse does not hold. See
[problem 5](#5-blue-is-right-but-it-is-awarded-for-inattention).

---

## How big should a paragraph be?

**Size it in edits, not words.** Word count is a poor proxy — the measurements
below show two paragraphs of near-identical length differing by 1.8× in how much
work they ask for.

> **The rule: 12–20 changed words, which is roughly 70–100 words of prose.**
> Aim at 15 edits.

Fifteen edits is about **2–3 minutes**: 25 seconds reading, then 15 edits at
6–8 seconds each to find, decide and retype.

**Why not fewer.** At 8 edits each one is worth 12.5% of the score. The result
moves in coarse steps, and a single careless slip reads as incompetence.

**Why not more.** Past 25 edits it is four to five minutes of retyping, and the
tail is tedium rather than measurement. The player has already shown what they
know by edit fifteen.

## What the measurements say

Run [tools/measure-edit-rate.py](tools/measure-edit-rate.py) to reproduce any of
this.

### One word in five, not one in fifty

Against the lexicon over a 588-billion-token frequency corpus:

| | |
| --- | --- |
| Always changes | **16.3%** of tokens |
| May change, depending on context | up to **21.0%** |
| Not in the lexicon at all | 6.5% — names, numerals, OOV |

The familiar "four fifths of the dictionary is untouched" is a claim about
dictionary **types**. A player faces **tokens**, and the common words change
heavily — `of→ov`, `to→tu`, `is→iz`, `you→yu`. Both figures are true; only the
second one sizes a paragraph.

### Literary prose runs hotter than the corpus

Four public-domain paragraphs, measured:

| Paragraph | Words | Edits | Rate | Top-100 | Context |
| --- | --- | --- | --- | --- | --- |
| Austen, *Pride and Prejudice* | 70 | 20 | 28.6% | 13 | 2 |
| Dickens, *A Tale of Two Cities* | 60 | 11 | 18.3% | **11 of 11** | 2 |
| Conan Doyle, *The Hound of the Baskervilles* | 50 | 8 | 16.0% | 4 | 1 |
| Plain narrative prose | 43 | 7 | 16.3% | 3 | 1 |

Two things follow. **The web corpus understates the literary rate** — expect
18–22% rather than 16.3%, which is why the word-count guide lands at 70–100
rather than 80–110. And **the variance between paragraphs is larger than the
variance between corpora**, which is the whole argument for sizing by edits.

### Half of every player's work is twenty words

| | |
| --- | --- |
| Top 3 word types | 31.3% of all edits |
| Top 20 | **50.7%** |
| Top 100 | 68.9% |
| Top 1,000 | 93.0% |

**This is the finding that most affects the design.** In a 90-word paragraph,
roughly 7 of 16 edits are the same handful of function words. Two players can
score identically while one has memorised four words and the other reads the
reform fluently — and distinguishing them is the entire point of a skills test.

The Dickens paragraph above is the pathological case: **every one of its 11
edits is a top-100 word.** A player who knows only `of`, `to` and `is` scores
100% on it.

There is a consolation in the same numbers, and it belongs on the website rather
than in the game: **1,000 word types cover 93% of all edits.** The reform is
small to write, not merely small to read.

---

## Open problems

### 1. Statelessness makes the score unmeasurable

`Convert` shows the answer *and*, with the clarified behaviour, underlines which
words it changed — so it is a complete answer key, both halves. `Hint` gives
away the harder half. Because nothing is recorded, `Score` cannot tell an
unaided run from one where both were pressed, and a percentage that cannot
distinguish those is not a score.

**Fix, without giving up the stateless buttons:** let the *round* hold two
booleans, and have `Score` annotate itself — `82% (hints used)`. Better still,
rename `Convert` to **Show answer** and let it end the round.

### 2. The score needs two numbers, twice over

**What is the percentage of?** Scored across all tokens, doing nothing scores
82%. It has to be over the words that were in play — and the five-colour legend
answers that for free, which is its unadvertised benefit. The categories
partition every token into in play and not:

```text
    score = (blue + green) / (blue + green + orange + red)
```

The `none` words drop out automatically rather than by a special rule. In an
85-word paragraph the denominator is **15–20**, each item worth 5–7% — good
granularity, and it lands on the 12–20 edit band without being contrived. Blue
correctly *raises* the denominator: leaving `records` alone was a decision, so it
should count both for and against.

One number still will not do it, though:

- **Recall** — found 12 of the 15 changes. Alone, it rewards changing everything.
- **Precision** — 2 of your 14 changes were wrong. Alone, it rewards changing nothing.

**And split by difficulty**, per the concentration finding: edits on the top-100
words (the reflexes) reported separately from everything else (the reform
proper). *"You have the common words; you are losing the `-ough` family"* is
worth more to a player than *"78%"*.

**Then a line for the context-dependent words** — *"context words: 2 of 4"* —
for the reason set out in problem 5: those are the only ones that test reading
rather than recall. Four short lines beat one percentage:

```text
    changes found      12 of 15
    of your 14 changes  2 wrong   (1 was the right word, wrong reading)
    common / reform      7 / 5
    context words        3 of 4    (2 of them after hints)
```

### 3. Free-text editing breaks the alignment

If a player inserts or deletes a word, token-by-token comparison against the
reference collapses and the colours scatter.

**Make each word its own editable field.** It reveals nothing — word boundaries
are already visible — it preserves the "convert by editing" feel, and it turns
scoring from a diff heuristic into an exact comparison.

### 4. Red still carries four errors, and the legend is now asymmetric

Blue fixed the correct side. The error side is unchanged, so the scheme now
names a success it does not name the failure of:

| Player did | Truth | Shows | What it means |
| --- | --- | --- | --- |
| Changed `cat` → `catt` | out of scope | red | Thinks the reform is bigger than it is |
| Wrote `recordz`, noun meant | in scope, unchanged | red | **Misread the sentence** — the exact mirror of blue |
| Wrote `bowz` where `buwz` was right | in scope, changed | red | Misread the sentence |
| Wrote `rekordz` | in scope, changed | red | Knows it changes, does not know the form |

Row 1 and row 2 call for opposite responses — *four fifths is untouched, leave
more alone* against *here is the sentence cue you missed* — and the second player
is far closer to competent than the first.

**Resolved without a sixth colour**, by the second channel now in the legend:
**context-dependent words are bold in all four states.** Blue+bold, green+bold,
orange+bold and red+bold all read as *this one was a judgement call*, so a
player can see at a glance which of their reds were misreadings rather than
overreach. Bold does not collide with the underline `Hint` and `Convert` use,
and it is the one cue that survives greyscale (problem 6).

This makes blue partly redundant — bold + unchanged + correct says the same
thing twice — which is deliberate. The redundancy is what keeps the display
legible when either channel is unavailable.

**It is not a rare case.** 5,911 lexicon entries carry two or more euspellings —
2.9% of types, but **5.3% of running tokens**, since they skew common (`use`,
`services`, `read`, `does`, `books`). Expect **~4.5 per 85-word paragraph**.

#### The explanation, on hover

Nothing in the visual scheme distinguishes rows 3 and 4 of the table above, and
it should not try. **The colour grades; the explanation teaches.** Without it
the drill is a marking scheme, and the four reds all mean the same thing to the
player who earned them.

It is also the fix for blue's weakness. Someone who left `records` alone by
never noticing it gets blue and learns nothing; the explanation says *noun here,
so unchanged — the verb would be `recordz`*, and the accidental success becomes
a lesson. That is the highest-value moment in the exercise: the player is looking
at a word they personally decided about, seconds after deciding it.

| State | What it reveals |
| --- | --- |
| Never in play | **Nothing.** Do not make 80% of the page interactive — it is noise, and it invites hunting |
| Blue | Why it stayed: *"noun here; the verb is `recordz`"* |
| Green | Light confirmation, and the rule followed |
| Orange | The expected form and its rule: *"expected `ov`"* |
| Red | Which of the four errors it was |

The four reds want four different sentences:

- *`cat` never changes* — with the reassurance that four fifths is untouched
- *expected `records` (noun); you wrote `recordz` (verb)* — the misreading
- *expected `buwz`; you wrote `bowz`* — wrong member of the set
- *`rekordz` is not a euspelling of `records`* — an invented form

**Do not write the explanations twice.** The lexicon supplies the expected form
and `euspell_encoding.csv` supplies each code's meaning — and there is a
precedent to follow exactly. The extension's popup renders an encoding chip
whose tooltip is, per its own comment, *"euspell_encoding.csv's own wording,
shown verbatim — the table is the source of record for what a code means."* Two
products explaining the same reform in two phrasings is how a standard starts to
blur.

Interaction and rendering are in [Implementing it](#the-explanation-panel).

### 5. Blue is right, but it is awarded for inattention

**88% of context-dependent words have the original spelling among their valid
options** — the diatone shape, `records|recordz`, `use|uze`, `read|redd`. That
is roughly **4 words per paragraph where "leave it alone" is a legitimate
answer**, and they are the words blue lights up.

A player who never noticed `records` earns the same blue as one who parsed the
clause. Blue is still the correct verdict — the output is right, and in real
writing that is what matters — but it is weak evidence of skill.

**`Hint` makes it weaker.** The hint underlines *the words that need to be
changed*. A diatone in its noun reading does not need changing — **so it goes
unmarked, and the hint quietly tells the player to leave it alone.** The hardest
judgement in the reform is handed over for free. Left as specified, the design
makes the most interesting words the easiest to get right.

Three changes, in order of what they buy:

1. **Report context words as their own line, annotated with hint use** —
   *"context words: 3 of 4 (2 of them after hints)"*. The round already has to
   record hint state (problem 1), so this is nearly free, and it keeps blue
   honest without demoting it.
2. **Mark the class in every state**, per problem 4, so the failures are as
   visible as the successes.
3. **Consider a second hint level** that underlines *words in the reform's
   scope* rather than *words that change*. That preserves the judgement instead
   of defusing it, and turns `Hint` from a partial answer key into a genuine aid.

**Worth measuring before building:** how often the unchanged reading is actually
the correct one for these pairs — that is, how much blue there will be. Plural
nouns outnumber third-person verbs in most prose, so passive-correct is probably
the common case, but that is an expectation rather than a number, and the SVM's
training corpora in `euspell_ext` can settle it.

### 6. Hue alone cannot carry it — resolved in the legend

**The defect.** Green, orange and red is the worst possible triple: red-green
colour blindness affects roughly 8% of men, and those three collapse toward each
other. Blue and orange survive it; green and red do not. For a project whose
entire pitch is readability, a colour-only scoring display is a bad look — and
it is WCAG 1.4.1, a criterion rather than a preference.

Contrast against white makes the second half concrete. **The obvious orange and
red both fail AA**, orange badly:

| Naive | Ratio | Adopted | Ratio |
| --- | --- | --- | --- |
| `#0000FF` blue | 8.59:1 ✓ | `#1D4ED8` | 6.70:1 ✓ |
| `#008000` green | 5.14:1 ✓ | `#15803D` | 5.02:1 ✓ |
| `#FFA500` orange | **1.97:1 ✗** | `#B45309` | 5.02:1 ✓ |
| `#FF0000` red | **4.00:1 ✗** | `#B91C1C` | 6.47:1 ✓ |

**The fix, now in the legend.** The darkened set, plus two non-colour channels:
a **wavy underline** on the two error states, and **bold** on
context-dependent words.

Why a wavy underline rather than a glyph per word: at 15–20 coloured words a
paragraph, a leading `✓`/`✗` on each is visual noise, and the wavy underline is
already the universal convention for *this is wrong*. It carries the binary that
actually matters. The finer five-way distinction stays in the colour, where
losing it costs a colour-blind player nuance rather than the verdict.

Print the legend itself in the same three channels, so it teaches the encoding
rather than just naming it.

**Why this matters past the game.** The 94%-accurate classifier is the
project's central technical claim. A drill that scores a wrong reading
identically to an invented word cannot demonstrate that claim — it cannot even
see it.

### 7. Use the engine's own tokenizer

Sentence-initial capitals (`Of → Ov`), the specially-cased `I → ih/Ih`, and
apostrophes: **`it's → it'z` is one token**. A bare `[a-z]+` tore exactly those
in half in the channel's lexicon tool and had to be fixed. Import the
tokenizer; do not re-derive it.

### 8. Proper nouns are a trap, and 1930 prose is full of them

6.5% of tokens are not in the lexicon. A player who "corrects" a character's
name should go red; the reference must leave it alone.

### 9. `Start` is not quite stateless

Random selection with no memory will serve the same paragraph twice running. It
needs to remember the last one shown.

---

## Choosing the 100 paragraphs

Accept a paragraph only if:

| Criterion | Reason |
| --- | --- |
| **12–20 edits** | The governing rule; everything else is secondary |
| 70–100 words | Follows from the rule at literary rates, not a rule itself |
| **≥ 5 edits outside the top-100 list** | Kills the Dickens case, where every edit is a reflex |
| **≥ 2 context-dependent words** | The only ones that test reading rather than recall |
| ≥ 8 distinct changed word types | Repetition of one word is not breadth |
| ≤ 10% proper nouns | They are dead weight — neither edits nor distractors |
| Records the reform revision (`r1`) | See below |

The context-dependent floor is the one criterion that needs checking rather than
assuming. Running the four sample paragraphs through the tool gives 2, 2, 1 and
1 — so **half of ordinary literary prose fails it**, and a paragraph set chosen
purely on length would test recall almost exclusively. Prefer paragraphs where
at least one of those words takes its *changed* reading, since the unchanged
reading can be answered by inattention.

**Store the reform revision with each paragraph.** A cached game starts teaching
yesterday's answers, exactly as `dist/lexicon.js` did until it was rebuilt. The
freeze makes this low-risk today; r2 will not.

**Sourcing.** As of 2026 the US public domain covers works published **1930 or
earlier** (95-year term), so "recently public domain" is the 1930 cohort —
modern-feeling prose, and a good angle in itself. Take texts from Project
Gutenberg and record title, author and year per paragraph so attribution is
possible. Public-domain status is jurisdictional: either stay well back from the
line or state that the claim is US-PD.

---

## Implementing it

### The decision that makes everything else easy

**Nothing needs the engine or the lexicon at runtime.** The paragraphs are
stored as original *and* euspell, hand-checked, so scoring is a comparison
against stored text rather than a conversion. The payload is 100 paragraph pairs
plus a per-token flag — tens of KB gzipped, against **13 MB for
`dist/lexicon.data`**. That one fact removes most of the architecture.

(*Beat the classifier* is not the same: showing what the SVM chose does want the
engine. Worth knowing the two games have different weights before sharing code
between them.)

**One static page, no framework, no server, no network.** Concretely a plain ES
module exporting `mount(element, data)`, a stylesheet, and build-generated JSON.
That form does three jobs at once:

- **Opens standalone** — works offline, trivially screenshotable for the store
  assets ([store-screenshots.md](store-screenshots.md)).
- **Embeds in the site** through a short client component that renders a div and
  calls `mount()` in an effect — the pattern `RespellCycler.tsx` already uses on
  Next 16 / React 19. Fonts, theme and nav come free.
- **Survives the static export.** `euspell_website` builds with
  `output: "export"` onto hosting with no Node runtime, so anything server-side
  is unavailable — and this design never wants it.

The "no framework" line in [game-concept.md](game-concept.md) meant no Unity, no
game engine. It was never an argument against the site's existing stack.

**Source it in `euspell_game`, embedded by the site** — not the reverse, which
makes it awkward to open standalone and couples a demo to a deploy.

### Desktop

**Each word is its own inline editable span — and it must still read as a
paragraph, not as 85 input boxes.** Borderless spans in normal text flow, focus
ring only on the word being edited. That buys problem 3's exact scoring without
turning prose into a form.

- **Punctuation lives outside the span.** `records,` is span(`records`) plus
  text(`,`). Words are editable; the sentence cannot be broken.
- **Suppress Enter and rich paste.**
- **Tab moves word to word** — every word, not only the ones that change, which
  would leak the answer.

### Mobile

**Autocorrect is an adversary, not an annoyance.** Every euspelling is a
non-word to the phone's dictionary, so the keyboard undoes the player's work:
`ov`→`of`, `tu`→`to`, `iz`→`is`. A player who types correctly is marked wrong.
Set `autocorrect="off" autocapitalize="off" autocomplete="off"
spellcheck="false"` — then **test on real hardware**, because those attributes
are honoured unevenly and predictive text is a separate mechanism.

Two smaller traps: input text below **16px triggers iOS auto-zoom** on focus,
and the on-screen keyboard covers the lower viewport, so the button bar cannot
sit at the bottom.

**The real problem is that 15 edits is a lot of phone typing**, in unfamiliar
strings, on a keyboard that fights back. Expect abandonment.

**So give mobile a second mode: tap a word, choose from three or four
candidates.** Same data, no typing. State plainly that it tests **recognition,
not production** — the scores are not comparable to the typed mode and must not
share a number. That is a feature: recognition is the right first rung, and it
is the mode that will actually get played on a phone.

### The explanation panel

The content is specified in [problem 4](#the-explanation-on-hover). Four
mechanics decide whether it works:

**It cannot be hover-only.** Touch has no hover. After `Score` the word fields
are read-only, so tap is free to mean *explain this word* — build **click/tap as
the mechanism and hover as a desktop fast path**, never the reverse. The spans
are already focusable, so Tab must reveal the same content: WCAG 1.4.13 also
requires it be dismissible, hoverable in itself, and persistent, so a tooltip
that vanishes as the pointer moves toward it fails.

**One panel under the paragraph, not a floating tooltip.** It updates as the
player moves between words. Identical on both platforms, never clips at the
viewport edge, no positioning code, room for a full sentence, and a natural
`aria-live` region. A tooltip is more immediate on desktop and costs all of
that.

**Never use the `title` attribute.** It is the tempting shortcut and it fails
three ways at once: about a second of delay, unstyleable, invisible on touch,
and inconsistently announced by screen readers.

**Inert until `Score`.** `Hint` and `Convert` are already generous (problem 1);
an explanation that worked while editing would be a third leak and the most
complete one, handing over the expected form for any word the player pointed at.

### Distractors for the tap-to-choose mode

The tempting reading is "a second lexicon of wrong spellings". It is nothing
like that, because distractors are only needed for the types that appear in the
chosen paragraphs:

| | |
| --- | --- |
| Changed types in the lexicon | 13,229 |
| **Expected to appear across 100 paragraphs** | **~441** |
| Context-dependent types expected | ~281 |

Roughly 700 items with overlap, against a 205,493-entry lexicon — and frozen
alongside the paragraphs. **19 types cover half of all edit instances**, so the
head of the distribution is where the effort pays and it is tiny.

**Much of it is free.** The traditional spelling is a distractor for every
changed word, and the most meaningful one — "no change" is the error a beginner
actually makes. The sibling euspelling covers the context-dependent words
outright (`records`/`recordz`, `bows`/`buws`/`bowz`/`buwz`), which are also the
*best* items in the set, since choosing between them is the real skill.

**Generate, then review — do not author.** Hand-writing 900 wrong spellings is
drudgery and gives inconsistent difficulty. Invert the reform's own graphemes
and let a script propose: `z↔s`, `qh↔ch`, `uw↔ow/ou`, `y↔igh/i`, doubling.
These reproduce the misconceptions a learner genuinely has, which is what makes
a distractor teach rather than merely distract. Then review the output for those
~441 words.

**One automated check is mandatory:** reject any candidate that appears anywhere
in that entry's own spelling list. Otherwise `recordz` is eventually offered as
a wrong answer in a sentence where `recordz` is right, and a correct player is
marked wrong. A candidate that is a valid euspelling of some *other* word is
fine — desirable, even.

**The trap that matters more than distractor quality.** If the traditional
spelling is always on offer and always wrong, players learn *never pick the
unchanged one*, and the exercise collapses into reading the option list rather
than knowing the word. The fix is already in the data: **mix in items whose
correct answer is the unchanged form**, which the context-dependent words supply
(88% of them carry the original among their options). It is the multiple-choice
analogue of blue. Vary the option count too, or players learn positional tells.

**The cheap prototype**, if this proves too much up front: draw the wrong options
from the euspellings of other changed words in the same paragraph. Zero
authoring, always real euspell, self-scaling — but often obviously wrong on
length and shape, so items get easy. A sensible middle is one rule-generated,
one sibling-or-traditional, one from the paragraph. Start there and build the
reviewed set only if the mode gets played.

**Treat it as project data, not a table inside the game.** It is tied to `r1`
and needs the same revision stamp as the paragraphs — a spelling is only wrong
relative to a lexicon. And it has a second use to design for now: the same list
is what the desktop mode's hover explanation wants, and it could seed a "common
errors" page on the site.

### The build step earns its keep twice

A script turning the 100 pairs into token JSON has to tokenize and consult the
lexicon anyway, so have it **diff each stored euspell paragraph against what the
engine produces**. A hundred hand-checked conversions will contain mistakes;
this catches them before a player does, using the engine's own tokenizer rather
than a re-derived one (problem 7). The output is committed data, so the game
keeps no runtime dependency on `euspell_ext`.

### Consequences to catch now

**The privacy policy needs a line.** It currently states the site stores exactly
one `localStorage` value, `euspell-theme`. The drill wants a last-paragraph-shown
memory (problem 9) and probably progress. Still nothing leaving the device, but
the page has to say so.

**What not to build:** a native app, a PWA with a service worker, server-side
scoring, or any upload of results. The first two are premature; the last two
contradict both the privacy page and the reason this design is cheap.

---

## Before building

**Measure the real 100.** The corpus figures come from web text — `search`,
`business` and `health` sit high in its edit list, which no novel does. Once the
paragraphs are chosen, run them through the tool and re-fit the acceptance band
to what they actually contain.
