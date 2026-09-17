/**
 * Guards the generated PDF against two regressions:
 *
 * 1. Margins. Chromium honours the `@page` margin from src/styles/print.css in
 *    preference to the `margin` option passed to page.pdf(). Overriding that
 *    rule at print time silently produces a PDF with content running to the
 *    paper edge, which is easy to miss because the page count improves.
 * 2. Screen-only copy. Anything marked `screenOnly` in the data must stay on the
 *    web page and out of the printed CV.
 * 3. The link back to the live site, which a printed CV needs in order to be
 *    useful on paper.
 */
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const FILE = process.argv[2] ?? 'dist/cv.pdf';
const PT_PER_MM = 72 / 25.4;

/** Body text must clear each edge by at least this much. */
const MIN_SIDE_MM = 10;
const MIN_TOP_MM = 10;
/** The page-number footer legitimately sits inside the bottom margin. */
const MIN_BOTTOM_MM = 4;

const data = new Uint8Array(readFileSync(FILE));
const doc = await getDocument({ data, useSystemFonts: false }).promise;

const mm = (pt) => pt / PT_PER_MM;
const failures = [];

for (let n = 1; n <= doc.numPages; n += 1) {
  const page = await doc.getPage(n);
  const view = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    if (!item.str?.trim()) continue;
    const [, , , , x, y] = item.transform;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + (item.width ?? 0));
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + (item.height ?? 0));
  }

  if (!Number.isFinite(minX)) continue;

  const edges = {
    left: mm(minX),
    right: mm(view.width - maxX),
    top: mm(view.height - maxY),
    bottom: mm(minY),
  };

  const limits = {
    left: MIN_SIDE_MM,
    right: MIN_SIDE_MM,
    top: MIN_TOP_MM,
    bottom: MIN_BOTTOM_MM,
  };

  const report = Object.entries(edges)
    .map(([edge, value]) => `${edge} ${value.toFixed(1)}mm`)
    .join('  ');
  console.log(`  page ${n}: ${report}`);

  for (const [edge, value] of Object.entries(edges)) {
    if (value < limits[edge]) {
      failures.push(
        `page ${n}: ${edge} margin is ${value.toFixed(1)}mm, expected at least ${limits[edge]}mm`,
      );
    }
  }
}

if (failures.length) {
  console.error(`\n${FILE} has margin problems:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\nMargins come from the @page rule in src/styles/print.css. Check that nothing ' +
      'overrides it at print time in scripts/generate-pdf.mjs.',
  );
  process.exit(1);
}

/* ------------------------------------------------ screen-only copy leaks -- */

/** Whitespace differs between the DOM and extracted PDF text, so ignore it. */
const squash = (value) => value.replace(/\s+/g, '').toLowerCase();

let manifest;
try {
  manifest = JSON.parse(readFileSync('.pdf-check.json', 'utf8'));
} catch {
  console.log('\nNo .pdf-check.json found; skipping the screen-only check.');
}

if (manifest?.screenOnly?.length) {
  let pdfText = '';
  for (let n = 1; n <= doc.numPages; n += 1) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pdfText += items.map((item) => item.str).join(' ');
  }
  pdfText = squash(pdfText);

  const leaked = manifest.screenOnly.filter((entry) => {
    const needle = squash(entry).slice(0, 60);
    return needle.length > 20 && pdfText.includes(needle);
  });

  if (leaked.length) {
    console.error('\nCopy marked screen-only leaked into the PDF:');
    for (const entry of leaked) console.error(`  - ${entry.slice(0, 80)}...`);
    console.error(
      '\nCheck the [data-screen-only] rule in src/styles/print.css still applies.',
    );
    process.exit(1);
  }

  console.log(
    `  ${manifest.screenOnly.length} screen-only block(s) correctly excluded from print.`,
  );
}

/* ------------------------------------------------------ link back to site -- */

if (manifest?.expectedLink) {
  const links = new Set();
  for (let n = 1; n <= doc.numPages; n += 1) {
    for (const annotation of await (await doc.getPage(n)).getAnnotations()) {
      if (annotation.url) links.add(annotation.url);
    }
  }

  const found = [...links].some((url) => url.startsWith(manifest.expectedLink));
  if (!found) {
    console.error(
      `\nThe PDF does not link back to ${manifest.expectedLink}. ` +
        'A printed CV should point at the live version.',
    );
    process.exit(1);
  }

  console.log(`  links back to ${manifest.expectedLink}`);
}

console.log(`\n${FILE}: ${doc.numPages} pages, margins OK.`);
