import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    track: z.enum(['tech', 'fashion', 'textiles']),
    tags: z.array(z.string()),
    date: z.date(),
    live_url: z.string().optional(),
    github_url: z.string().optional(),
    password_protected: z.boolean().optional().default(false),
  }),
});

const illustrations = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    image: z.string(),
    tags: z.array(z.string()),
    description: z.string().optional(),
  }),
});

export const collections = { projects, illustrations };
