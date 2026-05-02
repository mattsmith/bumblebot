# Bumblebot v1 Specification

## 1. Overview

Bumblebot is a self-hosted, opinionated chassis for a personal Telegram + Claude Code assistant with persistent memory and a nightly dreaming loop. It is built for indie hackers and solo builders who want a personal builder-agent they fully control — bring your own Postgres, bring your own API keys, run it on your own box. Clone the repo, run an install script, answer five prompts, and 15 minutes later you have your own bot that listens on Telegram, mirrors replies into forum topics, dispatches Claude Code agents from `<<DISPATCH>>` markers, remembers what you tell it across sessions, and quietly consolidates that memory while you sleep.

Bumblebot is the open-source chassis. Mandela (the author's own personal overlord) is one configured instance built on top of it. The two stay separate repos; Mandela imports concepts from Bumblebot once Bumblebot v1 is shippable.

## 2. Design Decisions

The v1 design was settled via a five-question brainstorming flow. Condensed answers:

1. **Target user:** indie hackers and solo builders — people who already run their own infrastructure, are comfortable with a CLI, and want a personal assistant without giving Anthropic / OpenAI / a SaaS provider their entire memory graph.
2. **Install model:** pure self-host, BYO Postgres. Recommended path is a free Supabase project (linked from the install prompts). No managed/cloud option in v1 — that's a v2+ direction.
3. **Security posture:** strict by default. Allowlist is required at install (script refuses to finish empty). `.env` is gitignored and a pre-commit hook blocks it. There is no `PUBLIC_MODE` flag — running publicly requires a fork.
4. **Scope:** core + dreaming. Telegram bot, allowlist auth, DISPATCH → agent runner, Postgres-backed brain with auto-graph, dreaming loop every 6 hours, one example cron. Persona router, web dashboard, audio, MCP, and observation files are explicitly out.
5. **Name:** Bumblebot. Domains `bumblebot.dev` (primary) and `bumblebot.ai` (secondary) are registered.

## 3. Architecture

```
                     ┌─────────────────────────────┐
                     │         Telegram            │
                     │  (user → bot, topic-aware)  │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                          ┌────────────────────┐
                          │   src/telegram.js  │
                          │  - allowlist gate  │
                          │  - topic router    │
                          │  - DISPATCH parser │
                          └─────────┬──────────┘
                                    │
                  ┌─────────────────┼──────────────────┐
                  │                 │                  │
                  ▼                 ▼                  ▼
         ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
         │ Claude API   │  │ agent-runner │   │ brain/capture│
         │ (chat reply) │  │ (worktree +  │   │ (Postgres +  │
         │              │  │  Claude Code)│   │  pgvector +  │
         │              │  │              │   │  BM25 + Gem.)│
         └──────┬───────┘  └──────┬───────┘   └──────┬───────┘
                │                 │                  │
                ▼                 ▼                  ▼
         plain-text reply    git push + PR      brain table +
         in originating      back to user       graph_entities/
         forum topic                            graph_edges
                                                       │
                                                       ▼
                                          ┌────────────────────┐
                                          │  brain/dream.js    │
                                          │  cron every 6h:    │
                                          │  - dedup           │
                                          │  - strengthen      │
                                          │  - synthesize into │
                                          │    compiled mems   │
                                          └────────────────────┘
```

Key flows:

- **Chat flow:** message → allowlist check → Claude reply → mirror into the originating forum topic.
- **Build flow:** message contains `<<DISPATCH>>...<<END>>` → parser extracts task → agent-runner creates a git worktree, spawns Claude Code with the task, watches for completion, opens a PR, replies with the PR URL.
- **Memory flow:** every meaningful turn → brain capture (text + Gemini embedding + tsvector for BM25 + agent namespace + significance score) → graph extractor pulls entities and edges → both written to Postgres.
- **Dream flow:** every 6 hours → `dream.js` reads recent memories, dedupes near-duplicates by cosine similarity, strengthens repeated facts (raises significance), and synthesizes clusters into "compiled memories" that get written back as new high-significance rows.

## 4. Repo Layout

```
bumblebot/
├── bin/
│   └── bumblebot           # single CLI entrypoint (stub)
├── src/
│   ├── telegram.js         # Telegram bot + topic-aware mirror (stub)
│   ├── agent-runner.js     # DISPATCH → worktree → Claude Code (stub)
│   └── brain/
│       ├── capture.js      # write to brain table (stub)
│       ├── recall.js       # hybrid pgvector + BM25 search (stub)
│       ├── dream.js        # 6-hour consolidation cron (stub)
│       └── graph.js        # entity + edge extraction (stub)
├── migrations/             # SQL migrations (added in next task)
├── examples/
│   └── daily-brief.js      # example user-defined cron (stub)
├── install                 # interactive bash install script (stub)
├── .env.example            # documented placeholder env file
├── .gitignore              # blocks .env, node_modules, worktrees, logs
├── LICENSE                 # MIT, 2026 Matt Smith
├── README.md               # placeholder; real README ships with v1
└── SPEC.md                 # this file
```

## 5. Install Flow

The install script is the Rails-style happy path. Four steps, ~15 minutes from clone to first DISPATCH.

**Step 1 — clone**

```bash
git clone https://github.com/mattsmith/bumblebot && cd bumblebot
```

**Step 2 — run install**

```bash
./install
```

The script prompts for, in order:

1. **Anthropic API key** — required, validated against the API.
2. **Telegram bot token** — prose links to @BotFather with the `/newbot` walkthrough.
3. **Telegram user ID for allowlist** — required, comma-separated for multiple. Prose links to @userinfobot. Empty → script exits with a clear error; the bot will not run without an allowlist.
4. **Postgres URL** — recommended path is a free Supabase project (link inline). Validates connection.
5. **Bot display name** — defaults to "Bumblebot".

**Step 3 — script finishes setup**

The script then:

- Writes `.env` with all five values plus `GEMINI_API_KEY` (prompted if missing) and `NODE_ENV=production`.
- Runs migrations: enables `pgvector` and `pg_search` (BM25) extensions, creates the `brain`, `graph_entities`, `graph_edges`, and `sessions` tables.
- Installs a git pre-commit hook at `.git/hooks/pre-commit` that fails the commit if `.env` is staged.
- Registers a pm2 process named `bumblebot` running `node src/telegram.js`, with `pm2 save` so it survives reboot.
- Prints: "Send `/start` to your bot now."

**Step 4 — first message**

The user opens Telegram, sends `/start`, gets a greeting, and ships their first DISPATCH.

## 6. Security Model

Strict by default. The bot refuses to run insecure.

- **Allowlist required at install.** `TELEGRAM_ALLOWLIST` must be non-empty in `.env`. The bot's startup checks this and exits with a clear error if empty. The install script also refuses to finish with an empty value.
- **Allowlist enforcement points:** every inbound Telegram message is checked against `TELEGRAM_ALLOWLIST` before any handler runs (Claude reply, DISPATCH parse, recall, capture). Non-allowlisted senders get no response — not even an error — to avoid leaking that the bot exists.
- **`.env` gitignored** by default (see `.gitignore`).
- **Pre-commit hook** installed by the install script blocks any commit that stages `.env`. The hook is a single-file shell script in `.git/hooks/pre-commit` that greps the staged file list.
- **`bumblebot doctor`** audits the running install. It checks: (a) `.env` is not in git history (`git log --all -- .env`); (b) `TELEGRAM_ALLOWLIST` is set and non-empty; (c) `DATABASE_URL` does not contain a default password like `postgres:postgres` or `password=password`; (d) no obvious secrets are present in any tracked file; (e) the pre-commit hook is installed and executable. Output is human-readable and exits non-zero on any failure.
- **No `PUBLIC_MODE` flag.** Running Bumblebot publicly (open to anyone on Telegram) requires forking and removing the allowlist gate. This is an intentional friction.
- **Secrets handling:** all secrets are read from `.env` via `process.env`. Secrets are never logged, never sent to Telegram, never written to the brain. The bot token is rotated by the user (re-run install) and is never bundled in the repo.

## 7. CLI Surface

`bin/bumblebot` is the single entrypoint. Subcommands:

| Command                        | Description                                                                 |
|--------------------------------|-----------------------------------------------------------------------------|
| `bumblebot start`              | Start the Telegram bot via pm2.                                              |
| `bumblebot stop`               | Stop the pm2 process.                                                        |
| `bumblebot doctor`             | Audit the install for security issues (see Security Model).                  |
| `bumblebot recall <query>`     | Hybrid pgvector + BM25 search across the brain.                              |
| `bumblebot capture <text>`     | Write a fact to the brain from the CLI (useful for scripts and crons).       |
| `bumblebot dream-now`          | Run the dreaming loop on demand instead of waiting for the 6-hour cron.      |
| `bumblebot install`            | Re-run the interactive install (alias for `./install` from anywhere).        |

## 8. Database Schema

High-level. SQL lives in `migrations/` (added in the next task).

### `brain`

| column         | type           | notes                                                       |
|----------------|----------------|-------------------------------------------------------------|
| `id`           | uuid PK        | default `gen_random_uuid()`                                 |
| `agent`        | text           | namespace: `shared`, `bumblebot`, or any user-defined value |
| `text`         | text           | the captured fact                                            |
| `embedding`    | vector(768)    | Gemini `text-embedding-004` output                           |
| `tsv`          | tsvector       | generated column for BM25 / full-text                        |
| `significance` | int            | 1–10, used by dreaming to decide what to keep                |
| `type`         | text           | `fact`, `decision`, `event`, `compiled`, etc.                |
| `created_at`   | timestamptz    | default `now()`                                              |
| `metadata`     | jsonb          | open bag: source, chat_id, turn_id, etc.                     |

Indexes: HNSW on `embedding`, GIN on `tsv`, btree on `(agent, created_at)`.

### `graph_entities`

| column        | type        | notes                                            |
|---------------|-------------|--------------------------------------------------|
| `id`          | uuid PK     |                                                  |
| `name`        | text        | canonical entity name                            |
| `type`        | text        | `person`, `project`, `org`, `concept`, etc.      |
| `aliases`     | text[]      | known synonyms                                   |
| `metadata`    | jsonb       | open bag                                         |
| `created_at`  | timestamptz | default `now()`                                  |

Unique on `(lower(name), type)`.

### `graph_edges`

| column         | type        | notes                                          |
|----------------|-------------|------------------------------------------------|
| `id`           | uuid PK     |                                                |
| `subject_id`   | uuid FK     | → `graph_entities.id`                          |
| `predicate`    | text        | e.g. `works_on`, `lives_in`, `prefers`         |
| `object_id`    | uuid FK     | → `graph_entities.id`                          |
| `source_brain` | uuid FK     | → `brain.id` (the memory this edge came from)  |
| `confidence`   | real        | 0–1                                            |
| `created_at`   | timestamptz | default `now()`                                |

### `sessions`

| column        | type        | notes                                                |
|---------------|-------------|------------------------------------------------------|
| `chat_id`     | text PK     | Telegram chat id (1:1 with conversation)             |
| `history`     | jsonb       | array of `{role, content, ts}` turns                  |
| `updated_at`  | timestamptz | default `now()`                                      |

## 9. v1 Scope and Explicit Non-Goals

**In v1:**

- Telegram bot with topic-aware mirror replies
- Allowlist auth, required at install
- DISPATCH marker → Claude Code agent runner with worktree isolation
- Brain: Postgres + pgvector + BM25 + Gemini embeddings, agent-namespaced
- Auto-graph: entity + edge extraction on every capture
- Dreaming loop: every 6 hours, dedup / strengthen / synthesize compiled memories
- One example cron (`examples/daily-brief.js`) showing the pattern
- Plain-text Telegram formatting baked into the system prompt
- `bumblebot doctor` security audit command

**Explicitly NOT in v1:**

- Persona router (multiple personalities per bot)
- Web dashboard
- Observation files (Mandela-specific concept)
- RemoteTrigger / cloud cron
- Audio transcription
- MCP server
- Hosted onboarding (the future "C" path — install at bumblebot.dev/install)

## 10. Future Direction (v2+)

These are noted as not-v1 but on the roadmap:

- **Persona router** — multiple personalities (e.g. "builder", "therapist", "researcher") routed by intent or explicit `/persona` command.
- **Hosted onboarding** at `bumblebot.dev/install` — the "C" path: managed cloud install where the user pays a small fee and Bumblebot provisions Postgres, secrets, and a bot for them. Pure self-host stays the primary path.
- **Audio** — voice-note transcription on inbound, optional voice replies.
- **MCP server** — expose Bumblebot's brain and dispatch surface as MCP tools so other Claude Code instances can talk to it.
- **Web dashboard** — read-only view of the brain, dispatched tasks, and PRs.

## 11. Mandela Parity Roadmap

Bumblebot v1 ships the chassis. Mandela (the author's personal overlord) runs on a heavier stack with several features that are intentionally deferred. The phased plan below is how Bumblebot grows toward parity without bloating v1:

- v1.0 — Chassis (this release): Telegram bot, brain (pgvector + BM25), DISPATCH markers + agent runner, worktree isolation, dreaming cron, allowlist auth, plain-text formatting, doctor command, cherry-picked /ce-compound + /ce-ideate.
- v1.1 — Brain-aware CLAUDE.md: install writes a CLAUDE.md so local `claude` SSH sessions auto-talk to the same Postgres brain. Restores the "nothing lost across harnesses" property. (Implemented in this release as step 9 of install.)
- v1.2 — Orchestrator + DISPATCH polish: orchestrator rules baked into the bot's default system prompt, audio note handling, "▶ Task #N started" confirmation lines.
- v1.3 — Persona system: default + code-specialist personas shipped, plus a personas/ directory pattern so users can add their own.
- v1.4 — Observations + directives folders: observations/ (analytical notes the bot writes) and directives/ (standing orders) loaded at boot, mirroring Mandela's notebook pattern.
- v1.5 — Self-improve + dreaming-plus: brain-improve.js port and the weekly cron that generates observations from the bot's own behavior.

Each phase lands as its own PR. Project memory (specific knowledge about the operator's life, projects, family) is intentionally NOT a phase — it's per-install user data that gets imported into the brain after install.

## 12. Recommended Optional Skills (post-install)

Bumblebot's v1 chassis ships no Claude Code skills baked in — the chassis stays opinionated about wiring, not about workflow. After install, two skills from EveryInc's compound-engineering plugin are recommended as optional additions:

- /ce-compound — codify lessons from each completed cycle into reusable notes
- /ce-ideate — early-stage idea generation (distinct from requirements brainstorming)

Source: https://github.com/EveryInc/compound-engineering-plugin

Why cherry-pick rather than vendor the whole plugin: the full compound-engineering plugin overlaps substantially with Anthropic's superpowers skill family (brainstorming, planning, TDD, debugging, verification). Only /ce-compound and /ce-ideate are genuinely additive on top of superpowers — the rest would create redundant or conflicting workflows.

Install — v1.1 (planned):

  bumblebot skills add ce-compound ce-ideate

This single command will be added to the `bumblebot` CLI in v1.1. It is not implemented in v1.

Install — v1 (manual vendor steps):

1. Clone the source repo: `git clone https://github.com/EveryInc/compound-engineering-plugin /tmp/ce-plugin`
2. Copy the two skill files into your local Claude Code skills directory:

       mkdir -p ~/.claude/skills
       cp /tmp/ce-plugin/skills/ce-compound.md ~/.claude/skills/
       cp /tmp/ce-plugin/skills/ce-ideate.md ~/.claude/skills/

3. Restart Claude Code so the new skills are picked up.

After this, /ce-compound and /ce-ideate are available alongside the superpowers family.

## 13. License

MIT. Copyright 2026 Matt Smith. See [LICENSE](./LICENSE).
