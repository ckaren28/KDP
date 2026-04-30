export function init(): void {
  const $ = (id: string) => document.getElementById(id);

  const workshop      = $("mlg-workshop")      as HTMLInputElement    | null;
  const presetsWrap   = $("mlg-presets");
  const facilitator   = $("mlg-facilitator");
  const discussion    = $("mlg-discussion");
  const desc          = $("mlg-description")   as HTMLTextAreaElement | null;
  const btn           = $("mlg-generate")      as HTMLButtonElement   | null;
  const err           = $("mlg-error");
  const empty         = $("mlg-empty");
  const loading       = $("mlg-loading");
  const output        = $("mlg-output");
  const details       = $("mlg-details");
  const toggleDetails = $("mlg-toggle-details");
  const title         = $("mlg-title")         as HTMLInputElement    | null;
  const artist        = $("mlg-artist")        as HTMLInputElement    | null;
  const year          = $("mlg-year")          as HTMLInputElement    | null;
  const medium        = $("mlg-medium")        as HTMLInputElement    | null;
  const tone          = $("mlg-tone")          as HTMLSelectElement   | null;
  const stayClose     = $("mlg-stayclose")     as HTMLInputElement    | null;
  const sysBlock      = $("mlg-system");
  const userBlock     = $("mlg-user");

  const SYSTEM_PROMPT = `You are a museum interpretation assistant. Write clear, accurate interpretive text that respects artists and audiences.
Constraints:
- Do not invent facts. If information is missing, write around it or label as "Unknown".
- Avoid academic jargon unless requested.
- Be culturally sensitive; do not stereotype. Flag sensitive topics with care.
- Keep claims grounded in the provided description.
Return output as valid JSON only.`;

  const USER_TEMPLATE = `Artwork info:
- Title: {{title}}
- Artist: {{artist}}
- Year: {{year}}
- Medium/Materials: {{medium}}
- Description: {{description}}

Preferences:
- Tone: {{tone}}
- Grounding: {{stayCloseToSource}}

Return JSON with:
wall_label, extended_label, kids_label, audio_guide_script, alt_text, curator_notes, variations`;

  if (sysBlock) sysBlock.textContent = SYSTEM_PROMPT;
  if (userBlock) userBlock.textContent = USER_TEMPLATE;

  const presets: Record<string, { title: string; artist: string; year: string; medium: string; description: string }> = {
    abstract: {
      title: "Untitled (Blue Study)", artist: "Unknown", year: "Unknown", medium: "Acrylic on canvas",
      description: "A large canvas filled with layered blue forms that shift from sharp edges to soft gradients. Faint scraping and reworking marks are visible across the surface. The composition feels quiet but restless, as if the shapes are moving in and out of focus."
    },
    provenance: {
      title: "Ceremonial Mask", artist: "Unknown", year: "19th century (approx.)", medium: "Wood, pigment, fiber",
      description: "A carved mask with geometric patterning and traces of red and black pigment. The museum record notes it entered a private collection in the early 1900s before being donated decades later. Provenance details are incomplete, and the cultural context in the archive is minimal."
    },
    photo: {
      title: "Street Portrait", artist: "Unknown", year: "2018", medium: "Photograph",
      description: "A portrait of a person standing in bright sunlight on a city sidewalk. The background is softly blurred while the subject's clothing and posture read as calm and self-possessed. Strong contrast between light and shadow shapes the mood of the image."
    },
    textile: {
      title: "Coat", artist: "Cristóbal Balenciaga", year: "c. 1967", medium: "Wool gazar, fully lined silk",
      description: "A sculptural cocoon coat in double-faced wool gazar, cut away from the body with a single-seam construction at the back. The silhouette is architectural — volume held entirely by the fabric's weight and structure rather than darts or boning. The collar rises stiffly from the shoulders. Interior construction is immaculate: French seams, hand-stitched hem. Acquired from a private Paris collection; no alterations noted."
    }
  };

  function setPreset(p: { title: string; artist: string; year: string; medium: string; description: string }) {
    if (title)  title.value  = p.title;
    if (artist) artist.value = p.artist;
    if (year)   year.value   = p.year;
    if (medium) medium.value = p.medium;
    if (desc)   desc.value   = p.description;
    validate();
  }

  function validate() {
    if (btn) btn.disabled = (desc?.value || "").trim().length < 30;
  }
  desc?.addEventListener("input", validate);
  validate();

  workshop?.addEventListener("change", () => {
    const on = workshop.checked;
    if (presetsWrap) presetsWrap.style.display = on ? "block" : "none";
    if (facilitator) facilitator.style.display  = on ? "block" : "none";
    if (discussion)  discussion.style.display   = on ? "block" : "none";
    if (on && details) {
      details.style.display = "block";
      if (toggleDetails) toggleDetails.textContent = "Hide prompt & architecture";
    }
  });

  presetsWrap?.addEventListener("click", (e) => {
    const b = (e.target as Element).closest("button[data-preset]");
    if (!b) return;
    const p = presets[b.getAttribute("data-preset") || ""];
    if (p) setPreset(p);
  });

  toggleDetails?.addEventListener("click", () => {
    const hidden = details?.style.display === "none" || !details?.style.display;
    if (details) details.style.display = hidden ? "block" : "none";
    if (toggleDetails) toggleDetails.textContent = hidden ? "Hide prompt & architecture" : "Show prompt & architecture";
  });

  let lastData: Record<string, string> | null = null;
  document.addEventListener("click", (e) => {
    const copyBtn = (e.target as Element).closest("button[data-copy]");
    if (!copyBtn || !lastData) return;
    const key = copyBtn.getAttribute("data-copy") || "";
    navigator.clipboard.writeText(lastData[key] || "");
  });

  btn?.addEventListener("click", async () => {
    if (err)    { err.style.display    = "none"; err.textContent = ""; }
    if (empty)   empty.style.display   = "none";
    if (output)  output.style.display  = "none";
    if (loading) loading.style.display = "block";

    try {
      const resp = await fetch("/.netlify/functions/museum-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:             title?.value,
          artist:            artist?.value,
          year:              year?.value,
          medium:            medium?.value,
          description:       desc?.value,
          tone:              tone?.value,
          stayCloseToSource: stayClose?.checked
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed.");

      lastData = data;

      document.querySelectorAll("[data-field]").forEach((el) => {
        el.textContent = data[el.getAttribute("data-field") || ""] || "";
      });

      const ul = $("mlg-curator-notes");
      if (ul) {
        ul.innerHTML = "";
        (data.curator_notes || []).forEach((n: string) => {
          const li = document.createElement("li");
          li.textContent = n;
          ul.appendChild(li);
        });
      }

      const varWrap = $("mlg-variations");
      if (varWrap) {
        varWrap.innerHTML = "";
        (data.variations || []).forEach((v: string, i: number) => {
          const box = document.createElement("div");
          box.className = "variation-item";
          box.innerHTML = `
            <div class="variation-header">
              <span class="variation-label">Option ${i + 1}</span>
              <button type="button" class="btn-copy">Copy</button>
            </div>
            <p class="output-text"></p>
          `;
          const p = box.querySelector("p");
          if (p) p.textContent = v;
          box.querySelector("button")?.addEventListener("click", () => navigator.clipboard.writeText(v));
          varWrap.appendChild(box);
        });
      }

      const userWlcTitle = document.getElementById('user-wlc-title');
      const userWlcMeta  = document.getElementById('user-wlc-meta');
      const userWlcBody  = document.getElementById('user-wlc-body');
      if (userWlcTitle) userWlcTitle.textContent = title?.value || 'Untitled';
      if (userWlcMeta) {
        const parts = [artist?.value, year?.value, medium?.value].filter(Boolean);
        userWlcMeta.textContent = parts.length ? parts.join(' · ') : 'Artist unknown · Date unknown';
      }
      if (userWlcBody) {
        userWlcBody.textContent = data.wall_label || '';
        userWlcBody.removeAttribute('data-placeholder');
      }
      document.querySelector('[data-your-artwork-section]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (loading) loading.style.display = "none";
      if (output)  output.style.display  = "block";
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (empty)   empty.style.display   = "block";
      if (err) {
        err.textContent = (e as Error)?.message || "Something went wrong.";
        err.style.display = "block";
      }
    }
  });
}
