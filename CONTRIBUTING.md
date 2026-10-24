# Contributing to MMS

## Connect

- Clone via HTTPS: `https://github.com/Techmire-Solutions/mms.git`
- After `pnpm install`, `prepare` sets `git config core.hooksPath .githooks` (repo-managed hooks, not husky)

## Branch → commit → push → PR → deploy

1. Branch off `main` with a prefix: `feat/`, `fix/`, or `chore/` (e.g. `feat/contacts-pagination`).
2. **Commit** — [`.githooks/pre-commit`](.githooks/pre-commit) runs `pnpm check:secrets` and cached ESLint on staged files only (seconds). [`.githooks/commit-msg`](.githooks/commit-msg) requires [Conventional Commits](https://www.conventionalcommits.org):
   - `feat|fix|chore|refactor|perf|test|docs|ci|build|style|revert` with optional `(scope):` description
   - Example: `feat(contacts): add keyset pagination`
3. **Push** — [`.githooks/pre-push`](.githooks/pre-push) **blocks direct pushes to `main`**, then runs `pnpm ci:local`: affected-package typecheck, changed-file lint, and the unit tests related to your changes (full suites when tooling/config or `packages/shared` changes). Prefer `git push -u origin HEAD`.
4. **Pull request** — open a PR into `main`. Use a Conventional Commits **PR title** (CI validates it). Squash-merge is preferred so history stays conventional.
5. **Merge** — GitHub ruleset requires a PR, CODEOWNERS review on protected paths, and green **`CI Gate (All Checks Passed)`**. Prefer **squash** merges with a Conventional Commits PR title.
6. **Deploy** — a successful CI **push** to `main` builds/attests `mms-dist`; `deploy.yml` promotes that artifact to production (GitHub Environment `production`).

### Repo admin: apply branch / environment protections

Collaborators without admin cannot change rulesets. A repo admin should run once (or after policy drift):

```bash
bash scripts/ci/apply-github-branch-protections.sh
```

That script sets: 1 required approval, CODEOWNERS reviews, strict status checks (`CI Gate` + `PR Title`), squash-only merges, delete-branch-on-merge, and `production` environment reviewers (CODEOWNER) limited to protected branches. Also enable **Secret scanning + Push protection** under Settings → Code security if not already on.

Green `pnpm ci:local` is necessary but not sufficient for full Actions parity. Before merge when you touched DB, e2e, i18n, or release packaging, also run:

```bash
pnpm ci:local:full
# and when those paths changed:
pnpm ci:local --with-db
pnpm ci:local --with-e2e
# or combined:
bash scripts/ci/local-ci.sh --full --with-db --with-e2e
```

## Bypasses

- `SKIP_LOCAL_CI=1` skips hook CI checks. Agents must not set this unless the user explicitly asks.
- Do not use `--no-verify` unless the user explicitly asks.
- Never force-push to `main`.

## Secrets and standards

- Never commit `.env` files, credentials, or secrets.
- When changing rules or skills, run `bash .agent/scripts/sync-all.sh`, then `node scripts/verify-rules-integrity.mjs`.

## Agent norms

Agents follow `AGENTS.md` / `mms-core`: never `git add` / `commit` / `push` unless the user asks; always leave `pnpm ci:local` green first.
