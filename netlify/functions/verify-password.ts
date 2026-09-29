import { fromThisSite, bodyTooLarge, FORBIDDEN, TOO_LARGE } from "../lib/guard";

type HandlerEvent = {
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  body: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

export async function handler(event: HandlerEvent): Promise<HandlerResponse> {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Only the gate on this site checks passwords, which makes scripted guessing
  // from elsewhere a little harder.
  if (!fromThisSite(event.headers)) return FORBIDDEN;
  if (bodyTooLarge(event.body, 1_000)) return TOO_LARGE;

  let password: unknown;
  try {
    ({ password } = JSON.parse(event.body || "{}") as { password?: unknown });
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Bad request." }) };
  }
  const correct = process.env.GATE_PASSWORD;

  if (!correct) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Password gate not configured." }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: password === correct }),
  };
}
