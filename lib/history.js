import fs from "node:fs";
import path from "node:path";

const RUNTIME_DIR = path.resolve("runtime");
const STATE_LOG_PATH = path.join(RUNTIME_DIR, "persistent_state.log");
const MAX_TURNS = 5; // 5 user+assistant pairs = 10 messages, enforced below
const MAX_ITEMS = MAX_TURNS * 2;
const CONDENSED_CHAR_LIMIT = 140;

fs.mkdirSync(RUNTIME_DIR, { recursive: true });

/**
 * In-memory sliding window. Holds at most MAX_ITEMS messages.
 * Anything pushed off the front is condensed and archived to disk first.
 */
export class SlidingHistory {
  constructor() {
    this.items = [];
  }

  push(role, content) {
    this.items.push({ role, content });
    while (this.items.length > MAX_ITEMS) {
      const expired = this.items.shift();
      this._archive(expired);
    }
  }

  toMessages() {
    return this.items.map(({ role, content }) => ({ role, content }));
  }

  _archive(turn) {
    const line = condense(turn);
    fs.appendFileSync(STATE_LOG_PATH, line + "\n", "utf8");
  }
}

function condense({ role, content }) {
  const flat = String(content).replace(/\s+/g, " ").trim();
  const clipped = flat.length > CONDENSED_CHAR_LIMIT ? flat.slice(0, CONDENSED_CHAR_LIMIT) + "…" : flat;
  return `[${new Date().toISOString()}] ${role.toUpperCase()}: ${clipped}`;
}

/**
 * Read back the condensed state log for system-prompt injection.
 * Capped to the most recent N lines so the log can't grow the cached
 * system prefix without bound.
 */
export function readPersistentState(maxLines = 40) {
  if (!fs.existsSync(STATE_LOG_PATH)) return "(no archived turns yet)";
  const lines = fs.readFileSync(STATE_LOG_PATH, "utf8").split("\n").filter(Boolean);
  return lines.slice(-maxLines).join("\n") || "(no archived turns yet)";
}

export { STATE_LOG_PATH };
