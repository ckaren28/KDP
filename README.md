# karendettmar.com

Portfolio site for Karen Dettmar, Creative Technologist and Fashion Designer 
based in New York City.

## Live site

[karendettmar.com](https://karendettmar.com)

## Tech stack

- Astro
- TypeScript
- MDX (case study content)
- Netlify (hosting + serverless functions)
- CSS custom properties (design tokens)

## Project case studies

Case studies live as MDX files in /src/content/projects/. Each file is 
the source of truth for that project page on the site.

To add a new case study: create a new .mdx file in /src/content/projects/ 
following the schema in /src/content/config.ts.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment variables
