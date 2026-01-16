import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    coverImage: z.string(),
    tags: z.array(z.string()),
    featured: z.boolean().optional(),
  }),
});

const illustrations = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    image: z.string(),
    tags: z.array(z.string()),
    description: z.string().optional(), // Add optional description
  }),
});

export const collections = { projects, illustrations };