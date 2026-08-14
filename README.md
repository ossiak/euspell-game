# euspell_game

Interactive and playable work for the Euspell project — everything that is a
*demo* rather than a tool. Sibling to `euspell_ext` (the extension and the
engine), `Eupub` (the reader), `euspell_website`, and `euspell_yt`.

Nothing is built yet. This folder currently holds the thinking.

| Note | What it is |
| --- | --- |
| [game-concept.md](game-concept.md) | The design discussion: what a Euspell game is for, the one worth building, and the recommendation not to build a game at all yet |
| [writing-test.md](writing-test.md) | The conversion drill — convert a paragraph by hand and be scored on it. Paragraph sizing, the open problems in the spec, and how to implement it on desktop and mobile |
| [store-screenshots.md](store-screenshots.md) | The Chrome Web Store screenshot brief, parked here because the demo page may produce the imagery |

| Tool | What it does |
| --- | --- |
| [tools/measure-edit-rate.py](tools/measure-edit-rate.py) | How much work a paragraph asks of a player: the token change rate, how concentrated the edits are, and which candidate paragraphs fall in the acceptance band |

## The through-line

The disambiguation demo — *Beat the classifier* — is the asset that solves
several problems at once: it is the game's best mechanic, the missing product
demo, episode 10's blocked cold open, and a candidate source for the store
screenshots. It reuses the existing JavaScript engine and needs no art.

The conversion drill is the other half of the same idea: *Beat the classifier*
tests whether a player can reason about the reform, the drill tests whether they
can write it. Both run on the lexicon that already exists, which is why neither
needs content authored for it.

The standing constraint from the launch sequencing still applies: **nothing here
ships before the repositories are public and the site is deployed.** Publishing a
demo into 404s spends credibility that is hard to win back.
