---
name: mms-reports-export
description: Builds MMS module analytics, CustomReportBuilder, Recharts dashboards, and PDF/Excel/print exports. Use when editing Reports tabs, KPIs, ExportToolbar, drill-down, saved reports, or dashboard widgets. Do NOT use for primary entity CRUD directories (use mms-module-work), multi-tier module layout (use mms-module-page), or background worker scheduling (use mms-background-jobs).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-04
---

# MMS Reports & Export Workflow

**Rule (norms SSOT):** `mms-reports.md` · `mms-data-layer.md` · `mms-performance.md` §1-2 · `mms-module-architecture.md`.
**Workflows:** `/feature-module` · **Manifest:** `.agent/skills-manifest.json`

## When to use

- Editing Reports tabs, KPIs, ExportToolbar, drill-down, or saved reports
- Changing dashboard widgets or analytics charts

Report checklists (accessibility, filters, i18n/formatting, completion): **`references/report-checklists.md`**.

## Accounting statements and issued exports

Advisory accounting workflow: read [closing and reporting](../mms-finance-accounting/references/closing-reporting.md) before changing financial filters or calculations. Keep post-closing trial-balance rows separate from income-statement flows and cumulative balance-sheet balances. Trace dashboard/command metrics and exports too; a correct report endpoint does not validate independent KPI queries.

Saved report definitions remain live logic. An explicitly issued/exported financial pack can retain its authorized artifact, source cutoff, basis, currency, and policy version under retention controls; it is not a stale cache serving live reports. Cash-flow classification and framework applicability come from the finance reference, not a chart label.

## Placement

Reports tab **inside** each module — no standalone `/reports` page. Shared UI: `apps/frontend/src/components/reports/` · utils: `@/lib/reports/*`.

## Data (Query-first)

REST reports/KPIs use Query hooks / `/metrics` — not localStorage-primary. Factories → **`mms-query-factories`**.

```ts
// ✅ REST modules — Query / server aggregates / /metrics
const { data, isError, refetch } = useModuleReportAggregatesQuery(...)

// ✅ Dashboard widgets / visualizer
useWidgetCollections({ requiredCollections })
useReportCollectionRows(collectionKey)

// ❌ Never — collection dumps for chart data
useLiveCollection('finance_invoices', SEED)          // banned for REST entities
getCollection('finance_invoices')                    // primary read banned
useFinanceInvoicesPaginated({ page: 1, limit: 500 }) // 500-row client dump banned
saveCollection('students', rows)                     // widget toggle banned
```

- Module category must be module-specific — never `category="academic"`.
- Cross-module ids via batch `/resolve` — no N+1 hydrate loops.
- Charts: `lazy` + `SafeResponsiveContainer` — recharts must NOT be imported directly in report parent components.
- **Chart Type Intelligence**: Consult UI/UX Pro Max chart recommendations (`python3 .agent/skills/ui-ux-pro-max/scripts/search.py "<metric type>" --domain chart`, skill `ui-ux-pro-max`) to choose accessible chart types (bullet charts for KPI targets, trend areas, and distribution bars with data table fallbacks).
- Widget toggles: `persistWidgetRecordToggle` — not `saveCollection`.
- **Aggregation on server only**: charts showing monthly/weekly/daily bucketing require a `/report-aggregates` backend endpoint. No `limit:500` page dump + client `reduce()`.
- **QueryOptions**: report aggregate queries use `staleTime: 5 * 60 * 1000` — reports are not real-time.
- **Dashboard / KPI SSOT**: home seeded cards + report standard KPIs → category-gated `use*Metrics` / widget-aggregates. Gate `useWidgetCollections({ requiredCollections })` for pinned widgets / builder / drilldown; visualizer → `useReportCollectionRows`. Niche charts/statements may Query-reduce rows when aggregates unavailable — never localStorage-primary for REST. Ban fake faculty hours (`hours += 2`); use real class counts.
- **Soft-Delete Manifest Compliance**: Analytical dashboards must respect manifest `softDelete.reportsIncludeDeleted: false` by querying only active records (`WHERE deleted_at IS NULL`). Exports must respect manifest `softDelete.exportsIncludeDeleted: false` by hiding export buttons in trash mode and excluding archived rows (`docs/soft-delete.md` §5 & §7.6 · `mms-soft-delete`).

## Tier Shell Standard

Every `*ReportsTier.tsx` must use this exact shell — no inner wrapper divs:

```tsx
export function ModuleReportsTier(): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="moduleName" />
        <ModuleReports category="moduleName" />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
```

## Chart Rules & Lazy Loading
- **Chart Component Isolation**: Recharts must NOT be imported directly into parent report components. Extract chart JSX into a `{Module}ReportCharts.tsx` sibling and lazy-load it with Suspense and Skeleton fallback.
- **Safe Responsive Container**: Wrap all charts in `ReportChartCard` (which enforces `SafeResponsiveContainer` and handles empty states).
- **Reference Example**: `.agent/skills/mms-reports-export/examples/ModuleReportCharts.tsx`.

## Add / Change a Report

1. Add a `/api/{module}/report-aggregates` backend route if new monthly/weekly data bucketing is needed.
2. Create a `use{Module}ReportAggregates` query hook with `staleTime: 5 * 60 * 1000`.
3. Register metadata in `@/lib/reports` / `reportMetadata` when shared across modules.
4. Extract chart JSX into a `{Module}ReportCharts.tsx` sibling — lazy-load it from the parent.
5. Embed in module Reports tab; show `ErrorState` (with `description` hint) when query-backed and `isError`.
6. Add module-aware filters only — update `CATEGORY_FILTERS` in `ReportFilters.tsx`.
7. Wire drill-down: chart segment `onClick` → push URL params → Work directory with equivalent filters.
8. Saved reports: save **logic** (filters/columns/aggregates), not snapshots.
   - Generic modules → `/api/saved-reports?category=` (typed `saved_reports` table).
   - Contacts (share scopes) → `/api/contacts/saved-reports` only; category `contacts` in the same table — never resurrect `contacts_saved_reports` objects.
9. Add `aria-label` on the `<section>` root and `aria-label` on each `ReportChartCard`.
10. All text rendered in charts (axis, tooltips, legends) must go through `t()`.

## Export Standards & Compliance
Detailed size gates, background queuing, formula injection protection, and tamper-evident compliance export specs:
- Reference `.agent/skills/mms-reports-export/references/export-standards.md` · `mms-background-jobs`.

## Done

`pnpm typecheck` · `cd apps/frontend && pnpm lint` — `mms-completion-review.md`.

## Related skills

`mms-module-page`, `mms-background-jobs`, `mms-finance-accounting`, `mms-ui-ux-design`.
