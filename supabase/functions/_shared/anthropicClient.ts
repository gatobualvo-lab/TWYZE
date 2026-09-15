// Thin wrapper around the Anthropic Messages API.
//
// Structured output is enforced via a single FORCED tool call
// (tool_choice: {type: "tool", name: ANSWER_TOOL_NAME}) rather than hoping
// free-form prose matches a shape. This is a well-established, stable
// mechanism for constraining response shape and is NOT the same thing as
// giving Claude tools it can use to fetch more data: there is exactly one
// tool, it is forced on every call, and the app never loops its output
// back into another Claude turn — the "tool call" IS the final answer, not
// an intermediate step in a multi-turn tool-use flow. Claude has no
// mechanism here to request additional business data beyond what the
// domain router already decided to hand it in the prompt.
//
// NOTE: this was written without the ability to make a live Anthropic API
// call in the development environment — verify the exact request/response
// shape (endpoint, headers, model availability) against current Anthropic
// API docs during the Phase 3 local/staging smoke test called for in the
// implementation plan, and adjust if anything has changed.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 2048;
const ANSWER_TOOL_NAME = 'provide_business_answer';
const REQUEST_TIMEOUT_MS = 30000;

export interface AnthropicCallResult {
  toolInput: unknown;
  inputTokens: number;
  outputTokens: number;
}

export class AnthropicCallError extends Error {}

export async function callAssistant(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  responseSchema: Record<string, unknown>;
}): Promise<AnthropicCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }],
        tools: [
          {
            name: ANSWER_TOOL_NAME,
            description: "Provide the complete structured answer to the business owner's question. Call this exactly once with your full answer.",
            input_schema: params.responseSchema,
          },
        ],
        tool_choice: { type: 'tool', name: ANSWER_TOOL_NAME },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new AnthropicCallError(err instanceof Error ? err.message : 'Anthropic request failed');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new AnthropicCallError(`Anthropic API error ${response.status}: ${errBody.slice(0, 500)}`);
  }

  const data = await response.json();
  const content: Array<{ type: string; name?: string; input?: unknown }> = data?.content ?? [];
  const toolUseBlock = content.find(block => block.type === 'tool_use' && block.name === ANSWER_TOOL_NAME);

  if (!toolUseBlock) {
    throw new AnthropicCallError('Anthropic response did not include the expected tool_use block');
  }

  return {
    toolInput: toolUseBlock.input,
    inputTokens: Number(data?.usage?.input_tokens) || 0,
    outputTokens: Number(data?.usage?.output_tokens) || 0,
  };
}
