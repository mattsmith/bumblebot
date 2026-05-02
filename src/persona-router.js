'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PERSONAS = Object.freeze(['default', 'code']);

const PERSONAS_DIR = path.join(__dirname, '..', 'personas');

// Whole-word keyword set that signals the user is asking about build / debug /
// deploy / git / code work. Whole-word matching avoids false positives like
// "prefix" → "fix" or "decode" → "code".
const CODE_KEYWORDS = [
  'build',
  'builds',
  'building',
  'deploy',
  'deploys',
  'deploying',
  'deployment',
  'fix',
  'fixes',
  'fixing',
  'bug',
  'bugs',
  'debug',
  'debugging',
  'code',
  'coding',
  'compile',
  'compiles',
  'compiling',
  'lint',
  'linter',
  'linting',
  'test',
  'tests',
  'testing',
  'git',
  'pr',
  'prs',
  'rebase',
  'merge',
  'commit',
  'commits',
  'branch',
  'refactor',
  'refactoring',
  'docker',
  'ci',
  'cd',
  'pipeline',
  'stack',
  'trace',
  'crash',
  'error',
  'errors',
  'exception',
];

const CODE_KEYWORD_RE = new RegExp(
  '\\b(' + CODE_KEYWORDS.join('|') + ')\\b',
  'i',
);

function routePersona(message) {
  if (typeof message !== 'string') return 'default';
  const trimmed = message.trim();
  if (trimmed.length === 0) return 'default';
  return CODE_KEYWORD_RE.test(trimmed) ? 'code' : 'default';
}

function loadPersona(name) {
  if (!PERSONAS.includes(name)) {
    throw new Error(`unknown persona: ${name}`);
  }
  const filePath = path.join(PERSONAS_DIR, `${name}.md`);
  return fs.readFileSync(filePath, 'utf8');
}

function buildSystemPrompt(name, basePrompt = '') {
  const persona = loadPersona(name);
  if (!basePrompt) return persona;
  return `${persona.trimEnd()}\n\n${basePrompt}`;
}

module.exports = {
  routePersona,
  loadPersona,
  buildSystemPrompt,
  PERSONAS,
  PERSONAS_DIR,
};
