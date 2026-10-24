---
name: mms-i18n-completeness
description: Audits and fixes MMS translation coverage across en/ar/ur/fa — missing keys, untranslated strings, RTL/LTR formatting, and hardcoded copy. Use when adding user-facing text, when check:i18n fails, or when a locale renders English or overflows. Do NOT use for settings-page structure or navigation registries (use mms-settings-i18n), for BiDi token/logical-CSS work (use mms-ui-ux-design), or for form field validation copy (use mms-form-architecture).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS i18n Completeness

**Rules (norms SSOT):** `mms-settings-i18n.md` (key registry, ban on `t(key) || 'English'`, date/money formatting) · `mms-ui-ux-design.md` §2–§3 (logical CSS, RTL correctness) · `mms-structure-naming.md` (Title Case scope).

## When to use

- Adding user-facing text or when `check:i18n` fails
- A locale renders English fallbacks or overflows

## Accounting terminology and exports

Advisory: pair translation parity with [accounting policy applicability](../mms-finance-accounting/references/policies-2026.md). Verify negative amounts, debit/credit labels, dates, account IDs, currency codes and fund restrictions in RTL and exported reports. A present translation key does not prove correct financial meaning; localization never changes the accounting basis, stored currency, or recognition date.

## Where translations live

| File | Role |
|---|---|
| `packages/shared/src/i18n/appTranslationsEn.ts` | **source of truth** — add the key here first |
| `packages/shared/src/i18n/appTranslationsAr.ts` | Arabic |
| `packages/shared/src/i18n/appTranslationsUr.ts` | Urdu |
| `packages/shared/src/i18n/appTranslationsFa.ts` | Farsi |
| `packages/shared/src/i18n/appTranslations.ts` | aggregation/lookup used by the runtime |

Locales are `en`, `ar`, `ur`, `fa`; `ar`/`ur`/`fa` are RTL, `en` is LTR.

## The gate

```bash
pnpm run check:i18n
```

Current implementation (`scripts/i18n/check-translations.ts`) reports missing/English-equal values using a source-text heuristic and an invariant allowlist. It does not exit nonzero for missing translations, so a successful command is not a blocking parity gate. Review the counts and changed keys explicitly; exact meaning, interpolation and Persian fallback behavior still need review.

## Procedure

1. **Never write user-facing text inline.** No literal copy in JSX, `notify.*` calls, validation messages, chart labels, export headers, or PDF templates. Every string resolves through `t('...')`.
2. **Add keys in order:** `appTranslationsEn.ts` → `ar` → `ur` → `fa`. Run the completeness report and inspect its counts before finishing; do not claim CI fails on missing translations.
3. **Ban the fallback idiom.** `t('key') || 'English default'` hides a missing key forever — the rule forbids it, and it is why missing keys need explicit review until a blocking parity check is implemented.
4. **Format through the shared helpers, never inline `Intl`:** dates via `formatDate`, money via `formatMoney`/`formatNumber`, numbers/percentages via the shared formatters. This keeps locale, calendar, and decimal-as-string conventions consistent with the backend DTOs (`mms-settings-i18n.md`).
5. **Dynamic content:** use the translation engine's parameter/interpolation form rather than string concatenation — concatenation breaks word order in Urdu/Farsi and is untranslatable in Arabic.
6. **Check layout, not just text.** Longer `ar`/`ur`/`fa` strings overflow fixed-width containers and truncate buttons: verify at 375 / 768 / 1440 with the locale switched, and check the RTL mirror (start/end classes, `dir="rtl"`, icons that imply direction).
7. **Verify the surfaces you touched** in a non-English locale: the form, the error path (validation message + toast), the empty state, and any export/PDF header — exports frequently bypass the runtime translator and ship English or mojibake.

## RTL/LTR checklist for new copy

- [ ] No hardcoded `left-*`/`right-*`, `text-left`/`text-right`, `border-l-*`, `rounded-l-*` (`mms-ui-ux-design.md` §2 table)
- [ ] Numbers, dates, and phone numbers render correctly when the paragraph direction flips
- [ ] Icons that encode direction (chevrons, arrows) are mirrored or direction-agnostic
- [ ] Truncation/ellipsis does not hide required information in the longer locales

## Done means

`pnpm run check:i18n` output reviewed (exit status alone is insufficient), relevant locale packs updated in the same change, no hardcoded copy introduced, and the touched surfaces spot-checked in one RTL locale at mobile + desktop widths.

## Related skills

`mms-settings-i18n` (settings + navigation registries), `mms-ui-ux-design` (tokens, BiDi, layout), `mms-reports-export` (export/PDF copy), `mms-messaging` (template tokens and campaign copy).
