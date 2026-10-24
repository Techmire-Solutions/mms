# Work Directory Architecture & CI Ratchets

Governs compliance with `scripts/check-work-directory.mjs` and `mms-module-architecture.mdc` §3/§7.

## The Six Invariant Ratchets

### 1. Banned Retired Bulk Bar Adapter
- **Rule:** Never import `ModuleStandardBulkActionBar`.
- **Standard:** Use `ModuleUniversalBulkActionBar` directly or wrap via `ModuleWorkBulkActionBar`.

### 2. Banned Legacy Directory Shells
- **Rule:** Never import `useWorkDirectoryController` or `ModuleWorkDirectoryShell`.
- **Standard:** Page controllers own layout and state; compose directories with `DataTable` / `WorkBatchTable`.

### 3. No CSS Dual-Rendering in Directory Lists
- **Rule:** Zero `md:hidden` / `md:block` dual-rendering inside `*List.tsx` directory files.
- **Reason:** Rendering both table and card DOM nodes causes severe performance degradation, duplicate DOM listeners, and virtualization desync.
- **Standard:** Use unified responsive layout or conditional rendering based on view mode state (`viewMode === 'table' ? <TableView /> : <CardsView />`).

### 4. Selection State SSOT
- **Rule:** Zero `selectedCount: 0` dummy shortcut stubs in page controllers.
- **Standard:** Always wire row selection through `useWorkSelection`. Row selection state must be authoritative and singular.

### 5. Centralized Data Table Primitives
- **Rule:** Zero hand-rolled `<Table>` or `<table>` tags in directory or catalog features.
- **Standard:** Use `DataTable` or `WorkBatchTable`. Non-directory tables (e.g., balance sheets, trial balance, ledger detail lines) require explicit inclusion in `RAW_TABLE_ALLOWLIST`.

### 6. Directory Card Composites
- **Rule:** Work-directory card composite items (`*CardItem.tsx`, `*CardsView.tsx`) must never use outer `<EntityCard>` wrappers.
- **Standard:** Use `DirectoryCard` for directory composites. `<EntityCard>` is a primitive slot element only. Non-Work form cards (such as `MarkAttendanceStudentCard.tsx`) are strictly allowlisted in `ENTITY_CARD_OUTER_ALLOWLIST`.

## Verification Command

```bash
pnpm run check:work-directory
```
