// Boot sequence — assembles the agent's system prompt at startup.
//
// Reads long-form continuity notes from two folders at the install root:
//   - directives/    standing orders the operator has issued (all included)
//   - observations/  analytical notes about the ecosystem (latest N included)
//
// Both folders are gitignored content with a tracked .gitkeep so the structure
// ships empty and each install fills them in. Filenames are conventionally
// YYYY-MM-DD-topic.md so lexicographic sort == chronological sort.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OBSERVATION_LIMIT = 10;
const ROOT = path.resolve(__dirname, '..');

function readNotes(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort()
    .map((name) => ({
      name,
      content: fs.readFileSync(path.join(dir, name), 'utf8').trim(),
    }))
    .filter((n) => n.content.length > 0);
}

function formatSection(heading, notes) {
  if (notes.length === 0) return '';
  const body = notes
    .map((n) => `### ${n.name}\n\n${n.content}`)
    .join('\n\n');
  return `## ${heading}\n\n${body}`;
}

function buildContinuityPrompt({ root = ROOT, observationLimit = DEFAULT_OBSERVATION_LIMIT } = {}) {
  const directives = readNotes(path.join(root, 'directives'));
  const observations = readNotes(path.join(root, 'observations')).slice(-observationLimit);

  const sections = [
    formatSection('Standing Orders', directives),
    formatSection('Recent Observations', observations),
  ].filter(Boolean);

  return sections.join('\n\n');
}

function injectContinuity(basePrompt, options) {
  const continuity = buildContinuityPrompt(options);
  if (!continuity) return basePrompt;
  if (!basePrompt) return continuity;
  return `${basePrompt}\n\n${continuity}`;
}

module.exports = {
  buildContinuityPrompt,
  injectContinuity,
  readNotes,
  DEFAULT_OBSERVATION_LIMIT,
};
