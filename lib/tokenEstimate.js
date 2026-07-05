import { get_encoding } from "tiktoken";

// cl100k_base is an approximation, not Claude's real tokenizer. It's used
// here purely for a fast, zero-cost pre-call estimate (classifier logging,
// sanitizer thresholds). Actual billed usage always comes from the API
// response's usage block, handled in lib/budget.js.
let encoder;
function getEncoder() {
  if (!encoder) encoder = get_encoding("cl100k_base");
  return encoder;
}

export function estimateTokens(text) {
  if (!text) return 0;
  return getEncoder().encode(String(text)).length;
}

process.on("exit", () => {
  if (encoder) encoder.free();
});
