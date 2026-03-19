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
      travellerMode = false,
    } = body;

    if (!description || String(description).trim().length < 20) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please include a garment description (20+ chars)." }) };
    }

    const system = `
You are an expert patternmaker and garment construction specialist with deep knowledge of industrial and couture techniques.
Given a garment description, produce a precise, structured technical breakdown a sewist or patternmaker could actually use.

Constraints:
- Be specific. Name actual seam types, interfacing weights, stitch types, and techniques.
- If information is ambiguous, offer the most likely approach and note alternatives.
- Do not invent details not implied by the description.
- Return output as valid JSON only (no markdown, no commentary).
`;

    const travellerNote = travellerMode
      ? "\n- TRAVELLER MODE: Prioritize packability. Favor lightweight fabrics, minimal structure, wrinkle resistance, and compact closures. Flag any recommendations specifically for travel."
      : "";

    const user = `
Analyze this garment and return a structured technical construction breakdown.

Garment description: ${description}
${garmentType ? `Garment type: ${garmentType}` : ""}
${fabricType ? `Fabric: ${fabricType}` : ""}
${travellerNote}

Return JSON with exactly these keys:
- seam_types: array of objects { name, description, where_used }
- fabric_behavior: string describing how the fabric will behave during construction and wear
- lining: object { recommended (boolean), type, reason }
- interfacing: array of objects { location, weight, type, reason }
- closure_options: array of objects { type, pros, cons, best_for }
- construction_order: array of strings (step-by-step build sequence)
- construction_notes: array of strings (tips, watchouts, technique flags)
- traveller_notes: array of strings (only if traveller mode — packability and travel-specific flags, otherwise empty array)
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
