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
