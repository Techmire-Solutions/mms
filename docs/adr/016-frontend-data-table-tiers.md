# ADR-016: Two frontend data-table tiers (client-side `DataTable` vs server-driven directory)

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Frontend/platform maintainers

## Context
Module pages shared a large amount of three-tier page boilerplate (`{Module}PageView`
+ `Work/Reports/SetupTier` + `use{Module}PageController`), and there are two table
stacks: `DataTable` (client-side search, facet filters, table/card toggle, per-user
column layout) over `WorkBatchTable`, and `WorkBatchTable` + `EntityCardsGrid` used
directly by the standard module work directory.

A consolidation onto `DataTable` for the work-directory modules (students, contacts)
was considered. It is blocked by three facts: (1) those directories drive
**server-side** search and pagination (`debouncedSearch`/`listPage` → the work query),
whereas `DataTable`'s search is client-side over the loaded page and its toolbar is
non-suppressible; (2) they render cards through the shared `EntityCardsGrid`, not
`DataTable`'s card layout; (3) the directory owns external chrome (filters menu, trash
toggle, keyboard shortcuts bound to a fixed search-input id, server sort). Forcing
`DataTable` on them would silently downgrade search to page-only and change the card
grid — regressive, not DRY.

## Decision
1. **Keep two intentional tiers.** `DataTable` is for self-contained, client-side
   tables. `WorkBatchTable` + `EntityCardsGrid` + external `*Filters` is the
   server-driven work-directory tier. This is a deliberate split, not duplication to
   be collapsed.
2. **Share the invariant page shell instead.** Standard module pages render the shared
   `ModuleTierPage` scaffold (`src/components/app/ModuleTierPage.tsx`) and resolve the
   tier-navigation prefix via `useModuleTierPageNav`. The Reports tier body is the
   shared `ModuleReportsTier`; per-category report selection is data in
   `moduleReportRegistry.tsx`, not a `switch (category)`.
3. **Bridge, don't fork, the table stacks.** Descriptor-driven tables derive their
   column set from the shared `EntityDescriptor` via `useDescriptorColumnLayout` /
   `resolveVisibleDescriptorColumns` (`src/hooks/useDescriptorColumnLayout.ts`), then
   supply per-column cell renderers at the call site — one canonical source for column
   set, order, and visibility. (A speculative `descriptor → DataTableColumn` adapter was
   removed: it had no consumer, since the renderers are always view-specific.)
4. Introducing a `DataTable` server mode (controlled search/sort/view/count) is a
   prerequisite for any future records-driven migration; do not migrate a
   server-driven directory onto `DataTable` before that exists.

## Consequences
- The "two table stacks" are documented as intentional; new modules pick the tier that
  matches their data source (client-side vs server-driven).
- Page-level duplication is removed by the scaffold + descriptor adapter without
  regressing directory search or card UX.
- A future consolidation must add a `DataTable` server mode first, and verify parity
  with E2E (axe + responsive) because card/search behaviour is UX-sensitive.
