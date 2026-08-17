// Copies web/ into the website, where it is served at /game/.
//
//   node tools/build-data.mjs     # paragraphs/*.md -> web/paragraphs.js
//   node tools/publish-game.mjs   # web/ -> euspell_website/public/game/
//
// Run the second after the first, every time a paragraph is added. web/ is the
// source of truth; the copy under the site is a build output.
//
// Why a copy into the website repo rather than a hand upload to the host: files
// under public/ are copied verbatim into out/ by the static export, so the game
// survives every future deploy. Anything uploaded beside the export is one
// full-site upload away from vanishing.
//
// This publishes four static files, not the repository. game-concept.md,
// writing-test.md and the store-screenshot brief are working notes, and making
// the repo public to serve 29 KB of assets would put them in front of readers
// for no benefit.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'web');
const SITE = join(HERE, '..', '..', 'euspell_website');
const DEST = join(SITE, 'public', 'game');

if (!existsSync(SITE)) {
  console.error(`euspell_website not found at ${SITE} — clone it beside euspell_game.`);
  process.exit(1);
}

// Replaced wholesale rather than merged, so a file renamed in web/ cannot leave
// its old copy being served alongside the new one.
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

const files = readdirSync(DEST).sort();
let bytes = 0;
for (const f of files) bytes += statSync(join(DEST, f)).size;
console.log(`published ${files.length} files (${(bytes / 1024).toFixed(1)} KB) -> public/game/`);
for (const f of files) console.log(`  ${f}`);
console.log('\nServed at /game/ once the site is deployed.');
