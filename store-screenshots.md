# Chrome Web Store screenshots — on hold

**Parked 14 August 2026**, on the reasoning that the disambiguation demo page
(see [game-concept.md](game-concept.md)) may produce this imagery as a
by-product, and shooting the screenshots twice would be wasteful.

**What this blocks:** the Chrome Web Store submission, which is otherwise ready —
the package builds (`npm run build:chrome` in `euspell_ext`), and the listing
copy, permission justifications and data disclosures are written up in
`euspell_ext/docs/chrome-submission.md`. Screenshots are the last hard blocker
alongside deploying the privacy policy.

---

## The problem the assets have to solve

Euspell's effect is a **diff**, but a screenshot is a frame. A static image of a
converted page — `niht`, `recordz`, `hoo'z` scattered through prose — reads to a
stranger as *a page full of typos*, or as a language they do not know. The naive
hero shot ("here is a converted article") is actively the worst one to lead with,
because it demonstrates the output while hiding the intent.

Shot 1 therefore has to carry before *and* after in one frame.

**This is exactly where the demo page helps.** *Beat the classifier* shows a
sentence, a choice, and a reveal — before and after, with the reason, in a single
purpose-built screen. A screenshot of that page is a better first image than
anything that can be composed out of a converted web page, and it needs no
side-by-side mockup at all.

## The spec

1280×800 or 640×400, PNG or JPEG, up to five, at least one. Take 1280×800;
640×400 looks cheap on any modern display. The **first** image appears in search
results and above the fold, and does most of the work.

## The four shots

1. **The split.** One paragraph, twice, labelled *Traditional* / *Euspell*.
   Minimal labels in the site's own type, no arrows or starbursts. The only shot
   that has to *teach*. (Superseded by a demo-page shot if that gets built.)
   Composed images are within store policy provided they show real UI and do not
   imitate Chrome's own chrome or add fake badges.
2. **The popup on `records`.** The word lookup is the most persuasive single
   fact: same spelling, two words, and euspell separates them (`records` /
   `recordz`), with the encoding chip and its description showing. Choosing a
   diatone here is deliberate — a boring word wastes the slot.
3. **The PDF viewer.** Proves the scope claim. Anyone can rewrite HTML;
   converting a PDF in a bundled viewer reads as engineering rather than a
   userscript.
4. **The off switch.** Counterintuitive, and worth arguing for. The dominant
   anxiety about an extension requesting **all sites** is "will this take over my
   browser". A shot of the toggle and per-page control answers it before it is
   asked — the same question the `<all_urls>` justification has to answer for the
   reviewer.

**Stop at four.** Five slots is a ceiling, not a quota. Dictation in particular
resists screenshotting — it is audio, and a still of a microphone indicator says
nothing. It belongs in the demo video.

## What page to shoot

Not a news site: a recognisable masthead is someone else's trademark in your
marketing, the page will have changed by the time anyone looks, and it invites
"is this affiliated with…". Wikipedia has the same problem plus CC BY-SA
attribution.

**Use public-domain prose** — Gutenberg's *Alice* or *Sherlock Holmes*. Legally
clean, timeless, pleasant to read, and full of exactly the words the reform
touches. Then use **euspell.org's own rationale page** for one of the later
shots: dogfooding reads well once the viewer knows what they are looking at.

## Capture mechanics

- **Shoot at 2× and downscale.** Capture 2560×1600 (DevTools device toolbar, DPR
  2), then resize to 1280×800. Visibly crisper than a native 1× capture.
- **Zoom the page to ~125–150% first.** At default type the respelled words are
  illegible in the listing thumbnail, which is the size most people see.
- **The popup will not appear in a DevTools capture** — it is browser UI, not
  page content. Either composite it (open
  `chrome-extension://<id>/src/popup/popup.html` in a tab, where it renders at
  its natural 260px) or capture the full screen and crop. Shot 2 is the fiddly
  one.
- **Set the OS theme once and do not change it.** The popup, options page and PDF
  viewer all follow `prefers-color-scheme`; a half-light, half-dark set looks
  like two different products.

## Tooling, if it is wanted

`sharp` is already a dependency of `euspell_ext` (`build/gen-icons.js` uses it).
A `build/gen-screenshots.js` taking raw captures and emitting exact-size store
assets — crop, downscale from 2×, pad to 1280×800, add the split labels — would
make re-shooting cheap the next time the UI changes. Not written; offered.

## Also outstanding

A **440×280 promo tile** is optional but required for any chance of being
featured.
