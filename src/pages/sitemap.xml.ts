import { getCollection } from 'astro:content';

// Written by hand rather than with @astrojs/sitemap so it adds no dependency,
// and so what it leaves out is explicit. Left out: the experience pages, which
// are password protected and noindexed; /admin/; and the tag listings, which
// only repeat the work page.
const SITE = 'https://karendettmar.com';

export async function GET() {
  const projects = (await getCollection('projects')).map(
    (p) => `/projects/${p.id.replace(/\.mdx?$/, '')}/`,
  );
  const paths = ['/', '/projects/tech/', '/about/', '/cv/', '/system/', ...projects];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
