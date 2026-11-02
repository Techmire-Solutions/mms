# Automatic Role Tagging

Contacts receive system-managed tags from the Student and Faculty modules. The
tags are a projection of role state, not free text: a contact write cannot add,
rename, or remove them.

## Role sources

| Source | Active when | Tag | System key |
| --- | --- | --- | --- |
| Student | Student row is live and status is `active` or `suspended` | `Student` | `student:self` |
| Parent | The student primary contact has a `Parent` relationship to this contact; any active student link keeps it active | `Parent` | `student:parent` |
| Guardian | The student primary contact has a `Guardian` relationship to this contact | `Guardian` | `student:guardian` |
| Faculty tenure | Employment status `active`/`on_leave`, live faculty + designation, open tenure window | `faculty-<Designation>` | `faculty:designation:<designationId>` |
| Faculty assignment | Same employment/designation conditions plus an open assignment window | `faculty-<Designation>` | `faculty:designation:<designationId>` |

Faculty tags come from **both** HR tenure (`faculty_employ_designations`) and
multi-role assignments (`faculty_assignments`). One contact can hold several
faculty tags plus Student/Parent/Guardian tags.

## Archive and reactivate

- Role end or unlink converts the tag to `Former …` (`Former Student`, `Former
  faculty-Teacher`, …) and sets `archived = true`.
- System rows are never deleted by reconciliation. If the role returns, the same
  row becomes active again.
- A contact merge is the one exception: the merged-away contact's system rows are
  removed because that contact is being folded into another record.
- Explicit mutations reconcile immediately. Employment/assignment **end dates**
  are also swept hourly by the worker, so a date-only end archives without
  waiting for an unrelated contact save.
- Start/end dates are evaluated against the **workspace-local** day
  (`workspaces.timezone`, UTC when unset). A future-dated start stays
  archived/absent until that local day arrives.
- The sweep only visits contacts that hold faculty tags or a live faculty
  employment; student/guardian changes are event-driven and do not require it.
- Per-contact reconciliation takes a transaction-scoped advisory lock, so two
  concurrent role/contact writes cannot create the same system row and fail on
  the unique indexes.

## Tag names and duplicate handling

- Faculty names use the designation's display name exactly: `faculty-Teacher`.
- Two active designations with the same name collapse to one visible tag. If one
  is later renamed, the names diverge and a second tag is created.
- A manual tag whose name matches an incoming system tag is converted in place:
  the row keeps its id/created-at, gains `source`/`system_key`, and is no longer
  editable.
- `faculty-…`, `Former faculty-…`, and the six student role labels are reserved.
  Contact writes and CSV imports drop them from manual input; bulk tag requests
  return `400`.

## Read model

`GET /api/contacts/:id` (and list responses) include:

```ts
tags: ["Student", "faculty-Teacher"];       // display names, active + archived
systemTags: [
  {
    name: "Student",
    source: "student",                       // "student" | "faculty"
    systemKey: "student:self",
    archived: false
  }
];
```

`systemTags` is read-only. It is stripped together with `tags` when the
`basic.tag` field is hidden by field permissions. The contact form renders these
chips with a lock icon and no remove control; the Setup tag lookup excludes
reserved names.

## CSV / import behavior

- Export writes the display names in the normal Tag column.
- Contact CSV import filters reserved names, so re-importing an export cannot
  create a manual duplicate of a system tag.
- Batch import writes reconcile once at the end of the batch (per-contact
  reconciliation is suppressed while `batchMode` is on).
- Google/bulk contact saves preserve existing system rows and reconcile the saved
  contacts once after the bulk write.

## Migrations and backfill

- `0201_contact_system_tags.sql` adds `source`, `system_key`, `archived`,
  `updated_at`, the partial unique indexes, and backfills Student/Faculty tags.
- `0202_backfill_relationship_role_tags.sql` backfills `Parent`/`Guardian` from
  the student primary contact's relationship graph (the `students.father_*`
  columns are legacy and normally empty).
- New roles after deployment are tagged by the lifecycle hooks. Date-ended roles
  that predate the sweep are repaired by its first run, using workspace-local
  dates.

## Troubleshooting

- Missing tag on a contact: confirm the role row is active and inside its
  start/end window, then save the role (or wait for the hourly sweep).
- Unexpected `Former …` tag: check student status, employment status/end date,
  designation status, and the tenure/assignment end date.
- Duplicate-looking tags are collapsed by design when their display names match;
  rename one designation to distinguish them.
- The worker must be running for date-only archives. Explicit role edits do not
  require the worker.
