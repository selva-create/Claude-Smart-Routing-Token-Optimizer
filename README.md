# Claude Smart Routing Token Optimizer

A small, single-repo reference implementation showing how five Claude-specific
cost mechanics fit together: local intent routing, a bounded history window,
a prompt-cache breakpoint, an input sanitizer, and a budget alert. It's built
to be read start to finish in about ten minutes, not adopted as a dependency.

**What this is not:** a general-purpose LLM router. If you need multi-provider
routing, a trained classifier, or production-grade fallback chains, use
[RouteLLM](https://github.com/lm-sys/RouteLLM) or
[LiteLLM](https://github.com/BerriAI/litellm) instead — see the comparison
below. This repo exists to show the mechanics clearly, in plain code, for
people building their own Claude-specific tooling.

## What "zero-cost" means here

Every prompt runs through a local regex classifier before any API call.
That step costs nothing — no network request, no tokens billed — because it
never touches the model. It does not mean using this tool is free: you still
pay Anthropic per token for every actual API call, exactly as you would
without this wrapper. "Zero-cost" describes the classification step only.

## Comparison

| | This repo | RouteLLM | LiteLLM |
|---|---|---|---|
| Scope | Single provider (Anthropic) | Router framework, model-agnostic | Multi-provider gateway |
| Classifier | Regex, hand-written | Trained (BERT / causal LLM / Elo) | Configurable, pluggable |
| Prompt caching | Manual `cache_control` placement | N/A | Built-in auto-injection |
| Intended use | Read the code, adapt what you need | Production routing at scale | Production gateway at scale |
| Maturity | Reference implementation | Published benchmarks, active research | Widely deployed, large user base |

If you're choosing infrastructure for a real workload, RouteLLM or LiteLLM
are the better starting points — both have published benchmarks and existing
production usage. This repo is worth reading if you want to understand
exactly how the pieces work before you decide whether to hand that
responsibility to a bigger framework.

## What it does

**Local intent classification.** `lib/classifier.js` runs a prompt against
13 regex-based task profiles before any tokens are spent, mapping each to a
model and an output ceiling:

| Task | Model | Max Tokens |
|---|---|---|
| General Enquiry | Haiku | 400 |
| Creating Image | Haiku | 500 |
| Website Design | Sonnet | 3000 |
| Code Development Web App | Sonnet | 4000 |
| YAGNI Code Review (Lazy Code Review) | Sonnet | 2500 |
| Creating Documentation | Haiku | 1500 |
| Mobile App Code Development | Sonnet | 4000 |
| Structuring / Rephrasing Prompt | Haiku | 600 |
| Logo Designs | Haiku | 800 |
| Document Review / Flashcards | Sonnet | 2000 |
| Package Upgrades | Haiku | 500 |
| Error Troubleshooting | Sonnet | 1500 |
| DB Architecture | Sonnet | 2000 |

Website Design requests get an added instruction restricting output to
native HTML5 and Tailwind utility classes. YAGNI Code Review requests get an
instruction to walk the code for speculative abstractions, redundant
helpers, and dead branches — the "lazy" in the name refers to laziness as an
engineering virtue (do less, keep less), not to a low-effort review.

**5-turn sliding history.** `lib/history.js` keeps at most 5 user/assistant
pairs in the live request. Anything older gets condensed to a single line
and archived to `runtime/persistent_state.log`.

**Context injection with a cache breakpoint.** `lib/context.js` reads
`project_context/instructions.md`, `project_context/codebase_summary.md`,
and the persistent state log, then places `cache_control: {"type":
"ephemeral"}` on the block that ends that static content, so Anthropic's
prompt cache can reuse the prefix across turns. Note: LiteLLM does this same
thing automatically via `cache_control_injection_points` — this repo shows
the placement by hand so the mechanism is visible rather than hidden behind
a config flag.

**Input buffer sanitizer.** `lib/sanitizer.js` catches pastes over 50 lines
and replaces the middle with a truncation notice, keeping the first 30 and
last 10 lines.

**Assistant pre-fill anchor.** `lib/anthropicClient.js` appends a frozen
`{role: "assistant", content: "Here is the optimized, direct code block
response:"}` message to every request, so Claude continues from that line
instead of spending tokens on an opener.

**70% budget threshold.** `lib/budget.js` tracks real usage from each
response's `usage` block against a 1,000,000 token monthly allowance. Past
700,000 tokens, an alert gets prepended to the next request naming which
task types to shift to Haiku.

## Honest limitations

**The classifier is regex, not a trained model.** Every serious router in
this space (RouteLLM's BERT/causal-LLM classifiers, NVIDIA's CLIP-embedding
router, NadirClaw's sentence-embedding classifier) moved past keyword
matching for a reason: regex has no concept of intent, only surface text. It
will misclassify prompts that don't use the expected words, and it can't
weigh "this mentions Postgres in passing" against "this is really an app-dev
question."

Measured on the 50-prompt labeled set in `tests/labeled-prompts.json`, run
via `npm test`: **47/50 correct (94.0%)**. The three misses are worth
reading because they show exactly where regex breaks down, not just that it
does:

- *"Help me build a full-stack app with Express and Postgres"* → classified
  as DB Architecture instead of Code Development Web App. The classifier has
  no way to tell an incidental keyword from the actual intent — it sees
  "Postgres" and routes there, regardless of what the sentence is really
  asking for.
- *"How should I organize related tables so lookups stay fast?"* →
  classified as General Enquiry instead of DB Architecture. No schema,
  database, or indexing keyword appears, so nothing fires.
- *"My code has gotten pretty messy, can you make it leaner?"* → classified
  as General Enquiry instead of YAGNI Code Review. Same problem: the intent
  is clear to a person, invisible to a regex with no matching keyword.

Run `npm test` yourself before trusting this number on your own prompt
style — 94% on this dataset says nothing about accuracy on a different
distribution of requests.

**Single provider.** This only talks to Anthropic's API. That's intentional
scope, not a missing feature — if you need multi-provider support, that's
what RouteLLM and LiteLLM are for.

## Setup

\`\`\`bash
npm install
cp .env.example .env
# add your key to .env
npm start
\`\`\`

Requires Node 18 or later and an \`ANTHROPIC_API_KEY\`.

## Running the tests

\`\`\`bash
npm test
\`\`\`

Runs the labeled classifier accuracy check in \`tests/classifier.test.js\`
against \`tests/labeled-prompts.json\`, prints every misclassification, and
fails if accuracy drops below an 85% regression floor.

## Layout

\`\`\`
index.js                          CLI loop, wires every module together
lib/classifier.js                 task profile matrix, regex-based routing
lib/sanitizer.js                  50-line paste truncation
lib/history.js                    sliding window + state-log archival
lib/context.js                    system prompt assembly, cache breakpoint
lib/budget.js                     monthly usage tracking, 70% alert
lib/anthropicClient.js            Messages API call, pre-fill anchor
lib/tokenEstimate.js              tiktoken-based local estimate (approximate)
tests/labeled-prompts.json        50 labeled prompts for accuracy measurement
tests/classifier.test.js          accuracy test, run via \`npm test\`
project_context/instructions.md   static system content, cached
project_context/codebase_summary.md  static system content, cached
runtime/                          generated at runtime: usage.json, persistent_state.log
\`\`\`

## Notes on the token estimator

\`lib/tokenEstimate.js\` uses \`tiktoken\`'s \`cl100k_base\` encoding for a fast
local estimate before a call is made. That's an OpenAI tokenizer, not
Claude's, so treat the number as a rough guide for sanitizer thresholds and
logging, not a billing figure. Actual spend always comes from the \`usage\`
block on the API response, which is what \`lib/budget.js\` records.

## Extending the profile matrix

Add an entry to \`TASK_PROFILES\` in \`lib/classifier.js\`, give it a regex
pattern, and insert its key into the \`PRIORITY\` array at the point that
matches how specific the pattern is — more specific patterns need to sit
above \`codeDevWebApp\` and \`generalEnquiry\`, or they'll never get reached.
Add matching rows to \`tests/labeled-prompts.json\` and rerun \`npm test\` to
see whether the change helped or hurt overall accuracy.

## License

MIT
