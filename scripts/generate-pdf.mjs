/**
 * Renders the built site to a print-quality PDF and an Open Graph image.
 *
 * Runs after `astro build`. Serves `dist/` from a minimal static server so the
 * configured base path resolves exactly as it will on GitHub Pages, then drives
 * Chromium over it.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import astroConfig from '../astro.config.mjs';

const ROOT = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const BASE = (astroConfig.base ?? '/').replace(/\/$/, '');
const PORT = Number(process.env.PDF_PORT ?? 4327);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

async function resolveFile(pathname) {
  let relative = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  relative = relative.replace(/^\/+/, '');

  const candidates = relative.endsWith('/') || relative === ''
    ? [path.join(relative, 'index.html')]
    : [relative, path.join(relative, 'index.html'), `${relative}.html`];

  for (const candidate of candidates) {
    const absolute = path.join(DIST, candidate);
    // Refuse anything that escapes dist via ".." segments.
    if (!absolute.startsWith(DIST)) continue;
    try {
      const info = await stat(absolute);
      if (info.isFile()) return absolute;
    } catch {
      /* Try the next candidate. */
    }
  }

  return null;
}

function startServer() {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const file = await resolveFile(decodeURIComponent(pathname));

    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end(`Not found: ${pathname}`);
      return;
    }

    response.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(file));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  try {
    await stat(path.join(DIST, 'index.html'));
  } catch {
    throw new Error('dist/index.html is missing. Run `npm run build` first.');
  }

  await mkdir(DIST, { recursive: true });

  const server = await startServer();
  const origin = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();

  try {
    /* ---------------------------------------------------------- CV PDF -- */
    const page = await browser.newPage();
    // `?theme=light` is honoured by the inline theme script in the layout.
    await page.goto(`${origin}${BASE}/?theme=light`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });

    // Capture the copy that is marked screen-only so the PDF check can assert
    // none of it leaked into the printed file.
    const screenOnly = await page.$$eval('[data-screen-only]', (nodes) =>
      nodes.map((node) => node.textContent?.trim() ?? '').filter(Boolean),
    );
    await writeFile(
      path.join(ROOT, '.pdf-check.json'),
      JSON.stringify({ screenOnly }, null, 2),
    );

    await page.pdf({
      path: path.join(DIST, 'cv.pdf'),
      format: 'A4',
      printBackground: true,
      // Page margins come from the @page rule in src/styles/print.css, which
      // Chromium honours in preference to the `margin` option below. Change the
      // margins there, not here.
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;padding:0 13mm;font-family:Arial,Helvetica,sans-serif;
                    font-size:7pt;color:#6b6b6b;display:flex;justify-content:space-between;">
          <span>Paweł Stuczyński — Curriculum Vitae</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
    console.log('  dist/cv.pdf');

    /* -------------------------------------------------- Open Graph card -- */
    const ogPage = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await ogPage.goto(`${origin}${BASE}/og`, { waitUntil: 'networkidle' });
    await ogPage.evaluate(() => document.fonts.ready);
    await ogPage.locator('[data-og-card]').screenshot({ path: path.join(DIST, 'og.png') });
    console.log('  dist/og.png');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
