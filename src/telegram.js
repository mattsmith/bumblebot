'use strict';

// Telegram bot entrypoint.
//
// Responsibilities (per SPEC.md §3 + §6):
//   - Refuse to start if TELEGRAM_ALLOWLIST is empty.
//   - Listen for inbound messages, gate every handler on the allowlist.
//   - Route forum-topic-originated messages back into the same topic.
//   - Pick a persona based on the user's message and prepend it to the
//     system prompt before calling Claude (this file's responsibility).
//   - Parse <<DISPATCH>>...<<END>> markers and hand off to agent-runner.
//   - Capture meaningful turns into the brain.
//   - Send replies in plain text (no Markdown / HTML parse_mode).
//
// The Telegram listener and Claude API call are landed in later phases. This
// file currently exposes the persona-aware system-prompt assembly so those
// phases can import it directly.

const { routePersona, buildSystemPrompt } = require('./persona-router');

// Base system prompt the chassis always includes after the persona. Kept
// minimal — the persona carries the voice; the base carries the chassis
// invariants (plain-text formatting, DISPATCH marker behaviour, etc.).
const BASE_SYSTEM_PROMPT = [
  'You reply over Telegram. Replies are sent with no parse_mode, so',
  'Markdown formatting will not render — write plain prose.',
  '',
  'When the user asks for non-trivial build / debug / deploy work, suggest',
  'they wrap the task in <<DISPATCH>>...<<END>> markers so the chassis can',
  'run it in an isolated worktree and open a PR.',
].join('\n');

// systemPromptFor(message) returns the full system prompt the chassis should
// send to Claude for this turn: persona (chosen from the message) + base.
function systemPromptFor(message) {
  const personaName = routePersona(message);
  return {
    persona: personaName,
    system: buildSystemPrompt(personaName, BASE_SYSTEM_PROMPT),
  };
}

module.exports = {
  BASE_SYSTEM_PROMPT,
  systemPromptFor,
};

// Direct invocation: not implemented yet — the bot loop lands in a later
// phase. Run `node --test test/` for the persona-router tests.
if (require.main === module) {
  console.error(
    'src/telegram.js: bot loop not implemented yet — see SPEC.md. ' +
      'Persona router is wired and tested; run `node --test test/`.',
  );
  process.exit(1);
}
