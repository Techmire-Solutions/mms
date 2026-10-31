---
name: mms-agent-standards
description: Authors and verifies the MMS agent-standards corpus itself — rules, skills, workflows, commands, hooks, and the mirrors across Cursor, Antigravity, Claude Code, and DeepSeek Harness. Use when adding or editing a rule or skill, when a skill is not firing, or when the standards verifier fails. Do NOT use for reviewing application code (use mms-code-review) or for local environment problems (use mms-dev-setup).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-29
allowed-tools: Read Grep Glob Write Edit Bash(node scripts/verify-rules-integrity.mjs) Bash(bash .agent/scripts/sync-all.sh)
---

# MMS Agent Standards

**Rules (norms SSOT):** `mms-agent-universal.md` (enforcement principle, tool neutrality) · `mms-core.md` (ownership matrix) · `.cursor/rules/README.md` (topic → owner rule → skill).

## When to use

- Adding or editing a rule, skill, workflow, command, or hook
- A skill is not firing, or `verify-rules-integrity.mjs` / sync fails

## Canonical sources vs generated mirrors

| Artifact | Edit here | Generated |
|---|---|---|
| Rules | `.cursor/rules/*.mdc` | `.agent/rules/*.md`, `.claude/rules/*.md` |
| Skills | `.agent/skills/*/SKILL.md` | `.cursor/skills/`, `.claude/skills/` |
| Workflows | `.agent/workflows/*.md` | `.claude/docs/workflows/` |
| Commands | `.cursor/commands/`, `.claude/commands/` | — (thin wrappers over the workflow) |
| Shared guide | `AGENTS.md` | `CLAUDE.md` imports it |
| DeepSeek Harness | `.cursor/rules/*.mdc` + `.agent/skills/` | `.dsh/rules/`, `.dsh/skills/`, generated `.dsh/AGENTS.md` |

Editing a mirror is always a bug: `sync-all.sh` overwrites it and CI fails the drift check.

## Authoring a rule

1. **Find the owner first.** Run the matrix in `.cursor/rules/README.md`. If a topic already has an owner, extend that rule instead of creating a second home — duplicate essays are the corpus's main decay mode.
2. **Frontmatter is the only tool-specific part:** Cursor `globs` + `alwaysApply`, Antigravity `trigger: always_on | model_decision`, Claude `paths:` (or none when always-on). Bodies are identical modulo the sync script's rule-reference rewrite (`.mdc` → `.md`); it never rewrites `.cursor/...` paths.
3. **Scope the globs.** They must match real files — any glob matching zero files fails the verifier. Never write `apps/**` style catch-alls: a rule that matches everything is an always-on rule with extra steps.
4. **Budget the always-on set.** Two rules are `alwaysApply` / always-on: `mms-core` (invariants, boundaries, edit discipline) and `mms-completion-review` (mandatory self-review + adversarial audit). `mms-agent-universal` is requestable in Cursor/Antigravity; in Claude Code any rule without `paths:` loads every session, so its no-paths set is these two **plus** `mms-agent-universal` (the verifier enforces that parity). A new always-on rule needs a strong justification, and a scoped rule's content should shrink the always-on set rather than grow it.
5. **Every norm is machine-enforced or labelled advisory.** Land the lint rule, ratchet script, CI step, hook, or test in the same change, or say explicitly why it can only be reviewed by eye.

## Authoring a skill

1. **Frontmatter:** `name` (must equal the folder, ≤64 chars), `description` (≤1024 chars) with *what it does* + **"Use when…"** + **"Do NOT use for… (use X)"**. The negative boundary is enforced by the verifier and is what stops the wrong skill firing.
2. **Triggers collide easily.** `mms-a11y-smoke` must fire on "prove a11y", not on all UI work; `mms-code-review` needs the diff; `mms-backend-security` needs the mechanism. If two skills could fire on the same sentence, sharpen both descriptions.
3. **Body headings (template):** keep `SKILL.md` under ~200 lines and push detail to `references/`. Required structure:
   1. `**Rule(s) (norms SSOT):**` pointer
   2. `## When to use` (short bullets — fail if missing)
   3. Procedure / implementation map (real repo paths)
   4. A verification section — any of `## Verification`, `## Verification Checklist`, `## Checklist`, `## Done`, or `## ...Validat…` (required; enforced by the verifier)
   5. `## Related skills` (required — fail if missing)
   6. Named links for every local `references/`, `examples/`, and `scripts/` file
4. **Code samples must compile.** Every `@/...` import is resolved case-sensitively by the verifier (`Skeleton` vs `skeleton` breaks the Linux deploy). `examples/` and `references/` are validated too: paths, filenames, and alias imports.
5. **Assets must be reachable.** Every file under `scripts/`, `references/`, and `examples/` (skip `__pycache__`, `*.pyc`, dotfiles) must be named in `SKILL.md`. Scripts must be executable, exit non-zero on real problems, and must not swallow failures with `|| true`. Exception: a deliberately **advisory** reporter (e.g. `scripts/check-tdd-pairing.mjs`) may exit 0, must label its output advisory, and must be registered as advisory in the rules README enforcement table.

## Indexes that must stay in sync

Adding or renaming a skill touches five outputs — the manifest, the skills README table, the `AGENTS.md` count, and the `.cursor/`, `.claude/`, and `.dsh/` skill mirrors. Keep them honest with two commands:

```bash
node scripts/sync-skill-index.mjs   # .agent/skills-manifest.json, skills README table, AGENTS.md count
bash .agent/scripts/sync-all.sh     # .agent/.cursor/.claude/.dsh mirrors
```

The verifier fails if the manifest, the README index count, or the AGENTS.md skill count disagree with disk, or if any canonical rule/skill body differs from a mirror — so run this before `verify-rules-integrity.mjs`.

## Verification loop

```bash
node scripts/verify-rules-integrity.mjs        # the gate CI runs
bash .agent/scripts/sync-all.sh                # regenerate mirrors (.cursor, .agent, .claude, .dsh)
bash .agent/scripts/sync-all.sh --dry-run      # preview (prune is destructive)
git diff --exit-code -- .agent .cursor .claude # exactly what CI checks
```

The verifier covers: skill inventory vs manifest, AGENTS.md count, the `@AGENTS.md` import in CLAUDE.md, always-on parity, skill frontmatter limits, description **"Use when"** + **"Do NOT use"** boundaries, body `## When to use` + `## Related skills` (fail), rule citations (`§N` must resolve, including numbered list items like `§6.9`), backticked and bare filenames, example imports, `scripts/`/`references/`/`examples/` reachability and script execute bits, Cursor globs matching real files, cited `pnpm <script>` names and three-part version ranges resolving to a manifest, rule-inventory claims (`Always-on rules (N)`, `rules: X always-on + Y scoped`, `Scoped (N rules, M total)`, `all N descriptions`, and the generated `.dsh/AGENTS.md` line) matching frontmatter and disk, canonical skills citing rules as `.md` with a verification section, and byte parity of the DeepSeek Harness mirror (`.dsh/rules`, `.dsh/skills`, no flat `.md` at the skills root, kebab names matching folders).

## Checking whether a skill actually fires

A skill nobody invokes is invisible cost: all 49 descriptions load on every turn. Probes worth using: `/skill-doctor` for per-skill context cost and invocation counts, and the `InstructionsLoaded` hook to log which rule files loaded. If a skill never fires on the prompts it is meant for, the fix is the **description**, not the body.

## Related skills

`antigravity-workspace`, `mms-code-review`, `mms-ci-ratchets`.

Claude agent: `mms-docs-auditor` (`.claude/agents/mms-docs-auditor.md`).
