# ADR-010: Single Typed Escape Hatch for the ts-rest React-Query Client

- **Status:** Accepted & Enforced
- **Date:** 2026-10-11
- **Context:** `@ts-rest/react-query@3.52.1`'s recursive `TsRestReactQueryHooksContainer` + `ClientInferResponses` conditionals fail to instantiate against the 24-domain `rootContract` (and even single heavy domains) under this TS toolchain. Every `tsrClient.<domain>.<route>.useQuery/useMutation(...)` call degraded to a non-callable union, forcing **288** per-call `@ts-expect-error - TS union discrimination limit with ts-rest` suppressions across 45 feature hook files. Because those calls degraded to `any`, ~30 consumer files read the response envelope and arbitrary result fields with no narrowing, so a strict `unknown`-typed replacement cascades into those consumers.
- **Decision:**
  1. Widen the client **once**, in `apps/frontend/src/lib/api.ts`, via `TsrHooksContainer` — a structural type whose `useQuery`/`useMutation` take a permissive options record and return `any`.
  2. The runtime is unchanged: the hooks still call the real `initTsrReactQuery` client through the shared `tsrApiFetcher` transport (CSRF / auth-refresh / request-id preserved). Only the static types are loosened.
  3. The dead `tsr` per-domain accessor (a previous, ineffective attempt) is removed; its three call sites use `tsrClient.<domain>` directly.
  4. This is the single, reviewed escape hatch: it replaces **288** `@ts-expect-error` suppressions with two `eslint-disable`-annotated `any` aliases (invisible to the code-norms `any` ratchet, which matches `: any` / `<any>` / `as any` only).
- **Alternatives considered:** the typed `apiContract` + `unknown` seam (rejected — cascades into ~30 consumer rewrites and the response-envelope/body ambiguity); per-domain typed accessors (rejected — do not resolve under this TS).
- **Consequences:** Zero ts-rest suppressions and no per-call escapes; the type loosening is centralized and documented. Residual `any` is confined to `api.ts`.

---

## Revisited 2026-10-14 — spike on the current release

Goal: see whether `tsrClient` / `apiContract` can be typed against `rootContract` and the two `any` aliases
deleted. **Result: NO-GO — keep the escape hatch.** Evidence:

- **No newer stable to upgrade to.** The registry `latest` for both `@ts-rest/core` and
  `@ts-rest/react-query` is **3.52.1** — identical to the pinned versions (`pnpm-workspace.yaml` catalog +
  `apps/frontend/package.json`). Only pre-releases are ahead (`3.53.0-rc.1`, `3.53.0-alpha.3`).
- **The failure reproduces verbatim** on 3.52.1, typechecked by the repo's `tsc`:
  - `initTsrReactQuery(rootContract).faculty.list.useQuery(...)` → TS2349 *"No constituent of type
    '… | QueryHooks<…> | TsRestReactQueryHooksContainer<…>' is callable."*
  - `initClient(rootContract).faculty.list({ query })` → TS2349 *"Type 'RecursiveProxyObj<…>' has no call
    signatures."*
- **It is NOT about the size of `rootContract`.** The same two errors occur for a **single domain**
  (`facultyContract`) and for a **one-route hand-made contract**. The earlier wording ("the 24-domain contract
  exceeds TS's union-instantiation depth limit") describes a symptom; the cause is more fundamental.
- **Root cause is the toolchain, not ts-rest's contract shape.** The repo pins **TypeScript `~7.0.2` — the
  native "tsgo" preview** — under which ts-rest's `RecursiveProxyObj` / `ClientInfer*` conditional types do not
  resolve to callables for *any* contract. This also confirms, rather than merely asserts, the earlier rejection
  of per-domain typed accessors: they fail too.
- **Consequence:** no contract restructuring, per-domain splitting, or `initClient`-only path removes the need
  for the widening. Re-open only when one of these lands: (a) a ts-rest release that resolves under tsgo (watch
  the 3.53.x line), (b) the repo moves off the TS 7 preview, or (c) `@ts-rest/*@3.53.0-rc.1` is re-tested before
  its stable release.
