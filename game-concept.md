# A Euspell game — what it would be for

**Recorded 14 August 2026.** This is a design discussion held in a working
session, written down here because it existed only in the conversation. The
argument and the recommendation are as they were made; only the framing has been
edited so it stands on its own.

---

Worth taking seriously, because this project has something almost no educational
game has: **the content already exists and doesn't need authoring.** 205,481
words tagged with what changed, why, and their parts of speech; a
frequency-ranked list for difficulty tiers; 35,000-odd IPA readings for audio;
and 14 genuinely hard multi-way words. Most word games die on content
production. This one starts with a finished corpus.

And the engine exists too. `converter.js`, the 70-odd semantic rules, and the SVM
all run **client-side in JavaScript today** — that is what the browser extension
is. A web game is not a rewrite, it is a different front end on code that already
ships.

## First, what the game is actually for

There is a trap here, and it is worth naming before any design. The obvious game
is a spelling drill — flashcards, streaks, Duolingo for Euspell. **That game
argues against the reform.** Euspell's entire pitch is *you don't have to learn
this*: four fifths untouched, 85% of changes one letter, "a reader familiar with
either spelling should be able to read the other comfortably." A drill says the
opposite — that this is a thing requiring study. It would undercut the paper on
the paper's strongest claim.

So the design goal is not teaching. It is **demonstrating readability** and,
secondarily, recruitment.

## The one I'd build: *Beat the classifier*

The project's most interesting technical claim is that some spellings cannot be
decided without reading the sentence, and a machine gets it right 94% of the
time. Make that a game.

Show a sentence with the target word blanked. *The girl who loves Christmas
presents her paintings to the class.* Player picks `presents` or `presentz`.
Then reveal what the SVM chose, and what the lexicon says is right. Score the
player against the machine.

Why this one:

- **The hook writes itself** — "a computer reads English better than you do" is
  provocative in a way spelling reform normally is not.
- **It teaches the argument, not the spellings.** A player who plays for four
  minutes has internalised *why* the reform splits `-s` and `-z`, which is the
  thing the paper most needs people to understand.
- **Difficulty tiers are free.** Start with unambiguous `011` words, move to the
  4,925 `012` noun/verb splits, end on the fourteen multi-way words. The
  frequency-ranked word list already orders them.
- **It doubles as a missing asset.** Episode 10 needs a recording, not a script:
  thirty seconds of a TTS engine saying `records` wrong and then right. A page
  that reads the sentence aloud both ways *is* that recording, and it is the demo
  the launch note still lists as missing.
- **Every disagreement is a labelled example.** When a player picks against the
  classifier, that is a candidate corpus line — and `disambig/*.txt` is already
  exactly that format, tagged tokens with expected outputs. The game feeds the
  thing it is built on.

That last point needs a caveat: crowd labels are noisy and some players will
troll. It is a queue for review, not a training pipeline.

## The second idea, which is worth more strategically

Instrument it as a **reading test**. Show a passage in traditional or euspell
spelling, measure comprehension and time, compare.

The reason this matters: the paper's *Motivation* section cites no direct
evidence — it points at `spellingsociety.org/research` generically. The gathered
evidence (Seymour et al. 2003, the 34%-vs-98% first-year figure) has never been
landed in the paper itself, so under the rule that videos are downstream of the
paper, the flagship cannot use it.

A reading instrument generates first-party evidence for a claim the project
currently borrows. That is a different class of asset from a promo toy — and it
is in this project's register, which is "here are the numbers" rather than "here
is an opinion."

Two honest limits: a self-selected web sample is weak evidence and you should say
so rather than overclaim it; and the moment you collect timing data from people
you need real consent language and no PII. Do that properly or do not collect.

## What I'd not build

**A real video game** — Unity, art, levels, characters. Months of work, a skill
set the project does not have, and it competes directly with a launch that is not
done. A game would be the fourth unfinished thing.

**Anything that ships before the repositories do.** The sequencing rule applies
here exactly as it does to the channel: publishing into 404s spends credibility
you cannot get back.

## Cost, honestly

The disambiguation game as a single self-contained page — reusing the existing JS
engine, no framework, no art beyond the `#0000FF` you already use — is a **few
days**, not a project. It embeds on euspell.org, it is a link in every video
description, and screen recordings of it are Shorts, which feeds the channel you
are already building.

The reading-test instrument is a week and change, mostly on consent, storage, and
analysis rather than the game.

## One risk specific to this project

The game teaches whatever the lexicon says, and the lexicon moved daily through
early August — `sloff → sluff`, 43 broken plurals, six removed proper nouns, the
French block reading 968 then 999 then 1,001. A shipped game caches its content
and starts teaching yesterday's answers, exactly as `dist/lexicon.js` did until
it was rebuilt. If you build this, have it read the lexicon at build time and put
the build date on screen — the same discipline the encoding table needed.

*(The lexicon has since been frozen, which lowers this risk considerably. It does
not remove it: a frozen lexicon still thaws for r2.)*

## Recommendation

**Don't build a game.** Build the disambiguation demo page, because it is
simultaneously the game's best mechanic, the flagship's missing asset, episode
10's blocker, and the launch note's outstanding demo. If it gets played, make it
a game afterwards.
