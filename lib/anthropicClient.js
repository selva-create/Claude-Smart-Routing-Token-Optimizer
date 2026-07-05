import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Immutable pre-fill anchor. Appended as the final message so Claude
// continues from this exact string instead of spending tokens on an
// unprompted opener. Never mutate this at call sites.
export const PREFILL_TEXT = "Here is the optimized, direct code block response:";
const PREFILL_MESSAGE = Object.freeze({ role: "assistant", content: PREFILL_TEXT });

/**
 * Call the Messages API with routing already resolved.
 * @param {object} params
 * @param {string} params.model
 * @param {number} params.maxTokens
 * @param {Array} params.system - system content blocks, cache_control already applied
 * @param {Array} params.messages - sliding-window history plus the current user turn
 */
export async function callClaude({ model, maxTokens, system, messages }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [...messages, PREFILL_MESSAGE],
  });

  const continuation = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    fullText: PREFILL_TEXT + " " + continuation,
    continuation,
    usage: response.usage,
    raw: response,
  };
}
