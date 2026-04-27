type HandlerEvent = {
  httpMethod: string;
  body: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

export async function handler(event: HandlerEvent): Promise<HandlerResponse> {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const body = JSON.parse(event.body || "{}") as {
      title?: string;
      artist?: string;
      year?: string;
      medium?: string;
      description?: string;
      tone?: string;
      stayCloseToSource?: boolean;
    };
    const {
      title = "Unknown",
      artist = "Unknown",
      year = "Unknown",
      medium = "Unknown",
      description = "",
      tone = "neutral",
      stayCloseToSource = true,
    } = body;

    if (!description || String(description).trim().length < 30) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please include a longer artwork description (30+ chars)." }) };
    }

    const system = `
You are a museum interpretation assistant. Write clear, accurate interpretive text that respects artists and audiences.

Constraints:
- Do not invent facts. If information is missing, write around it or label as "Unknown".
- Avoid academic jargon unless requested by the tone.
- Be culturally sensitive; do not stereotype. Flag sensitive topics with care.
- Keep claims grounded in the provided description.
- Return output as valid JSON only (no markdown, no commentary).
`;

    const closeness = stayCloseToSource
      ? "Be conservative. Stay close to the source description. Avoid inference."
      : "You may make light interpretive inferences, but do not invent factual claims (dates, identities, events).";

    const user = `
Create museum interpretive text for the following artwork.

Artwork info:
- Title: ${title}
- Artist: ${artist}
- Year: ${year}
- Medium/Materials: ${medium}
- Description (source text, may be incomplete): ${description}

Preferences:
- Tone: ${tone} (neutral/warm/playful/academic)
- Audience: general public
- Additional constraint: ${closeness}

Return JSON with keys:
wall_label, extended_label, kids_label, audio_guide_script, alt_text, curator_notes, variations

Rules:
- wall_label 50–70 words
- extended_label 150–200 words
- kids_label 60–90 words, friendly but not babyish
- audio_guide_script 120–160 words, spoken style
- alt_text: 1–2 sentences focused on what is visible
- curator_notes: array of 4–6 bullet strings including themes + context + "Sensitivity flags" if relevant
- variations: array of 3 alternative wall_label options in different phrasing (same facts)
`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server missing ANTHROPIC_API_KEY." }) };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        temperature: 0.5,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const raw = await resp.json() as { content?: Array<{ type: string; text: string }>; error?: { message: string } };
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: raw?.error?.message || "Anthropic API error." }) };
    }

    const text = (raw?.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let data: unknown;
    try {
      data = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        data = JSON.parse(cleaned.slice(start, end + 1));
      } else {
        return { statusCode: 500, body: JSON.stringify({ error: "Model returned invalid JSON. Try again." }) };
      }
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error." }) };
  }
}
