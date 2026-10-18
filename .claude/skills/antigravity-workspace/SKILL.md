---
name: antigravity-workspace
description: Orients Antigravity agents to the MMS workspace layout — .agent rules, skills, workflows, and parity with Cursor and Claude Code. Use when starting work in Antigravity, loading project context, or syncing agent standards. Do NOT use for local server operations (use mms-dev-setup) or code review checklists (use mms-code-review).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
allowed-tools: Read Grep Glob Bash(bash .agent/scripts/sync-all.sh) Bash(node scripts/verify-rules-integrity.mjs)
---

# Antigravity Workspace — MMS

**Rule (norms SSOT):** `mms-agent-universal.md` · `mms-core.md` · `mms-completion-review.md`.

## When to use

- Starting work in Antigravity or loading MMS agent-standards context
- Syncing rules/skills across Antigravity, Cursor, and Claude Code

## Anti-Patterns & Banned Operations

- ❌ **NEVER edit rules/skills without running sync**: Running `bash .agent/scripts/sync-all.sh` is mandatory to keep Cursor, Claude, and Antigravity aligned.
- ❌ **NEVER run `cd` in tool commands**: Specify absolute execution `Cwd` or pass paths directly to scripts.
- ❌ **NEVER commit or push without instruction**: Commits require the user to say "commit"; pushes require the user to say "push".
- ❌ **NEVER rewrite full files**: Use targeted `replace_file_content` patches with minimal anchor context.

## Directory layout

```
.agent/
  rules/       # always_on | model_decision triggers
  skills/      # capability modules (this folder)
  workflows/   # slash-command style procedures
```

Cursor equivalent: `.cursor/rules/` + `.cursor/skills/`  
Claude Code equivalent: `.claude/rules/` + `.claude/skills/` + root `CLAUDE.md`

Keep in sync when editing: `bash .agent/scripts/sync-all.sh`

## Always-on rules (1)

| File | Purpose |
|------|---------|
| `rules/mms-core.md` | MMS stack, boundaries, ownership matrix, edit discipline |

Requestable (not always-on): `rules/mms-agent-universal.md` (cognition, output economy, security, TS/git), `rules/mms-completion-review.md` (self-review after edits).

Scoped (20 rules, 21 total): `mms-performance` (compute/virtualization), `mms-migration-status` (active debt register), `mms-data-layer` (Postgres/RLS/Query), `mms-dry`, `mms-dependencies`, `mms-structure-naming`, `mms-hooks`, `mms-module-architecture`, `mms-ui-ux-design`, etc.

## Priority skills (daily)

`mms-dev-setup` → `mms-frontend` / `mms-query-factories` / `mms-backend-api` → `mms-module-page` / `mms-module-work` → `mms-code-review` / `mms-a11y-smoke`. Domain: `mms-messaging`, `mms-settings-i18n`, `mms-backup-restore`, `mms-backend-security`. Infra: `mms-dependency-upgrade`, `mms-schema-migrate`.

## Skills index

See `skills/README.md`. Invoke by task keywords or `@skill-name` if your client supports it.

## Quick start & validation

```bash
pnpm install && pnpm typecheck
pnpm test
pnpm run check:i18n                                # Verify i18n translation coverage
bash .agent/skills/mms-dev-setup/scripts/verify-env.sh
./restart_servers.sh                               # local dev (screen)
```

## Architecture blueprints & docs

- `docs/architecture.md`
- `docs/adr/README.md` (ADR journal index)
- `docs/archive/MigrationPlan.md`
- `.agent/skills/README.md`

## Sync policy

When changing standards:

1. Update `.cursor/rules/*.mdc` (Cursor) or `.agent/skills/*/SKILL.md` (skills)
2. Run `bash .agent/scripts/sync-all.sh` to mirror **Antigravity**, **Cursor**, and **Claude Code**

| Target | Path | Frontmatter |
|--------|------|-------------|
| Cursor | `.cursor/rules/*.mdc` | `globs` + `alwaysApply` |
| Antigravity | `.agent/rules/*.md` | `trigger: always_on \| model_decision` |
| Claude Code | `.claude/rules/*.md` | `paths:` (scoped) or none (always-on) |

Skills canonical in `.agent/skills/` → mirrored to `.cursor/skills/` and `.claude/skills/`.

## Project root guide

Read `AGENTS.md` at repo root.

## Related skills

`mms-agent-standards` (authoring/sync), `mms-dev-setup` (local env), `mms-code-review` (diff review).
