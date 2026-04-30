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
    track: z.enum(['tech', 'fashion', 'textiles']),
    tags: z.array(z.string()),
    date: z.date(),
    coverImage: z.string().optional(),
    live_url: z.string().optional(),
    github_url: z.string().optional(),
    password_protected: z.boolean().optional().default(false),
    // Textiles hub fields — to add a new filter category:
    //   1. extend this enum
    //   2. add the label to textiles.mdx `tags` frontmatter
    //   3. add the option to public/admin/config.yml textile_category widget
    textile_category: z.enum(['dyeing', 'printing', 'fiber']).optional(),
    hero_image: z.string().optional(),
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
