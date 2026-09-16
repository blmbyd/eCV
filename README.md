# eCV — public CV of Paweł Stuczyński

A static CV site published to GitHub Pages, with a matching print stylesheet and a
build-generated PDF.

**Live:** https://blmbyd.github.io/eCV
**PDF:** https://blmbyd.github.io/eCV/cv.pdf

---

## How it works

All CV content lives in typed YAML files under `src/data/`. Nothing is hardcoded in the
markup, so updating the CV means editing data, not components. Every file is validated
against a Zod schema at build time — a typo in a date or a missing field fails the build
with a readable message instead of shipping a broken page.

```
src/data/profile.yaml          name, contact, summary, links
src/data/experience.yaml       every role, its highlights and its tech stack
src/data/skills.yaml           grouped skills plus the three "top skills"
src/data/certifications.yaml   certifications by issuer, plus courses
src/data/education.yaml        degrees and languages
src/data/community.yaml        talks, podcasts, writing and open source
src/data/interests.yaml        the "Beyond the desk" cards
```

Derived values are computed, never typed by hand: years in engineering, role durations,
organisation counts, certification counts, the rolling twelve-month contribution count and
the career elevation profile all come from the data above. They cannot drift.

## Local development

```bash
npm install
npm run dev          # http://localhost:4321/eCV
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload, including on YAML edits |
| `npm run build` | Static build into `dist/` |
| `npm run pdf` | Renders `dist/cv.pdf` and `dist/og.png` from the build |
| `npm run build:full` | `build` followed by `pdf` |
| `npm run check` | Astro and TypeScript diagnostics |

`npm run pdf` needs Chromium once: `npx playwright install chromium`.

## Editing the CV

1. Edit the relevant file in `src/data/`.
2. Run `npm run dev` and check it.
3. Commit to `main`. The deploy workflow rebuilds the site and the PDF.

Useful details:

- `end: null` on a role means "present" and renders a Current badge.
- `track: parallel` puts a role in the independent-practice lane rather than on the main
  ridge of the elevation profile.
- `featured: false` renders a role as a compact single line under "Earlier roles".
- `scope` (1-10) is the vertical axis of the elevation profile — breadth of
  responsibility, not salary.
- `chartLabel` overrides the elevation-profile label where horizontal room is tight.

In `community.yaml`:

- `type` is one of `talk`, `video`, `writing` or `community`, and decides the group.
- `date: null` means ongoing. Those entries render as "Ongoing" and are left out of the
  rolling twelve-month count in the stats strip.
- `url: null` renders the title unlinked, for things with no public link.
- `lang` marks a title that is not in English, for example `lang: uk`.

## The PDF

Two independent paths, both rendered from the same source:

1. **Print this page** calls the browser print dialog. `src/styles/print.css` forces the
   light palette regardless of the active theme, drops decoration and navigation, and
   sets A4 page geometry.
2. **Download PDF** serves `cv.pdf`, generated during the build by
   `scripts/generate-pdf.mjs`. It serves `dist/` over a minimal local static server so
   the base path resolves exactly as it does on Pages, drives Chromium in print emulation
   at `/?theme=light`, and writes the file with page numbers in the footer. The same
   script screenshots `/og` into `og.png` for social previews.

## Theming

Dark "night forest" is the default. A toggle in the header switches to light "day trail"
and persists the choice in `localStorage`. An inline script in `<head>` applies the theme
before first paint, so there is no flash.

`?theme=light` or `?theme=dark` forces a theme via the URL, which is what the PDF
generator uses.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: build, render the PDF and OG
image into `dist/`, then publish via GitHub Pages.

> **One-time setup:** in the repository settings, set **Pages → Build and deployment →
> Source** to **GitHub Actions**. Until that is done the workflow will run but nothing
> will publish.

`.github/workflows/ci.yml` builds and type-checks pull requests without deploying, and
attaches the rendered PDF as an artifact so changes can be reviewed before merging.

## Moving to a custom domain

1. Create `public/CNAME` containing the domain, e.g. `cv.stuczynski.eu`.
2. In `astro.config.mjs`, set `site` to `https://cv.stuczynski.eu` and delete the `base`
   line.
3. Update the `Sitemap:` URL in `public/robots.txt`.
4. Add a DNS `CNAME` record for `cv` pointing at `blmbyd.github.io`.
5. In the repository's Pages settings, enter the domain and enable **Enforce HTTPS**.

## Privacy

This page is public and crawlable, so it deliberately carries only city-level location,
an email address and public profile links. Street address, phone number, date of birth and
photographs are not in this repository and should not be added.

## Stack

Astro, TypeScript, Zod-validated YAML, self-hosted variable fonts via Fontsource, and
Playwright for PDF and image rendering. No client-side framework; the only JavaScript
shipped is the theme toggle, the print button and the elevation-profile highlighting.
