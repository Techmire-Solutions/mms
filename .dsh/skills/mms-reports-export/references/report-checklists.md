# report-checklists — mms-reports-export

Extracted from `SKILL.md` so the skill body stays loadable in one pass; the owning rule is the norm SSOT.


## Completion Checklist

```
- [ ] Query/server data for REST modules — no limit:500 page dumps
- [ ] /report-aggregates backend route for any new monthly/weekly bucketing
- [ ] staleTime: 5 * 60 * 1000 on report aggregate queries
- [ ] KPI StatCards on /metrics where available — no forced collection dumps
- [ ] Widget collections gated with requiredCollections
- [ ] No academic category on module reports
- [ ] Chart JSX in lazy-loaded sibling file; parent imports via lazy() + Suspense
- [ ] SafeResponsiveContainer via ReportChartCard (not raw ResponsiveContainer)
- [ ] Skeleton fallback on Suspense; EmptyState via emptyNode on ReportChartCard
- [ ] ErrorState with description hint when isError
- [ ] Tables / drill-down grids in overflow-x-auto; no page-level scroll at 375px
- [ ] Print: isAnimationActive={false} on charts for @media print
- [ ] ExportToolbar uses columns+rows API (not deprecated data+headers)
- [ ] Export filename includes module + date range + timestamp
- [ ] Formula injection escaped in untrusted text cells; negative numeric values preserved
- [ ] PII exports logged to audit log
- [ ] Tamper-evident compliance exports embed chain hash + Merkle root proof
- [ ] Accessing audit logs emits 'VIEW' audit entry (Auditing the Auditor)
- [ ] Background job for exports >500 rows Excel / >200 rows PDF
- [ ] Permissions match Work boundary (can(), field visibility, soft-delete policy: reportsIncludeDeleted / exportsIncludeDeleted from manifest; Export CTA hidden in trash mode)
- [ ] a11y: aria-label, table caption, keyboard drill-down, aria-busy on export
- [ ] All strings via t(); numbers via formatNumber(); dates via formatDate()
- [ ] Filter state URL-serializable; date ranges interpreted using the domain date/time contract
- [ ] Tier shell: ModuleTierMotion space-y-4, no inner wrapper divs
```

## Accessibility Checklist

```
- [ ] <section aria-label={t('module.reports.aria')}> on report root
- [ ] Hide decorative charts only when an equivalent accessible alternative exists; no focusable descendants inside aria-hidden
- [ ] <table> has <caption> or aria-labelledby pointing to section heading
- [ ] Interactive chart bars/segments: tabIndex={0} + onKeyDown Enter/Space drill-down
- [ ] KPI delta badges: aria-label="Up 12% vs last month" (not just colored icon)
- [ ] ExportToolbar shows spinner + aria-busy="true" during export
```

## Filter Standards

```
- [ ] Date range defaults to current academic session (or current month for finance)
- [ ] Date-only values preserved as calendar dates; timestamp ranges use explicit timezone and inclusive/exclusive bounds
- [ ] Free-text debounced 300ms
- [ ] Filter state URL-serializable (bookmarkable)
- [ ] Clearing a filter resets to module default, not unbounded "all time"
- [ ] CATEGORY_FILTERS in ReportFilters.tsx updated for new module
```

## i18n / Formatting

```
- [ ] All chart labels, tooltips, legends via t()
- [ ] Numbers via formatNumber() from @mms/shared
- [ ] Currency via the settings-aware formatMoney helper
- [ ] Month/date labels via formatMonthName() / formatDate() from @mms/shared
- [ ] Export column headers via t() — same keys as table column headers
```
