"""Shared lexicon access for the euspell_game tools.

One loader, one tokenizer. Two scripts each rolling their own is how the
Firefox and Safari packagers in euspell_ext drifted apart, and how a bare
[a-z]+ regex once tore `it'z` in half in the channel's lexicon tool — the same
mistake writing-test.md's problem 7 is about. Anything here that needs to match
the engine should eventually import from the engine; until then it lives in one
place so there is only one thing to correct.
"""

import csv
import re
from pathlib import Path

EUSPELL = Path(__file__).resolve().parent.parent.parent
LEX = EUSPELL / "euspell_ext" / "data" / "euspell_lexicon.csv"
CONTRACTIONS = EUSPELL / "euspell_ext" / "data" / "euspell_lexicon_contractions.csv"
FREQ = EUSPELL / "euspell_yt" / "unigram_freq.csv"

# An apostrophe is part of the word: `it'z` and `anywun's` are single tokens,
# and a bare [a-z]+ tears each into two meaningless halves.
WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*")


class Entry:
    """One lexicon row, asked the questions the tools actually have."""

    __slots__ = ("word", "encoding", "spellings")

    def __init__(self, word, encoding, spellings):
        self.word = word
        self.encoding = encoding
        self.spellings = spellings

    @property
    def variants(self):
        """The encoding's last digit: how many euspellings this row really has."""
        return self.encoding % 10

    @property
    def in_effect(self):
        """The spellings the engine will actually consider.

        converter.js reads `entry.encoding % 10` and returns the word unchanged
        when it is zero, WHATEVER the euspelling field holds — and 40 rows hold
        something. They are the `9xx` abbreviations, where the fourth column is
        an expansion rather than a respelling: `mr -> Mister`, `etc -> et
        cetera`, `eg -> exempli gratia`. The column is overloaded, and this
        guard is the only thing that keeps "Mister" from being read as a
        euspelling of "mr". Any tool that parses the CSV without it silently
        invents 40 changes.
        """
        return self.spellings if self.variants else []

    @property
    def changed(self):
        """Spellings that differ from the original."""
        return [s for s in self.in_effect if s != self.word]

    @property
    def always_changes(self):
        """True when no reading of this word keeps the traditional spelling."""
        return bool(self.changed) and len(self.changed) == len(self.in_effect)

    @property
    def is_context(self):
        """True when the sentence decides which spelling applies."""
        return self.variants >= 2 and len(self.in_effect) >= 2

    @property
    def may_stay(self):
        """True when leaving the word alone can be correct."""
        return not self.in_effect or self.word in self.in_effect


def load_lexicon(contractions=True):
    """word -> Entry, over the main lexicon and (by default) the contractions.

    The contractions are a separate file that gen-pls.js also has to load
    separately; a tool that skips them flags every `it'z` as an invention.
    """
    lex = {}
    files = [LEX] + ([CONTRACTIONS] if contractions else [])
    for path in files:
        with open(path, encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) < 4 or row[0] in ("Word", "Contraction"):
                    continue
                try:
                    encoding = int(row[2])
                except ValueError:
                    continue
                spellings = [s for s in row[3].split("|") if s and s != "[]"]
                lex[row[0]] = Entry(row[0], encoding, spellings)
    return lex


def frequencies():
    """Yield (word, count) from the unigram corpus."""
    with open(FREQ, encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) < 2 or row[0] == "word":
                continue
            try:
                yield row[0], int(row[1])
            except ValueError:
                continue
