# ADR-009: Prettier Owns Formatting (enforced)

- **Status:** Accepted & Enforced
- **Date:** 2026-10-11
- **Context:** `.prettierrc.json` and `.prettierignore` were committed but Prettier was never installed, so formatting was unenforced and the editor hook (`.cursor/hooks/format-edited-file.sh`) silently no-opped.
- **Decision:**
  1. `prettier` and `eslint-config-prettier` are root devDependencies; `pnpm format` (write) and `pnpm format:check` (verify) are root scripts.
  2. `eslint-config-prettier/flat` is registered last in every `eslint.config.js` (frontend, backend, `@mms/shared`, e2e) so ESLint owns no stylistic rules.
  3. `.prettierignore` excludes agent/scratch trees (`.agent/`, `.cursor/`, `.claude/`, `.commandcode/`, `.superpowers/`, `docs/`) so the tri-mirror rule/skill corpus stays byte-identical for `verify-rules-integrity.mjs`, and the unified translation dictionaries (`packages/shared/src/appTranslations*.ts`, the ADR-001 exemption) which a line-based i18n parity checker (`scripts/i18n/check-translations.ts`) parses one `"key": "value"` per line.
  4. `pnpm format:check` gates the `typecheck-lint` CI job.
  5. **ADR-004 authorization recorded:** this change adds root dependencies and edits `.github/workflows/ci.yml` (both Protected Zones); explicit authorization was granted by the project owner for the remediation program of 2026-10-11.
- **Consequences:** Consistent formatting repo-wide, machine-enforced in CI; the one-time reformat landed as an isolated commit.

---
