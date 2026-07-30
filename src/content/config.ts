import { defineCollection, z } from 'astro:content';

const outputRow = z.object({
  field: z.string(),
  what_it_solves: z.string(),
});

const designDecision = z.object({
  title: z.string(),
  body: z.string(),
});

const imageItem = z.object({
  image: z.string(),
  caption: z.string().optional(),
});

const projects = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    track: z.literal('tech'),
    tags: z.array(z.string()),
    date: z.date(),
    coverImage: z.string().optional(),
    live_url: z.string().optional(),
    github_url: z.string().optional(),
    password_protected: z.boolean().optional().default(false),
    hero_image: z.string().optional(),
    // ── Tabbed case study layout fields ──
    // Overview tab
    problem_statement: z.string().optional(),
    who_its_for: z.string().optional(),
    why_i_built_it: z.string().optional(),
    scope_constraints: z.string().optional(),
    // How it works tab (any one present → tab renders)
    architecture_diagram: z.string().optional(),
    output_structure: z.array(outputRow).optional(),
    sample_output: z.string().optional(),
    design_decisions: z.array(designDecision).optional(),
    // Try it tab
    live_embed_url: z.string().optional(),
    live_embed_note: z.string().optional(),
    // Process tab (any images present → tab renders)
    process_images: z.array(imageItem).optional(),
    // Results tab (any images present → tab renders)
    results_images: z.array(imageItem).optional(),
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
