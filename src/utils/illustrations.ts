// The illustrations collection is intentionally empty until the gallery is
// populated. Calling getCollection('illustrations') on an empty collection makes
// Astro log "The collection ... does not exist or is empty" once per built page,
// which buries real build output.
//
// Callers that only need to know *whether* illustrations exist (nav gating, the
// /illustrations redirect) can use this instead: import.meta.glob resolves at
// build time and stays silent when nothing matches. Drop an .md/.mdx file into
// src/content/illustrations/ and the nav link and gallery appear automatically.
const entries = import.meta.glob('/src/content/illustrations/**/*.{md,mdx}');

export const hasIllustrations = Object.keys(entries).length > 0;
