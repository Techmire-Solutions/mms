---
description: App settings, live preview draft states, navigation registries, and i18n translation keys (en/ar/ur/fa)
paths:
  - "apps/frontend/src/tenant/features/settings/**"
  - "apps/frontend/src/tenant/features/**/*Settings*"
  - "apps/frontend/src/platform/**"
  - "apps/frontend/src/lib/contexts/TranslationContext.tsx"
  - "apps/frontend/src/platform/lib/themeScope.ts"
  - "apps/frontend/src/lib/config/settings*"
  - "apps/frontend/src/lib/config/routes.ts"
  - "apps/frontend/src/lib/config/navConfig.tsx"
  - "apps/frontend/src/hooks/useTranslation.ts"
  - "packages/shared/src/i18n/appTranslations*.ts"
---

# MMS Settings, Navigation & Internationalization

**Workflow skills:** `/settings` + i18n → `mms-settings-i18n` · Backup wipe-restore → `mms-backup-restore` · Module Setup → `mms-module-setup`.

## 1. App-Wide Settings (`/settings` Scope)
- **Unified Settings Route:** All app-wide settings panels mount under `/settings` tracked via `SettingsTabContext` (`setActiveTab()`). Standalone sub-routes are banned.
- **Section Allowlist:** Registered sections: `global`, `modules`, `branding`, `theme`, `backup`, `llm`. Module-specific configurations belong strictly in that module's **Setup → Preferences** tab.
- **Encrypted Backup & Wipe-Restore:**
  - Export: Server-generated `.mmsbak` via AES-GCM (`GET /api/db/backup`).
  - Two-Step Restore: (1) Password re-auth + mandatory safety backup download (`createSafetyBackup`), (2) wipe-restore (`beginRestore`) unlocked only when `safetyReady`.
  - Validate backup JSON schema and tenant subdomain match before decrypt prompt; partial restores are banned.

## 2. Navigation Registry
- **Sidebar SSOT:** Sidebar retrieves navigation links exclusively from `NAV_ITEMS` in `navConfig.tsx`.
- **Academics Modules:** Submenu grouping mirrors `SYSTEM_MODULE_NAV`: `students`, `faculty`, `sessions`, `attendance`, `enrollment`, `hasanat`, `examination`, `questionBank`. Item access comes from `TENANT_APP_ROUTE_ACCESS` (`mms-auth-security.md` §3), not from `NAV_ITEMS`.

## 3. Live Previews & Settings Drafts
- **Draft State:** Retain panel changes in component state via `useSettingsDraft` (or `useBrandingDraft`/`useThemeSettingsDraft`). Never commit to database until explicit **Save**.
- **Dynamic Preview:** Call `onPreview(draft)` on draft mutations for immediate UI surface updates. Revert previews on unmount via `revertSettingsPreviews()`.

## 4. Internationalization & Locale Dictionary
- **Supported Locales:** English (`en`, SSOT in `appTranslationsEn.ts`), Arabic (`ar`, RTL), Urdu (`ur`, RTL in `appTranslationsUr.ts`), and Persian (`fa`, override in `appTranslationsFa.ts`).
- **Zero Hardcoded Strings:** All user copy resolves via `t('key')`. English fallback chains (`t(key) || 'Fallback'`) are banned.
- **Key Parity & Types:** Add new keys to `appTranslationsEn.ts` first, then mirror across ar, ur, fa. Settings and fields use `labelKey: AppTranslationKey`. Parameter interpolation matches `TranslationArgs<K>`.
- **BiDi Layout Tokens:** Logical Tailwind only (`text-start`, `ms-*`, `ps-*`, `border-s-*`, `rtl:*`). Consume `dir`/`isRtl` from `useTranslation()`.
- **Intl Formatting SSOT:** Format all dates and currency via settings-aware `formatDate`/`formatMoney` from `@mms/shared`. Raw `.toLocaleDateString()` and `.toLocaleString()` are banned.

## 5. Platform Isolation & Tenant Routing
- **Platform Apex English Lock:** Platform apex (console, onboarding, admins, auth, tenant-not-found) is locked to **English + LTR**. Never consume tenant `settings.language`. Hardcode `dir="ltr"` and `lang="en"`.
- **Unknown Tenant Gate:** Invalid/missing tenant subdomains trigger immediate hard-redirect (`window.location`) to `ROUTES.tenantNotFound` (`/tenant-not-found?subdomain=...`). Never mount tenant routes or `/settings` on invalid subdomains. Disabled workspaces render `WorkspaceDisabledScreen`.

