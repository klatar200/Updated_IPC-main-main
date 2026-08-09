/**
 * PLAN-7 item 2 — re-encode the marketing photographs at their measured paint
 * size, from the `febc0b7` ORIGINALS.
 *
 * 4.32 re-encoded every image with a 1000px cap on the long edge. That was
 * correct for a file painted nowhere — there is no paint size to target, so
 * the pipeline used a blanket bound. The moment a file is painted the bound
 * becomes a constraint, and it is free to undo: the originals are intact in
 * git history and nothing needs to be shot or upscaled.
 *
 * 4.32's rules, unchanged:
 *   - PSNR-scored against the original AT THE OUTPUT RESOLUTION
 *   - 38 dB floor for a painted photograph
 *   - NO CROP, NO RETOUCH, NO RENAMED FILE. Any crop is done at render time
 *     with object-fit, which is also what lets the homepage band trim
 *     IPC-Building's baked-in white border.
 *   - "keep the original" is the fallback: if no quality setting clears the
 *     floor at a smaller byte count, the file is left alone.
 *
 * Needs sharp:  npm i --no-save sharp
 * Usage:        node _harness/imgopt-plan7.js [--dry]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'public', 'images', 'site');
const ORIGIN_REF = 'febc0b7';
const DRY = process.argv.includes('--dry');
const FLOOR_DB = 38;

/**
 * The width each file is actually PAINTED at, measured in the browser at 1440
 * (the widest any of them gets), not read off the plan's estimates.
 *
 * `want` is 2x that, the retina target. But a re-encode only happens if the
 * file on disk does not already cover its paint box adequately — see
 * MIN_DENSITY. Shipping more pixels than a screen can show is the same waste
 * 4.32 existed to remove, just in the other direction.
 */
const MIN_DENSITY = 1.5;
const TARGETS = [
  { file: 'Marker-Sample-2.jpg', paint: 584, why: 'hero right column at 1440' },
  { file: 'staff.jpg', paint: 845, why: 'homepage band, 2-col span at 1440' },
  { file: 'IPC-Building.jpg', paint: 411, why: 'homepage band, 1-col at 1440' },
];

/** The file as it was before 4.32 capped it. */
function original(file) {
  return execFileSync('git', ['show', `${ORIGIN_REF}:public/images/site/${file}`], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer',
  });
}

/** PSNR between two same-size RGB buffers. */
function psnr(a, b) {
  if (a.length !== b.length) throw new Error(`psnr size mismatch ${a.length} vs ${b.length}`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  const mse = sum / a.length;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

(async () => {
  console.log(`re-encoding from ${ORIGIN_REF} originals${DRY ? '  (DRY RUN)' : ''}\n`);
  let before = 0, after = 0;

  for (const t of TARGETS) {
    const cur = path.join(DIR, t.file);
    const curBytes = fs.statSync(cur).size;
    before += curBytes;

    const orig = original(t.file);
    const om = await sharp(orig).metadata();
    const ext = path.extname(t.file).toLowerCase();
    const cm = await sharp(fs.readFileSync(cur)).metadata();

    // Does the file already cover its paint box? Two ceilings apply: the
    // source cannot be exceeded, and buying density the eye cannot resolve is
    // waste. Reported either way so the decision is legible.
    const curDensity = cm.width / t.paint;
    const srcDensity = om.width / t.paint;
    const wantDensity = Math.min(2, srcDensity);
    if (curDensity >= Math.min(MIN_DENSITY, srcDensity)) {
      console.log(
        `  ${t.file.padEnd(22)} KEPT — ${cm.width}px covers a ${t.paint}px box at ` +
        `${curDensity.toFixed(2)}x (source ceiling ${srcDensity.toFixed(2)}x)   (${t.why})`
      );
      after += curBytes;
      continue;
    }

    // Never upscale past the source. No crop: height follows the aspect.
    const width = Math.min(Math.round(t.paint * wantDensity), om.width);
    const pipeline = () => sharp(orig).resize({ width, withoutEnlargement: true, fit: 'inside' });

    // The reference for PSNR is the ORIGINAL resampled to the output size —
    // scoring against the full-resolution original would measure the resize,
    // not the compression.
    const refRaw = await pipeline().removeAlpha().raw().toBuffer();

    // Search quality AND chroma subsampling, and keep the SMALLEST encode that
    // still clears the floor — not merely the lowest quality. 4:2:0 halves the
    // chroma resolution, which on a photograph is usually invisible and much
    // cheaper, but on this set one file is a photo OF PRINTED TEXT where
    // coloured edges are the subject. Measured rather than assumed: whichever
    // combination is smallest at >= 38 dB wins.
    let best = null;
    const consider = (buf, q, db, chroma) => {
      if (db < FLOOR_DB) return;
      if (!best || buf.length < best.buf.length) best = { buf, q, db, chroma };
    };
    for (const chroma of ['4:2:0', '4:4:4']) {
      for (const q of [92, 88, 84, 80, 76, 72]) {
        const out = ext === '.png'
          ? await pipeline().png({ quality: q, compressionLevel: 9, palette: true }).toBuffer()
          : await pipeline().jpeg({ quality: q, mozjpeg: true, chromaSubsampling: chroma }).toBuffer();
        const raw = await sharp(out).removeAlpha().raw().toBuffer();
        const db = psnr(refRaw, raw);
        consider(out, q, db, chroma);
        if (db < FLOOR_DB) break;   // quality only falls from here
        if (ext === '.png') break;  // chroma is meaningless for png
      }
      if (ext === '.png') break;
    }

    const meta = await sharp(await pipeline().toBuffer()).metadata();
    if (!best) {
      console.log(`  ${t.file.padEnd(22)} KEPT — nothing cleared the ${FLOOR_DB} dB floor`);
      after += curBytes;
      continue;
    }
    if (best.buf.length >= curBytes && meta.width <= om.width && curBytes > 0 && width <= (await sharp(fs.readFileSync(cur)).metadata()).width) {
      console.log(`  ${t.file.padEnd(22)} KEPT — re-encode is not smaller and adds no pixels`);
      after += curBytes;
      continue;
    }

    console.log(
      `  ${t.file.padEnd(22)} ${om.width}x${om.height} -> ${meta.width}x${meta.height}  ` +
      `q${best.q}${best.chroma ? ' ' + best.chroma : ''}  ${best.db === Infinity ? 'lossless' : best.db.toFixed(1) + ' dB'}  ` +
      `${(curBytes / 1024).toFixed(0)} -> ${(best.buf.length / 1024).toFixed(0)} KB   (${t.why})`
    );
    after += best.buf.length;
    if (!DRY) fs.writeFileSync(cur, best.buf);
  }

  console.log(`\ntotal for these ${TARGETS.length}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
  const all = fs.readdirSync(DIR).reduce((n, f) => n + fs.statSync(path.join(DIR, f)).size, 0);
  console.log(`public/images/site/ total: ${(all / 1024).toFixed(0)} KB across ${fs.readdirSync(DIR).length} files`);
})();
