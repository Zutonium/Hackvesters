import { APICallError, convertToModelMessages, streamText, type UIMessage } from "ai";

import { ADVISOR_SYSTEM_PROMPT } from "./advisor-prompt.server";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./gateway.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
// Full (frontier) Gemini model, as the CEO asked for the most capable version.
export const ADVISOR_MODEL = "google/gemini-4-argon";
const MAX_MESSAGES = 80;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function friendlyError(error: unknown) {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    let upstream: string | undefined;
    try {
      const parsed = JSON.parse(error.responseBody ?? "{}");
      upstream = parsed?.error?.message ?? parsed?.message;
    } catch {
      upstream = undefined;
    }
    if (status === 429) return "The advisor is busy right now. Please wait a moment and try again.";
    if (status === 402)
      return upstream ?? "AI credits have run out for this workspace. Add credits to keep using the advisor.";
    if (status === 403) return upstream ?? "The advisor isn't available for this workspace right now.";
    if (status === 401) return "The advisor isn't configured correctly. Please contact the site owner.";
    return upstream ?? "The advisor couldn't answer that. Please try again.";
  }
  return "The advisor couldn't answer that. Please try again.";
}

export async function handleChat(request: Request) {
  let messages: UIMessage[];
  try {
    const body = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json(400, { error: "No messages provided." });
    }
    messages = body.messages.slice(-MAX_MESSAGES) as UIMessage[];
  } catch {
    return json(400, { error: "Invalid request." });
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, { error: "The advisor isn't configured yet." });

  const gateway = createLovableAiGatewayProvider(apiKey, getLovableAiGatewayRunId(request), {
    baseURL: GATEWAY_URL,
  });

  const result = streamText({
    model: gateway(ADVISOR_MODEL),
    system: ADVISOR_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    maxRetries: 1,
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onError: (error) => {
        console.error("advisor chat error", error);
        return friendlyError(error);
      },
    }),
    gateway,
  );
}
