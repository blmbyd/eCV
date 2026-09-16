/**
 * Guards the generated PDF against margin regressions.
 *
 * Chromium honours the `@page` margin from src/styles/print.css in preference
 * to the `margin` option passed to page.pdf(). Overriding that rule at print
 * time silently produces a PDF with content running to the paper edge, which is
 * easy to miss because the page count improves. This check fails the build if
 * that happens again.
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

console.log(`\n${FILE}: ${doc.numPages} pages, margins OK.`);
