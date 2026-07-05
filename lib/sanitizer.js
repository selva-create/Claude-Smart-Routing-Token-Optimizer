/**
 * Input buffer sanitizer.
 * Any pasted block over MAX_LINES gets truncated to a head/tail sample with
 * a warning header, so one oversized trace dump can't blow out the request.
 */

const MAX_LINES = 50;
const KEEP_HEAD = 30;
const KEEP_TAIL = 10;

export function sanitizeInput(raw, { maxLines = MAX_LINES, keepHead = KEEP_HEAD, keepTail = KEEP_TAIL } = {}) {
  const lines = raw.split("\n");
  if (lines.length <= maxLines) {
    return { text: raw, truncated: false };
  }

  const omitted = lines.length - keepHead - keepTail;
  const warning =
    `[INPUT BUFFER SANITIZER] Original paste was ${lines.length} lines, over the ` +
    `${maxLines}-line ceiling. Showing the first ${keepHead} and last ${keepTail} lines; ` +
    `${omitted} line(s) truncated to protect the token budget.`;

  const sanitized = [
    warning,
    "```",
    ...lines.slice(0, keepHead),
    `... [${omitted} lines omitted] ...`,
    ...lines.slice(-keepTail),
    "```",
  ].join("\n");

  return { text: sanitized, truncated: true, originalLines: lines.length, omittedLines: omitted };
}
