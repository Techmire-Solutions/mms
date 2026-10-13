# Standardized Module Data Transfer Architecture (Import & Export SSOT)

**Owner:** Platform Architecture  
**Status:** Active / Standard  
**Package:** `@mms/shared` (`packages/shared/src/dataTransfer/`)  
**Scope:** All Form-Containing Modules in MMS Monorepo  

---

## 1. Executive Summary

In older implementations, CSV export and import were maintained independently per module: export routines hardcoded column lists and extractors, while import dialogs re-declared custom field mappings and template generators. This led to:
1. **Schema Drift**: Export column labels diverged from import header expectations.
2. **Metadata Leaks**: Internal identifiers (`id`, `_id`, `tenantId`, `createdAt`, `updatedAt`, `deletedAt`) were exposed in exports or accepted during imports.
3. **DRY Violations**: Redundant mapping objects duplicated throughout frontend modals.

The **MMS Data Transfer Framework** resolves this by establishing a Single Source of Truth (SSOT) for every form-containing module. A single schema definition generates:
- Human-readable export columns
- Cell extractors
- Symmetrical import mappings & aliases
- Clean downloadable CSV templates
- Type-safe row parsing and validation

---

## 2. Core Invariants

### 2.1 Field Whitelist (System Metadata Stripping)
Internal system metadata must never be exposed to users in CSV exports, nor accepted from external imports into application state.

**Enforced Stripped Keys:**
```typescript
[
  'id', '_id', 'uuid',
  'tenant', '_tenant', 'tenantId', 'tenant_id',
  'createdAt', 'created_at', 'createdDate', 'created_date',
  'updatedAt', 'updated_at', 'updatedDate', 'updated_date',
  'deletedAt', 'deleted_at', 'deletedDate', 'deleted_date',
  'isDeleted', 'is_deleted',
  'createdBy', 'created_by', 'updatedBy', 'updated_by', 'deletedBy', 'deleted_by',
  'version', '__v', '_rev', 'rev',
  'syncStatus', 'sync_status',
  'shardedHash', 'sharded_hash', 'hashChain', 'hash_chain'
]
```

**Enforcement Points:**
- [`createModuleTransferSchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/core/moduleTransferSchema.ts): Automatically strips any fields whose key or label matches metadata keys.
- [`buildExportGrid`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/export/buildExportGrid.ts#L33-L47) & [`yieldExportGridChunks`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/export/buildExportGrid.ts#L61-L77): Filter columns through `filterNonMetadataColumns()` at the root grid generation layer.
- [`runGridCsvExportJob`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/lib/backgroundJobs/runGridCsvExportJob.ts) & [`useModuleServerCsvExportActions`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/lib/backgroundJobs/useModuleServerCsvExportActions.ts): Sanitize columns before triggering downloads or server export jobs.
- [`registerModuleCsvExportRoutes`](file:///Users/syedaalin/Documents/mms/apps/backend/src/lib/registerModuleCsvExportRoutes.ts): Sanitizes incoming export columns on Fastify endpoints.

### 2.2 Bidirectional 1:1 Header Symmetry
- Every column generated in a CSV export has its label mapped as the **primary expected header** in the import schema (`header: field.label`).
- Exporting records from a module produces a CSV that can be immediately re-imported into the same module with **0 missing headers** and **0 mapping warnings**.
- External and legacy files are supported via configured `aliases` (e.g. `['employee_id', 'emp_id', 'Emp ID']`).

### 2.3 Single Source of Truth (SSOT)
Each module declares a `TransferFieldDefinition<TEntity>` array defining:
- `key`: Entity property name
- `label`: Human-readable column header
- `aliases`: Optional alternative import headers
- `required`: Mandatory check during import
- `sample`: Value used in auto-generated templates
- `extract`: Optional custom cell formatter for exports
- `parse`: Optional custom value parser/transformer for imports

---

## 3. Architecture Overview

```
              ┌─────────────────────────────────────────────────────────┐
              │           @mms/shared ModuleTransferSchema              │
              │  (createModuleTransferSchema / TransferFieldDefinition) │
              └──────────────┬───────────────────────────┬──────────────┘
                             │                           │
                             ▼                           ▼
            ┌──────────────────────────────────┐ ┌─────────────────────────────────┐
            │         Export Pipeline          │ │         Import Pipeline         │
            ├──────────────────────────────────┤ ├─────────────────────────────────┤
            │ • exportColumns                  │ │ • importMappings                │
            │ • buildExportGrid()              │ │ • mapCsvGridToObjects()         │
            │ • yieldExportGridChunks()        │ │ • fromImportCsv()               │
            │ • csvSerializer / jsonSerializer │ │ • generateTemplate()            │
            └────────────────┬─────────────────┘ └────────────────┬────────────────┘
                             │                                    │
                             ▼                                    ▼
            ┌──────────────────────────────────┐ ┌─────────────────────────────────┐
            │ Frontend / Backend Consumers     │ │ Frontend / Backend Consumers    │
            ├──────────────────────────────────┤ ├─────────────────────────────────┤
            │ • useModuleServerCsvExportActions│ │ • useModuleCsvImportActions     │
            │ • runGridCsvExportJob            │ │ • ModuleImportDialog            │
            │ • registerModuleCsvExportRoutes  │ │ • registerModuleCsvImportRoutes │
            └──────────────────────────────────┘ └─────────────────────────────────┘
```

---

## 4. Exemplary Module Implementation: Faculty

The **Faculty** module demonstrates full integration of this architecture for both primary entities and sub-catalogs.

### 4.1 Schema Definitions ([`facultyTransferSchema.ts`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/schemas/facultyTransferSchema.ts))
- **`facultyTransferSchema`**: Full field whitelist for faculty members (name, employee ID, department, designation, specialization, phone, email, notes).
- **`facultyDesignationTransferSchema`**: Consolidated SSOT schema for department designations.

### 4.2 Frontend Import Dialog ([`FacultyCsvImportDialog.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyCsvImportDialog.tsx))
Consumes the generic [`ModuleImportDialog`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/components/ui/ModuleImportDialog.tsx) and the hook `useModuleCsvImportActions`:

```tsx
export function FacultyCsvImportDialog({
  open,
  entity,
  onClose,
  canWrite,
}: FacultyCsvImportDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();

  const facultyActions = useModuleCsvImportActions<FacultyTransferEntity>({
    apiPath: "/api/faculty/import",
    schema: facultyTransferSchema,
    defaultLabel: t("faculty.io.importFacultiesJob"),
    onSuccess: onClose,
  });

  const designationActions = useModuleCsvImportActions<FacultyDesignationCsvRow>({
    apiPath: "/api/faculty/designations/import",
    schema: facultyDesignationTransferSchema,
    defaultLabel: t("faculty.io.importDesignationsJob"),
    onSuccess: onClose,
  });

  if (!open || !entity || !canWrite) return null;

  return entity === "faculties" ? (
    <ModuleImportDialog<FacultyTransferEntity>
      open={open}
      onClose={onClose}
      title={t("faculty.io.importFaculties")}
      subtitle={t("faculty.io.csvHint")}
      canWrite={canWrite}
      actions={facultyActions}
    />
  ) : (
    <ModuleImportDialog<FacultyDesignationCsvRow>
      open={open}
      onClose={onClose}
      title={t("faculty.io.importDesignations")}
      subtitle={t("faculty.io.csvHint")}
      canWrite={canWrite}
      actions={designationActions}
    />
  );
}
```

---

## 5. Monorepo Coverage Catalog

All 15 form-containing modules have implemented, registered transfer schemas in [`packages/shared/src/dataTransfer/schemas/`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/schemas/):

| Module | Title | Priority | SSOT Schema | Status |
|:---|:---|:---:|:---|:---:|
| `contacts` | Contacts | P1 | `contactsTransferSchema` | Fully Wired (vCard + CSV) |
| `students` | Students | P1 | `studentsTransferSchema` | Fully Wired (SSOT Dialog) |
| `faculty` | Faculty | P1 | `facultyTransferSchema` + `facultyDesignationTransferSchema` | Fully Wired (SSOT Dialog) |
| `sessions` | Sessions | P1 | `sessionsTransferSchema` | Fully Wired (SSOT Dialog) |
| `enrollments` | Enrollments | P1 | `enrollmentsTransferSchema` | Fully Wired (SSOT Dialog) |
| `users` | Users | P2 | `usersTransferSchema` | Fully Wired (SSOT Dialog) |
| `questionBank` | Question Bank | P2 | `questionBankTransferSchema` | Fully Wired (SSOT Dialog) |
| `accounting` | Accounting | P2 | `accountingTransferSchema` | Fully Wired (SSOT Dialog) |
| `finance` | Finance | P2 | `financeTransferSchema` | Fully Wired (SSOT Dialog) |
| `attendance` | Attendance | P3 | `attendanceTransferSchema` | Fully Wired (SSOT Dialog) |
| `examinations` | Examinations | P3 | `examinationsTransferSchema` | Fully Wired (SSOT Dialog) |
| `hasanat` | Hasanat | P3 | `hasanatTransferSchema` | Fully Wired (SSOT Dialog) |
| `obligations` | Obligations | P3 | `obligationsTransferSchema` | Fully Wired (SSOT Dialog) |
| `tasks` | Tasks | P3 | `tasksTransferSchema` | Fully Wired (SSOT Dialog) |
| `messaging` | Messaging | P3 | `messagingTransferSchema` | Fully Wired (SSOT Dialog) |

---

## 6. Migration Guide for Remaining Modules

To connect an existing form module to this standardized data transfer system:

### Step 1: Create the Feature Import Dialog
Create `{Module}CsvImportDialog.tsx` in `apps/frontend/src/tenant/features/{module}/components/`:
```tsx
import { ModuleImportDialog } from "@/components/ui/ModuleImportDialog";
import { useModuleCsvImportActions } from "@/lib/backgroundJobs/useModuleCsvImportActions";
import { {module}TransferSchema, type {Module}TransferEntity } from "@mms/shared";

export function {Module}CsvImportDialog({ open, onClose, canWrite }) {
  const actions = useModuleCsvImportActions<{Module}TransferEntity>({
    apiPath: "/api/{module}/import",
    schema: {module}TransferSchema,
    onSuccess: onClose,
  });

  return (
    <ModuleImportDialog
      open={open}
      onClose={onClose}
      title="Import Records"
      canWrite={canWrite}
      actions={actions}
    />
  );
}
```

### Step 2: Wire Header Actions
In `{Module}PageHeaderActions.tsx`, add an Import button with permission check (`canWrite`):
```tsx
{canWrite && (
  <ActionButton variant="outline" icon={Upload} onClick={onOpenImport}>
    {t("common.import")}
  </ActionButton>
)}
```

### Step 3: Register Fastify Queue Endpoint
In `apps/backend/src/routes/tenant/{module}/`:
```typescript
registerModuleCsvImportRoutes(fastify, {
  canWrite: (user) => canWriteCollection(user, '{module}'),
  bodySchema: {module}ImportBodySchema,
  moduleId: '{module}',
  defaultLabel: 'Importing {module}…',
  entityNoun: '{entity}',
  queueAuditAction: '{module}.import',
});
```

### Step 4: Verification Checklist
1. Export existing data to CSV and verify headers match `field.label` and no `id`/`tenant_id` appear.
2. Upload the exported CSV to the import dialog and verify 100% valid rows without missing header warnings.
3. Verify download of template CSV generates correct headers and sample values.
4. Run `pnpm typecheck` and `pnpm --filter mms-frontend test`.
