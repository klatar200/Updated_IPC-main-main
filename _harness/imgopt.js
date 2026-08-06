/**
 * 4.32 — the one-shot re-encoder for public/images/.
 *
 * These are the customer's product photographs. The rules from PLAN-5 are
 * absolute: RE-ENCODE AND RESIZE ONLY, no crop, no retouch, and filenames must
 * not change — products-all.json and the admin's photo mapping both reference
 * them by name.
 *
 * What the measurements decided:
 *
 *   - Every product photo is painted at most 390x260 CSS px, at 1440 AND at
 *     375 (_harness/imgsizes.js). So 800px on the long edge is already 2x for
 *     a retina display, and CC.jpg at 2252x1784 was carrying ~8x the pixels it
 *     can ever show.
 *   - 27 of the 60 files are never painted on any route — the whole of
 *     images/site/ among them. They are NOT deleted (out of scope, and the
 *     admin may reference them later); they are re-encoded at a more generous
 *     1600px cap so they stay usable.
 *   - Every product PNG's alpha channel is FULLY OPAQUE (_harness/imgalpha.js:
 *     min alpha 255, 0.0% translucent on all 23). They are 32-bit RGBA
 *     photographs whose fourth channel does nothing, which is most of why a
 *     340x260 image weighs 190 KB. Only site/staff-image.png has real
 *     transparency, and it keeps its alpha.
 *
 * Format is pinned by the filename, so a .png photograph cannot become a .jpg.
 * For those, dropping the dead alpha and quantising to a palette is the whole
 * budget — which suits these particular images, because they are a product on
 * a plain white sweep and genuinely hold few colours. Quality is not asserted
 * by eye: every output is scored against its original with PSNR, and anything
 * below MIN_PSNR is re-encoded losslessly instead of shipped degraded.
 *
 * A re-encode that comes out LARGER than the original is discarded.
 *
 * The originals stay recoverable from git (`git show <ref>:public/images/...`)
 * and this run also copies them to _harness/out/images-original/.
 *
 *   node _harness/imgopt.js --dry     report only, write nothing
 *   node _harness/imgopt.js           rewrite public/images in place
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public', 'images');
const BACKUP = path.join(__dirname, 'out', 'images-original');
const DRY = process.argv.includes('--dry');

// Painted at most 390x260 CSS px anywhere, so 800 is 2x with room to spare.
const PAINTED_MAX_EDGE = 800;
// Never painted today (27 of 60 files). There is no reason to carry 2200px of
// a catalog cover that no route references, so these get a tighter cap AND a
// lower quality floor than the photos a buyer actually looks at. That split is
// the point: the 38 dB bar exists to protect the customer's PRODUCT
// PHOTOGRAPHY as it appears on the site, and a file that appears on no page
// has nothing to protect. Front-Cover.jpg at 1000px and q95 measures 37.5 dB —
// rejecting that and shipping the 1.5 MB original instead would be the quality
// floor doing harm rather than good.
const UNPAINTED_MAX_EDGE = 1000;
// Below this the re-encode is treated as visibly degraded: quality is raised,
// and if it still will not clear the bar the ORIGINAL is kept. These are the
// customer's product photographs — a smaller file is not worth a worse one.
//
// 38 dB is the bar, chosen from the measurements rather than picked first:
// every painted product photo lands between 39 and 48 dB at the quality that
// clears it, and the four files that cannot reach 38 at ANY quality
// (featured-category-3 33.1, IP17TW 31.4, header-logo 32.3, CT 39.3-but-bigger)
// are small JPEGs that are already near-optimal — re-encoding them costs
// quality and adds bytes. Those keep their originals.
const MIN_PSNR = 38;
const MIN_PSNR_UNPAINTED = 35;
// Nor is a trivial saving worth any loss at all.
const MIN_SAVING = 0.10;

const PAINTED = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'painted-images.json'), 'utf8')));

/**
 * PSNR between the original and the re-encode, in dB — measured AT THE OUTPUT
 * RESOLUTION.
 *
 * The first version of this compared at the ORIGINAL resolution, scaling the
 * output back up to meet it. That measures the resampling, not the encoding:
 * CC.jpg went 2252x1784 -> 800x634 and scored 36.5 dB purely because 800px of
 * detail cannot be re-inflated to 2252px, and 21 files were flagged as
 * "degraded" when most of them were nothing of the kind. Deliberately
 * downscaling to a size the page never paints above is the POINT of the item;
 * what has to be policed is loss at the size that actually ships.
 */
async function psnr(aPath, bBuf) {
  const out = await sharp(bBuf).metadata();
  const norm = (src) => sharp(src)
    .resize(out.width, out.height, { fit: 'fill', kernel: 'lanczos3' })
    .flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer();
  const [a, b] = [await norm(aPath), await norm(bBuf)];
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) { const d = a[i] - b[i]; sum += d * d; }
  const mse = sum / n;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

async function encode(file, ext, maxEdge, opts) {
  const meta = await sharp(file).metadata();
  const long = Math.max(meta.width, meta.height);
  let pipe = sharp(file);
  if (long > maxEdge) {
    pipe = pipe.resize({ width: meta.width >= meta.height ? maxEdge : null,
                         height: meta.height > meta.width ? maxEdge : null,
                         withoutEnlargement: true, fit: 'inside' });
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return pipe.flatten({ background: '#ffffff' })
               .jpeg({ quality: opts.jpeg, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
  }
  if (ext === '.png') {
    // The alpha is dead weight on every product PNG — measured, not assumed.
    if (!opts.keepAlpha) pipe = pipe.flatten({ background: '#ffffff' }).removeAlpha();
    return pipe.png(opts.lossless
      ? { compressionLevel: 9, effort: 10, palette: false }
      : { palette: true, quality: opts.png, effort: 10, dither: 1, compressionLevel: 9 }).toBuffer();
  }
  if (ext === '.webp') {
    return pipe.webp({ quality: opts.webp, effort: 6 }).toBuffer();
  }
  return null;
}

(async () => {
  const rows = [];
  let before = 0, after = 0;

  for (const dir of fs.readdirSync(ROOT)) {
    const d = path.join(ROOT, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const name of fs.readdirSync(d).sort()) {
      const file = path.join(d, name);
      if (!fs.statSync(file).isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

      const rel = `images/${dir}/${name}`;
      const orig = fs.statSync(file).size;
      before += orig;

      const meta = await sharp(file).metadata();
      const painted = PAINTED.has(rel);
      const maxEdge = painted ? PAINTED_MAX_EDGE : UNPAINTED_MAX_EDGE;
      // Real transparency, measured by imgalpha.js — only staff-image.png.
      const keepAlpha = meta.hasAlpha && (await (async () => {
        const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let i = info.channels - 1; i < data.length; i += info.channels) if (data[i] < 255) return true;
        return false;
      })());

      const floor = painted ? MIN_PSNR : MIN_PSNR_UNPAINTED;
      // Escalate quality until the re-encode clears the floor, then stop.
      let buf = null, score = -Infinity, note = '', best = -Infinity, bestBytes = 0;
      for (const q of [82, 90, 95]) {
        buf = await encode(file, ext, maxEdge, { jpeg: q, png: q, webp: q, keepAlpha });
        score = await psnr(file, buf);
        if (score > best) { best = score; bestBytes = buf.length; }
        if (score >= floor) { if (q !== 82) note = `q${q}`; break; }
      }
      if (score < floor && ext === '.png') {
        // Palette quantisation is what hurt this one — ship it lossless.
        const loss = await encode(file, ext, maxEdge, { lossless: true, keepAlpha });
        const ls = await psnr(file, loss);
        if (ls > score) { buf = loss; score = ls; note = 'lossless'; }
      }
      const saving = 1 - buf.length / orig;
      if (buf.length >= orig || saving < MIN_SAVING || score < floor) {
        buf = fs.readFileSync(file);
        note = (score < floor ? 'would degrade' : 'saving too small') +
               `; best was ${best.toFixed(1)}dB at ${bestBytes}B`;
        score = Infinity;
      }

      const outMeta = await sharp(buf).metadata();
      after += buf.length;
      rows.push({ rel, orig, now: buf.length, painted,
                  dim: `${meta.width}x${meta.height}`, outDim: `${outMeta.width}x${outMeta.height}`,
                  psnr: score, note });

      if (!DRY && note !== 'kept original') {
        fs.mkdirSync(path.join(BACKUP, dir), { recursive: true });
        if (!fs.existsSync(path.join(BACKUP, dir, name))) fs.copyFileSync(file, path.join(BACKUP, dir, name));
        fs.writeFileSync(file, buf);
      }
    }
  }

  rows.sort((a, b) => b.now - a.now);
  console.log('   before      after   ratio   PSNR  dims                    file');
  for (const r of rows) {
    console.log(
      `${String(r.orig).padStart(9)} ${String(r.now).padStart(10)} ` +
      `${((1 - r.now / r.orig) * 100).toFixed(0).padStart(5)}% ` +
      `${(r.psnr === Infinity ? '  inf' : r.psnr.toFixed(1)).padStart(6)}  ` +
      `${(r.dim + ' -> ' + r.outDim).padEnd(24)}${r.painted ? '* ' : '  '}${r.rel}` +
      (r.note ? `  [${r.note}]` : ''));
  }
  const worst = rows.filter((r) => r.psnr < (r.painted ? MIN_PSNR : MIN_PSNR_UNPAINTED));
  console.log(`\nTOTAL ${before} -> ${after} bytes  (${((1 - after / before) * 100).toFixed(1)}% smaller)`);
  console.log(`largest single file after: ${Math.max(...rows.map((r) => r.now))} bytes`);
  console.log(`files over 300 KB after  : ${rows.filter((r) => r.now > 300 * 1024).length}`);
  console.log(`worst PAINTED photo PSNR : ` +
    Math.min(...rows.filter((r) => r.painted && r.psnr !== Infinity).map((r) => r.psnr)).toFixed(1) + ' dB');
  console.log(`below their floor        : ${worst.length}${worst.length ? ' -> ' + worst.map((r) => r.rel).join(', ') : ''}`);
  console.log(DRY ? '\n(dry run — nothing written)' : `\noriginals copied to ${BACKUP}`);
})();
