# Platform Console Settings & White-Label

**Scope:** `/platform/settings` (apex console), platform-scoped persistence, runtime white-label branding, and the platform AI/backup surfaces.
**Out of scope:** editing a tenant's `/settings` from the console; platform-wide tenant-data wipe/restore; tenant branding.

## 1. Information architecture

The platform settings page mirrors the tenant `/settings` sections so operators get the same mental model:

| id | Tab | Contents | API |
| --- | --- | --- | --- |
| `global` | General | Timezone/date format, idle-session policy (2FA/step-up/audit read-only), notification toggles + email/SMS integrations, TLS/certbot | `PUT /api/platform/settings` |
| `branding` | Branding | Product name, console title, tagline, logo/favicon, footer, contact, legal/registration, address, social links | `PUT /api/platform/branding` |
| `theme` | Theme | Display-mode default, primary/secondary colours, corner style, footer, logo-colour extraction | `PUT /api/platform/branding` (`themeMode` + appearance) |
| `modules` | Modules | Platform-wide availability (feature flags) + defaults for new workspaces | `PUT /api/platform/modules` (super-user) |
| `llm` | LLM | Provider configs, masked keys, default text model, connection test, model discovery | `PUT /api/platform/llm`, `POST /api/platform/llm/{test,models}` (super-user) |
| `backup` | Backup | Encrypted platform-configuration export/import + export history | `POST /api/platform/backup/{export,import}` (super-user + step-up) |

Legacy deep links `?section=notifications` / `?section=security` resolve to `global`. Nav and section components
live in `apps/frontend/src/platform/features/settings/lib/platformSettingsNavConfig.ts` and
`platformSettingsSectionComponents.ts`; keep ids aligned with `PLATFORM_SETTINGS_SECTIONS`.

## 2. Persistence

- `platform_settings` (singleton `id = 'global'`) — TLS, notifications, `timezone`, `date_format`, `theme_mode`,
  `default_enabled_modules`, `disabled_modules`, `llm_provider`, `llm_api_key` (encrypted), `llm_configs`
  (encrypted keys), `idle_session_minutes`, `whatsapp_notifications`.
- `platform_branding` (singleton `id = 'global'`) — product identity + appearance, mirroring the tenant
  `workspaces.branding` columns (`product_name` replaces `madrasa_name`).
- Both caches are in-memory + Redis (`platform:settings:global`, `platform:branding:global`) and are merged with
  defaults on read so a stale cached shape never breaks boot.
- LLM keys are encrypted with the existing `encryptSecretAtRest` envelope; responses are always masked
  (`****last4`). A masked/omitted key never overwrites the stored secret.

Migration: `packages/db/migrations_drizzle/0272_platform_settings_branding.sql` (forward-only,
`lock_timeout`, journal + snapshot).

## 3. Runtime white-label

1. `GET /api/public/platform-branding` (unauthenticated) returns the public branding, `themeMode`, timezone, and
   date format from the in-memory caches (ETag, `no-cache`).
2. `apps/frontend/src/lib/branding/platformBrandingStore.ts` hydrates that payload at apex boot (bounded wait),
   caches it in `mms_platform_branding`, and emits subscribe events.
3. `lib/settingsPreviewStore` returns platform branding on apex; `applyApexPlatformTheme`, `useBranding`,
   `documentFavicon`, and the sidebar/header/auth layouts read it.
4. `TranslationProvider` resolves `entry.productName` / `platform.consoleTitle` from branding on apex only.
5. `public/theme-init.js` reads the cached `themeMode` on `/platform*` paths to avoid a first-paint flash.
6. `GET /api/public/platform-manifest.webmanifest` builds the PWA manifest from branding; the app swaps the
   manifest link only after custom branding hydrates (the static `site.webmanifest` remains the default).
7. Platform email sender name falls back to the branding product name when `PLATFORM_EMAIL_FROM_NAME` is unset.

## 4. Modules enforcement

- `loadModuleAvailability` ANDs `platform_settings.disabled_modules` into every workspace's availability and
  marks entries `platformDisabled`; module gates then deny with `MODULE_DISABLED`.
- Tenant settings writes cannot re-enable a platform-disabled module (`saveGlobalSettings` forces it off).
- Onboarding rejects a platform-disabled module and falls back to `default_enabled_modules` when the caller
  sends no list. The wizard seeds its selection from `GET /api/platform/modules/catalog` (`settings` **or**
  `onboard` grant), renders only platform-enabled modules, and never overwrites a selection the operator edited.
- Tenant Settings → Modules renders a platform-disabled module as a locked “Managed by platform” card
  (`moduleAccessResponseSchema.platformDisabled`) and cannot toggle it; the server still strips any re-enable.

## 5. LLM & backup boundaries

- The platform LLM provider only powers the Platform AI assistant (`synthesizePlatformAiDiagnostics` uses it,
  falls back to the deterministic telemetry synthesiser and reports `mode: "llm" | "heuristic"`). The platform
  config modal discovers models through `POST /api/platform/llm/models` via the shared scoped `useLlmModelFetch`
  hook (tenant and platform pass their own endpoint).
- Backup exports an **encrypted configuration snapshot** (settings without secrets + branding + workspace/admin
  registry metadata). Import validates the strict snapshot schema, decrypts with the operator's email/password,
  and applies **settings + branding only** in one transaction. Workspace/admin sections are reported as not
  applied: tenant data lives in separate databases and credentials must never be restored from a file.
- There is no all-tenant wipe/restore and no tenant backup restore from the apex.

## 6. Authorization

| Action | `settings` grant | `super_user` | Step-up |
| --- | --- | --- | --- |
| Read settings/branding/catalog; write regional/TLS/notifications/idle/branding/theme | yes | – | – |
| Write module availability/defaults, LLM config/tests/models | yes | yes | – |
| Export/import a configuration backup | yes | yes | password |

Every write appends a `platform_activity_logs` row (`update_platform_branding`, `update_platform_modules`,
`update_platform_llm`, `export_platform_backup`, `import_platform_backup`, existing `update_settings`).

## 7. Verification

`pnpm typecheck` · frontend lint · affected Vitest suites · `check:shared-ui` · `check:code-norms` ·
`check:frontend-structure` · `check:backend-boundaries` · `check:backend-structure` · `check:i18n` ·
`check:migration-hygiene` · `check:migrations-forward-only` · `pnpm ci:local`.
`e2e/tests/platform/platform-settings.spec.ts` is a local-only, non-destructive smoke flow (tabs, branding
propagation to the apex sign-in, super-user-only notices); it seeds only a dedicated platform admin and restores
branding in `finally`.
