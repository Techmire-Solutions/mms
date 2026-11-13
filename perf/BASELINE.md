# Frontend Performance Baseline

**Date:** 2026-11-12  
**Target:** Production build of `mms-frontend` (`vite preview` at `http://localhost:4173/`)  
**Artifacts Generated:**

- Bundle visualizer: [`./perf/baseline/bundle.html`](file:///E:/Projects/mms/perf/baseline/bundle.html)
- Mobile Lighthouse report: [`./perf/baseline/mobile.report.json`](file:///E:/Projects/mms/perf/baseline/mobile.report.json)
- Desktop Lighthouse report: [`./perf/baseline/desktop.report.json`](file:///E:/Projects/mms/perf/baseline/desktop.report.json)

---

## 1. Lighthouse Scores

Audits were executed in clean, isolated browser profiles against the production build preview.

| Category           | Mobile Score | Desktop Score |
| ------------------ | ------------ | ------------- |
| **Performance**    | **70 / 100** | **92 / 100**  |
| **Accessibility**  | **97 / 100** | **97 / 100**  |
| **Best Practices** | **96 / 100** | **96 / 100**  |
| **SEO**            | **63 / 100** | **63 / 100**  |

### Core Web Vitals & Key Timings

| Metric                             | Mobile | Desktop | Status / Note                                                                                       |
| ---------------------------------- | ------ | ------- | --------------------------------------------------------------------------------------------------- |
| **First Contentful Paint (FCP)**   | 0.9 s  | 0.3 s   | Fast (instant skeleton boot)                                                                        |
| **Speed Index (SI)**               | 0.9 s  | 0.3 s   | Fast                                                                                                |
| **Largest Contentful Paint (LCP)** | 7.7 s  | 1.8 s   | Simulated mobile CPU/network throttling inflates initial client JS execution before main root paint |
| **Total Blocking Time (TBT)**      | 270 ms | 20 ms   | Low main-thread contention                                                                          |
| **Cumulative Layout Shift (CLS)**  | 0      | 0       | Perfect stability                                                                                   |

---

## 2. 10 Largest Chunks

Measured from production bundle artifacts under `apps/frontend/dist/assets/`.

|  Rank  | Chunk Name                   |  Raw Size  | Brotli Size | Gzip Size | Loads on First Route? | Contents / Description                                                 |
| :----: | ---------------------------- | :--------: | :---------: | :-------: | :-------------------: | ---------------------------------------------------------------------- |
| **1**  | `elk-QONTBCTQ-c5-yaQLQ.js`   | 1,437.4 KB |  341.3 KB   | 441.9 KB  |     **No (lazy)**     | Mermaid ELK layout engine (loaded on demand for diagramming)           |
| **2**  | `mms-i18n-fa-6ToMVE74.js`    |  723.0 KB  |  118.2 KB   | 156.0 KB  |     **No (lazy)**     | Persian language translation dictionary                                |
| **3**  | `mms-i18n-ur-C8l8zeNT.js`    |  706.4 KB  |  117.7 KB   | 154.6 KB  |     **No (lazy)**     | Urdu language translation dictionary                                   |
| **4**  | `mms-i18n-ar-Dd6B9Ud7.js`    |  688.3 KB  |  115.0 KB   | 152.0 KB  |     **No (lazy)**     | Arabic language translation dictionary                                 |
| **5**  | `chunk-NGNAAXSQ-ZPq9_-4A.js` |  621.0 KB  |  108.4 KB   | 129.0 KB  |     **No (lazy)**     | Shared core parser routines for Mermaid diagrams                       |
| **6**  | `mms-i18n-en-DKgBHQc-.js`    |  549.7 KB  |  106.8 KB   | 132.5 KB  |        **Yes**        | Default English translation dictionary                                 |
| **7**  | `vendor-charts-BrnImYst.js`  |  505.5 KB  |  117.7 KB   | 143.0 KB  |     **No (lazy)**     | Recharts & D3 charting vendor chunk (lazy-loaded in reporting views)   |
| **8**  | `xlsx-DSXnwAD4.js`           |  487.8 KB  |  132.0 KB   | 158.9 KB  |     **No (lazy)**     | SheetJS spreadsheet parser and exporter (lazy-loaded on export/import) |
| **9**  | `cytoscape.esm-CxTrij9L.js`  |  429.8 KB  |  115.6 KB   | 136.9 KB  |     **No (lazy)**     | Cytoscape graph visualization engine                                   |
| **10** | `jspdf.es.min-DL-yvbKU.js`   |  401.2 KB  |  110.1 KB   | 130.1 KB  |     **No (lazy)**     | jsPDF document generator (lazy-loaded on PDF print/export)             |

---

## 3. Initial Route Dependency Analysis

On initial load (`/`), the HTML entry closure consists of **27 JavaScript chunks** totaling **~2.05 MB uncompressed** (~573 KB Brotli / ~720 KB Gzip).

### Heaviest Initial Chunks:

1. `mms-i18n-en-DKgBHQc-.js` (549.7 KB raw / 106.8 KB Brotli) — Default application translation dictionary.
2. `useTranslation-B17qaVYW.js` (368.2 KB raw / 90.9 KB Brotli) — Translation provider, keys registry, and runtime interpolation logic.
3. `vendor-react-Bxy93xWB.js` (264.0 KB raw / 78.4 KB Brotli) — React 19, React DOM, and React Router core runtime.
4. `vendor-ui-BtFIXE-a.js` (258.0 KB raw / 58.7 KB Brotli) — Radix UI primitives, Lucide icon subset, and base UI utilities.
5. `vendor-validation-DgONrq1Y.js` (104.2 KB raw / 27.5 KB Brotli) — Zod runtime schemas.
6. `vendor-query-D8o05jzO.js` (78.3 KB raw / 21.0 KB Brotli) — TanStack Query client runtime.

### Key Observation:

Only **1 of the top 10 largest chunks** (`mms-i18n-en`, Rank 6) loads on the initial route. All other heavy vendor chunks (diagramming, non-active locales, charting, spreadsheet processing, and PDF rendering) are successfully split and lazily loaded on demand.

---

## 4. Optimization Progress & Results Table

| Stage / Iteration                                              | Performance (Mob / Desk) | FCP      | LCP      | TBT         | CLS   | Initial JS Transfer             | Notes                                                       |
| -------------------------------------------------------------- | ------------------------ | -------- | -------- | ----------- | ----- | ------------------------------- | ----------------------------------------------------------- |
| **Baseline**                                                   | 70 / 92                  | 0.9s     | 7.7s     | 270ms       | 0     | 692.5 KiB (107 reqs)            | Cold start without below-the-fold chart deferral            |
| **Part 1: Bundle & Code-Splitting**                            | 72 / 93                  | 0.9s     | 7.5s     | 270ms       | 0     | 692.5 KiB (closure split)       | Route-level lazy loading confirmed; heavy libraries dynamic |
| **Part 2: Sequential Boot & Query Parallelisation**            | 76 / 94                  | 0.6s     | 4.8s     | 260ms       | 0     | 692.5 KiB (cached shell)        | Parallelized session & dashboard summary calls              |
| **Part 3: Mobile-First Skeleton & Non-Composited Animations**  | 78 / 95                  | 0.4s     | 3.6s     | 240ms       | 0     | 692.5 KiB                       | Zero-flash critical CSS; eliminated body color transition   |
| **Part 4: CPU Throttling, IntersectionObserver & Deferred WS** | **82 / 96**              | **0.3s** | **3.2s** | **< 230ms** | **0** | **~200 KiB** (critical closure) | Below-the-fold charts lazy; live WS deferred post-paint     |
| **Part 5: Design Tokens & Font Preload Budget**                | **84 / 96**              | **0.3s** | **2.8s** | **< 210ms** | **0** | **~195 KiB**                    | Single critical font weight (Inter 400); design-system sync |
