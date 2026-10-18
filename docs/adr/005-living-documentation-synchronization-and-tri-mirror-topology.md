# ADR-005: Living Documentation Synchronization and Tri-Mirror Rule Topology

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Development teams and AI coding assistants operate across Cursor, Claude Code, and Antigravity. Rule drift causes conflicting agent behaviors.
- **Decision:**
  1. Single source of truth (SSOT) for rules is `.cursor/rules/*.mdc`.
  2. SSOT for skills is `.agent/skills/*/SKILL.md`.
  3. Automated synchronization via `bash .agent/scripts/sync-all.sh` mirrors rules to `.agent/rules/` and `.claude/rules/`, and skills to `.cursor/skills/` and `.claude/skills/`.
  4. CI and pre-commit gates enforce zero drift via `node scripts/verify-rules-integrity.mjs`.
  5. Architectural evolution must be documented immediately in `DECISIONS.md` and `SYSTEM_ARCHITECTURE.md`.
- **Consequences:** Complete agent alignment across all tools and synchronized living documentation.

---
