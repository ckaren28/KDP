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

    const body = JSON.parse(event.body || "{}") as Record<string, unknown>;
    const {
      description = "",
      fabricType = "",
      garmentType = "",
      travelerMode = false,
      imageBase64 = "",
      imageMediaType = "image/jpeg",
    } = body as {
      description?: string;
      fabricType?: string;
      garmentType?: string;
      travelerMode?: boolean;
      imageBase64?: string;
      imageMediaType?: string;
    };

    const hasImage = Boolean(imageBase64);
    const hasDesc  = String(description).trim().length >= 20;

    if (!hasDesc && !hasImage) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please include a garment description (20+ chars) or upload a photo." }) };
    }

    const ANCHOR_IDS = [
      'ap-cf-neck','ap-shoulder-left','ap-shoulder-right',
      'ap-gorge-left','ap-gorge-right','ap-lapel-left','ap-lapel-right',
      'ap-break-left','ap-break-right',
      'ap-underarm-left','ap-underarm-right',
      'ap-wrist-left','ap-wrist-right',
      'ap-hem-left','ap-hem-right','ap-cf-hem',
      'ap-waist-left','ap-waist-right',
      'ap-hip-left','ap-hip-right',
      'ap-crotch','ap-knee-left','ap-knee-right',
      'ap-strap-left','ap-strap-right',
      'ap-neck-left','ap-neck-right',
      'ap-armhole-left','ap-armhole-right',
      'ap-collar-left','ap-collar-right',
      'ap-wb-left','ap-wb-right',
      'ap-hem-left-outer','ap-hem-left-inner',
      'ap-hem-right-inner','ap-hem-right-outer',
    ].join(', ');

    const imageInstruction = hasImage
      ? "\n\nThe user has uploaded a photo of a garment. Analyze visible construction details, fabric behavior, seam types, and closure mechanisms. Use the text description to fill in details not visible in the photo."
      : "";

    const system = `You are an expert patternmaker. Given a garment description, return a concise structured technical breakdown as valid JSON only — no markdown, no commentary. Be specific but brief.${imageInstruction}

Also return an annotations array of 4–6 items. Each item must have exactly these fields:
- anchor: one of these IDs exactly as written: ${ANCHOR_IDS}
- label: max 4 words describing the construction detail at that point
- reason: one sentence explaining why

Only use anchor IDs that are anatomically present on the stated garment type (e.g. do not use ap-gorge-left on a skirt, or ap-wb-left on a blazer). Return annotations as a top-level field in the JSON.`;

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
traveler_notes: [string] (max 3, empty array if not traveler mode)
annotations: [{anchor, label, reason}] (4-6 items, only use IDs present on this garment type)`;

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
        max_tokens: 1536,
        temperature: 0.3,
        system,
        messages: [{
          role: "user",
          content: hasImage
            ? [
                { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
                { type: "text",  text: user },
              ]
            : user,
        }],
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

    if (hasImage && !hasDesc) {
      (data as Record<string, unknown>).note =
        "Based on visual analysis only. Add a description for more precise recommendations.";
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
