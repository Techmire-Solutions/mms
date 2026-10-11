@AGENTS.md

# MMS — Claude Code notes

Everything above this line is the shared cross-tool guide, imported from `AGENTS.md`.
Only Claude-Code-specific behaviour is documented below — do not duplicate project
conventions here, and never add a second copy of the skill list or the always-on set:
`CLAUDE.md` has no `paths:` frontmatter, so all of it loads in every session.

## How this repo's standards load in Claude Code

| Layer                    | Location                                          | When it loads                                                                                                                    |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Shared guide             | `AGENTS.md` (imported above)                      | every session                                                                                                                    |
| Always-on rules          | `.claude/rules/mms-core.md`                       | every session (no `paths:`)                                                                                                      |
| Scoped & on-demand rules | `.claude/rules/*.md` with `paths:` or description | when Claude reads a matching file or invokes on-demand                                                                           |
| Skills                   | `.claude/skills/*/SKILL.md`                       | when the description matches the task; read `SKILL.md` plus its `references/`/`scripts/`                                         |
| Subagents                | `.claude/agents/*.md`                             | `mms-reviewer`, `mms-explorer`, `mms-test-triage`, `mms-docs-auditor` — use them for context isolation on large read-heavy tasks |
| Commands                 | `.claude/commands/*.md`                           | `/dev-setup`, `/feature-module`, `/code-review`, `/dry`, `/run-tests`, `/fix-migration-debt`                                     |

## Claude-specific mechanics worth knowing

- `.claude/rules/`, `.claude/skills/`, and `.claude/docs/workflows/` are **generated** from `.cursor/rules/` and `.agent/skills/`. Edit the canonical source and run `bash .agent/scripts/sync-all.sh`; a hand edit here is overwritten and CI will fail the drift check.
- `bash .agent/scripts/sync-all.sh --dry-run` previews which mirror files would change (the prune step deletes mirror-only files).
- Permissions and hooks are committed in `.claude/settings.json` (`deny` rules apply immediately; `allow` rules wait for workspace trust). Personal overrides belong in the gitignored `.claude/settings.local.json`.
- The guards are hooks, not prose: `drizzle-kit push`, destructive `rm`, and reads of real `.env` files are blocked by `.cursor/hooks/guard-shell.sh` (shared with Cursor).
- Verify the standards corpus with `node scripts/verify-rules-integrity.mjs` after any rule/skill change; it is the same gate CI runs.
