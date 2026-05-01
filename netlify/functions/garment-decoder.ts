type HandlerEvent = {
  httpMethod: string;
  body: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message: string };
  stop_reason?: string;
};

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 2_000_000;

function estimateBase64Bytes(value: string): number {
  return Math.ceil((value.replace(/=+$/, "").length * 3) / 4);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate) as unknown;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
    } catch {
      try {
        const repaired = candidate.replace(/,\s*([}\]])/g, "$1");
        const data = JSON.parse(repaired) as unknown;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          return data as Record<string, unknown>;
        }
      } catch {
        // Try the next candidate.
      }
    }
  }

  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeImageAnnotations(value: unknown): Array<Record<string, unknown>> {
  return asArray(value)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const x = Number(record.x);
      const y = Number(record.y);
      const label = String(record.label || "").trim();
      if (!Number.isFinite(x) || !Number.isFinite(y) || !label) return null;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        label,
        reason: String(record.reason || "").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 5) as Array<Record<string, unknown>>;
}

function normalizeBreakdown(data: Record<string, unknown>, hasImage: boolean): Record<string, unknown> {
  data.seam_types = asArray(data.seam_types);
  data.interfacing = asArray(data.interfacing);
  data.closure_options = asArray(data.closure_options);
  data.construction_order = asArray(data.construction_order);
  data.construction_notes = asArray(data.construction_notes);
  data.traveler_notes = asArray(data.traveler_notes);
  data.annotations = asArray(data.annotations);
  data.image_annotations = hasImage ? normalizeImageAnnotations(data.image_annotations) : [];
  return data;
}

function responseText(raw: AnthropicResponse): string {
  return (raw?.content || [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

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

    const normalizedImageMediaType = String(imageMediaType).toLowerCase().split(";")[0];
    const hasImage = Boolean(String(imageBase64).trim());
    const hasDesc  = String(description).trim().length >= 20;

    if (!hasDesc && !hasImage) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please include a garment description (20+ chars) or upload a photo." }) };
    }

    if (hasImage && !SUPPORTED_IMAGE_MEDIA_TYPES.has(normalizedImageMediaType)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please upload a JPEG, PNG, or WebP image." }) };
    }

    if (hasImage && estimateBase64Bytes(String(imageBase64)) > MAX_IMAGE_BYTES) {
      return { statusCode: 400, body: JSON.stringify({ error: "That image is too large to analyze. Please upload a smaller garment photo." }) };
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
      ? "\n\nThe user has uploaded a garment photo. First identify the likely garment category and visible fabric behavior from the image. Then analyze visible seam types, closures, hems, lining/interfacing needs, and construction sequence. If text is present, use it to refine details that are not visible. Also return image_annotations for clearly visible details only. Use x and y as percentages from the top-left of the uploaded image, from 0 to 100. Prefer visible hems, closures, darts, straps, waistbands, collars, pocket openings, and major seam placements. Do not annotate hidden interior construction."
      : "";

    const system = `You are an expert patternmaker. Given a garment description or photo, return one complete valid JSON object only. Do not use markdown. Do not include commentary outside JSON. Keep every string concise.${imageInstruction}

Return an annotations array of 3-5 items for the built-in SVG silhouette. Each item must have exactly these fields:
- anchor: one of these IDs exactly as written: ${ANCHOR_IDS}
- label: max 4 words describing the construction detail at that point
- reason: one sentence explaining why

Only use anchor IDs that are anatomically present on the stated garment type (e.g. do not use ap-gorge-left on a skirt, or ap-wb-left on a blazer). Return annotations as a top-level field in the JSON.

If an image is uploaded, also return image_annotations as a top-level field. Each item must have exactly these fields:
- x: number from 0 to 100
- y: number from 0 to 100
- label: max 4 words naming the visible detail
- reason: one sentence explaining what is visible

If no image is uploaded, return image_annotations as an empty array.`;

    const travelerNote = travelerMode
      ? "\n- TRAVELER MODE: Prioritize packability. Favor lightweight fabrics, minimal structure, wrinkle resistance, and compact closures. Flag any recommendations specifically for travel."
      : "";

    const garmentContext = hasDesc
      ? String(description)
      : "Uploaded garment photo only. Infer the garment type, fabric behavior, closures, seam finishes, and construction details from the image.";

    const user = `Garment: ${garmentContext}
${garmentType ? `Type: ${garmentType}` : ""}
${fabricType ? `Fabric: ${fabricType}` : ""}${travelerNote}

Return one valid JSON object with exactly these keys:
seam_types: [{name, description, where_used}] (max 2)
fabric_behavior: string (1-2 sentences)
lining: {recommended: boolean, type, reason}
interfacing: [{location, weight, type, reason}] (max 2)
closure_options: [{type, pros, cons, best_for}] (max 2)
construction_order: [string] (max 6 steps)
construction_notes: [string] (max 3 tips)
traveler_notes: [string] (max 2, empty array if not traveler mode)
annotations: [{anchor, label, reason}] (3-5 items, only use IDs present on this garment type)
image_annotations: [{x, y, label, reason}] (${hasImage ? "2-4 visible photo annotations" : "empty array"})`;

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
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 3072,
        temperature: 0.3,
        system,
        messages: [{
          role: "user",
          content: hasImage
            ? [
                { type: "image", source: { type: "base64", media_type: normalizedImageMediaType, data: imageBase64 } },
                { type: "text",  text: user },
              ]
            : user,
        }],
      }),
    });

    const rawText = await resp.text();
    let raw: AnthropicResponse = {};
    try {
      raw = JSON.parse(rawText) as typeof raw;
    } catch {
      return { statusCode: 502, body: JSON.stringify({ error: "Claude returned an unreadable response. Try again with a smaller image or shorter description." }) };
    }

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: raw?.error?.message || "Anthropic API error." }) };
    }

    const text = responseText(raw);
    const data = parseJsonObject(text);
    if (!data) {
      const repairResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          temperature: 0,
          system: "Repair malformed tool output into one complete valid JSON object only. Do not add markdown or commentary.",
          messages: [{
            role: "user",
            content: `Rewrite this response as one complete JSON object with keys seam_types, fabric_behavior, lining, interfacing, closure_options, construction_order, construction_notes, traveler_notes, annotations, image_annotations. Use empty arrays when data is missing.\n\n${text || rawText.slice(0, 4000)}`,
          }],
        }),
      });

      const repairRawText = await repairResp.text();
      let repairRaw: AnthropicResponse = {};
      try {
        repairRaw = JSON.parse(repairRawText) as AnthropicResponse;
      } catch {
        return { statusCode: 502, body: JSON.stringify({ error: "Claude returned an unreadable repair response. Try again with a short description added to the photo." }) };
      }

      if (!repairResp.ok) {
        return { statusCode: repairResp.status, body: JSON.stringify({ error: repairRaw?.error?.message || "Anthropic API error." }) };
      }

      const repairedData = parseJsonObject(responseText(repairRaw));
      if (!repairedData) {
        return { statusCode: 500, body: JSON.stringify({ error: "Claude returned an incomplete construction breakdown. Try again with a clearer photo or a short description." }) };
      }

      normalizeBreakdown(repairedData, hasImage);
      if (hasImage && !hasDesc) {
        repairedData.note = "Based on visual analysis only. Add a description for more precise recommendations.";
      }

      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(repairedData),
      };
    }

    normalizeBreakdown(data, hasImage);

    if (hasImage && !hasDesc) {
      data.note = "Based on visual analysis only. Add a description for more precise recommendations.";
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("garment-decoder error", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error while decoding the garment. Try again with a smaller image or add a short text description." }) };
  }
}
