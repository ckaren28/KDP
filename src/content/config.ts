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
    // One line under the title on the work grid.
    subtitle: z.string().optional(),
    track: z.literal('tech'),
    tags: z.array(z.string()),
    date: z.date(),
    coverImage: z.string().optional(),
    // Off keeps the project out of the work grid while leaving its page live at
    // /projects/<slug>. DevCon uses this: it is a talk rather than a made thing,
    // so it doesn't belong beside the tools, but the write-up is worth keeping.
    listed: z.boolean().optional().default(true),
    // Surfaced by the landing page's letter-pull reveal. If more than one is
    // set, the most recent wins; if none is, the most recent project is used.
    featured: z.boolean().optional().default(false),
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
    // Lift the tool out of the tabs to sit directly under the page header.
    // With this on there is no "Try it" tab — the tool is the page.
    tool_on_top: z.boolean().optional().default(false),
    // Process tab (any images present → tab renders)
    process_images: z.array(imageItem).optional(),
    // Results tab (any images present → tab renders)
    results_images: z.array(imageItem).optional(),
  }),
});

// Employment history, shown as the third section of the work page beneath the
// tools and experiments.
//
// The shape is deliberate. Karen is leaving developer advocacy for design
// engineering, and plain reverse chronology would open this section with two
// "Developer Advocate" headings — reinforcing the role she is moving away from.
// So `headline` leads each card with the work itself and `role` is demoted to
// metadata beside the dates. Her first three jobs were design and front-end, so
// read this way the section tells a return story rather than a pivot.
//
// `result` is the quantified outcome, which she has for every job. That is
// rarer than screenshots and does more work here, so it is required while
// artifacts are optional — several roles are internal or NDA'd and have none.
const experience = defineCollection({
  schema: z.object({
    company: z.string(),
    role: z.string(),
    location: z.string(),
    start_date: z.date(),
    // Omitted for the current role, which renders as "Present".
    end_date: z.date().optional(),
    // Leads the card. Describe the work, not the job title.
    headline: z.string(),
    // The quantified outcome. The headline number of the card.
    result: z.string(),
    summary: z.string(),
    // Secondary things worth listing under the headline work. Keep it to two,
    // chosen — an exhaustive list reads as a CV bleeding into a portfolio.
    also: z.array(z.string()).optional(),
    // Optional by design: internal or NDA'd work legitimately has nothing to
    // show, and saying so is better than padding the card.
    artifacts: z.array(imageItem).optional(),
    // Set when the work shown was never shipped, so the card can say so
    // outright rather than implying it went live.
    unshipped: z.boolean().optional().default(false),
    // The work is internal and can't be shown. This states that outright rather
    // than leaving a card that looks like it forgot its images — to a hiring
    // manager "internal, happy to discuss" reads as discretion, not a gap.
    nda: z.boolean().optional().default(false),
    // Drops the entry to a single line beneath the cards and builds no detail
    // page. For roles with a real result but nothing to show, where a full card
    // would be padding. Uneven depth reads as editorial judgement; five equal
    // cards where two are thin reads as filler.
    compact: z.boolean().optional().default(false),
    live_url: z.string().optional(),
    // Ascending. Controls section order independently of dates.
    order: z.number(),
  }),
});

export const collections = { projects, experience };
