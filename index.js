#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline";
import { classifyIntent } from "./lib/classifier.js";
import { sanitizeInput } from "./lib/sanitizer.js";
import { SlidingHistory } from "./lib/history.js";
import { buildSystemBlocks } from "./lib/context.js";
import { callClaude } from "./lib/anthropicClient.js";
import { recordUsage, peekUsage } from "./lib/budget.js";
import { estimateTokens } from "./lib/tokenEstimate.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

const history = new SlidingHistory();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("Claude Smart Routing Token Optimizer — type a prompt, or 'exit' to quit.\n");
promptNext();

function promptNext() {
  rl.question("> ", async (raw) => {
    if (raw.trim().toLowerCase() === "exit") {
      rl.close();
      return;
    }
    await handleTurn(raw);
    promptNext();
  });
}

async function handleTurn(rawInput) {
  // Step 1: zero-cost local classification, before any tokens are spent.
  const profile = classifyIntent(rawInput);

  // Step 2: sanitize oversized pastes.
  const { text: sanitizedInput, truncated, originalLines } = sanitizeInput(rawInput);
  if (truncated) {
    console.log(`[sanitizer] truncated a ${originalLines}-line paste before sending.`);
  }

  // Step 3: check budget before spending more tokens.
  const usageBefore = peekUsage();

  // Step 4: build the system prompt — cached prefix + per-task instruction + alert.
  const system = buildSystemBlocks({ taskProfile: profile, budgetAlert: usageBefore.alert });

  // Step 5: append the current turn to the sliding window and send it.
  history.push("user", sanitizedInput);
  const localEstimate = estimateTokens(sanitizedInput);

  console.log(
    `[router] task=${profile.label} model=${profile.model} maxTokens=${profile.maxTokens} ` +
      `localEstimate=${localEstimate}tok`
  );

  try {
    const result = await callClaude({
      model: profile.model,
      maxTokens: profile.maxTokens,
      system,
      messages: history.toMessages(),
    });

    history.push("assistant", result.continuation);

    const usageAfter = recordUsage(result.usage);
    if (usageAfter.alert) console.log(`\n[budget] ${usageAfter.alert}\n`);

    console.log(`\n${result.fullText}\n`);
  } catch (err) {
    console.error(`[error] ${err.message}`);
  }
}
