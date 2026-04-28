# Bumblebot

A friendly little bot that builds things while you sleep.

Bumblebot is a self-hosted, opinionated chassis for a personal Telegram + Claude Code assistant with persistent memory and a nightly dreaming loop. Clone the repo, run the install script, point it at your own Postgres, and 15 minutes later you have your own personal builder bot.

> **Status:** v1 spec at [SPEC.md](./SPEC.md). Implementation in progress.

## Install (preview)

```bash
git clone https://github.com/mattsmith/bumblebot && cd bumblebot
./install
```

The install script will prompt for an Anthropic API key, Telegram bot token, your Telegram user ID (allowlist), Postgres URL, and a bot display name. It writes `.env`, runs migrations, installs a pre-commit hook to block secret leaks, registers a pm2 process, and tells you to send `/start` to your bot.

## Links

- Website: https://bumblebot.dev
- Spec: [SPEC.md](./SPEC.md)
- License: [MIT](./LICENSE)
