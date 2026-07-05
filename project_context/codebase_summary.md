# Codebase Summary

Replace this file with a short structural map of your own repository —
directory layout, key modules, and conventions. This is read on every turn
alongside instructions.md, so it belongs in the cached prefix too.

Default placeholder content, describing this router itself:

- `index.js` — CLI entry point, wires classifier → history → context →
  sanitizer → client → budget together.
- `lib/classifier.js` — regex-based task profile matrix, zero API cost.
- `lib/sanitizer.js` — truncates pastes over 50 lines.
- `lib/history.js` — 5-turn sliding window, archives expired turns to
  runtime/persistent_state.log.
- `lib/context.js` — builds system content blocks, sets the ephemeral cache
  breakpoint.
- `lib/budget.js` — tracks monthly token spend, raises an alert at 70%.
- `lib/anthropicClient.js` — thin wrapper over the Messages API, owns the
  assistant pre-fill anchor.
