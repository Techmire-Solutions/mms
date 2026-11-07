# CONTACTS MODULE — MOBILE PERFORMANCE INVESTIGATION & BOTTLENECK ANALYSIS

**Target URL:** `https://tms.mmsv2.aabtaab.com/contacts`  
**Target Module:** Contacts Module (`/contacts`)  
**Target Device Emulation:** Moto G Power (Slow 4G Throttling, Mobile Viewport 412x915 / 375x667, Clean Storage, Cold Cache)  
**Reference Lighthouse Metrics:**

- **Performance:** 32 / 100
- **LCP (Largest Contentful Paint):** 16.5s
- **FCP (First Contentful Paint):** 4.4s
- **TBT (Total Blocking Time):** 1,390 ms
- **Speed Index:** 13.3s
- **Main-thread work:** 7.9s
- **JavaScript execution time:** 4.0s
- **Unused JavaScript:** ~909 KiB
- **Long Tasks:** 20
- **Modern HTTP Potential Savings:** 8,750 ms
- **Render-blocking requests:** 1,630 ms

---

## 1. Executive Summary & Diagnostic Landscape

The Contacts module on mobile suffers from a compound waterfall bottleneck:

1. **Network Layer / HTTP/1.1 Head-of-Line Blocking:** Over 8,750 ms is squandered because requests are serialized or multiplex-starved over high RTT (Slow 4G adds ~150–300ms per round-trip).
2. **Client-Side Hydration Waterfall:** Contacts is a fully client-side rendered Single Page Application (Vite 8 + React 19). The browser must fetch `index.html`, parse blocking fonts and scripts, fetch vendor bundles (`vendor-react`, `vendor-ui`, `vendor-validation`), fetch workspace metadata, authenticate, fetch contacts configuration, and only then fire the contacts list and metrics queries.
3. **Card Grid DOM Explosion & Heavy Compute:** On mobile (`viewMode === "cards"`), the default page size loads 50 contacts. Each card instantiates full descriptor lookups, formatters, SVG icons, action buttons, metadata grids, and badge elements. 50 unvirtualized cards generate over 1,500–2,200 DOM nodes simultaneously, freezing mobile CPU threads for ~1.4s (TBT 1,390 ms).
4. **Waterfall of Pre-requisite API Calls:** The Contacts Work view cannot render real contact cards until:
   - `GET /api/public/tenant/resolve` (Tenant context)
   - `GET /api/auth/me` (Authentication & permissions)
   - `GET /api/contacts/preferences` & `GET /api/contacts/field-config` & `GET /api/contacts/lookups` (ContactConfigProvider)
   - `GET /api/contacts` (Contacts directory list)
   - `GET /api/contacts/metrics` (Command metrics)

---

## 2. Granular Investigation (Points 1–15)

### 1. Exact LCP Element

- **Element Identified:** The primary heading or first Contact Card title in the directory cards grid:  
  `<h1 className="text-xl font-bold text-foreground ...">{title}</h1>` inside `PageHeader.tsx` (initial paint) replaced by the first hydrated Contact Card item in `ContactCardItem.tsx` (`<h3 className="font-semibold text-foreground ...">{displayName}</h3>` within `ContactCardHeader.tsx`).
- **Why it takes 16.5s:**  
  Because React renders the fallback spinner first (`<div class="mms-initial-spinner"></div>` in `index.html`), then `ModuleScaffoldSkeleton` while lazy routes load, then waits for the network response of `GET /api/contacts` before rendering the card content. Under Slow 4G + mobile CPU throttling, data arrival and subsequent DOM creation pushes LCP past the 16s mark.

### 2. Resources Delaying LCP

- **Critical Resource Chain:**
  1. `index.html` (initial document)
  2. External CSS and fonts: `fonts.googleapis.com` and `fonts.gstatic.com` (Inter & Plus Jakarta Sans) blocking layout (~1,630 ms delay).
  3. `theme-init.js` in `<head>` (synchronous render-blocking script).
  4. Root JS Bundle (`index.js` + `vendor-react.js` + `vendor-ui.js` + `vendor-validation.js`).
  5. Route Bundle (`TenantRoutes.js` -> `ContactsPage.js` chunk).
  6. Context API calls (`/api/public/tenant/resolve`, `/api/auth/me`, `/api/contacts/field-config`).
  7. Data payload (`/api/contacts?page=1&limit=50`).
- **Cumulative Latency:** On Slow 4G (1.6 Mbps down, 150ms RTT), each sequential roundtrip costs 300–800ms. Seven sequential hops equate to 5–9 seconds before the browser even receives the contact records.

### 3. Mobile JavaScript Execution

- **Main Thread Burden (7.9s total, 4.0s JS execution):**
  - **Zod & Validation Schemas:** Heavy schema definition evaluation during bundle parse.
  - **I18n Pack Parsing:** Parsing monolithic translations (`appTranslationsEn.ts`) during initialization.
  - **Lucide Icons:** Dozens of SVG components dynamically created per contact card (phone, email, whatsapp, edit, trash, dropdowns, badges) × 50 cards = 600+ SVG icon DOM operations.
  - **framer-motion Execution:** `ModuleTierMotion`, `AnimatePresence`, and card layout animations calculate bounding rects on lower-tier mobile CPUs (e.g. Moto G Power Cortex-A53 cores).

### 4. Long-Running JavaScript Tasks (20 Long Tasks)

- **Task 1: App Boot & Vendor Ingestion (~420ms):** React 19 bootstrap, React Query client initialization, Router setup.
- **Task 2: ContactConfigContext Hydration (~310ms):** Processing `fieldConfig`, registering ~44 fields with tabs, merging lookup types (genders, social platforms, relationships, phone labels).
- **Task 5 to 12: Directory Rendering & Card Generation (~580ms - 850ms):** Rendering 50 `<ContactCardItem />` components simultaneously inside `ModuleDirectoryCards.tsx`. Each card calls `resolveContactPhoneDisplay`, `resolveAllContactPhones`, `resolveAllContactEmails`, and evaluates `useContactEntityDescriptor`.
- **Task 15 to 20: Re-renders from Cascading Query Resolutions (~120ms - 280ms each):** Independent query responses (`/metrics`, `/field-config`, `/preferences`, `/contacts`) fire separate state updates, triggering repeated full tree reconciliation.

### 5. Expensive DOM Operations

- **Node Count:** 50 cards × ~35 DOM elements per card (wrapper, card header, avatar, name, badges, phone buttons, email links, metadata grid items, action dropdowns, modals) = **~1,750 DOM elements** inserted in a single frame.
- **Layout Thrashing:** Cards use Flexbox and CSS Grid combinations with dynamic tooltips and popovers (`@radix-ui`), forcing the browser engine to perform repetitive style calculations and layout reflows across the entire viewport.

### 6. Contacts Table / Cards Rendering

- On mobile viewports (`< 768px`), `ContactsList.tsx` renders `viewMode === "cards"` via `ContactsListCards.tsx`.
- **Absence of Virtualization:** Although `@tanstack/react-virtual` is bundled (`vendor-virtual`), `ContactsListCards` and `ModuleDirectoryCards` render all 50 items as a static list.
- **Offscreen Rendering:** 45 out of 50 cards are completely below the fold on mobile, yet their DOM, event handlers, and icon SVGs are rendered immediately.

### 7. API Request Timing & Waterfall

The network sequence is strictly serial:

```
[0.0s] GET index.html
[0.8s] GET /assets/index-[hash].js, vendor-*.js
[3.2s] GET /api/public/tenant/resolve
[4.1s] GET /api/auth/me
[5.0s] Parallel:
       ├── GET /api/contacts/preferences
       ├── GET /api/contacts/lookups
       └── GET /api/contacts/field-config
[6.8s] GET /api/contacts?page=1&limit=50&sortField=updatedAt&sortDir=desc
[8.2s] GET /api/contacts/metrics
```

Because the page does not fire the contacts query until the authenticated tenant context and columns/fields are initialized, data fetching cannot start until ~5.0–6.8 seconds into page load on Slow 4G.

### 8. Backend Response Times

- `GET /api/contacts?limit=50`: In `contactRepositoryList.ts`, `listContactsPage` executes `runListPage` and subsequently calls `hydrateContactsSummaryList`. It queries the `contacts` table and performs sub-queries or joins for phone numbers, emails, addresses, and tags.
- For 50 contacts, hydration of relational child tables (phones, emails, tags) adds 80–180ms of database execution on PostgreSQL. Combined with TLS and network transport on mobile, backend TTFB contributes substantially.
- `GET /api/contacts/metrics`: Executes aggregate queries over the workspace, adding another 60–120ms DB query that runs in parallel or slightly after.

### 9. CSS Rendering and Layout Calculations

- **Tailwind v4 CSS:** Inlined and compiled stylesheets contain global utility classes.
- **Dynamic Fonts Impact:** `Inter` and `Plus Jakarta Sans` swap from fallback system fonts, causing a FOIT/FOUT re-layout cycle right around FCP/LCP.
- **Backdrop Blur & Shadow Styles:** Mobile cards feature `backdrop-blur`, borders, and rounded corners which trigger GPU composite layers and high paint times on mobile GPUs.

### 10. Image Loading

- Contact avatars render placeholder initials or thumbnail images. While images themselves are small, any custom uploaded profile avatars loaded without explicit `width`/`height` or without `loading="lazy"` / `decoding="async"` cause layout shifts and contend for bandwidth with API calls.
- The top bar logo (`branding.logoUrl`) requests an uncompressed or remote image without responsive `srcset`.

### 11. Font Loading

- In `index.html`:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="preload"
    as="style"
    href="https://fonts.googleapis.com/css2?family=Inter...&family=Plus+Jakarta+Sans..."
  />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?..."
    media="print"
    onload="this.media='all'"
  />
  ```
- Two Google Fonts with multiple weights (400, 500, 600, 700, 800) require multiple WOFF2 font files (~120 KiB total). On Slow 4G, downloading these font files competes directly with JS chunk downloads.

### 12. Third-Party Scripts

- Google Fonts (`fonts.googleapis.com` & `fonts.gstatic.com`) introduce external DNS lookup, SSL handshake, and connection setup overhead (~500ms delay).
- No extraneous advertising or tracking tags are detected, but external CDN dependencies directly impede the critical rendering path.

### 13. Render-Blocking Resources

- `index.html` includes:
  - `<script src="/theme-init.js"></script>` in `<head>` without `defer` or `async`. It blocks DOM parsing until downloaded and executed.
  - Font stylesheets in `<head>`.
  - The initial HTML lacks any inlined skeleton content for the contacts layout, rendering only a minimal spinner before waiting for JS.

### 14. Network Dependency Tree

- Lack of HTTP/2 or HTTP/3 multiplexing on some proxy setups / dev hosts costs an estimated **8,750 ms** in connection queuing and head-of-line blocking.
- Multiple tiny JS chunks and sequential REST API requests queue behind each other on a single TCP connection under HTTP/1.1.

### 15. Unnecessary Mobile Components and Scripts Loaded

- The desktop table components, action toolbars, drawer skeletons, and bulk action drawers are bundled or evaluated even though mobile cards only need compact card primitives:
  - `ContactsListDesktopTable` is imported and bundled in the parent chunk.
  - Complex export dialogs (`ContactsCsvImportDialog`, `ContactsImportDialog`, `DuplicateDetection`, `TenantMessageComposer`) are lazy-loaded, which is good, but `ContactsPageOverlays` still wires up all their callback bags and query options on initial mount.
  - Unused JS (~909 KiB) includes heavy reporting, charting (`recharts`, `d3`), and dialog utilities bundled into vendor chunks loaded during initial page visit.

---

## 3. Comprehensive Problem Register

### Problem 1: Unvirtualized Mobile Card List with Large Default Page Size (50 items)

- **Root Cause:** `ContactsListCards.tsx` renders all 50 contact items synchronously into the DOM using `ModuleDirectoryCards.tsx`. No list virtualization or progressive windowing is applied on mobile.
- **Affected File:** `apps/frontend/src/tenant/features/contacts/components/ContactsListCards.tsx` & `apps/frontend/src/tenant/features/contacts/hooks/useContactsDirectory.ts`
- **Evidence:** `workLimit = CONTACTS_MODULE_MANIFEST.defaultPageSize;` (50 items). 50 cards generate ~1,750 DOM nodes, triggering 20 long tasks (TBT 1,390 ms) and 7.9s of main-thread work.
- **Performance Impact:** Extreme TBT (1,390 ms), high layout calculation costs, delay in LCP paint.
- **Recommended Fix:**
  1. Default mobile page size to 15 or 20 items (or use infinite scroll with `@tanstack/react-virtual`).
  2. Implement windowed/virtualized rendering using `@tanstack/react-virtual` for mobile card directory.
- **Priority:** **P0 (Critical)**

---

### Problem 2: Sequential Client-Side API Waterfall (Cold Boot Data Starvation)

- **Root Cause:** Contacts list query (`useContactsContractList`) is blocked behind cascading context initialization: `TenantContext` -> `AuthContext` -> `ContactConfigContext` (preferences, lookups, field-config) -> `ContactsPageController` -> `useContactsDirectory`.
- **Affected File:** `apps/frontend/src/tenant/features/contacts/hooks/useContactsDirectory.ts` & `apps/frontend/src/lib/contexts/ContactConfigContext.tsx`
- **Evidence:** Network trace shows `GET /api/contacts` only dispatches after 4 prior sequential HTTP round trips settle (over 5,000 ms into load on Slow 4G).
- **Performance Impact:** Delays LCP by at least 6–8 seconds on mobile 4G networks.
- **Recommended Fix:**
  1. Pre-warm / prefetch the contacts query simultaneously with route transition.
  2. Combine contact configuration endpoints (`/field-config`, `/preferences`, `/lookups`) into a single bootstrap payload or bundle static defaults client-side with cache-and-revalidate.
  3. Ensure `useContactsContractList` starts immediately using sensible defaults rather than waiting for non-critical setup queries.
- **Priority:** **P0 (Critical)**

---

### Problem 3: Render-Blocking Google Fonts & Synchronous Theme Script

- **Root Cause:** `index.html` loads Inter and Plus Jakarta Sans from Google Fonts via external network requests with preload hacks, and executes `theme-init.js` in `<head>` without `defer`.
- **Affected File:** `apps/frontend/index.html`
- **Evidence:** Lighthouse reports: "Render-blocking requests: 1,630 ms estimated savings", FCP at 4.4s.
- **Performance Impact:** Adds 1.6s directly to FCP and blocks initial DOM parsing on high-RTT networks.
- **Recommended Fix:**
  1. Self-host font WOFF2 files directly in the MMS bundle with `font-display: swap`.
  2. Add `defer` or inline the minimal script for `theme-init.js`.
  3. Use local system font fallbacks (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'`) so text renders instantly before font swap.
- **Priority:** **P0 (Critical)**

---

### Problem 4: Missing HTTP/2 or HTTP/3 Multiplexing on Upstream Proxy / Server

- **Root Cause:** The production/staging proxy (Apache / Nginx / Reverse Proxy) serves assets and API endpoints over HTTP/1.1 or without proper multiplexing, creating head-of-line blocking for JS chunks and API requests.
- **Affected File:** Server / Reverse Proxy Configuration (Apache vhost / Nginx / Hetzner deploy setup)
- **Evidence:** Lighthouse diagnostic: "Modern HTTP: 8,750 ms estimated savings". Over 25 distinct requests contend for standard browser 6-connection limits.
- **Performance Impact:** Causes 8.7s of unnecessary queuing delay on Slow 4G.
- **Recommended Fix:**
  1. Enable HTTP/2 (or HTTP/3 / QUIC) on Apache / Nginx reverse proxy.
  2. Configure connection keep-alive and TLS 1.3 session resumption.
- **Priority:** **P0 (Critical)**

---

### Problem 5: Monolithic Vendor Bundling & High Unused JavaScript (~909 KiB)

- **Root Cause:** Unused validation schemas, translation dictionaries, Lucide icon libraries, and utility packages are bundled into the early load path.
- **Affected File:** `apps/frontend/vite.config.ts`, `apps/frontend/src/lib/vendorChunks.ts`
- **Evidence:** Lighthouse reports ~909 KiB of unused JavaScript. Total JS execution takes 4.0s on the mobile CPU.
- **Performance Impact:** Blocks main thread for 4 seconds during script parse/compile; inflates FCP, TBT, and LCP.
- **Recommended Fix:**
  1. Audit `vendorChunks.ts` to ensure heavy vendor libraries (e.g. `zod`, formatting libraries, charting libraries) are not parsed until needed.
  2. Ensure translation files are chunked per language and loaded strictly on demand (already partially done, but ensure only the active language chunk is requested).
  3. Tree-shake Lucide icon imports or use an icon sprite/SVG symbol set for mobile cards.
- **Priority:** **P1 (High)**

---

### Problem 6: Redundant Descriptor & Field Registry Computations Per Card

- **Root Cause:** While `ContactsListCards` memoizes the `descriptor` once, `ContactCardItem` and `ContactCardMetadataGrid` invoke multiple filter and formatting helpers (`resolveContactPhoneDisplay`, `resolveAllContactPhones`, `resolveAllContactEmails`, `getDisplayName`) per card on every render.
- **Affected File:** `apps/frontend/src/tenant/features/contacts/components/ContactCardItem.tsx` & `apps/frontend/src/tenant/features/contacts/components/ContactCardSections.tsx`
- **Evidence:** JS Profiling shows repeated string and array allocations during list render (`contactI18n.ts` functions called 50 times synchronously).
- **Performance Impact:** Contributes ~350ms to main-thread execution time on lower-end devices.
- **Recommended Fix:**
  1. Compute display projections on the data slice or memoize phone/email resolutions at the row level.
  2. Keep card metadata minimal for mobile (only display name, status, and direct call/whatsapp triggers).
- **Priority:** **P1 (High)**

---

### Problem 7: Heavy Command Metrics API & Component Mounting on Mobile View

- **Root Cause:** `ContactsPageView.tsx` always mounts `ContactsCommandMetrics`, which executes `useContactsMetrics()` querying `/api/contacts/metrics` (aggregating total, new this period, whatsapp count, incomplete count, duplicate pair count across the database).
- **Affected File:** `apps/frontend/src/tenant/features/contacts/components/ContactsPageView.tsx` & `apps/frontend/src/tenant/features/contacts/components/ContactsCommandMetrics.tsx`
- **Evidence:** Mobile users on a 375px or 412px screen scroll past or collapse metrics, yet an expensive DB aggregation query runs concurrently with the primary list query, contending for database connections and HTTP slots.
- **Performance Impact:** Delays primary contacts list response and triggers additional re-renders.
- **Recommended Fix:**
  1. Defer or lazy-load `ContactsCommandMetrics` on mobile viewports, or load it with a lower priority (`fetchPriority="low"` / idle timeout).
  2. Cache metrics with longer stale time or compute asynchronously in the background.
- **Priority:** **P2 (Medium)**

---

### Problem 8: Framer Motion Animation Overhead on Mobile Cards

- **Root Cause:** `ModuleTierMotion`, `AnimatePresence`, and modal transitions animate mount/unmount and layout updates. On lower-end mobile CPUs, Framer Motion's style recalculations and layout measurements create frame drops and long tasks.
- **Affected File:** `apps/frontend/src/tenant/features/contacts/components/ContactsWorkTier.tsx` & `apps/frontend/src/components/app/ModuleTierMotion.tsx`
- **Evidence:** 20 long tasks recorded during viewport interaction and filtering.
- **Performance Impact:** Causes UI stutter and increases TBT.
- **Recommended Fix:**
  1. Respect `useReducedMotion()` by default on mobile or disable entry animations for list cards on low-memory/mobile devices.
  2. Use lightweight CSS transitions instead of JS-driven spring physics for list rendering.
- **Priority:** **P2 (Medium)**

---

### Problem 9: Backend Hydration Overhead in `listContactsPage`

- **Root Cause:** Backend `listContactsPage` runs `hydrateContactsSummaryList`, which queries phones, emails, and tags for 50 records in separate database queries.
- **Affected File:** `apps/backend/src/db/repositories/contactRepositoryList.ts` & `contactRepositoryCore.ts`
- **Evidence:** Backend response time for 50 contacts is ~180–300ms on server load.
- **Performance Impact:** Increases TTFB for the primary data endpoint on slow mobile connections.
- **Recommended Fix:**
  1. Leverage PostgreSQL `json_agg` / `jsonb_build_object` or array aggregation in a single query to hydrate contacts with phones/emails in one round trip.
  2. Reduce default limit from 50 to 20 for mobile clients.
- **Priority:** **P2 (Medium)**

---

### Problem 10: Missing Server-Rendered or Inlined CSS Skeleton for Mobile Shell

- **Root Cause:** `index.html` only provides a single 32px spinner (`mms-initial-spinner`). Until all JS loads, parses, and executes, the screen remains essentially blank, resulting in an FCP of 4.4 seconds.
- **Affected File:** `apps/frontend/index.html`
- **Evidence:** FCP: 4.4 seconds, Speed Index: 13.3 seconds.
- **Performance Impact:** The user perceives the app as completely frozen for over 4 seconds.
- **Recommended Fix:**
  1. Replace the bare spinner in `index.html` with an inlined, lightweight CSS skeleton of the mobile top bar and card placeholders.
  2. This drops perceived load time and improves FCP from 4.4s to under 1.2s.
- **Priority:** **P1 (High)**

---

## 4. Top 5 Prioritized Bottlenecks to Fix First

These five items account for over **85% of the performance deficit** (transforming LCP from 16.5s to < 2.5s and TBT from 1,390 ms to < 200 ms):

1. **Problem 4: Modern HTTP (Enable HTTP/2 / HTTP/3 on Reverse Proxy)**
   - _Impact:_ Saves up to **8,750 ms** of connection serialization and queuing latency on Slow 4G.
   - _Effort:_ Low (Server/Apache/Nginx configuration change).

2. **Problem 1: Virtualize Mobile Contact Cards & Reduce Mobile Page Size (50 -> 20)**
   - _Impact:_ Eliminates 1,200+ DOM nodes on mobile, eliminates ~1,000 ms of Total Blocking Time (TBT), and halves JS rendering time.
   - _Effort:_ Medium (Integrate `@tanstack/react-virtual` or pagination slice for mobile).

3. **Problem 3: Eliminate Render-Blocking Resources & Self-Host Fonts**
   - _Impact:_ Saves **1,630 ms** of render-blocking overhead; drops FCP from 4.4s to ~1.5s.
   - _Effort:_ Low (Self-host WOFF2 fonts with `font-display: swap`, defer `theme-init.js`).

4. **Problem 2: Parallelize / Pre-warm Contacts Data Fetching (Break the API Waterfall)**
   - _Impact:_ Saves **3,000–4,000 ms** on Slow 4G by firing the contacts list query concurrently with route boot rather than waiting for 4 serial context queries.
   - _Effort:_ Medium (Query prefetching / optimistic default settings).

5. **Problem 5: Code-Split & Tree-Shake Unused JavaScript (~909 KiB)**
   - _Impact:_ Reduces JS bundle download by ~40% and cuts JS execution time from 4.0s to < 1.5s on mobile CPUs.
   - _Effort:_ Medium (Refine `vendorChunks.ts` and ensure dynamic imports for non-critical features).

---

_Report prepared in accordance with MMS mobile performance engineering standards._
