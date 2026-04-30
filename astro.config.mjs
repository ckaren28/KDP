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
  }
});