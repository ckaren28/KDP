export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const {
      description = "",
      fabricType = "",
      garmentType = "",
      travelerMode = false,
    } = body;

    if (!description || String(description).trim().length < 20) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please include a garment description (20+ chars)." }) };
    }

    const system = `You are an expert patternmaker. Given a garment description, return a concise structured technical breakdown as valid JSON only — no markdown, no commentary. Be specific but brief.`;

    const travelerNote = travelerMode
      ? "\n- TRAVELER MODE: Prioritize packability. Favor lightweight fabrics, minimal structure, wrinkle resistance, and compact closures. Flag any recommendations specifically for travel."
      : "";

    const user = `Garment: ${description}
${garmentType ? `Type: ${garmentType}` : ""}
${fabricType ? `Fabric: ${fabricType}` : ""}${travelerNote}

Return JSON with these keys (keep each value concise):
seam_types: [{name, description, where_used}] (max 3)
fabric_behavior: string (2-3 sentences)
lining: {recommended: boolean, type, reason}
interfacing: [{location, weight, type, reason}] (max 3)
closure_options: [{type, pros, cons, best_for}] (max 2)
construction_order: [string] (max 8 steps)
construction_notes: [string] (max 4 tips)
traveler_notes: [string] (max 3, empty array if not traveler mode)`;

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
        max_tokens: 1024,
        temperature: 0.3,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const raw = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: raw?.error?.message || "Anthropic API error." }) };
    }

    const text = (raw?.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let data;
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
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error." }) };
  }
}
