import fs from "node:fs";
import path from "node:path";
import { readPersistentState } from "./history.js";

const CONTEXT_DIR = path.resolve("project_context");
const INSTRUCTIONS_PATH = path.join(CONTEXT_DIR, "instructions.md");
const CODEBASE_SUMMARY_PATH = path.join(CONTEXT_DIR, "codebase_summary.md");

function readOrPlaceholder(filePath, label) {
  if (!fs.existsSync(filePath)) return `(${label} not found at ${filePath})`;
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Build the system content block array for a request.
 *
 * Layout:
 *   [0] static project instructions
 *   [1] static codebase summary
 *   [2] persistent state memory + cache_control breakpoint  <- cache boundary
 *   [3] task-specific instruction for this turn (uncached, changes per request)
 *   [4] budget alert, only present once the 70% threshold is crossed
 *
 * Blocks 0-2 stay identical between calls until the state log rolls forward,
 * so Anthropic's prompt cache can reuse that prefix instead of re-billing
 * full input tokens on every turn.
 */
export function buildSystemBlocks({ taskProfile, budgetAlert }) {
  const instructions = readOrPlaceholder(INSTRUCTIONS_PATH, "project instructions");
  const codebaseSummary = readOrPlaceholder(CODEBASE_SUMMARY_PATH, "codebase summary");
  const stateMemory = readPersistentState();

  const blocks = [
    { type: "text", text: instructions },
    { type: "text", text: codebaseSummary },
    {
      type: "text",
      text: `PERSISTENT STATE MEMORY (condensed prior turns):\n${stateMemory}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (taskProfile.extraSystemInstruction) {
    blocks.push({ type: "text", text: `TASK INSTRUCTION (${taskProfile.label}): ${taskProfile.extraSystemInstruction}` });
  }

  if (budgetAlert) {
    blocks.push({ type: "text", text: budgetAlert });
  }

  return blocks;
}
