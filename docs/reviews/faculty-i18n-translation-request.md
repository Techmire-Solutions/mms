# Faculty i18n — Translation Request (m25–m28)

The following hardcoded-English strings in the faculty module need proper **en / ar / ur / fa**
translations before the code can be de-hardcoded. Until then they render English in every locale
(same as today). English source + suggested key are given; the ar/ur/fa columns are to be filled by
a bilingual reviewer.

## m25 — Workload warnings (`packages/shared/src/faculty/facultyWorkload.ts`)

| Key | en (source) | ar | ur | fa |
|---|---|---|---|---|
| `faculty.workload.creditsExceeded` | `Total teaching credits ({credits}) exceeds maximum allowed limit ({max})` | | | |
| `faculty.workload.sectionsExceeded` | `Section count ({count}) exceeds maximum allowed sections ({max})` | | | |
| `faculty.workload.hoursExceeded` | `Weekly contact hours ({hours}) exceeds maximum limit ({max})` | | | |
| `faculty.workload.creditsBelowMin` | `Total teaching credits ({credits}) is below minimum required ({min})` | | | |

## m26 — Zod refine messages (`facultyDesignationTypes.ts`, `facultyDepartmentTypes.ts`)

| Key | en (source) | ar | ur | fa |
|---|---|---|---|---|
| `faculty.validation.designationSelfParent` | `A designation cannot be its own parent` | | | |
| `faculty.validation.designationEndBeforeStart` | `Designation end date must not precede its start date` | | | |
| `faculty.validation.endBeforeStart` | `End date must not precede start date` | | | |

## m27 — Display-name fallback (`packages/shared/src/faculty/facultyUtils.ts`)

| Key | en (source) | ar | ur | fa |
|---|---|---|---|---|
| `faculty.displayName.withEmployeeId` | `Faculty ({id})` | | | |
| `faculty.displayName.withId` | `Faculty #{id}` | | | |

## m28 — Frontend error fallbacks (`useFacultyQueries.ts`, `useFacultyTsrQueries.ts`, `useEmployeeIdMigration.ts`)

| Key | en (source) | ar | ur | fa |
|---|---|---|---|---|
| `faculty.export.limitExceeded` | `Faculty export exceeds the 100,000-record safety limit; narrow the filters.` | | | |
| `faculty.toast.loadFailed` | `Failed to fetch faculty` | | | |
| `faculty.toast.backfillFailed` | `Failed to backfill employee IDs` | | | |
| `faculty.toast.duplicateCheckFailed` | `Duplicate check failed` | | | |
| `faculty.toast.migrationFailed` | `Migration failed` | | | |

---

**Two ways to proceed once translations are available (or approved):**
1. Fill the ar/ur/fa columns above, and I'll add all keys to the four locale files and de-hardcode the
   code (return codes for m25, `translateApp`/keys for m26, empty/labelKey for m27, `t()` at call sites for m28).
2. Approve **English-as-temporary-fallback** in ar/ur/fa (identical to today's behavior), and I'll do the
   structural de-hardcoding now, leaving the ar/ur/fa columns as English for a later bilingual pass.
