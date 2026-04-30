import { defineCollection, z } from 'astro:content';

const colorSwatch = z.object({
  name: z.string(),
  hex: z.string(),
  note: z.string().optional(),
});

const look = z.object({
  title: z.string(),
  image: z.string(),
  caption: z.string().optional(),
});

const technicalFlat = z.object({
  image: z.string(),
  caption: z.string().optional(),
});

const materialItem = z.object({
  name: z.string(),
  note: z.string().optional(),
});

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
    // Fashion collection fields
    season: z.string().optional(),
    year: z.number().optional(),
    logo: z.string().optional(),
    collection_icon: z.string().optional(),
    background_color: z.string().optional(),
    color_palette: z.array(colorSwatch).optional(),
    looks: z.array(look).optional(),
    technical_flats: z.array(technicalFlat).optional(),
    fabric_notes: z.string().optional(),
    material_palette: z.array(materialItem).optional(),
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