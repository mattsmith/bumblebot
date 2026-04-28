// TODO: DISPATCH agent runner.
//
// Responsibilities (per SPEC.md §3):
//   - Accept a parsed DISPATCH task (text + originating chat/topic).
//   - Create an isolated git worktree on a new branch.
//   - Spawn Claude Code in the worktree with the task as the prompt.
//   - Watch for completion, then push the branch and open a PR.
//   - Reply in the originating Telegram topic with the PR URL.
//   - Default to push + PR; do NOT auto-merge.
//
// Implementation comes in the v1 build task.

throw new Error('src/agent-runner.js: not implemented yet — see SPEC.md');
