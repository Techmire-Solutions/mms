---
name: mms-settings-i18n
description: Governs application-wide settings panels (/settings), settings preview states, sidebar navigation registries, and localization/i18n standards (en/ar/ur/fa). Use when adding or modifying settings, sidebar navigation items, custom localizations, translation files, or RTL/LTR layout mirroring. Do NOT use for per-module setup preferences (use mms-module-setup), full encrypted backup/restore (use mms-backup-restore), or generic BiDi UI tokens (use mms-ui-ux-design).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Settings, Navigation & Internationalization

**Rule (norms SSOT):** `mms-settings-i18n.mdc` · `mms-ui-ux-design.mdc` · `mms-core.mdc`.
**Workflows:** `/feature-module` · **Manifest:** `.agent/skills-manifest.json`

## When to use

- Adding global `/settings` panels or sidebar nav items
- Adding or syncing user-facing translation keys (en/ar/ur/fa)
- Fixing RTL/LTR mirroring for settings or shell chrome (with `mms-ui-ux-design`)

## Accounting localization

Advisory: use [exact-money guidance](../mms-finance-accounting/references/ledger-controls.md). Locale controls presentation, not functional currency, fiscal dates, or stored scale.

## Anti-Patterns & Banned Operations

- ❌ **NEVER use fallback strings in `t()`**: Strict ban on `t('key') || 'English Default'`. Register the key in `appTranslationsEn.ts` first.
- ❌ **NEVER use physical directional CSS**: Ban `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`. Use logical CSS (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`).
- ❌ **NEVER add RTL locale packs for platform apex**: Platform administration is strictly English/LTR.
- ❌ **NEVER put module-specific preferences under `/settings`**: Module preferences belong under their respective module Setup tier (`mms-module-setup`).

## Localization pipeline

1. Add the key to `packages/shared/src/i18n/appTranslationsEn.ts`.
2. Sync ar/ur/fa packs to match.
3. Consume via `useTranslation` + `AppTranslationKey` (`@/hooks/useTranslation`).
4. Verify: `pnpm run check:i18n`.

Keep user-authored field labels as data. Use semantic tokens and logical spacing. Preserve LTR isolation for phone/identifier strings inside RTL text.

## Verification

```
- [ ] New keys registered in appTranslationsEn.ts and synced to ar/ur/fa
- [ ] Zero t('key') || 'English' fallback idioms
- [ ] Pure logical CSS properties (ps-, pe-, ms-, me-, start-, end-)
- [ ] Date and currency formatted via formatDate and formatMoney
- [ ] Run: pnpm typecheck && pnpm --filter mms-frontend lint && pnpm run check:i18n
```

## Related skills

`mms-i18n-completeness`, `mms-ui-ux-design`, `mms-module-setup`, `mms-frontend`.
