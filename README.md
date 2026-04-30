# karendettmar.com

Portfolio site for Karen Dettmar, Creative Technologist and Fashion Designer
based in New York City — [karendettmar.com](https://karendettmar.com)

Built with Astro, TypeScript, and MDX. Deployed to Netlify.

## Stack

- **Astro** — static site generator with MDX content collections
- **TypeScript** — all client-side scripts
- **CSS Modules** — scoped per-component styles with design tokens
- **Netlify** — hosting and serverless functions
- **Netlify CMS** (legacy config present) — content authoring

## Structure

```
src/
  components/        # Reusable Astro components
    tools/           # Interactive tool components + client-side .ts modules
      silhouettes/   # SVG garment silhouettes (design-token fills, anchor circles)
  content/           # MDX content collections (projects, illustrations)
  pages/             # File-based routing
    projects/        # Project detail pages with CSS Modules
  layouts/           # Page shell layouts
  styles/            # Global CSS and design tokens

netlify/functions/   # Serverless API handlers (Claude API calls)
public/              # Static assets (images, fonts)
```

## Tool components

Each tool in `src/components/tools/` pairs an `.astro` file with extracted `.ts` modules:

- **GarmentDecoderTool** — garment construction analysis via Claude API
  - `garmentDecoder.ts` — form logic, API call, DOM rendering
  - `garmentAnnotations.ts` — SVG silhouette selection and annotation overlay
  - `garmentImageUpload.ts` — image upload state and drag-and-drop
- **MuseumLabelTool** — generates museum-style artwork labels
- **TextilePatternGenerator** — generative canvas-based textile patterns

## SVG silhouettes

`src/components/tools/silhouettes/` contains garment outline SVGs. Conventions:
- All fills use CSS custom properties (`var(--black)`, `var(--muted)`, `var(--border)`, `var(--off-white)`)
- No hardcoded hex colors or gradient defs
- Annotation anchor points: `<circle id="ap-{name}" cx="…" cy="…" r="2" fill="none"/>` directly in a `<g id="ap-">` group

## Project case studies

Case studies live as MDX files in `/src/content/projects/`. Each file is
the source of truth for that project page on the site.

To add a new case study: create a new `.mdx` file in `/src/content/projects/`
following the schema in `/src/content/config.ts`.

## Local development

```bash
npm install
cp .env.example .env
netlify dev        # runs Astro + Netlify functions together
# or
npm run dev        # Astro only (tool API calls will 404)
```

Build:

```bash
npm run build
```

## Environment variables
