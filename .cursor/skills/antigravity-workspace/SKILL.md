---
name: antigravity-workspace
description: Orients Antigravity agents to the MMS workspace layout — .agent rules, skills, workflows, and parity with Cursor, Claude Code, and DeepSeek Harness. Use when starting work in Antigravity, loading project context, or syncing agent standards. Do NOT use for local server operations (use mms-dev-setup) or code review checklists (use mms-code-review).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-29
allowed-tools: Read Grep Glob Bash(bash .agent/scripts/sync-all.sh) Bash(node scripts/verify-rules-integrity.mjs)
---

# Antigravity Workspace — MMS

**Rule (norms SSOT):** `mms-agent-universal.mdc` · `mms-core.mdc` · `mms-completion-review.mdc`.

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

## Always-on rules (2)

| File | Purpose |
|------|---------|
| `rules/mms-core.mdc` | MMS stack, boundaries, ownership matrix, edit discipline |
| `rules/mms-completion-review.mdc` | Mandatory self-review + adversarial audit before marking work done |

Requestable (not always-on): `rules/mms-agent-universal.mdc` (cognition, output economy, security, TS/git).

Scoped (21 rules, 23 total): `mms-performance` (compute/virtualization), `mms-migration-status` (active debt register), `mms-data-layer` (Postgres/RLS/Query), `mms-tdd` (test-first delivery), `mms-dry`, `mms-dependencies`, `mms-structure-naming`, `mms-hooks`, `mms-module-architecture`, `mms-ui-ux-design`, etc.

Claude Code difference: a rule with no `paths:` loads every session, so `.claude/rules/` always-on = the two above **plus** `rules/mms-agent-universal.mdc` (requestable in Cursor/Antigravity). `verify-rules-integrity.mjs` enforces that parity.

## Priority skills (daily)

`mms-dev-setup` → `mms-frontend` / `mms-query-factories` / `mms-backend-api` → `mms-module-page` / `mms-module-work` → `mms-code-review` / `mms-a11y-smoke`. Domain: `mms-messaging`, `mms-settings-i18n`, `mms-backup-restore`, `mms-backend-security`. Infra: `mms-dependency-upgrade`, `mms-schema-migrate`.

## Skills index

See `.agent/skills/README.md` (mirrored at `.cursor/skills/`, `.claude/skills/`, and `.dsh/skills/`). Invoke by task keywords or `@skill-name` if your client supports it.

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
2. Run `bash .agent/scripts/sync-all.sh` to mirror **Antigravity**, **Cursor**, **Claude Code**, and **DeepSeek Harness**

| Target | Path | Frontmatter |
|--------|------|-------------|
| Cursor | `.cursor/rules/*.mdc` | `globs` + `alwaysApply` |
| Antigravity | `.agent/rules/*.md` | `trigger: always_on \| model_decision` |
| Claude Code | `.claude/rules/*.md` | `paths:` (scoped) or none (always-on) |
| DeepSeek Harness | `.dsh/rules/*.md` (+ generated `.dsh/AGENTS.md`) | none — read on demand |

Skills canonical in `.agent/skills/` → mirrored to `.cursor/skills/`, `.claude/skills/`, and `.dsh/skills/` (DSH auto-discovers the last one at project rank 100).

## Project root guide

Read `AGENTS.md` at repo root.

## Related skills

`mms-agent-standards` (authoring/sync), `mms-dev-setup` (local env), `mms-code-review` (diff review).
