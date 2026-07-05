import fs from "node:fs";
import path from "node:path";

const RUNTIME_DIR = path.resolve("runtime");
const USAGE_PATH = path.join(RUNTIME_DIR, "usage.json");

const MONTHLY_ALLOWANCE = Number(process.env.MONTHLY_TOKEN_ALLOWANCE || 1_000_000);
const ALERT_THRESHOLD = Number(process.env.BUDGET_ALERT_THRESHOLD || 0.7);

fs.mkdirSync(RUNTIME_DIR, { recursive: true });

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function loadUsage() {
  const month = currentMonthKey();
  if (!fs.existsSync(USAGE_PATH)) return { month, totalTokens: 0 };
  const stored = JSON.parse(fs.readFileSync(USAGE_PATH, "utf8"));
  if (stored.month !== month) return { month, totalTokens: 0 }; // monthly reset
  return stored;
}

function saveUsage(usage) {
  fs.writeFileSync(USAGE_PATH, JSON.stringify(usage, null, 2), "utf8");
}

/**
 * Record actual token spend from an API response's usage block and return
 * the updated totals plus an alert string once the threshold is crossed.
 */
export function recordUsage(usageFromResponse) {
  const usage = loadUsage();
  const turnTokens =
    (usageFromResponse.input_tokens || 0) +
    (usageFromResponse.output_tokens || 0) +
    (usageFromResponse.cache_creation_input_tokens || 0) +
    (usageFromResponse.cache_read_input_tokens || 0);

  usage.totalTokens += turnTokens;
  saveUsage(usage);

  return {
    totalTokens: usage.totalTokens,
    allowance: MONTHLY_ALLOWANCE,
    percentUsed: usage.totalTokens / MONTHLY_ALLOWANCE,
    alert: buildAlertIfNeeded(usage.totalTokens),
  };
}

export function peekUsage() {
  const usage = loadUsage();
  return {
    totalTokens: usage.totalTokens,
    allowance: MONTHLY_ALLOWANCE,
    percentUsed: usage.totalTokens / MONTHLY_ALLOWANCE,
    alert: buildAlertIfNeeded(usage.totalTokens),
  };
}

function buildAlertIfNeeded(totalTokens) {
  if (totalTokens < MONTHLY_ALLOWANCE * ALERT_THRESHOLD) return null;
  const pct = ((totalTokens / MONTHLY_ALLOWANCE) * 100).toFixed(1);
  return (
    `TOKEN BUDGET ALERT: ${totalTokens.toLocaleString()} / ${MONTHLY_ALLOWANCE.toLocaleString()} ` +
    `monthly tokens used (${pct}%). Route Documentation, Package Upgrades, Logo Designs, and ` +
    `Structuring Prompt tasks to Haiku only, hold Sonnet for Code Development, Website Design, ` +
    `Mobile App Development, DB Architecture, and YAGNI Code Review, and pause exploratory queries ` +
    `until the monthly reset if usage keeps climbing.`
  );
}
