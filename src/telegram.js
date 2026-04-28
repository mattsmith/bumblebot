// TODO: Telegram bot entrypoint.
//
// Responsibilities (per SPEC.md §3 + §6):
//   - Refuse to start if TELEGRAM_ALLOWLIST is empty.
//   - Listen for inbound messages, gate every handler on the allowlist.
//   - Route forum-topic-originated messages back into the same topic.
//   - Pass message to Claude for chat reply.
//   - Parse <<DISPATCH>>...<<END>> markers and hand off to agent-runner.
//   - Capture meaningful turns into the brain.
//   - Send replies in plain text (no Markdown / HTML parse_mode).
//
// Implementation comes in the v1 build task.

throw new Error('src/telegram.js: not implemented yet — see SPEC.md');
