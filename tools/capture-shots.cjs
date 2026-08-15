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
  // The popup was captured from a real Chrome at its natural size, so it is
  // composited onto a converted page rather than upscaled — placed where it
  // actually hangs, top right, over a page containing the very word it explains.
  {
    name: '02-popup-records.png',
    w: 1280,
    h: 800,
    page: 'tools/demo-page.html',
    overlay: { file: 'popup-records.png', marginRight: 44, top: 40 },
  },
  // The options panel is the subject, so it gets a plain field rather than the
  // article behind shot 2 — the same background twice reads as carelessness.
  // Trimmed because the capture caught a few pixels of the page underneath the
  // dialog, and scaled down so it does not fill the frame edge to edge.
  {
    name: '04-options.png',
    w: 1280,
    h: 800,
    page: 'tools/blank.html',
    overlay: { file: 'options-popup.png', center: true, height: 660, trim: 6 },
  },
  // Captured by hand from Chrome, because the viewer needs the extension really
  // installed: rendering it headless gets the toolbar up and the page canvases
  // instantiated, but they come out blank. Nothing to compose — it is already a
  // full window — so this one is only resized.
  // Padded, not cropped: the window is wider than 16:10, and cropping to cover
  // cut the right of the viewer's own toolbar off — losing "Open original",
  // which is the control that says the reader can always get back to the
  // publisher's text. #525659 is the viewer's page gutter, so the padding is
  // invisible.
  {
    name: '03-pdf-viewer.png',
    w: 1280,
    h: 800,
    source: 'pdf-converted.png',
    fit: 'contain',
    background: '#525659',
  },
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

/**
 * Lay a real popup capture over a page capture, with a soft shadow so it reads
 * as floating above the page rather than pasted into it.
 *
 * No fake browser chrome is drawn. Inventing a toolbar for the popup to hang
 * from would look more convincing and would be imitating Chrome's own UI, which
 * is not something a store listing should do.
 */
async function composite(background, spec) {
  const sharp = require(SHARP);
  const overlayPath = path.join(OUT, spec.overlay.file);
  if (!fs.existsSync(overlayPath)) {
    console.warn(`  ! ${spec.overlay.file} not found — leaving the page uncomposited`);
    return background;
  }

  // Trim any page that bled in around a dialog capture, then scale if asked.
  let pipeline = sharp(overlayPath);
  if (spec.overlay.trim) {
    const m = await pipeline.metadata();
    const t = spec.overlay.trim;
    pipeline = sharp(await pipeline
      .extract({ left: t, top: t, width: m.width - t * 2, height: m.height - t * 2 })
      .png().toBuffer());
  }
  if (spec.overlay.height) {
    pipeline = sharp(await pipeline.resize({ height: spec.overlay.height }).png().toBuffer());
  }

  const popup = pipeline;
  const { width, height } = await popup.metadata();
  const left = spec.overlay.center
    ? Math.round((spec.w - width) / 2)
    : spec.w - width - spec.overlay.marginRight;
  const top = spec.overlay.center
    ? Math.round((spec.h - height) / 2)
    : spec.overlay.top;

  // Two pipelines, and it has to be two.
  //
  // sharp applies operations in ITS order, not the order they are called, and
  // composite runs near the end — after blur. So `.composite(...).blur()` blurs
  // the empty canvas and then pastes a hard-edged rectangle on top, which is
  // exactly the grey band this went through three attempts to remove. Realising
  // the composite to a buffer first, then blurring that, is what actually
  // feathers it. The transparent margin is still needed: a blur has to have
  // somewhere to bleed into.
  const pad = 40;
  const slab = await sharp({
    create: { width, height, channels: 4, background: { r: 24, g: 24, b: 27, alpha: 0.30 } },
  }).png().toBuffer();
  const flat = await sharp({
    create: {
      width: width + pad * 2,
      height: height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: slab, left: pad, top: pad }])
    .png()
    .toBuffer();
  const shadow = await sharp(flat).blur(18).png().toBuffer();

  return sharp(background)
    .composite([
      { input: shadow, left: left - pad, top: top - pad + 14 },
      { input: await popup.png().toBuffer(), left, top },
    ])
    .png()
    .toBuffer();
}

/** Resize an already-captured file to the store size, no browser involved. */
async function fromFile(spec) {
  const sharp = require(SHARP);
  const src = path.join(OUT, spec.source);
  if (!fs.existsSync(src)) {
    console.warn(`  ! ${spec.source} not found — skipping ${spec.name}`);
    return;
  }
  const before = await sharp(src).metadata();
  const buffer = await sharp(src)
    .resize(spec.w, spec.h, {
      fit: spec.fit ?? 'cover',
      position: 'top',
      background: spec.background ?? '#ffffff',
    })
    .png()
    .toBuffer();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, spec.name), buffer);
  console.log(`  ${spec.name.padEnd(22)} ${before.width}x${before.height} -> ${spec.w}x${spec.h}  (from ${spec.source})`);
}

async function shoot(spec) {
  if (spec.source) return fromFile(spec);
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

  if (spec.overlay) {
    buffer = await composite(buffer, spec);
    note += ' + ' + spec.overlay.file;
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
