"""How much work does one paragraph actually ask of a player?

The quoted "four fifths of the dictionary is untouched" is a figure about
dictionary *types*. A player faces *tokens*, and the common words change
heavily, so the paragraph-size question cannot be answered from that number.
This measures the token rate, and how concentrated the edits are across word
types — the facts writing-test.md's sizing rests on.

    python measure-edit-rate.py                 # against the frequency corpus
    python measure-edit-rate.py paragraphs.txt  # against real candidate texts

The second form is the one that matters once the paragraphs are chosen:
the corpus is web-derived (`search`, `business` and `health` sit high in its
edit list), and 1930 literary prose will not match it exactly. Blank-line
separated paragraphs; the per-paragraph table shows which ones fall inside the
12-20 edit acceptance band.

Approximation, stated plainly: a word counts as an edit when every euspelling
in its lexicon row differs from the original. Words whose spelling depends on
context (diatones, sense pairs) are counted separately as "may change", since
without running the disambiguator we cannot know which way they went. The true
rate lies between the two, nearer the ceiling.

To check the committed paragraph files themselves — alignment, spellings, front
matter — use check-paragraphs.py instead.
"""

import os
import re
import sys
from pathlib import Path

from euspell_data import WORD, frequencies, load_lexicon

BAND = (12, 20)  # the acceptance band, in edits
# A sample size for the authoring estimate, not a target: how many paragraphs the
# game ends up with is not decided here, and nothing depends on this number
# except the projection printed below. Override it with SAMPLE=n in the
# environment to project for a different set.
PARAGRAPHS = int(os.environ.get("SAMPLE", 100))
WORDS_PER = 85  # measured mean, from the paragraphs that exist


def measure_corpus(lex):
    total = unknown = floor = ceiling = 0
    changes = []  # (frequency, word) for words that always change
    for word, count in frequencies():
        total += count
        entry = lex.get(word)
        if entry is None:
            unknown += count
            continue
        if entry.changed:
            ceiling += count
        if entry.always_changes:
            floor += count
            changes.append((count, word))

    pct = lambda n: 100 * n / total
    print(f"tokens measured        {total:,}")
    print(f"not in the lexicon     {pct(unknown):5.1f}%   names, numerals, OOV")
    print(f"always changes         {pct(floor):5.1f}%   floor")
    print(f"may change (context)   {pct(ceiling):5.1f}%   ceiling")

    changes.sort(reverse=True)
    total_changes = sum(c for c, _ in changes)
    print(f"\nedits are spread over {len(changes):,} word types, very unevenly:")
    for k in (3, 10, 20, 100, 1000):
        share = sum(c for c, _ in changes[:k]) / total_changes
        print(f"  top {k:>4} words   {100 * share:5.1f}% of all edits")

    print("\nthe words a player retypes most:")
    for count, word in changes[:10]:
        print(f"  {word:<10} {100 * count / total:5.2f}% of all tokens")


def measure_context_words(lex):
    """How often the hardest class shows up, and how much of it is free.

    A context-dependent word whose spellings include the original — the diatone
    shape, records|recordz — can be scored correct by never noticing it. Hint
    underlines only the words that NEED changing, so in its unchanged reading
    such a word is left unmarked, and the hint tells the player to leave the
    hardest judgement in the reform alone.
    """
    n_context = sum(1 for e in lex.values() if e.is_context)
    print(f"\ncontext-dependent entries  {n_context:,}  "
          f"({100 * n_context / len(lex):.2f}% of types)")

    total = ctx = passive = 0
    seen = []
    for word, count in frequencies():
        total += count
        entry = lex.get(word)
        if not entry or not entry.is_context:
            continue
        ctx += count
        if entry.may_stay:
            passive += count
        seen.append((count, word, entry.spellings))

    print(f"  share of running tokens  {100 * ctx / total:.2f}%")
    print(f"  'leave alone' is valid   {100 * passive / ctx:.0f}% of them")
    print(f"  in an 85-word paragraph  ~{85 * ctx / total:.1f} of them, "
          f"~{85 * passive / total:.1f} where doing nothing may be the answer")

    seen.sort(reverse=True)
    print("\n  the ones a player will meet:")
    for _count, word, spellings in seen[:8]:
        free = "  <- unchanged is an option" if word in spellings else ""
        print(f"    {word:<10} {'|'.join(spellings):<24}{free}")


def measure_authoring_load(lex):
    """How many words would actually need distractors written for them?

    The tap-to-choose mode on mobile needs wrong spellings to offer. The
    tempting reading is "another lexicon" — 13,229 changed types, or worse the
    whole 205,493. Neither is the job: distractors are only needed for the
    types that turn up in the chosen paragraphs, and Zipf makes that a much
    smaller set. Estimated as the expected number of distinct types appearing
    at least once in PARAGRAPHS x WORDS_PER tokens.
    """
    n = PARAGRAPHS * WORDS_PER
    total = 0
    rows = list(frequencies())
    total = sum(c for _, c in rows)

    changed, context = [], []
    for word, count in rows:
        entry = lex.get(word)
        if not entry:
            continue
        p = count / total
        if entry.always_changes:
            changed.append(p)
        if entry.is_context:
            context.append(p)

    met = lambda pool: sum(1 - (1 - p) ** n for p in pool)
    print(f"\nauthoring load for {PARAGRAPHS} paragraphs (~{n:,} tokens):")
    print(f"  changed types in the lexicon   {len(changed):,}")
    print(f"  ...expected to actually appear ~{met(changed):.0f}   <- need distractors")
    print(f"  context types expected         ~{met(context):.0f}   <- sibling spelling is free")

    changed.sort(reverse=True)
    mass = sum(changed)
    run = 0
    marks = {}
    for i, p in enumerate(changed, 1):
        run += p
        for target in (0.5, 0.8, 0.9):
            if target not in marks and run / mass >= target:
                marks[target] = i
    print("  types covering a share of all edit instances:", end="")
    print("".join(f"  {int(t * 100)}%={marks[t]:,}" for t in (0.5, 0.8, 0.9)))


def top_common(lex, n=100):
    """The n most frequent always-changing words — the 'reflex' set."""
    changes = [
        (count, word)
        for word, count in frequencies()
        if (e := lex.get(word)) and e.always_changes
    ]
    changes.sort(reverse=True)
    return {w for _, w in changes[:n]}


def measure_texts(lex, path):
    text = Path(path).read_text(encoding="utf-8")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        sys.exit(f"no paragraphs found in {path}")
    common = top_common(lex)

    print(f"{'#':>3}  {'words':>5}  {'edits':>5}  {'rate':>6}  {'top100':>6}  {'ctx':>4}  band")
    in_band = 0
    for i, para in enumerate(paragraphs, 1):
        words = WORD.findall(para)
        entries = [lex.get(w.lower()) for w in words]
        edits = [w for w, e in zip(words, entries) if e and e.always_changes]
        rate = 100 * len(edits) / len(words) if words else 0
        # How many of this paragraph's edits are the reflex words rather than
        # the reform proper — the split writing-test.md asks the score to report.
        hits = sum(1 for w in edits if w.lower() in common)
        # Context-dependent words are counted over ALL tokens, not just edits:
        # in its unchanged reading a diatone is not an edit at all, which is
        # exactly the case the game must not hand over for free.
        ctx = sum(1 for e in entries if e and e.is_context)
        ok = BAND[0] <= len(edits) <= BAND[1]
        in_band += ok
        print(
            f"{i:>3}  {len(words):>5}  {len(edits):>5}  {rate:5.1f}%  "
            f"{hits:>6}  {ctx:>4}  {'ok' if ok else '--'}"
        )

    print(f"\n{in_band} of {len(paragraphs)} paragraphs fall in the {BAND[0]}-{BAND[1]} edit band")
    print("top100 = edits that are reflex words; ctx = words needing a reading decided")


if __name__ == "__main__":
    lexicon = load_lexicon()
    if len(sys.argv) > 1:
        measure_texts(lexicon, sys.argv[1])
    else:
        measure_corpus(lexicon)
        measure_context_words(lexicon)
        measure_authoring_load(lexicon)
