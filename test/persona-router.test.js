'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  routePersona,
  loadPersona,
  buildSystemPrompt,
  PERSONAS,
} = require('../src/persona-router');

test('routes build/deploy/code keywords to "code" persona', () => {
  const codeMessages = [
    'fix the broken build',
    'deploy to staging',
    'git pr review',
    'why is the test suite failing on main',
    'debug this stack trace',
    'open a PR for the auth refactor',
    'lint is complaining about unused imports',
    'rebase onto main and squash',
    'the docker image is 2GB, can we cut it down',
    'compile error in src/foo.ts',
  ];
  for (const msg of codeMessages) {
    assert.equal(routePersona(msg), 'code', `expected "code" for: ${msg}`);
  }
});

test('routes general/strategy/journaling messages to "default" persona', () => {
  const defaultMessages = [
    'what should I do today',
    'summarize my notes',
    'remind me about X',
    'how was my week',
    'I had a tough conversation with my cofounder',
    'help me think through pricing for the new tier',
    'what time is dinner',
    "I'm feeling stuck on the roadmap",
  ];
  for (const msg of defaultMessages) {
    assert.equal(routePersona(msg), 'default', `expected "default" for: ${msg}`);
  }
});

test('empty / whitespace messages route to "default"', () => {
  assert.equal(routePersona(''), 'default');
  assert.equal(routePersona('   '), 'default');
  assert.equal(routePersona('\n\t'), 'default');
});

test('null / undefined messages route to "default" without throwing', () => {
  assert.equal(routePersona(null), 'default');
  assert.equal(routePersona(undefined), 'default');
});

test('very long messages still route correctly when keywords are present', () => {
  const longTail = ' '.padEnd(20000, 'x');
  assert.equal(
    routePersona('please fix the build pipeline' + longTail),
    'code',
  );
  const longNoCode = 'I want to think about my goals for the year. ' + 'and then '.repeat(2000);
  assert.equal(routePersona(longNoCode), 'default');
});

test('mixed-intent messages prefer "code" when build/code keywords are present', () => {
  // Rationale: if the user mentions a build/deploy/code task at all, the
  // code persona is safer — it's terser and won't pretend to be a therapist
  // about a real engineering problem. Default persona explicitly hands off
  // build work to code mode.
  assert.equal(
    routePersona("I'm feeling stuck — can you fix the deploy script too"),
    'code',
  );
  assert.equal(
    routePersona('summarize my notes and also debug the failing test'),
    'code',
  );
});

test('case-insensitive keyword matching', () => {
  assert.equal(routePersona('FIX THE BUILD'), 'code');
  assert.equal(routePersona('Deploy To Staging'), 'code');
  assert.equal(routePersona('GIT PR REVIEW'), 'code');
});

test('keyword must be a whole word, not a substring', () => {
  // "fix" should not match "prefix", "affix", "suffix"
  assert.equal(routePersona('what is the prefix for our env vars'), 'default');
  // "git" should not match "digital", "fugitive"
  assert.equal(routePersona('what does digital sovereignty mean'), 'default');
  // "deploy" should not match nothing common, but "code" shouldn't match "decode"
  assert.equal(routePersona('decode this base64 string for me'), 'default');
});

test('PERSONAS exposes the two valid persona names', () => {
  assert.deepEqual([...PERSONAS].sort(), ['code', 'default']);
});

test('loadPersona reads the markdown file from disk', () => {
  const def = loadPersona('default');
  assert.match(def, /Default persona/);
  assert.match(def, /Bumblebot/);

  const code = loadPersona('code');
  assert.match(code, /Code-specialist persona/);
  assert.match(code, /DISPATCH/);
});

test('loadPersona throws on unknown persona name', () => {
  assert.throws(() => loadPersona('nonexistent'), /unknown persona/i);
});

test('buildSystemPrompt prepends the persona to a base prompt', () => {
  const base = 'BASE_SYSTEM_PROMPT';
  const out = buildSystemPrompt('default', base);
  // persona first, then base, separated by blank line(s)
  assert.ok(out.startsWith('# Default persona'), 'persona should come first');
  assert.ok(out.endsWith(base), 'base prompt should be appended at the end');
  assert.ok(
    out.indexOf('# Default persona') < out.indexOf(base),
    'persona must be before base',
  );
});

test('buildSystemPrompt with code persona includes code voice', () => {
  const out = buildSystemPrompt('code', 'BASE');
  assert.match(out, /Code-specialist persona/);
  assert.match(out, /BASE$/);
});

test('buildSystemPrompt with no base returns only the persona', () => {
  const out = buildSystemPrompt('default');
  assert.match(out, /Default persona/);
  assert.equal(out.trim(), loadPersona('default').trim());
});

test('persona files exist on disk', () => {
  const root = path.join(__dirname, '..', 'personas');
  assert.ok(fs.existsSync(path.join(root, 'default.md')));
  assert.ok(fs.existsSync(path.join(root, 'code.md')));
});
