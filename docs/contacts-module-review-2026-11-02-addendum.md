# Contacts Deep-Dive Review Addendum — Messaging, Uploads, Duplicate Scan

Follow-up to [contacts-module-review-2026-11-02.md](./contacts-module-review-2026-11-02.md). That review
closed C-01–C-11 but left three surfaces checked only for tenant scoping. This addendum audits them:
**read-only**, no fixes applied. Reviewed at `main` = `9fdf1f374` (post-#261/#262/#263).

**Method.** Focused suites were run green (backend contacts 29 files/279 tests, messaging 9/91, upload 2/16;
frontend contacts+messaging 132/323; shared contacts 43/337; `check:db-projections` and `check:code-norms`
clean). Lane A was reproduced against a seeded dev tenant via a throwaway probe calling the real
`loadMessagingRecipients`; the other findings are proved from the executed code path and labelled where
only latent.

---

## 1. Verdict

**One P1** (cross-module PII exposure through the messaging recipient list), one **P2** (field-level
visibility bypass in recipient resolution), and eight **P3s**. The upload storage layer is otherwise
well-hardened (magic-byte AVIF/WebP, octet-stream + attachment disposition, tenant path checks, rate
limits); the duplicate SQL is tenant-scoped and correct, but its cache lifecycle is incomplete.

| ID | Severity | Lane | Finding |
| --- | --- | --- | --- |
| A-01 | **P1** | Messaging | `GET /api/messaging/recipients` returns full contact records (notes, DOB, addresses, phones, emails) under `messaging.read`; teacher/assistant_teacher/librarian have no `contacts.read` |
| A-02 | **P2** | Messaging | Resolve/match recipients bypass Contacts field-level permissions for phone/email (no viewer sanitizer) |
| A-03 | P3 | Messaging | Recipient listing hydrates child collections it never uses (addresses/socials/relationships) |
| A-04 | P3 | Messaging | Resolve path loads full contacts (bank details, attachments) and discards them for a 4-field DTO |
| B-01 | P3 | Uploads | Root-level `/uploads/<category>/…` files are readable by any authenticated tenant session (no tenant segment to check) |
| B-02 | P3 | Uploads | Any authenticated tenant role can upload 10 MB attachments / 512 KB images; no module action or quota gate |
| B-03 | P3 | Uploads | Attachment files are orphaned when the record is deleted or the contact save fails; no reconciler |
| B-04 | P3 | Uploads | Attachment `url`/`name` are client-supplied and rendered as a download link; external/phishing URLs accepted |
| C-01 | P3 | Duplicates | Duplicate cache never expires (`computedAt` unused) and preferences changes do not invalidate it → stale pairs after `namePrefixesToIgnore` edits |
| C-02 | P3 | Duplicates | On-demand page reads rescan and fully hydrate the blocked set without caching; scan/write races can persist a pre-write cache |

---

## 2. Lane A — Messaging ↔ contacts

### A-01 — P1 — Full contact records exposed to messaging-only roles

**Evidence.**
- `GET /api/messaging/recipients` is gated only by `canReadMessaging` and returns
  `loadMessagingRecipients` unchanged ([messagingRecipientContractHandlers.ts:23-50](../apps/backend/src/routes/tenant/messaging/messagingRecipientContractHandlers.ts)).
- That use case returns `loadContactsPageForTenant(...)` — a `ContactsListPageResult` of hydrated
  contacts ([messagingRecipientUseCases.ts:21-59](../apps/backend/src/messaging/use-cases/messagingRecipientUseCases.ts)).
- The response schema is the **full** `contactListPageResponseSchema`
  ([messaging.contract.ts:59-64](../packages/shared/src/contracts/messaging.contract.ts),
  [contacts.contract.schemas.ts:20-28](../packages/shared/src/contracts/contacts.contract.schemas.ts)).
- Summary hydration still includes top-level scalars (notes, DOB, CNIC, aiSummary) plus
  phones/emails/addresses/tags/socials/relationships
  ([contactRepositoryHydrate.ts:51-77](../apps/backend/src/db/repositories/contactRepositoryHydrate.ts),
  [contactRepositoryMappers.ts:84-95](../apps/backend/src/db/repositories/contactRepositoryMappers.ts)).
  No `sanitizeContactsForViewer` call exists in the messaging path.
- Role defaults grant `messaging: ["read"]` with **no `contacts` grant** to `teacher`,
  `assistant_teacher`, and `librarian`
  ([userRbacDefaultRoles.ts:95-155](../packages/shared/src/auth/userRbacDefaultRoles.ts)).

**Reproduced.** A read-only probe against seeded tenant `a11ypopd…` calling the real loader returned
contacts whose payload included `notes: "Father of Quran student…"`, `dob`, `addresses[1]`, `phones[1]`,
`emails[1]` — fields a teacher cannot open in Contacts.

**Impact.** A role with no Contacts access can enumerate the directory and read free-text notes, DOB,
addresses, phone/email — PII beyond the recipient picker’s need. This is a cross-module authorization
boundary failure, not just over-fetching.

**Fix.** Make the list return lean recipients (the existing `StandardMessagingRecipient` used by
`match`/`resolve`) or apply `sanitizeContactsForViewer` plus a restricted projection; change
`listRecipients`’ response schema to the recipient list. If the richer payload is genuinely needed,
require `contacts.read` for it. Acceptance: a teacher token gets name/phone/email only, with no
notes/DOB/addresses.

### A-02 — P2 — Recipient resolution ignores Contacts field permissions

`resolveMessagingRecipients` and `matchMessagingRecipients` map contacts with `toMessagingRecipient`
([messagingRecipientUseCases.ts:62-120](../apps/backend/src/messaging/use-cases/messagingRecipientUseCases.ts))
without the viewer field config. A Setup rule hiding phone/email from a role is bypassed for any role with
`messaging.read`. Precondition: non-empty `permissions` in contact field config (API-written today, same as
C-04/C-05). Fix: apply `sanitizeContactsForViewer` (or the column-access filter) before mapping, and add a
restricted-role test.

### A-03 / A-04 — P3 — Over-fetching

- The list hydrates addresses/socials/relationships that the picker never reads (`:21-59`).
- `resolve` loads `findContactsByIds` (full hydration: bank details, attachments, education) then keeps only
  id/name/phone/email (`:62-75`); the summary loader would suffice. Both add query work per keystroke/selection
  on large tenants.

---

## 3. Lane B — Avatar and attachment uploads

Positive checks: image uploads accept only AVIF/WebP, verify magic bytes (buffer and stream paths), enforce
512 KB, and partition by tenant ([imageAssetService.ts:13-175](../apps/backend/src/services/imageAssetService.ts)).
Attachments enforce 10 MB, sanitize filenames, unlink on size/stream failure, and serve as
`application/octet-stream` + `Content-Disposition: attachment` with `private, no-store`
([uploads.ts:96-174](../apps/backend/src/routes/common/uploads.ts),
[staticAssets.ts:30-46](../apps/backend/src/plugins/staticAssets.ts)). `/uploads/**` is session-gated and
tenant-matched, with traversal rejection ([staticAssets.ts:99-186](../apps/backend/src/plugins/staticAssets.ts)).
No stored-HTML/XSS path was found; upload POSTs are inside the global rate limiter.

### B-01 — P3 — Root-level uploads skip the tenant match

`authorizeUpload` authenticates, then returns early when the path has no `tenants/<t>/` segment
([staticAssets.ts:149-166](../apps/backend/src/plugins/staticAssets.ts)). Any authenticated tenant session can
therefore read root-level non-branding files. No root-level `attachments/` or `avatars/` currently exist in
the dev tree, and new uploads are tenant-partitioned, so this is legacy-data exposure; the code comments
themselves acknowledge root-level attachments. Fix: require a tenant segment for every non-public category
(or migrate remaining root files), and pin it with a test.

### B-02 — P3 — Uploads are session-only

`authenticateUploader` accepts any tenant session ([authenticateUploader.ts](../apps/backend/src/middleware/authenticateUploader.ts));
`/api/uploads/attachment` has no module action gate and no per-tenant quota. A viewer can write 10 MB files
(global rate limit applies). Fix: gate attachment purpose by the owning module action (contacts.write,
messaging.write, …) or add a per-tenant upload budget.

### B-03 — P3 — Orphaned attachment files

Removing an attachment deletes the contact child row only
([contactPersistEngagementChildren.ts:72-90](../apps/backend/src/db/repositories/contactPersistEngagementChildren.ts),
[useContactDetailAttachments.ts:90-110](../apps/frontend/src/tenant/features/contacts/hooks/useContactDetailAttachments.ts));
the file under `/uploads/tenants/<t>/attachments/` remains. Upload-then-save-failure leaves one too. No
sweeper exists. Fix: unlink on explicit remove and add an orphan reconciler (list-by-prefix vs rows).

### B-04 — P3 — Client-controlled attachment links

Contact writes accept `attachments[].url/name/type` verbatim and the UI renders `href={file.url}`
([ContactDetailFiles.tsx:70-102](../apps/frontend/src/tenant/features/contacts/components/detail/ContactDetailFiles.tsx)).
A writer can store an external/phishing URL (React blocks `javascript:`), and the `download` attribute is
ignored cross-origin. Fix: accept only same-origin `/uploads/…` URLs for attachments (server validation on
contact write), or render a non-navigating preview.

---

## 4. Lane C — Duplicate scan

Positive checks: blocked-id and candidate SQL are tenant-scoped and exclude soft-deleted contacts
([contactRepositoryDuplicateFind.ts](../apps/backend/src/db/repositories/contactRepositoryDuplicateFind.ts));
pair ordering/pagination is capped at `LIST_PAGE_MAX_LIMIT`
([contactsDuplicatesQuery.ts:14-27](../packages/shared/src/contacts/contactsDuplicatesQuery.ts)); cache keys
are tenant-scoped through `resolveObjectStorageKey`.

### C-01 — P3 — Stale duplicate cache after preferences change

`saveContactPreferences` saves and mirrors relationships but never calls `invalidateDuplicateScanCache`
([contactPreferencesService.ts:58-63](../apps/backend/src/contacts/use-cases/contactPreferencesService.ts)).
The scan depends on `namePrefixesToIgnore` ([contactDuplicateScanUseCases.ts:97-107](../apps/backend/src/contacts/use-cases/contactDuplicateScanUseCases.ts)),
and `computedAt` is written but never read, so cached pairs survive until some unrelated contact write
invalidates them. Fix: invalidate on preferences save and enforce a max age (e.g., 24 h) in
`getDuplicateScanCache`; add a test.

### C-02 — P3 — On-demand recompute + scan/write race

`loadDuplicatePairsPage` computes pairs when the cache is missing but does not save them, and the compute
fully hydrates the blocked set (`findByIds`, `:68`), so every page open on uncached tenants repeats the
work. Separately, a contact write that lands between `runContactsDuplicateScan`’s read and `saveObject` is
invalidated first and then overwritten by the stale cache (`:92-112`). Fix: persist on-demand results, use a
summary projection, and guard the save with a generation/version (or re-read after the scan).

---

## 5. Remediation priority

1. **A-01 (P1)** — restrict `listRecipients` to lean recipients or require `contacts.read` before any release.
2. **A-02 (P2)** — apply the viewer sanitizer in resolve/match.
3. **C-01** — invalidate duplicate cache on preferences save + TTL.
4. **B-01/B-03** — tenant-check root uploads and unlink/reconcile attachment files.
5. **A-03/A-04, B-02/B-04, C-02** — scheduled hygiene/performance work.

## 6. Residual risk

- A-01 is proved against one seeded tenant with the real loader; the route-level 200 payload was not
  re-fetched with a teacher JWT (the loader it calls is the same code path).
- B-01 is latent until root-level files exist; the dev tree currently has none.
- A-02/B-04/C-01 depend on configuration or edge flows and are code-verified, not observed in a browser.
- No browser/e2e run was needed for this addendum; the prior contacts e2e/a11y runs remain the browser baseline.

---

## 7. Remediation status (working tree, uncommitted)

All findings below are addressed in the current working tree. The findings text above is preserved as the
point-in-time review record.

| ID | Status | Fix | Key tests |
| --- | --- | --- | --- |
| A-01 | Closed | `listRecipients` now returns a lean `{recipients,total,page,limit,hasMore}` page; frontend picker consumes it directly ([messagingRecipientUseCases.ts](../apps/backend/src/messaging/use-cases/messagingRecipientUseCases.ts), [messagingModuleManifest.ts](../packages/shared/src/messaging/messagingModuleManifest.ts)). Live probe returned only `id/name/phone/email`. | `messagingRecipientsService.test.ts`, `messaging.integration.test.ts` |
| A-02 | Closed | List/resolve/match apply `sanitizeContactsForViewer` with the session role; hidden channels are dropped from channel-required queries ([messagingRecipientUseCases.ts](../apps/backend/src/messaging/use-cases/messagingRecipientUseCases.ts), [messagingRecipientContractHandlers.ts](../apps/backend/src/routes/tenant/messaging/messagingRecipientContractHandlers.ts)). | `messagingRecipientsService.test.ts` |
| A-03 | Closed | Recipient listing uses a two-collection projection (phones/emails only) via `recipientProjection`; no addresses/socials/relationships queries ([contactRepositoryRecipientHydrate.ts](../apps/backend/src/db/repositories/contactRepositoryRecipientHydrate.ts), [contactRepositoryList.ts](../apps/backend/src/db/repositories/contactRepositoryList.ts)). | `contactsConcurrencyDb.integration.test.ts` |
| A-04 | Closed | Resolve uses `loadContactsSummaryByIdsForTenant` instead of full hydration ([messagingRecipientUseCases.ts](../apps/backend/src/messaging/use-cases/messagingRecipientUseCases.ts)). | `messagingRecipientsService.test.ts` |
| B-01 | Closed | Tenant sessions are denied root-level non-public uploads via `isCrossTenantRootUpload` ([staticAssets.ts](../apps/backend/src/plugins/staticAssets.ts)). | `uploadsAuth.test.ts` |
| B-02 | Closed | `/attachment` uploads require `contacts.write`; image/branding uploads unchanged ([uploads.ts](../apps/backend/src/routes/common/uploads.ts)). | `uploadsHardening.test.ts` |
| B-03 | Closed | Explicit removal unlinks the file after a successful save, and the nightly retention cycle (02:00 UTC, leader-leased) sweeps files older than 24 h that no attachment row references; `MMS_ORPHAN_ATTACHMENT_SWEEP=off` disables it ([attachmentStorageService.ts](../apps/backend/src/services/attachmentStorageService.ts), [attachmentSweepService.ts](../apps/backend/src/services/attachmentSweepService.ts), [retentionPurgeScheduler.ts](../apps/backend/src/worker/retentionPurgeScheduler.ts)). Manual dry-run: `pnpm --filter mms-backend purge:orphaned-attachments`. | `attachmentStorageService.test.ts`, `attachmentSweepService.test.ts`, `purgeArchivedRecordsWorker.test.ts` |
| B-04 | Closed | New/changed attachment URLs must be relative `/uploads/tenants/<tenant>/attachments/…`; unchanged legacy absolute URLs are grandfathered on update/merge ([contactAttachmentUrls.ts](../apps/backend/src/contacts/use-cases/contactAttachmentUrls.ts), [contactWriteUseCases.ts](../apps/backend/src/contacts/use-cases/contactWriteUseCases.ts)). The frontend now stores relative upload URLs. | `contactAttachmentUrls.test.ts`, `contactUseCases.test.ts` |
| C-01 | Closed | Duplicate cache has a 24 h TTL and contact preferences saves invalidate it best-effort ([contactDuplicateScanUseCases.ts](../apps/backend/src/contacts/use-cases/contactDuplicateScanUseCases.ts), [contactSetupConfigRoutes.ts](../apps/backend/src/routes/tenant/contacts/contactSetupConfigRoutes.ts)). | `contactDuplicateScanService.test.ts`, `contactSetupConfigRoutes.test.ts` |
| C-02 | Closed | Uncached page reads persist the computed pairs, blocked participants hydrate through the summary projection, and both the scan and the on-demand fill are guarded by a tenant `MAX(updated_at)` write version: a write during the scan skips the save, and a write after the save deletes the cache ([contactDuplicateScanUseCases.ts](../apps/backend/src/contacts/use-cases/contactDuplicateScanUseCases.ts), [contactRepositoryPersist.ts](../apps/backend/src/db/repositories/contactRepositoryPersist.ts)). | `contactDuplicateScanService.test.ts`, `contactsConcurrencyDb.integration.test.ts` |

**Remaining residuals**

- Legacy absolute attachment URLs remain editable while unchanged; any new/changed URL is relative-only.
- The orphan sweep deletes on the worker host's `MMS_UPLOADS_DIR`; the worker and API must share that volume.
- The B-03/B-04 UI logic is now pinned by component/hook tests (recipient picker, attachment upload/unlink)
  in addition to the API/route tests; a new Playwright browser spec was not added, so the prior contacts
  E2E baseline remains the browser-level evidence.
