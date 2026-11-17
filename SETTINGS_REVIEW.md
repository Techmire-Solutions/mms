# Settings Module Review

**Scope:** app-wide tenant `/settings` (Workspace Settings) — routing, six section panels, draft/preview state, backend `global_settings`/`branding` persistence, RBAC, and the shared `settings`/`branding`/`i18n` surface.
**Out of scope (boundary only):** Platform-console settings (`apps/frontend/src/platform/**`, `routes/platform/**`) and per-module Setup-tier settings (`*ModuleSettings.ts`, `Accounting/Faculty/Attendance/…Settings.tsx`).
**Date:** 2026-11-17
**Verification:** `pnpm typecheck` ✅ · `pnpm --filter mms-frontend lint` ✅ · `pnpm run check:i18n` ✅ (10,122 keys, 0 missing/EN-fallback across ar/ur/fa).

---

## Verdict

**Needs fixes — one feature-breaking defect.** The security posture (secret masking, field-level RBAC, audit trail, tenant scoping) is genuinely strong, and the codebase is clean on i18n fallbacks and physical directional CSS. However, the **LLM configuration tab cannot persist any change** (save button permanently disabled _and_ the save merge drops the fields), which is a user-facing feature break. A small set of medium/low consistency issues follows.

## Fix status (applied 2026-11-17)

- ✅ **H1 (LLM save)** — fixed: added `globalSettingsSavePatch` (preview patch + `llmProvider`/`llmApiKey`/`llmConfigs`) and wired the dirty check, `mergeGlobalSettingsDraft`, and `retainGlobalDraftAfterModulesSave` to it. Live preview still excludes LLM fields. Covered by 4 new unit tests in `settingsGlobalDraft.test.ts`.
- ✅ **M1 (LLM intro key)** — fixed: `LlmSettings.tsx` now passes `introKey="settings.llm"` (→ `settings.llmDesc`).
- ✅ **L3 (discard consistency)** — fixed: `handleDiscardGlobal` now resets `whatsAppNotifications`.
- ✅ **L1 (dead `saved` prop)** — fixed: removed from `SettingsFormActions` interface/signature and all five call sites.
- ✅ **L2 (hardcoded fallback)** — fixed: `SettingsFormActions` now falls back to `t("theme.discardChanges")`; covered by a new test.
- ✅ **L4 (stale test mock)** — fixed: `SettingsPage.test.tsx` mock now mirrors the six real section ids.
- ✅ **M2 (display-mode permission)** — resolved M2-A: `theme` moved to a new `GLOBAL_SETTINGS_ADMIN_WRITE_ONLY_FIELD_KEYS` (read-by-all, write-by-admin); `sanitizeGlobalSettingsWrite` strips it for non-admins while reads keep the real value. The nominal residual (Theme tab gates `settings.branding.write` while `theme` persists under `global_settings`/`settings.global.write`) is **non-reachable**: both keys map to module `settings` + actions `create`/`update` in `permissionRules.ts`, so they resolve identically for every role — including custom roles — and the Theme-tab gate can never diverge from `theme`'s persistence gate.
- ✅ **L5 (branding read scoping)** — resolved: `redactBrandingIdentityForClient` (shared) + `dbObjectRoutes` now return the public + theme subset to non-admin readers.
- ✅ **L6 (settings tab abstraction)** — resolved: `usePersistedTabState` now accepts an optional `normalize` callback (defaulting to the module-tier migrator); `SettingsPage` passes an identity function, so settings section ids no longer route through `normalizeModuleTierTabId`.

All findings are resolved.

---

## Findings

### 🔴 HIGH

**H1 — LLM configuration edits are never saved (feature break + silent data loss).**

`globalSettingsPreviewPatch` is the single function reused for three purposes — live preview, the dirty check, and the save merge — and it omits `llmConfigs`, `llmProvider`, and `llmApiKey`.

- `apps/frontend/src/lib/settingsGlobalDraft.ts:15-30` — `globalSettingsPreviewPatch` returns only language/timezone/dateFormat/notification booleans/2FA/sessionTimeout/passwordPolicy. No LLM fields.
- `apps/frontend/src/lib/settingsGlobalDraft.ts:40-48` — `isGlobalPreferencesDirty` compares `globalSettingsPreviewPatch(draft)` vs `(baseline)`, so LLM-only edits are invisible.
- `apps/frontend/src/tenant/features/settings/hooks/useGlobalSettingsDraft.ts:71` — `isGlobalDirty = isGlobalPreferencesDirty(data, baseline)`.
- `apps/frontend/src/tenant/features/settings/components/LlmSettings.tsx:42` — `<SettingsFormActions dirty={isGlobalDirty} … />`.

Edits to LLM configs go through `upd("llmConfigs", …)` (`useLlmSettingsModal.ts:179`, `useLlmConfigListActions.ts:34`), which changes `data.llmConfigs` but never flips `isGlobalDirty`. Result: **the Save button stays disabled** (`SettingsFormActions.tsx:98` `disabled={… || !dirty || saving}`).

Even if the dirty flag were fixed, the save would still drop the fields:

- `apps/frontend/src/lib/settingsGlobalDraft.ts:60-66` — `mergeGlobalSettingsDraft` = `mergeGlobalSettings({ ...getGlobalSettings(), ...globalSettingsPreviewPatch(draft) })`, i.e. it re-reads `llmConfigs`/`llmProvider`/`llmApiKey` from persisted storage and **never writes the draft's values**.

`handleSaveGlobal` (`useGlobalSettingsDraft.ts:105-141`) is the only save path wired to the LLM tab, and it calls `mergeGlobalSettingsDraft`. The exclusion is **not** covered by `settingsGlobalDraft.test.ts` (it asserts `enabledModules`/`theme` exclusion but never LLM fields), so this regressed silently.

**Fix direction:** add a dedicated LLM-dirty check and a dedicated save merge (or extend a field-set that includes `llmConfigs`/`llmProvider`/`llmApiKey`) without leaking LLM fields into the live-preview overlay; add a unit test that edits `llmConfigs`, asserts dirty, and asserts the merged save retains them.

---

### 🟠 MEDIUM

**M1 — LLM tab intro renders a missing translation key.**

`LlmSettings.tsx:26` and `:35` pass `introKey="settings.llmDesc"`. `SettingsPanel` (`SettingsShell.tsx:41`) derives `const introDescKey = \`${introKey}Desc\``→`"settings.llmDescDesc"`, which **does not exist** in any locale pack. `translateApp` (`appTranslations.ts:62`) falls back to returning the key itself, and `warnIfKeyMissingAtRuntime`logs`[i18n] Missing translation key: settings.llmDescDesc`. The AI Assistant tab intro shows the literal string `settings.llmDescDesc` instead of "AI provider, credentials & assistant configuration".

Every other section passes `settings.introGlobal`/`introBranding`/`introTheme`/`introModules`/`introBackup` (→ `*Desc`). The LLM section should pass `introKey="settings.llm"` (→ `settings.llmDesc`).

**M2 — Display-mode (`theme`) authorization is inconsistent between backend and frontend.**

- `globalSettingsCore.ts:51-56` classifies `theme` as public and documents it: "Fields any authenticated tenant user may read and write (Language & Region, **Theme mode**)."
- But the only UI that edits `theme` — `ThemeSettings.tsx:33,70` — gates the whole tab behind `can("settings.branding.write")`. A non-admin has **no UI** to change display mode, yet can do so with a direct `POST /api/db/objects/global_settings` (backend `sanitizeGlobalSettingsWrite` preserves `theme` for non-admins).
- The same mismatch exists for branding appearance fields: `sanitizeBrandingWrite` (`workspacePresentationService.ts:271-280`) strips only `BRANDING_IDENTITY_FIELD_KEYS`, so `primaryColor`/`secondaryColor`/`cornerStyle`/`footerText` (`brandingSettingsTypes.ts:243-248`) are backend-writable by any authenticated user, while the UI that edits them is gated behind `settings.branding.write`.

`theme` is a **workspace-wide** value (applied globally via `applyAppTheme`), so "any user can write it" means a non-admin can change display mode for the whole workspace via API. Decide one intent and align: either (a) move the display-mode selector into the always-visible General tab (make it genuinely per-user or genuinely public), or (b) remove `theme` from `GLOBAL_SETTINGS_PUBLIC_FIELD_KEYS` and keep it admin-only — then also gate the branding theme fields consistently.

---

### 🟡 LOW / INFO

**L1 — Dead `saved` prop on `SettingsFormActions`.** `saved: _saved = false` (`SettingsFormActions.tsx:33`) is never read; all six callers pass `saved={saved}` for nothing. The "saved" badge is rendered separately by `SettingsStatusBadges`. Remove the prop or wire it up.

**L2 — Hardcoded English fallback.** `SettingsFormActions.tsx:62,90` render `{discardLabel ?? "Discard Changes"}`. Currently unreachable because every caller passes a `discardLabel`, but it's a hardcoded-copy/fallback idiom that contradicts the no-hardcoded-copy norm; make `discardLabel` required or source a registered key.

**L3 — `handleDiscardGlobal` omits `whatsAppNotifications`.** `useGlobalSettingsDraft.ts:172-185` resets every field in `globalSettingsPreviewPatch` _except_ `whatsAppNotifications`, so the dirty/discard sets can drift. Currently moot (no settings UI edits the three notification booleans — they moved to Messaging Setup), but keep the two lists in sync or drop the notification booleans from the preview patch if they're no longer part of this tab.

**L4 — Stale test mock.** `SettingsPage.test.tsx:42-59` mocks `SETTINGS_SECTION_COMPONENTS` with 8 obsolete ids (`security`, `audit`, `integrations`, `notifications`, `ai`, `trash`, `printTemplates`, `developer`) and omits `theme`/`llm`. It only renders the default tab, so it can't catch drift between `SETTINGS_SECTIONS`, `SETTINGS_NAV`, and the component registry. Update the mock to the real six ids.

**L5 — Branding read over-exposes identity fields to all authenticated tenant users.** `dbObjectRoutes.ts:62-77` returns the full `branding` object (admin `email`, `phone`, address, `legalName`, `registrationNumber`, social links) to any signed-in tenant user. The inline comment justifies this as "already public via `/api/workspace/by-subdomain`", but `toPublicBranding` (`brandingSettingsUtils.ts:65-74`) exposes only 6 fields (name/tagline/logo/favicon/colors) — not contact/legal/address. Within-tenant staff exposure is low risk, but the comment is inaccurate and the read could be scoped to non-contact fields for non-admins.

**L6 — Module-tier helper reused for settings tabs.** `usePersistedTabState` (`SettingsPage.tsx:41`) routes the settings section id through `normalizeModuleTierTabId`, which is a pass-through only because the settings ids (`global`/`branding`/`theme`/`llm`/`modules`/`backup`) don't collide with the legacy tier ids. Harmless today, but a misleading abstraction; a dedicated `useSettingsTabState` would be clearer.

---

## Notable-correctness callouts

- **Secret handling is correct end to end.** `maskGlobalSettingsForClient` masks `llmApiKey` + every `llmConfigs[].apiKey`; `saveGlobalSettings` (`globalSettingsService.ts:124-141`) has a round-trip guard so a masked/empty client key never overwrites the stored secret; the AI routes (`routes/common/ai.ts:36-44`) re-enforce `settings.global.write`.
- **Field-level RBAC is server-side and fail-closed.** `canWriteObject(user, "global_settings" | "branding")` resolves through `OBJECT_WRITE_PERMISSION` to `settings.global.write`/`settings.branding.write`; `redactAdminOnlyGlobalSettings`, `sanitizeGlobalSettingsWrite`, and `sanitizeBrandingWrite` strip unauthorized fields regardless of request body.
- **Audit + persistence share one tenant transaction.** `dbObjectRoutes.ts:138-158` writes the object and `recordModernAuditEvent` inside `withTenant`, closing the earlier fire-and-forget audit gap.
- **Registry parity is guarded.** `settingsNavConfig.ts:38-41` throws at startup if `SETTINGS_NAV` misses a `SETTINGS_SECTIONS` id; `SETTINGS_SECTIONS`/`SETTINGS_NAV`/`SETTINGS_SECTION_COMPONENTS` are currently in sync (6/6/6).
- **Non-module route is explicitly classified.** `moduleRegistry.ts:252-259` marks settings `kind: "open"` with a documented reason; per-section `requiredPermission` + in-page `SettingsAdminOnlyNotice` handle finer gating, and `routeAccess.test.ts` covers `/settings` as allowed.
- **i18n & BiDi hygiene is clean.** No `t('…') || '…'` fallbacks and no physical directional classes (`pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`) anywhere in the settings surface; `check:i18n` reports 0 missing/fallback keys.

---

## Recommended priority

1. **H1** (LLM save) — fix + unit test before any LLM-config release.
2. **M1** (`settings.llm` intro key) — one-line fix.
3. **M2** (theme/display-mode permission intent) — align backend public-field set with the UI gate.
4. **L1–L6** — cheap hygiene cleanup in the next settings-touching change.
