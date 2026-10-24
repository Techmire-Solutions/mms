## Summary

<!-- 1–3 bullets: why this change exists -->

## Test plan

- [ ] `pnpm ci:local` (the pre-push hook also runs this)
- [ ] `pnpm ci:local:full` and/or `--with-db` / `--with-e2e` if those buckets changed
- [ ] Manual checks for UI/API paths touched by this PR

## Checklist

- [ ] PR title follows Conventional Commits (`feat(scope): …`, `fix: …`, …)
- [ ] No secrets, `.env`, or credentials in the diff
- [ ] CODEOWNERS zones (`.github/`, migrations, auth, deploy scripts) reviewed when touched
- [ ] Rules/skills changes: ran `bash .agent/scripts/sync-all.sh` + `node scripts/verify-rules-integrity.mjs`
