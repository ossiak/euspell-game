/* Store screenshots, captured from the real page.
 *
 *   cd euspell_game
 *   NODE_PATH=../Eupub/node_modules \
 *     ../Eupub/node_modules/.bin/electron tools/capture-shots.cjs
 *
 * Electron comes from Eupub, the only project here that has it. Two things bite:
 * ELECTRON_RUN_AS_NODE=1 is set in some shells, which makes Electron behave as
 * plain Node and `require('electron')` return a path string instead of the API;
 * and this machine's display is at 150%, so an unforced capture comes out
 * 1920x1200. Both are handled below.
 *
 * Shot at 2x and downscaled, per store-screenshots.md: text comes out visibly
 * crisper than a native 1x capture, which is the difference between a
 * screenshot and a product shot.
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const GAME = path.resolve(__dirname, '..');
const OUT = path.join(GAME, 'screenshots');
const SHARP = path.resolve(GAME, '..', 'euspell_ext', 'node_modules', 'sharp');

// 1280x800 is the store size; capture at twice that and resize down.
const SCALE = 2;
const SHOTS = [
  { name: '01-drill-scored.png', w: 1280, h: 800, page: 'web/index.html', compose: composeDrill },
  { name: 'promo-tile.png', w: 440, h: 280, page: 'tools/promo-tile.html' },
];

app.commandLine.appendSwitch('force-device-scale-factor', String(SCALE));
app.disableHardwareAcceleration();

// Shots are taken one window at a time, so destroying the first closes the last
// window — and on Windows that starts the default quit, which fails the next
// load with a bare ERR_FAILED that says nothing about the cause.
app.on('window-all-closed', () => {});

/**
 * Put the drill in a scored state showing EVERY legend colour at once, so one
 * frame teaches the whole scheme:
 *
 *   green   a correct change
 *   blue    a context word correctly left alone  (`arms`)
 *   orange  a change the player missed           (`into`)
 *   red     the right word in the wrong reading  (`walls` -> `wallz`)
 *   bold    every context-dependent word
 *
 * Then click the red word so the explanation panel is showing what it is for.
 */
async function composeDrill(win) {
  await win.webContents.executeJavaScript(`(() => {
    // Poe: 70 words, two context words, both of which want the traditional
    // form — which is the only way blue can appear.
    const only = window.EUSPELL_PARAGRAPHS.paragraphs.filter((p) => p.id === '005');
    EuspellDrill.mount(document.getElementById('drill'), { paragraphs: only });

    const para = only[0];
    let missed = false, wrong = null;
    document.querySelectorAll('.w').forEach((el) => {
      const tok = para.tokens[Number(el.dataset.i)];
      if (tok.t === 'walls') { el.textContent = 'wallz'; wrong = el; return; }  // red
      if (tok.t === 'arms') return;                                            // blue
      if (tok.t === 'into' && !missed) { missed = true; return; }              // orange
      el.textContent = tok.e;                                                  // green / none
    });

    document.querySelector('[data-act="score"]').click();
    if (wrong) wrong.click();
    return document.querySelector('#readout').textContent;
  })()`);
}

async function shoot(spec) {
  const win = new BrowserWindow({
    width: spec.w,
    height: spec.h,
    useContentSize: true,
    show: false,
    backgroundColor: '#ffffff',
  });
  await win.loadFile(path.join(GAME, spec.page));
  await new Promise((r) => setTimeout(r, 400));
  if (spec.compose) await spec.compose(win);
  await new Promise((r) => setTimeout(r, 250));

  const image = await win.webContents.capturePage();
  const raw = image.getSize();

  // Resize to the exact store size. sharp lives in euspell_ext; if it is not
  // built for this Electron ABI, keep the 2x file rather than pretend.
  let buffer = image.toPNG();
  let note = `${raw.width}x${raw.height} (not resized)`;
  try {
    const sharp = require(SHARP);
    buffer = await sharp(buffer).resize(spec.w, spec.h, { fit: 'cover' }).png().toBuffer();
    note = `${raw.width}x${raw.height} -> ${spec.w}x${spec.h}`;
  } catch (e) {
    note += ` — sharp unavailable (${e.code || e.message.slice(0, 40)})`;
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, spec.name), buffer);
  console.log(`  ${spec.name.padEnd(22)} ${note}`);
  win.destroy();
}

app.whenReady().then(async () => {
  for (const spec of SHOTS) await shoot(spec);
  console.log(`\nwrote ${SHOTS.length} file(s) to screenshots/`);
  app.quit();
}).catch((err) => {
  console.error('capture failed:', err);
  app.exit(1);
});
