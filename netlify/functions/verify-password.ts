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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { password } = JSON.parse(event.body || "{}") as { password?: string };
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
