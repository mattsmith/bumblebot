const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildContinuityPrompt, injectContinuity } = require('../src/boot');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bumblebot-boot-'));
  fs.mkdirSync(path.join(root, 'observations'));
  fs.mkdirSync(path.join(root, 'directives'));
  return root;
}

function write(root, folder, name, body) {
  fs.writeFileSync(path.join(root, folder, name), body, 'utf8');
}

test('returns empty string when both folders are empty', () => {
  const root = makeRoot();
  assert.equal(buildContinuityPrompt({ root }), '');
});

test('does not crash when folders do not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bumblebot-boot-missing-'));
  // No subfolders created at all.
  assert.equal(buildContinuityPrompt({ root }), '');
});

test('injects directives under Standing Orders heading', () => {
  const root = makeRoot();
  write(root, 'directives', '2026-01-01-tone.md', 'Reply tersely.');
  const prompt = buildContinuityPrompt({ root });
  assert.match(prompt, /## Standing Orders/);
  assert.match(prompt, /### 2026-01-01-tone\.md/);
  assert.match(prompt, /Reply tersely\./);
});

test('injects observations under Recent Observations heading', () => {
  const root = makeRoot();
  write(root, 'observations', '2026-02-14-cron-flake.md', 'Cron is flaky on Sundays.');
  const prompt = buildContinuityPrompt({ root });
  assert.match(prompt, /## Recent Observations/);
  assert.match(prompt, /Cron is flaky on Sundays\./);
});

test('caps observations to the latest N (default 10) by filename sort', () => {
  const root = makeRoot();
  for (let i = 1; i <= 15; i++) {
    const day = String(i).padStart(2, '0');
    write(root, 'observations', `2026-01-${day}-note.md`, `body ${i}`);
  }
  const prompt = buildContinuityPrompt({ root });
  // Latest 10 means days 06–15 are included, 01–05 are dropped.
  assert.ok(!prompt.includes('body 1\n'), 'oldest body should be dropped');
  assert.ok(!prompt.includes('body 5\n'), 'day 05 should be dropped');
  assert.ok(prompt.includes('body 6'), 'day 06 should be kept');
  assert.ok(prompt.includes('body 15'), 'newest should be kept');
});

test('observation cap is configurable', () => {
  const root = makeRoot();
  for (let i = 1; i <= 5; i++) {
    write(root, 'observations', `2026-01-0${i}-note.md`, `body ${i}`);
  }
  const prompt = buildContinuityPrompt({ root, observationLimit: 2 });
  assert.ok(!prompt.includes('body 1'));
  assert.ok(!prompt.includes('body 3'));
  assert.ok(prompt.includes('body 4'));
  assert.ok(prompt.includes('body 5'));
});

test('directives are not capped', () => {
  const root = makeRoot();
  for (let i = 1; i <= 25; i++) {
    const day = String(i).padStart(2, '0');
    write(root, 'directives', `2026-01-${day}-rule.md`, `rule ${i}`);
  }
  const prompt = buildContinuityPrompt({ root });
  for (let i = 1; i <= 25; i++) {
    assert.ok(prompt.includes(`rule ${i}`), `rule ${i} should be present`);
  }
});

test('ignores non-md files and empty files', () => {
  const root = makeRoot();
  write(root, 'observations', 'README.txt', 'should be skipped');
  write(root, 'observations', '.gitkeep', '');
  write(root, 'observations', '2026-03-01-empty.md', '   \n  ');
  write(root, 'observations', '2026-03-02-real.md', 'real note');
  const prompt = buildContinuityPrompt({ root });
  assert.ok(!prompt.includes('should be skipped'));
  assert.ok(!prompt.includes('2026-03-01-empty.md'));
  assert.ok(prompt.includes('real note'));
});

test('renders both sections together when both folders have content', () => {
  const root = makeRoot();
  write(root, 'directives', '2026-01-01-a.md', 'direct');
  write(root, 'observations', '2026-01-01-a.md', 'observe');
  const prompt = buildContinuityPrompt({ root });
  const ordersIdx = prompt.indexOf('## Standing Orders');
  const obsIdx = prompt.indexOf('## Recent Observations');
  assert.ok(ordersIdx >= 0 && obsIdx >= 0);
  assert.ok(ordersIdx < obsIdx, 'Standing Orders should come before Recent Observations');
});

test('injectContinuity appends to the base prompt', () => {
  const root = makeRoot();
  write(root, 'directives', '2026-01-01-a.md', 'be terse');
  const result = injectContinuity('You are Bumblebot.', { root });
  assert.ok(result.startsWith('You are Bumblebot.'));
  assert.ok(result.includes('## Standing Orders'));
  assert.ok(result.includes('be terse'));
});

test('injectContinuity returns base prompt unchanged when folders are empty', () => {
  const root = makeRoot();
  const base = 'You are Bumblebot.';
  assert.equal(injectContinuity(base, { root }), base);
});
