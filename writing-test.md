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

**Legend** — foreground colour on white, default black:

| State | Colour |
| --- | --- |
| Correctly unchanged | none |
| Correctly changed | green |
| Incorrectly unchanged | orange |
| Incorrectly changed | red |

Leaving the 80% of correct-and-unchanged words uncoloured is the right
instinct: colour should mark the exceptions, not the page.

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
82%. It has to be over the changed set, and one number will not do it:

- **Recall** — found 12 of the 15 changes. Alone, it rewards changing everything.
- **Precision** — 2 of your 14 changes were wrong. Alone, it rewards changing nothing.

**And split by difficulty**, per the concentration finding: edits on the top-100
words (the reflexes) reported separately from everything else (the reform
proper). *"You have the common words; you are losing the `-ough` family"* is
worth more to a player than *"78%"*.

**Then a third line for the context-dependent words** — *"context words: 2 of
4"* — for the reason set out in problem 5: those are the only ones that test
reading rather than recall, and without their own line they disappear into the
uncoloured majority. Three short lines beat one percentage:

```text
    changes found      12 of 15
    of your 14 changes  2 wrong   (1 was the right word, wrong reading)
    common / reform      7 / 5
    context words        2 of 4
```

### 3. Free-text editing breaks the alignment

If a player inserts or deletes a word, token-by-token comparison against the
reference collapses and the colours scatter.

**Make each word its own editable field.** It reveals nothing — word boundaries
are already visible — it preserves the "convert by editing" feel, and it turns
scoring from a diff heuristic into an exact comparison.

### 4. The legend is missing the most interesting error

Red currently means two things at once, and they call for opposite responses.

| What the player did | What it says about them | What they need told |
| --- | --- | --- |
| Changed a word with no euspelling at all | They think the reform is bigger than it is | *Four fifths is untouched — leave more alone* |
| Wrote `recordz` where the noun `records` was meant | They know the word, know both forms, and read the grammar wrong | *This is the disambiguation problem — here is the cue you missed* |

Same colour, same score, and the second player is far closer to competent than
the first. (A third case hides in there too — inventing a form like `rekordz`,
which is right instinct with wrong spelling — but the noun/verb confusion is the
one worth its own colour, because it is the only error meaning *the player
engaged with the hard part and lost*.)

It deserves a fifth colour, with the expected form on hover — *expected
`records` (noun); you wrote `recordz` (verb)*. The hover matters more than the
colour: the colour says wrong, the hover teaches.

| State | Colour |
| --- | --- |
| Correctly unchanged | none |
| Correctly changed | green |
| Should have changed, did not | orange |
| Changed a word that should not change | red |
| Changed the right word to the wrong form | **purple** |

**It is not a rare case.** 5,911 lexicon entries carry two or more euspellings —
2.9% of types, but **5.3% of running tokens**, since they skew common (`use`,
`services`, `read`, `does`, `books`). Expect **~4.5 per 85-word paragraph**, so
purple would fire regularly rather than as a curiosity.

### 5. Hint defuses the hardest words, and the score rewards inattention

This is the more serious half of the same finding, and it is not a colour
problem.

**88% of context-dependent words have the original spelling among their valid
options** — the diatone shape, `records|recordz`, `use|uze`, `read|redd`. That
is roughly **4 words per paragraph where "leave it alone" is a legitimate
answer**.

Now combine that with `Hint`, which underlines *the words that need to be
changed*. A diatone in its noun reading does not need changing — **so it is not
underlined, and the hint quietly tells the player to leave it alone.** The
hardest judgement in the reform is handed over for free, and `Score` records a
success nobody earned. The player did not resolve the ambiguity; they were never
shown it.

Stated plainly: **the current design makes the most interesting words the
easiest to get right.**

Three changes, in order of what they buy:

1. **Score context-dependent words as their own line** — *"context words: 2 of
   4"* — regardless of colour. The cheapest fix and the most valuable: it counts
   passive-correct answers as a visible category instead of letting them vanish
   into the uncoloured 82%, and it tells the player the category exists at all.
2. **Add purple**, per the table above.
3. **Consider a second hint level** that underlines *words in the reform's
   scope* rather than *words that change*. That preserves the judgement instead
   of defusing it, and turns `Hint` from a partial answer key into a genuine aid.

**Worth measuring before building:** how often the unchanged reading is actually
the correct one for these pairs. Plural nouns outnumber third-person verbs in
most prose, so passive-correct is probably the common case — but that is an
expectation, not a number, and the SVM's training corpora in `euspell_ext` can
settle it.

**Why this matters past the game.** The 94%-accurate classifier is the
project's central technical claim. A drill that scores a wrong reading
identically to an invented word cannot demonstrate that claim — it cannot even
see it.

### 6. Use the engine's own tokenizer

Sentence-initial capitals (`Of → Ov`), the specially-cased `I → ih/Ih`, and
apostrophes: **`it's → it'z` is one token**. A bare `[a-z]+` tore exactly those
in half in the channel's lexicon tool and had to be fixed. Import the
tokenizer; do not re-derive it.

### 7. Proper nouns are a trap, and 1930 prose is full of them

6.5% of tokens are not in the lexicon. A player who "corrects" a character's
name should go red; the reference must leave it alone.

### 8. `Start` is not quite stateless

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

## Before building

**Measure the real 100.** The corpus figures come from web text — `search`,
`business` and `health` sit high in its edit list, which no novel does. Once the
paragraphs are chosen, run them through the tool and re-fit the acceptance band
to what they actually contain.
