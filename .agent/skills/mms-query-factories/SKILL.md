---
name: mms-query-factories
description: Implements TanStack Query v5 queryOptions/mutationOptions factories, tuple keys, optimistic updates, and API facades. Use when building query hooks, data fetching facades under @/tenant/hooks/collections/*, or caching mutations. Do NOT use for app routing (use mms-frontend), legacy document-store db.ts (use mms-data-sync), or Work tier directory UI (use mms-module-work).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Query Factories Workflow

**Rule (norms SSOT):** `mms-hooks.md` · `mms-data-layer.md` §3 · `mms-api-interface.md` · `mms-performance.md` §5.
**Workflows:** `/feature-module` · **Manifest:** `.agent/skills-manifest.json`

## When to use

- Building TanStack Query factories under `@/tenant/hooks/collections/*`
- Caching mutations, tuple keys, or optimistic (non-money) updates

## Financial mutation review

Advisory checklist: read [ledger controls](../mms-finance-accounting/references/ledger-controls.md) for money, posting, reconciliation, and close actions. Preserve the operation identity across retries; changing economic content requires a new operation or a conflict. A disabled submit button is not idempotency.

Under the existing no-optimistic-money rule, await persisted success, retain form input on conflict/failure, and invalidate affected finance/accounting lists, balances, reports, and setup state. A cancelled request or network timeout does not establish that the server rolled back; resolve uncertain outcomes before retrying external payments.

## Anti-Patterns & Banned Operations

- ❌ **NEVER fetch data via manual `useEffect`**: All server state reads must go through TanStack Query options.
- ❌ **NEVER use ad-hoc string keys**: Always define structured tuple key constants with `as const satisfies readonly unknown[]`.
- ❌ **NEVER perform optimistic updates on financial or bulk writes**: Optimistic updates are strictly limited to idempotent, low-risk UI (e.g. single-item soft-delete hide with 5–10s undo toast).
- ❌ **NEVER deep-import feature hooks across modules**: Always re-export public surfaces through `@/tenant/hooks/collections/{module}.ts`.

## Step-by-Step Workflow

1. **Verify REST Authority**: Confirm entity is server-authoritative REST. Never add `useLiveCollection` for REST entities.
2. **Tuple Query Keys**: Define query key constants and tuple factories in `features/{module}/hooks/{module}QueryKeys.ts`.
3. **Query options:** inspect `apps/frontend/src/tenant/features/contacts/hooks/contactsListQueryBuilders.ts` and `apps/frontend/src/lib/query/` for real contract shapes and signal forwarding. Reuse the declared ts-rest client or `apiJson`/`apiFetch`; no exported `apiClient.get/post` object exists.
4. **Invalidation:** await/return the shared invalidator so mutation completion has deliberate freshness semantics. If accepting caller callbacks, compose them explicitly; a trailing options spread must not replace mandatory invalidation.
5. **Mutation:** derive the write type from the shared contract, gate reads by session/capability, and expose pending, failure and success states. Keep cancellation distinct from server rollback.

6. **Cross-Feature Facade**: Re-export query options, hooks, and types in `@/tenant/hooks/collections/{module}.ts`.

## Verification Checklist

```
- [ ] queryOptions/mutationOptions colocated with tuple keys
- [ ] AbortSignal forwarded to apiContract/fetchOptions
- [ ] Previous-page placeholders limited to the same authorized dataset; expose stale/pending state and guard actions
- [ ] No manual useEffect fetch calls
- [ ] Re-exported through @/tenant/hooks/collections/{module}.ts
- [ ] Run: pnpm typecheck
```

Advisory cache review: inspect both in-memory Query state and IndexedDB persistence during logout, account switch and permission revocation. Auth-gating a query does not erase existing data. Include every response-shaping filter in keys; preserve existing scope conventions and test isolation before extending persistence. See the [frontend review](../mms-frontend/references/frontend-review.md).

## References

- Query Key Hierarchies & Cache Policies: `references/query-key-and-cache-policy.md`

## Examples

- Factory template: `examples/templateQueryFactory.ts`

## Related skills

`mms-frontend`, `mms-data-sync`, `mms-module-work`, `mms-backend-api`.
