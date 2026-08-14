"""Validate the committed paragraph files.

    python tools/check-paragraphs.py            # all of paragraphs/
    python tools/check-paragraphs.py 042        # one, by id or filename

Each file holds a passage twice, traditional and euspell, hand-converted. Five
things can go wrong, and only the first is visible by reading:

  1. token counts differ         one dropped word and every colour after it in
                                 the drill is wrong, silently
  2. a changed token is not a    a typo in the manual conversion, which the
     listed euspelling           drill would then teach as correct
  3. an unchanged token had to   the reverse: a missed edit in the source data,
     change                      scored against the player
  4. the passage misses the      it tests reflexes rather than the reform
     acceptance band
  5. front matter incomplete,    the public-domain claim has to be checkable,
     or `death` after 1955       not remembered

Exits non-zero if anything fails, so it can gate a build.
"""

import re
import sys
from pathlib import Path

from euspell_data import WORD, load_lexicon

HERE = Path(__file__).resolve().parent
PARAGRAPHS = HERE.parent / "paragraphs"
SKIP = {"TEMPLATE.md"}

REQUIRED = ["id", "title", "author", "year", "death", "source", "revision", "checked"]
LATEST_PUBLICATION = 1930  # US, 95-year term, as of 2026
LATEST_DEATH = 1955        # clears life+70 in the UK and EU
BAND = (12, 20)
WORDS = (70, 100)
MIN_CONTEXT = 2
MIN_UNCOMMON = 5
MAX_PROPER = 0.10


def parse(path):
    """Front matter plus the two sections. Deliberately not YAML: pyyaml is not
    installed here, and `key: value` is all the format needs."""
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return None, None, None, "no front matter"

    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()

    body = re.sub(r"<!--.*?-->", "", m.group(2), flags=re.S)
    sections = {}
    for name, chunk in re.findall(r"^##\s+(\w+)\s*\n(.*?)(?=^##\s|\Z)", body, re.S | re.M):
        sections[name.lower()] = chunk.strip()

    if "traditional" not in sections or "euspell" not in sections:
        return meta, None, None, "needs a '## traditional' and a '## euspell' section"
    return meta, sections["traditional"], sections["euspell"], None


def check_metadata(meta):
    problems = []
    for field in REQUIRED:
        if not meta.get(field):
            problems.append(f"front matter is missing '{field}'")
    for field, limit in (("year", LATEST_PUBLICATION), ("death", LATEST_DEATH)):
        raw = meta.get(field)
        if raw is None:
            continue
        try:
            value = int(raw)
        except ValueError:
            problems.append(f"{field} '{raw}' is not a year")
            continue
        if value > limit:
            why = ("US 95-year term" if field == "year"
                   else "life+70 in the UK and EU")
            problems.append(f"{field} {value} is after {limit} — fails the {why}")
    return problems


def check_alignment(lex, original, euspell):
    """Token-for-token, the two versions against the lexicon."""
    left, right = WORD.findall(original), WORD.findall(euspell)
    if len(left) != len(right):
        return [f"token counts differ: {len(left)} traditional, {len(right)} euspell"], None

    problems = []
    for i, (a, b) in enumerate(zip(left, right)):
        entry = lex.get(a.lower())
        if a == b:
            # An unchanged token is fine unless every reading of that word
            # changes, in which case the source data missed an edit.
            if entry and entry.always_changes:
                problems.append(
                    f"word {i + 1} '{a}' was left alone but always changes "
                    f"({'|'.join(entry.changed)})"
                )
            continue
        if not entry:
            problems.append(f"word {i + 1} '{a}' -> '{b}' but '{a}' is not in the lexicon")
        elif b.lower() not in [s.lower() for s in entry.in_effect]:
            listed = "|".join(entry.in_effect) or "nothing"
            problems.append(f"word {i + 1} '{a}' -> '{b}', but the lexicon lists {listed}")
    return problems, left


def measure(lex, words, common):
    edits = [w for w in words if (e := lex.get(w.lower())) and e.always_changes]
    context = sum(1 for w in words if (e := lex.get(w.lower())) and e.is_context)
    uncommon = sum(1 for w in edits if w.lower() not in common)
    proper = sum(1 for w in words if w[:1].isupper() and w.lower() not in lex)
    return {
        "words": len(words),
        "edits": len(edits),
        "distinct": len({w.lower() for w in edits}),
        "context": context,
        "uncommon": uncommon,
        "proper": proper,
    }


def check_band(stats):
    problems = []
    if not BAND[0] <= stats["edits"] <= BAND[1]:
        problems.append(f"{stats['edits']} edits, outside the {BAND[0]}-{BAND[1]} band")
    if not WORDS[0] <= stats["words"] <= WORDS[1]:
        problems.append(f"{stats['words']} words, outside {WORDS[0]}-{WORDS[1]}")
    if stats["context"] < MIN_CONTEXT:
        problems.append(f"{stats['context']} context-dependent words, want {MIN_CONTEXT}+")
    if stats["uncommon"] < MIN_UNCOMMON:
        problems.append(
            f"only {stats['uncommon']} edits outside the top-100 — tests reflexes"
        )
    if stats["words"] and stats["proper"] / stats["words"] > MAX_PROPER:
        problems.append(f"{stats['proper']} proper nouns in {stats['words']} words")
    return problems


def top_common(lex, n=100):
    """The reflex set: the n most frequent always-changing words."""
    from euspell_data import frequencies
    changes = [
        (count, word)
        for word, count in frequencies()
        if (e := lex.get(word)) and e.always_changes
    ]
    changes.sort(reverse=True)
    return {w for _, w in changes[:n]}


def main():
    if not PARAGRAPHS.is_dir():
        sys.exit(f"no {PARAGRAPHS} directory")

    wanted = sys.argv[1] if len(sys.argv) > 1 else None
    files = sorted(
        p for p in PARAGRAPHS.glob("*.md")
        if p.name not in SKIP and (not wanted or wanted in p.name)
    )
    if not files:
        print(f"No paragraphs yet in {PARAGRAPHS.name}/ — copy TEMPLATE.md to start.")
        return 0

    lex = load_lexicon()
    common = top_common(lex)
    failures = 0

    for path in files:
        meta, original, euspell, error = parse(path)
        problems = [error] if error else []
        if meta:
            problems += check_metadata(meta)
        stats = None
        if original is not None:
            aligned, words = check_alignment(lex, original, euspell)
            problems += aligned
            if words is not None:
                stats = measure(lex, words, common)
                problems += check_band(stats)

        if problems:
            failures += 1
            print(f"\n{path.name}")
            for problem in problems:
                print(f"  ! {problem}")
        elif stats:
            print(
                f"{path.name:<34} {stats['words']:>3}w  {stats['edits']:>2} edits  "
                f"{stats['distinct']:>2} distinct  {stats['context']} context  ok"
            )

    print(f"\n{len(files) - failures} of {len(files)} paragraphs pass")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
