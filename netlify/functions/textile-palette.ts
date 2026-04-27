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

    const body = JSON.parse(event.body || "{}") as { concept?: string };
    const { concept = "" } = body;

    if (!concept || String(concept).trim().length < 3) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please include a concept (3+ chars)." }) };
    }

    const system = `You are a textile designer and color expert. Given a fashion concept or mood, return a JSON object with a curated color palette and pattern recommendation. Return valid JSON only — no markdown, no commentary.`;

    const user = `Fashion concept: "${concept.trim()}"

Return JSON with exactly these keys:
colors: [string] — exactly 5 hex color codes that create a harmonious textile palette for this concept
patternStyle: string — one of: geometric, organic, stripe, grid — whichever best suits the concept
mood: string — one sentence describing the feel of this palette (max 12 words)`;

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        temperature: 0.7,
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

    let data: { colors?: unknown[]; patternStyle?: unknown; mood?: unknown };
    try {
      data = JSON.parse(cleaned) as typeof data;
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        data = JSON.parse(cleaned.slice(start, end + 1)) as typeof data;
      } else {
        return { statusCode: 500, body: JSON.stringify({ error: "Model returned invalid JSON. Try again." }) };
      }
    }

    if (!Array.isArray(data.colors) || data.colors.length !== 5) {
      return { statusCode: 500, body: JSON.stringify({ error: "Model returned unexpected palette format. Try again." }) };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colors: data.colors,
        patternStyle: data.patternStyle,
        mood: data.mood,
      }),
    };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error." }) };
  }
}
