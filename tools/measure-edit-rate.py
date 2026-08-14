"""How much work does one paragraph actually ask of a player?

The quoted "four fifths of the dictionary is untouched" is a figure about
dictionary *types*. A player faces *tokens*, and the common words change
heavily, so the paragraph-size question cannot be answered from that number.
This measures the token rate, and how concentrated the edits are across word
types — the two facts writing-test.md's sizing rests on.

    python measure-edit-rate.py                 # against the frequency corpus
    python measure-edit-rate.py paragraphs.txt  # against real candidate texts

The second form is the one that matters once the 100 paragraphs are chosen:
the corpus is web-derived (`search`, `business` and `health` sit high in its
edit list), and 1930 literary prose will not match it exactly. Blank-line
separated paragraphs; the per-paragraph table shows which ones fall inside the
12-20 edit acceptance band.

Approximation, stated plainly: a word counts as an edit when every euspelling
in its lexicon row differs from the original. Words whose spelling depends on
context (diatones, sense pairs) are counted separately as "may change", since
without running the disambiguator we cannot know which way they went. The true
rate lies between the two, nearer the ceiling.
"""

import csv
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EUSPELL = HERE.parent.parent
LEX = EUSPELL / "euspell_ext" / "data" / "euspell_lexicon.csv"
FREQ = EUSPELL / "euspell_yt" / "unigram_freq.csv"

# An apostrophe is part of the word: `it'z` and `anywun's` are single tokens,
# and a bare [a-z]+ tears each into two meaningless halves. That exact bug
# shipped once in the channel's lexicon tool; do not reintroduce it here.
WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*")

BAND = (12, 20)  # the acceptance band, in edits


def load_lexicon():
    """word -> (always_changes, may_change)"""
    lex = {}
    with open(LEX, encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) < 4 or row[0] == "Word":
                continue
            try:
                variants = int(row[2]) % 10
            except ValueError:
                continue
            spellings = [s for s in row[3].split("|") if s and s != "[]"]
            if variants == 0 or not spellings:
                lex[row[0]] = (False, False)
                continue
            differs = [s for s in spellings if s != row[0]]
            lex[row[0]] = (bool(differs) and len(differs) == len(spellings), bool(differs))
    return lex


def measure_corpus(lex):
    total = unknown = floor = ceiling = 0
    changes = []  # (frequency, word) for words that always change
    with open(FREQ, encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) < 2 or row[0] == "word":
                continue
            try:
                count = int(row[1])
            except ValueError:
                continue
            total += count
            entry = lex.get(row[0])
            if entry is None:
                unknown += count
                continue
            always, maybe = entry
            if maybe:
                ceiling += count
            if always:
                floor += count
                changes.append((count, row[0]))

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


def measure_texts(lex, path):
    text = Path(path).read_text(encoding="utf-8")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        sys.exit(f"no paragraphs found in {path}")

    print(f"{'#':>3}  {'words':>5}  {'edits':>5}  {'rate':>6}  {'top-100':>7}  band")
    in_band = 0
    for i, para in enumerate(paragraphs, 1):
        words = WORD.findall(para)
        edits = [w for w in words if lex.get(w.lower(), (False, False))[0]]
        rate = 100 * len(edits) / len(words) if words else 0
        # How many of this paragraph's edits are the reflex words rather than
        # the reform proper — the split writing-test.md asks the score to report.
        common = sum(1 for w in edits if w.lower() in COMMON)
        ok = BAND[0] <= len(edits) <= BAND[1]
        in_band += ok
        print(
            f"{i:>3}  {len(words):>5}  {len(edits):>5}  {rate:5.1f}%  "
            f"{common:>7}  {'ok' if ok else '--'}"
        )

    print(f"\n{in_band} of {len(paragraphs)} paragraphs fall in the {BAND[0]}-{BAND[1]} edit band")


def top_common(lex, n=100):
    """The n most frequent always-changing words — the 'reflex' set."""
    changes = []
    with open(FREQ, encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) < 2 or row[0] == "word":
                continue
            try:
                count = int(row[1])
            except ValueError:
                continue
            if lex.get(row[0], (False, False))[0]:
                changes.append((count, row[0]))
    changes.sort(reverse=True)
    return {w for _, w in changes[:n]}


if __name__ == "__main__":
    lexicon = load_lexicon()
    if len(sys.argv) > 1:
        COMMON = top_common(lexicon)
        measure_texts(lexicon, sys.argv[1])
    else:
        measure_corpus(lexicon)
