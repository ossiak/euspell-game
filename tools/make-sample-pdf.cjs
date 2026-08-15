/* Builds screenshots/sample.pdf — the document for the PDF-viewer screenshot.
 *
 *   cd euspell_game
 *   NODE_PATH=../Eupub/node_modules \
 *     ../Eupub/node_modules/.bin/electron tools/make-sample-pdf.cjs
 *
 * Generated rather than found. Nothing off the shelf fits: Gutenberg is mostly
 * EPUB and plain text, Standard Ebooks publishes no PDF, and a third-party paper
 * is someone else's work — fine as a local fixture, not something to publish in
 * a store listing.
 *
 * NOT the project's own white paper. Its HTML edition carries
 * data-euspell="off" on <body>, so the extension deliberately refuses to convert
 * it; the PDF converts only because a PDF has no way to carry that marker.
 * Photographing that would advertise a hole in the project's own opt-out.
 *
 * Printing HTML gives a real text layer by construction, which is the binding
 * constraint — the viewer converts text, so a scanned PDF would show nothing
 * converted and the shot would prove the opposite of its point.
 *
 * The passages are the ones already cleared for the drill: published 1930 or
 * earlier AND author died 1955 or earlier, so they are public domain in the US
 * and in life+70 jurisdictions alike. Text is read from paragraphs/*.md so the
 * two never drift, and stays in TRADITIONAL spelling — the viewer does the
 * converting, live, which is the whole point of the shot.
 */
const { app } = require('electron');
const { BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const GAME = path.resolve(__dirname, '..');
const OUT = path.join(GAME, 'screenshots', 'sample.pdf');
// Poe, Bronte, Conrad — in reading order. NOT Mansfield (003): it carries two
// genitives, and the clitic rule reads "the shepherd's head" as verbal, so the
// converted page showed `shepherd'z`. A store screenshot is the wrong place to
// exhibit a misclassification in the feature the reform is proudest of.
//
// The two known triggers are a genitive `'s` and a context-dependent word
// beside a semicolon (ossiak/euspell#11). Poe and Bronte both contain
// semicolons and are fine, because no context word sits next to one. Conrad has
// neither trigger, and its three context words — forcez, meanz, taer — all
// resolve correctly.
const WANT = ['005', '004', '002'];

// The title counts the passages rather than asserting a number. It said "Four
// passages" over three of them until someone read it: a hardcoded numeral beside
// a list is a fact waiting to go stale, exactly like the encoding table's counts.
const NUMERALS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const numeral = (n) => NUMERALS[n] ?? String(n);

function passages() {
  const dir = path.join(GAME, 'paragraphs');
  return WANT.map((id) => {
    const file = fs.readdirSync(dir).find((f) => f.startsWith(`${id}-`));
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const meta = {};
    for (const line of (/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '').split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const body = /^##\s+traditional\s*\n([\s\S]*?)(?=^##\s|$)/m.exec(text)?.[1].trim();
    return { title: meta.title, author: meta.author, body };
  });
}

const CHOSEN = passages();
const TITLE = `${numeral(CHOSEN.length)} passage${CHOSEN.length === 1 ? '' : 's'}`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font: 11.5pt/1.75 Georgia, "Times New Roman", serif; color: #111; }
  h1 { font-size: 21pt; font-weight: 500; margin: 0 0 4pt; letter-spacing: .01em; }
  .sub { font-size: 10pt; color: #555; margin: 0 0 26pt; font-style: italic; }
  h2 { font-size: 12.5pt; font-weight: 600; margin: 22pt 0 2pt; }
  .by { font-size: 9.5pt; color: #666; margin: 0 0 8pt; }
  p.text { margin: 0 0 12pt; text-align: justify; }
</style></head><body>
  <h1>${TITLE}</h1>
  <p class="sub">A short reader, set for testing how a document renders.</p>
  ${CHOSEN.map((p) => `
  <h2>${p.title}</h2>
  <p class="by">${p.author}</p>
  <p class="text">${p.body}</p>`).join('\n')}
</body></html>`;

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 1200 });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((r) => setTimeout(r, 400));

  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { marginType: 'default' },
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, pdf);

  const has = (needle) => pdf.includes(Buffer.from(needle));
  console.log(`wrote ${path.relative(GAME, OUT)} — ${(pdf.length / 1024).toFixed(0)} KB`);
  console.log(`  title: "${TITLE}"  over ${CHOSEN.length}: ${CHOSEN.map((p) => p.author).join(', ')}`);
  console.log(`  /Font present: ${has('/Font')}   (a text layer is the whole requirement)`);
  win.destroy();
  app.quit();
}).catch((e) => { console.error('failed:', e); app.exit(1); });
