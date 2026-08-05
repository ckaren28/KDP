import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import rehypeImageGrid from './src/rehype/image-grid.js';

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    mdx({ rehypePlugins: [rehypeImageGrid] }),
  ],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp'
    }
  },
  vite: {
    // html-to-image is only ever pulled in by a dynamic import (the "print"
    // easter egg). Without pre-bundling it, Vite discovers it late in dev,
    // re-optimises, and the already-resolved chunk URL 404s — which is the
    // "Failed to fetch dynamically imported module" error.
    optimizeDeps: { include: ['html-to-image'] }
  }
});