import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyIntent } from "../lib/classifier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "labeled-prompts.json"), "utf8"));

// Regression floor, not a target. This is a known regex classifier limitation,
// not a bug — see README "Honest limitations" for what this number means and
// why it will never reach 100%.
const MIN_ACCURACY = 0.85;

test("classifier accuracy on labeled dataset", () => {
  const results = dataset.map((row) => {
    const predicted = classifyIntent(row.prompt).id;
    return { ...row, predicted, correct: predicted === row.expected };
  });

  const correct = results.filter((r) => r.correct).length;
  const accuracy = correct / results.length;

  const misses = results.filter((r) => !r.correct);
  if (misses.length > 0) {
    console.log(`\nMisclassified ${misses.length}/${results.length}:`);
    for (const m of misses) {
      console.log(`  "${m.prompt}" -> expected ${m.expected}, got ${m.predicted}`);
    }
  }
  console.log(`\nAccuracy: ${correct}/${results.length} (${(accuracy * 100).toFixed(1)}%)\n`);

  assert.ok(
    accuracy >= MIN_ACCURACY,
    `Accuracy ${(accuracy * 100).toFixed(1)}% fell below the ${MIN_ACCURACY * 100}% regression floor`
  );
});
