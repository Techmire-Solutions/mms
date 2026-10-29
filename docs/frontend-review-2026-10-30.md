# MMS Frontend Review — 2026-10-30

Focused frontend performance, service-worker lifecycle, and resilience review of `apps/frontend`.

---

## 1. Executive Summary

This review addresses service worker precache bloat, dynamic import chunk load failures on continuous deployments, pre-paint BiDi layout shifts, and query/auth provider fallback robustness.

### Key Metrics & Improvements

| Area | Before | After | Impact |
| --- | --- | --- | --- |
| **PWA Precache Entries** | **647 files (~16 MB)** | **38 files (~2.3 MB raw)** | First visit bandwidth reduced by ~85%; route-level lazy loading restored |
| **Heavy Libraries in Precache** | Included `elk` (1.4MB), `cytoscape`, `xlsx`, `jspdf`, `katex`, non-en locales | **0 forbidden chunks** | Workbox runtime CacheFirst for assets on-demand |
| **Deploy Stale-Chunk Failures** | White-screen crash on 404 chunk fetch | **Automatic 1-shot reload & recovery** | User sessions transparently recover when asset hashes rotate |
| **RTL / BiDi First Paint** | FOUC (Flash of Unstyled Content / layout flip) | **`lang` and `dir` set in `<head>`** | Layout direction resolved before DOM render |
| **Dead Unused Assets** | `platform-logo.png` (1.2 MB raster) | **Deleted** | Bundle clean-up; SVG vectors used exclusively |

---

## 2. Findings & Implementations

### F-FE-1: Workbox Precache Bloat Defeating Route-Level Code Splitting
- **Problem**: `apps/frontend/vite.config.ts` used `globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]`, causing VitePWA to precache every emitted build artifact (~16 MB raw), including mermaid diagram engines, export libraries, and all 4 locale dictionaries on the user's initial page visit.
- **Remedy**:
  - Implemented `createEntryClosureTransform` in [`entryClosurePrecache.ts`](../apps/frontend/src/lib/pwa/entryClosurePrecache.ts), restricting the precache manifest to the app shell HTML, webmanifest, favicons, and the static import closure of `index.html`.
  - Added [`scripts/check-pwa-precache.mjs`](../scripts/check-pwa-precache.mjs) enforcing a strict budget (maximum 50 entries, 3.5 MB) and forbidding heavy libraries in precache.
  - Added `check:pwa` to `package.json` and `.github/workflows/ci.yml`.

### F-FE-2: Stale Hashed Chunk Fetch Failures on Deployment
- **Problem**: When a new version deploys to production, old hashed JavaScript chunks are pruned from the server. An active user navigating to an unvisited lazy-loaded route encountered unhandled 404 dynamic import failures (`Failed to fetch dynamically imported module`).
- **Remedy**:
  - Implemented [`chunkLoadRecovery.ts`](../apps/frontend/src/lib/chunkLoadRecovery.ts), wrapping dynamic imports with a 1-shot session recovery mechanism. On failure, it detects stale deployment asset mismatches and triggers a clean reload to fetch the latest index HTML and manifest.
  - Verified with comprehensive unit test suite in `apps/frontend/src/lib/chunkLoadRecovery.test.ts`.

### F-FE-3: Layout Shift and Direction Flip Before First Paint
- **Problem**: User interface direction (`dir="rtl"`) was applied via React state hooks during hydration, resulting in visible layout reflow and text flashing when users loaded Arabic or Urdu interfaces.
- **Remedy**:
  - Extracted language and direction detection into [`public/theme-init.js`](../apps/frontend/public/theme-init.js) running synchronously in the `<head>` of `index.html`.
  - Reads stored locale from localStorage or `navigator.languages` and sets `document.documentElement.lang` and `document.documentElement.dir` prior to first paint.

### F-FE-4: Provider Resiliency & Fallback Decoupling
- **Problem**: Direct calls to `useQueryClient` or auth context hooks inside leaf components threw unhandled runtime exceptions when rendered in lightweight or isolated test harness wrappers.
- **Remedy**:
  - Created [`optionalQueryContext.ts`](../apps/frontend/src/lib/query/optionalQueryContext.ts) and safe lookup wrappers that allow components to gracefully degrade or inspect optional query providers.

### F-FE-5: Clean-up of Legacy and Duplicate Components
- **Problem**: Unused 1.2 MB raster `platform-logo.png` lingered in `public/`, and duplicate legacy `DetailSheet.tsx` coexisted with `@shared/ui`.
- **Remedy**:
  - Deleted `platform-logo.png` and `DetailSheet.tsx`.
  - Refactored faculty hook query options (`useFacultyAssignments`, `useFacultyDepartments`, `useFacultyDesignations`, `useFacultySetupConfig`) to enforce strictly typed query factories.

---

## 3. Automated Verification

- `pnpm --filter mms-frontend typecheck`: Pass (0 errors)
- `pnpm --filter mms-frontend test --run`: Pass (1,024 test suites)
- `node scripts/check-pwa-precache.mjs`: Pass (38 entries, well within budget)
- `node scripts/check-bundle-budget.mjs`: Pass
- `node scripts/check-docs.mjs`: Pass
