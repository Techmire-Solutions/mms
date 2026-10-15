---
name: mms-vuln-response
description: Triages and responds to a dependency security advisory in MMS — reachability analysis, override policy, and the reviewed-exception pattern. Use when pnpm audit, Dependabot, dependency-review, or gitleaks reports a finding and it must be fixed or explicitly accepted. Do NOT use for routine version bumps (use mms-dependency-upgrade) or for application-level auth weaknesses (use mms-backend-security).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Vulnerability Response

**Rule (norms SSOT):** `mms-dependencies.md` (version/override policy, banned packages) · `mms-performance.md` (banned client deps) · `mms-auth-security.md` (application-level controls). Auth audit workflow → `mms-backend-security`.

## When to use

- pnpm audit, Dependabot, dependency-review, or gitleaks reports a finding
- A dependency advisory must be fixed or explicitly accepted

## Severity decides the response

| Severity | Response | Deadline shape |
|---|---|---|
| Critical | Patch or remove immediately; if unreachable, document the analysis and add a regression test that proves unreachability | before the next deploy |
| High | Patch now; the reviewed-exception route is allowed only with a reachability proof | same release |
| Moderate / Low | Patch in the normal maintenance pass; a documented exception is acceptable | next dependency pass |

CI enforces `pnpm audit --audit-level=high` and, for pull requests, `actions/dependency-review-action` with `fail-on-severity: high` — a PR that *adds* a vulnerable package is blocked even when the lockfile currently passes.

## Procedure

1. **Reproduce the finding locally** — never work from the alert text alone:
   ```bash
   pnpm audit --audit-level=high
   pnpm why <package>          # who pulls it in, and at which version
   pnpm outdated -r            # is a fixed version already available?
   ```
2. **Patch first.** Prefer, in order: bump the direct dependency → bump the parent that pins it → a `pnpm.overrides` entry in `pnpm-workspace.yaml` → remove the dependency.
3. **Prove reachability before accepting a finding.** The `ts-deepmerge` entry in the `overrides` block of `pnpm-workspace.yaml` is the house pattern: it names the advisory (CVE + GHSA), states why the override is unsafe (the fix breaks `@ts-rest/open-api`, guarded by a test), and proves the vulnerable path is unreachable with the exact call site. Copy that structure — a bare "accepted risk" comment is not a reviewed exception.
4. **Guarded exceptions need a guard.** If the exception depends on configuration (an env flag, a route that 404s in production), add or point at the test that enforces it — otherwise the exception silently becomes false.
5. **Secrets are a different track.** A gitleaks hit means the credential is compromised the moment it was committed (CI scans full history). Rotate/revoke it first; deleting the line does not undo exposure. Reviewed false positives go in `.gitleaks.toml` with a reason.
6. **Verify the fix is real:**
   ```bash
   bash .agent/skills/mms-dependency-upgrade/scripts/audit-deps.sh
   pnpm typecheck && pnpm test
   ```
   An override that changes a package's module format (CJS/ESM) breaks runtime behaviour that typecheck cannot see — run the affected tests, and for large bumps run `pnpm test:e2e`.

## Do not

- Lower `--audit-level` or add `|| true` to make the gate pass.
- Add a blanket override for a whole major range to silence one advisory.
- Accept a Critical advisory with no reachability analysis and no test.
- Commit a rotated secret back into the same file that leaked it.

## Related skills

`mms-dependency-upgrade` (catalogs, Renovate/Dependabot, React Compiler), `mms-backend-security` (exploitability inside the app), `mms-dev-setup` (env/secrets layout).
