# MMS Enterprise Modernization & Architecture Blueprint

> **Status note:** design-time blueprint. Per-phase completion status is NOT
> tracked here — the live Open Gaps Register lives in
> [`.agent/rules/mms-migration-status.md`](../.agent/rules/mms-migration-status.md)
> (synced to `.cursor/` and `.claude/`).

---

## 1. System Architecture & High-Scale Invariants

MMS unifies high-concurrency event ingestion, strict multi-tenant data isolation, asynchronous document compilation, and bidirectional localization.

```
                                 ┌─────────────────────────────────────────────────────────┐
                                 │                   Cloudflare Edge / CDN                 │
                                 │  - SSL Termination       - Geo-Routing / DDoS Shield    │
                                 │  - Static Asset Caching  - WebSocket Proxy              │
                                 └────────────────────────────┬────────────────────────────┘
                                                              │
                                                              ▼
                                 ┌─────────────────────────────────────────────────────────┐
                                 │              Reverse Proxy (Nginx / Envoy)              │
                                 │  - Cookie Validation     - Security Headers & CSP       │
                                 │  - Rate Limiting         - OpenTelemetry Ingress Trace  │
                                 └─────────────┬─────────────────────────────┬─────────────┘
                                               │                             │
                        HTTP / REST / WS       │                             │ Static SPAs / Assets
                                               ▼                             ▼
┌────────────────────────────────────────────────────────────────────────┐  ┌───────────────────────┐
│                     Fastify 5 API Gateway (:5002)                      │  │   React 19 Client     │
│ ┌────────────────────────────────────────────────────────────────────┐ │  │  - Vite 8 Engine      │
│ │ Plugins: @ts-rest/fastify, @fastify/jwt, Redis Session, RateLimit  │ │  │  - TanStack Query v5  │
│ └──────────────────────────────────┬─────────────────────────────────┘ │  │  - Tailwind CSS v4    │
│                                    ▼                                   │  │  - BiDi LTR/RTL Core  │
│ ┌────────────────────────────────────────────────────────────────────┐ │  └───────────────────────┘
│ │ Domain Services: Students, Finance, Contacts, Academics, Hasanat   │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
┌───────────────────────────┐ ┌──────────────┐ ┌───────────────────────────┐
│ Drizzle ORM Gateway       │ │ Redis 7+     │ │ BullMQ Worker Subsystem   │
│ - Write: Primary Master   │ │ - Sessions   │ │ - Typst HarfBuzz PDF Node │
│ - Read: Read Replicas     │ │ - Cache      │ │ - ExcelJS Stream Pipe     │
│ - SET LOCAL RLS Enforcer  │ │ - Rate-Limit │ │ - WhatsApp / SMS Gateway  │
└─────────────┬─────────────┘ └──────────────┘ └─────────────┬─────────────┘
              │                                              │
              ▼                                              ▼
┌───────────────────────────┐                  ┌───────────────────────────┐
│ PostgreSQL 16+ (3NF/BCNF) │                  │ S3-Compatible Object Store│
│ - Row-Level Security      │                  │ - Client Encrypted Exports│
│ - Immutable Audit Ledger  │                  │ - Generated PDF Cards     │
└───────────────────────────┘                  └───────────────────────────┘

```

### Core Invariants

* **Tenant Isolation**: Every database interaction occurs within an explicit transaction setting PostgreSQL's `app.current_tenant`. Direct queries without tenant scope fail by design.
* **BiDi Zero-Compromise Rendering**: Arabic, Urdu (Nastaliq), and Persian typography receive full ligature and HarfBuzz text-shaping support on both the client (DOM) and server (Typst engine).
* **Deterministic Contract Typing**: Route definitions, parameters, write payloads, and response envelopes are derived strictly from `@ts-rest` contracts in `@mms/shared`.

---

## 2. Database Multi-Tenancy & RLS Defense-in-Depth

### Scoped Transaction Gateway

To prevent RLS context pollution across pooled connections (`pg`), tenant execution context is encapsulated within transaction scopes using `set_config('app.current_tenant', ..., true)`.

```typescript
// apps/backend/src/db/tenant-context.ts
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db, readReplicaDb } from './index';
import * as schema from './schema';

export type TenantTransaction = NodePgDatabase<typeof schema>;

interface TenantContextOptions {
  readOnly?: boolean;
}

export async function withTenant<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: TenantContextOptions = {}
): Promise<T> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('SECURITY_ERROR: Missing or invalid tenant context identifier');
  }

  const targetDb = options.readOnly ? readReplicaDb : db;

  return targetDb.transaction(async (tx) => {
    // Parameter 3 (is_local = true) ensures setting reverts when transaction completes
    await tx.execute(
      sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`
    );
    return callback(tx as unknown as TenantTransaction);
  });
}

```

### PostgreSQL Engine Policy Blueprint

```sql
-- Migration: 0001_enforce_tenant_rls.sql

-- Enable RLS across all tenant domain tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners/superusers accessing via application pool
ALTER TABLE students FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;

-- Dynamic tenant isolation policy
CREATE POLICY tenant_isolation_policy ON students
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

-- Platform Super-Admin bypass role
CREATE POLICY platform_superadmin_policy ON students
  FOR ALL
  TO mms_platform_admin
  USING (true)
  WITH CHECK (true);

```

### Immutable Financial & Academic Audit Ledger

Every balance change, grade modification, and attendance update is backed by an append-only audit trail verified via cryptographic hashing:

```sql
CREATE TABLE audit_trail_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_name VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(16) NOT NULL, -- INSERT, UPDATE, DELETE
  actor_id UUID NOT NULL,
  actor_ip INET,
  changes_diff JSONB NOT NULL,
  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_audit_tenant_entity ON audit_trail_ledger(tenant_id, entity_name, entity_id);

```

---

## 3. End-to-End Type-Safe Contracts & Input Sanitization

### Contract Definition (`@mms/shared`)

```typescript
// packages/shared/src/contracts/students.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { 
  StudentSchema, 
  CreateStudentDto, 
  StudentQueryFiltersDto,
  ErrorResponseSchema 
} from '../schemas';

const c = initContract();

export const studentContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/students',
    query: StudentQueryFiltersDto,
    responses: {
      200: z.object({
        data: z.array(StudentSchema),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          totalPages: z.number(),
        }),
      }),
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
    summary: 'List paginated students with dynamic filter criteria',
  },
  create: {
    method: 'POST',
    path: '/api/v1/students',
    body: CreateStudentDto,
    responses: {
      201: StudentSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
    summary: 'Enroll a new canonical student into the current tenant',
  },
});

```

### Inbound BiDi Unicode Sanitization

Prevent Unicode Directional Spoofing (e.g., Right-to-Left Override attacks `U+202E`) across all string inputs:

```typescript
// packages/shared/src/schemas/sanitize.ts
import { z } from 'zod';

// Matches Unicode Bidi Override runes: U+202A to U+202E and U+2066 to U+2069
const BIDI_OVERRIDE_REGEX = /[\u202A-\u202E\u2066-\u2069]/g;

export const safeString = (min = 1, max = 255) =>
  z
    .string()
    .min(min)
    .max(max)
    .trim()
    .transform((val) => val.replace(BIDI_OVERRIDE_REGEX, ''));

```

### Backend Fastify Route Implementation

```typescript
// apps/backend/src/routes/students.routes.ts
import { initServer } from '@ts-rest/fastify';
import { studentContract } from '@mms/shared/contracts';
import { withTenant } from '../db/tenant-context';
import { StudentService } from '../services/student.service';

const s = initServer();

export const studentRouter = s.router(studentContract, {
  list: async ({ query, request }) => {
    const tenantId = request.tenant.id;
    const result = await withTenant(tenantId, async (tx) => {
      return StudentService.listStudents(tx, query);
    }, { readOnly: true });

    return {
      status: 200,
      body: result,
    };
  },

  create: async ({ body, request }) => {
    const tenantId = request.tenant.id;
    const created = await withTenant(tenantId, async (tx) => {
      return StudentService.createStudent(tx, {
        ...body,
        tenantId,
        actorId: request.user.id,
      });
    });

    return {
      status: 201,
      body: created,
    };
  },
});

```

---

## 4. Headless BiDi Document Engine & Async Workers

### Worker Architecture (BullMQ + Typst)

Complex scripts (Urdu Nastaliq, Arabic, Farsi) cause client-side rendering bottlenecks and broken ligatures when compiled via DOM canvas injectors. MMS migrates document rendering to a headless **Typst** compiler utilizing native HarfBuzz text shaping.

```
┌──────────────┐     Enqueue Job     ┌──────────────┐     Compile .typ      ┌──────────────┐
│ Fastify API  │ ──────────────────► │ BullMQ Queue │ ────────────────────► │ Typst Worker │
└──────────────┘                     └──────────────┘                       └──────┬───────┘
                                                                                   │
                                                                       Generates BiDi PDF
                                                                                   │
                                                                                   ▼
┌──────────────┐    WebSocket Event  ┌──────────────┐     Upload S3         ┌──────────────┐
│ Browser UI   │ ◄────────────────── │ Redis PubSub │ ◄──────────────────── │ MinIO / S3   │
└──────────────┘                     └──────────────┘                       └──────────────┘

```

### Typst Document Template (`report-card.typ`)

```typst
#set page(
  paper: "a4",
  flipped: false,
  margin: (x: 1.5cm, top: 2cm, bottom: 2cm)
)

// Font binding with native RTL shaping
#set text(
  font: ("Noto Nastaliq Urdu", "Readex Pro", "Geist"),
  size: 11pt,
  dir: rtl,
  lang: "ur"
)

#align(center)[
  #text(size: 18pt, weight: "bold")[جامعہ دارالعلوم — شعبہ امتحانات] \
  #text(size: 14pt)[تعلیمی سال: #json-data.session_name]
]

#v(1cm)

#table(
  columns: (3fr, 2fr, 2fr, 2fr),
  align: (right, center, center, center),
  stroke: 0.5pt + luma(150),
  [مضمون], [کل نمبر], [حاصل کردہ], [درجہ],
  ..json-data.grades.map(g => (
    g.subject_name,
    str(g.max_marks),
    str(g.obtained_marks),
    g.grade_letter
  )).flatten()
)

```

### Typst Processor Implementation

```typescript
// apps/backend/src/worker/processors/pdf-report.ts
import { Job } from 'bullmq';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import { s3Client } from '../../config/storage';

interface ReportCardJobPayload {
  tenantId: string;
  studentId: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export async function processReportCard(job: Job<ReportCardJobPayload>): Promise<{ downloadUrl: string }> {
  const { tenantId, studentId, data } = job.data;
  const tempDir = path.join('/tmp', `mms-pdf-${job.id}`);
  await fs.mkdir(tempDir, { recursive: true });

  const inputJsonPath = path.join(tempDir, 'data.json');
  const templatePath = path.join(__dirname, '../templates/report-card.typ');
  const outputPath = path.join(tempDir, 'output.pdf');

  await fs.writeFile(inputJsonPath, JSON.stringify(data));

  // Invoke Typst CLI with injected data and font path
  await execa('typst', [
    'compile',
    '--font-path', '/usr/share/fonts/opentype',
    '--input', `json-data=${inputJsonPath}`,
    templatePath,
    outputPath,
  ]);

  const pdfBuffer = await fs.readFile(outputPath);
  const s3Key = `tenants/${tenantId}/transcripts/${studentId}-${Date.now()}.pdf`;

  await s3Client.putObject({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  });

  await fs.rm(tempDir, { recursive: true, force: true });
  return { downloadUrl: `/api/v1/storage/download?key=${encodeURIComponent(s3Key)}` };
}

```

---

## 5. Enterprise Security & Session Management

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ User Credential │ ────► │ Fastify Server  │ ────► │ Redis Token DB  │
└─────────────────┘       └────────┬────────┘       └─────────────────┘
                                   │
                     Issues HttpOnly Strict Cookies
                                   │
                                   ▼
        ┌─────────────────────────────────────────────────────┐
        │  Access Token: Short-Lived JWT (15 Minutes)         │
        │  Refresh Token: High-Entropy UUIDv4 (7 Days)        │
        │  CSRF Token: Double-Submit Header (X-CSRF-Token)    │
        └─────────────────────────────────────────────────────┘

```

### Security Controls Matrix

| Attack Vector | Defense Mechanism | Implementation Detail |
| --- | --- | --- |
| **Session Hijacking** | Ephemeral Access Tokens | 15-minute JWT stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookie. |
| **Instant Termination** | Redis `jti` Revocation Registry | Session revoked immediately across WebSocket and REST gateways on suspension. |
| **Cross-Site Request Forgery** | Double-Submit Token | Read CSRF cookie $\rightarrow$ inject `X-CSRF-Token` header on mutating requests (`POST`/`PUT`/`DELETE`). |
| **Privilege Escalation** | Tenant-Scoped RBAC Bitmasks | Permissions calculated and asserted in-memory per request; cannot cross tenant boundaries. |

---

## 6. UI/UX Design System & BiDi Layout Contract

### Master Module Scaffold Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Academics > Students > Directory                                         │
│  PageHeader: [Icon] Students Management   [Badge: 1,240 Enrolled]   [ + Enroll Student] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Tabs: [ 💼 Work (Directory) ]      [ 📊 Reports & Analytics ]      [ ⚙️ Setup & Fields ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  FilterToolbar:                                                                        │
│  [ 🔍 Search name, roll no (/) ]  [ Grade: All ▾ ]  [ Status: Active ▾ ]  [ ⊞ Table|Card ]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  Dynamic Slot:                                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Table Header (Sticky)                                                           │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │ Virtualized Row Items (TanStack Virtual)                                         │  │
│  │ - Row 1: Muhammad Zaid | Roll #104 | Hifz Year 2 | Active Status                 │  │
│  │ - Row 2: Ibrahim Khalil | Roll #105 | Nazira Year 1 | Active Status              │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Dock: [ 3 Students Selected ]  [ Assign Section ]  [ Print Cards ]  [ Deselect (Esc) ] │
└────────────────────────────────────────────────────────────────────────────────────────┘

```

### Tailwind CSS v4 BiDi Design Tokens

```css
/* apps/frontend/src/index.css */
@theme {
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-arabic: 'Readex Pro', 'Cairo', system-ui;
  --font-urdu: 'Noto Nastaliq Urdu', 'Gulzar', serif;
  --font-farsi: 'Vazirmatn', system-ui;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

:root {
  --bg-app: oklch(0.98 0.005 240);
  --bg-surface: oklch(1.0 0 0);
  --bg-subtle: oklch(0.96 0.01 240);
  --border-subtle: oklch(0.90 0.01 240);
  --border-strong: oklch(0.80 0.02 240);

  --text-primary: oklch(0.15 0.02 240);
  --text-secondary: oklch(0.45 0.02 240);
  --text-muted: oklch(0.65 0.01 240);

  --primary: oklch(0.45 0.15 155); /* Emerald Corporate */
  --primary-foreground: oklch(0.98 0 0);
}

.dark {
  --bg-app: oklch(0.12 0.02 240);
  --bg-surface: oklch(0.16 0.02 240);
  --bg-subtle: oklch(0.20 0.02 240);
  --border-subtle: oklch(0.25 0.02 240);
  --border-strong: oklch(0.35 0.02 240);

  --text-primary: oklch(0.96 0.005 240);
  --text-secondary: oklch(0.72 0.01 240);
  --text-muted: oklch(0.50 0.01 240);

  --primary: oklch(0.60 0.18 155);
  --primary-foreground: oklch(0.10 0 0);
}

/* Direction-Aware Typography Overrides */
[dir="rtl"] {
  font-family: var(--font-arabic);
  letter-spacing: 0em;
}

[dir="rtl"][lang="ur"] {
  font-family: var(--font-urdu);
  line-height: 2.2;
}

[dir="rtl"][lang="fa"] {
  font-family: var(--font-farsi);
}

```

### Directional Class Refactoring Guide

Enforce logical CSS properties across all shared UI primitives (`apps/frontend/src/components/ui/`):

| Physical Class (Forbidden) | Logical Class (Required) | Behavior |
| --- | --- | --- |
| `pl-4`, `pr-2` | `ps-4`, `pe-2` | Inset padding aligns to start/end based on reading direction. |
| `ml-auto`, `mr-2` | `ms-auto`, `me-2` | Margins shift appropriately between LTR and RTL. |
| `left-0`, `right-4` | `inset-inline-start-0`, `inset-inline-end-4` | Positions absolute and fixed elements relative to current script. |
| `text-left`, `text-right` | `text-start`, `text-end` | Text aligns to reading start/end boundary. |
| `border-l-2`, `border-r-0` | `border-s-2`, `border-e-0` | Accent borders attach to logical start side. |

---

## 7. Production Monorepo File Structure

```text
mms/
├── apps/
│   ├── frontend/                         # React 19 + Vite 8 SPA Client
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # Primitive elements (ps-*, pe-*, text-start)
│   │   │   │   ├── common/               # ModuleScaffold, FilterToolbar, BulkDock
│   │   │   │   └── bidi/                 # HijriDatePicker, BiDiNumeral, DirectionSwitch
│   │   │   ├── hooks/                    # useModuleShortcuts, useTenantTheme, useLiveJobs
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                # @ts-rest/react-query client instance
│   │   │   │   ├── ws.ts                 # WebSocket hub listener
│   │   │   │   └── i18n/                 # Intl runtime loaders & calendar conversions
│   │   │   ├── platform/                 # Super-admin console UI
│   │   │   ├── providers/                # Auth, DirectionProvider, QueryClientProvider
│   │   │   └── tenant/                   # 18+ Feature Modules (Work / Reports / Setup)
│   │   └── package.json
│   │
│   └── backend/                          # Fastify 5 REST & WebSocket Server
│       ├── src/
│       │   ├── config/                   # Env validation, S3/Storage, OpenTelemetry
│       │   ├── db/
│       │   │   ├── schema/               # 3NF/BCNF Drizzle schemas
│       │   │   ├── migrations/           # Forward-only migrations
│       │   │   ├── tenant-context.ts     # withTenant() transaction runner
│       │   │   └── index.ts              # Primary & Read-replica connection pools
│       │   ├── middleware/               # Tenant resolution, Redis token check, CSRF
│       │   ├── plugins/                  # @ts-rest/fastify, fastify-jwt, fastify-helmet
│       │   ├── routes/                   # Route handlers bound to shared contracts
│       │   ├── services/                 # Domain business logic & audit ledger
│       │   └── worker/                   # BullMQ async processing subsystem
│       │       ├── queues/               # Queue definitions (pdf, export, notification)
│       │       ├── processors/           # Typst PDF, ExcelJS streaming, WhatsApp
│       │       ├── templates/            # Typst (.typ) document templates
│       │       └── index.ts              # Worker process entrypoint
│       └── package.json
│
├── packages/
│   └── shared/                           # @mms/shared (SSOT)
│       ├── src/
│       │   ├── contracts/                # @ts-rest API contracts (students, finance, etc.)
│       │   ├── schemas/                  # Zod DTOs with Unicode BiDi sanitizers
│       │   ├── translations/             # Key-synced dictionaries (en, ar, ur, fa)
│       │   ├── constants/                # RBAC bitmasks, feature registries
│       │   └── utils/                    # BiDi money/date formatters, E.164 phone normalizer
│       └── package.json
│
├── e2e/                                  # Playwright multi-viewport (375px/1440px) BiDi test suites
├── docker/                               # Container specs for Node.js, Postgres, Redis, Typst
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml

```

---

## 8. Implementation Roadmap & Verification Gates

```
Sprint 1: Core Isolation & Security ──► Sprint 2: Typed Contract Layer ──► Sprint 3: Worker & BiDi Docs ──► Sprint 4: UI/UX & Localization

```

### Sprint Milestones

```
Sprint 1: Multi-Tenancy & Security Hardening
├── [x] Implement withTenant() transaction runner in Drizzle gateway
├── [x] Run migration applying FORCE ROW LEVEL SECURITY across all tenant tables
├── [x] Deploy Redis token revocation blocklist and CSRF middleware
└── [x] Verification Gate: Concurrent connection pool test verifying zero cross-tenant leakage

Sprint 2: Contract-Driven API Layer
├── [x] Define @ts-rest contracts in packages/shared/src/contracts/
├── [x] Implement safeString() BiDi Unicode override sanitization
├── [x] Bind Fastify route handlers using @ts-rest/fastify
└── [x] Verification Gate: Typecheck suite passes; 100% autocompletion on frontend API client

Sprint 3: Headless BiDi Document Engine
├── [x] Configure BullMQ queues with Redis 7+ failover
├── [x] Create Typst templates for report cards, fee receipts, and transcripts
├── [x] Implement server-side ExcelJS memory-efficient streaming exports
└── [x] Verification Gate: Perfect Urdu Nastaliq ligature rendering in exported PDFs

Sprint 4: UI/UX Consistency & Localization
├── [x] Migrate frontend UI primitives to Tailwind CSS v4 logical classes (ps-*, pe-*)
├── [x] Deploy Universal ModuleScaffold with Work, Reports, and Setup tabs
├── [x] Integrate dual Hijri/Gregorian date pickers and dynamic numeral formatters
└── [x] Verification Gate: Playwright E2E tests passing on both LTR (English) and RTL (Urdu/Arabic)

```

---

---

## Security hardening follow-ups (applied 2026-09)

| Item | Status | File(s) |
|---|---|---|
| WebSocket upgrade auth mirrors `authenticateTenant` (2FA, token/session revocation, tenant blocklist); token read from cookie only (query token removed) | Done | `apps/backend/src/routes/common/websocket.ts` |
| CSRF: double-submit `X-CSRF-Token` validated server-side for cookie-auth `/api` mutations; fail-closed when a cookie session presents no Origin/Referer/Sec-Fetch-Site | Done | `apps/backend/src/plugins/csrfOriginGuard.ts` |
| Contract routers no longer echo raw `error.message` in 500 bodies | Done | `attendanceContractRouter.ts`, `sessions.ts`, `contactRouteHelpers.ts` |
| CSP enabled + CORP tightened to `same-site` | Done | `apps/backend/src/plugins/security.ts` |
| SPA CSP nonce upgrade (replace `script-src 'unsafe-inline'` with a per-request nonce on the inline theme-flash script) | Done | `security.ts` (per-request nonce in `onSend`, stamped onto inline scripts) |

---

## 9. Verification & Smoke Test Protocols

### Multi-Tenant RLS Concurrency Test

```typescript
// apps/backend/test/integration/rls-isolation.test.ts
import { describe, it, expect } from 'vitest';
import { withTenant } from '../../src/db/tenant-context';
import { students } from '../../src/db/schema';

describe('Row Level Security Concurrency Test', () => {
  it('prevents cross-tenant data leakage within the shared connection pool', async () => {
    const tenantA = '00000000-0000-0000-0000-000000000001';
    const tenantB = '00000000-0000-0000-0000-000000000002';

    // Seed records
    await withTenant(tenantA, async (tx) => {
      await tx.insert(students).values({ name: 'Tenant A Student', tenantId: tenantA });
    });
    await withTenant(tenantB, async (tx) => {
      await tx.insert(students).values({ name: 'Tenant B Student', tenantId: tenantB });
    });

    // Concurrently query across both tenants
    const [resultA, resultB] = await Promise.all([
      withTenant(tenantA, async (tx) => tx.select().from(students)),
      withTenant(tenantB, async (tx) => tx.select().from(students)),
    ]);

    expect(resultA.every((s) => s.tenantId === tenantA)).toBe(true);
    expect(resultB.every((s) => s.tenantId === tenantB)).toBe(true);
    expect(resultA.find((s) => s.name === 'Tenant B Student')).toBeUndefined();
    expect(resultB.find((s) => s.name === 'Tenant A Student')).toBeUndefined();
  });
});

```

### BiDi Visual Assertion Test (Playwright)

```typescript
// e2e/specs/bidi-layout.spec.ts
import { test, expect } from '@playwright/test';

test('verifies bidirectional layout and Nastaliq rendering parity', async ({ page }) => {
  // English LTR View
  await page.goto('/tenant/students?lang=en');
  await expect(page.locator('h1')).toHaveCSS('text-align', 'start');
  const enBox = await page.locator('[data-testid="search-input"]').boundingBox();

  // Urdu RTL View
  await page.goto('/tenant/students?lang=ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toHaveCSS('font-family', /Noto Nastaliq Urdu/);
  
  // Verify mirrored search icon position
  const urBox = await page.locator('[data-testid="search-input"]').boundingBox();
  expect(urBox?.x).not.toEqual(enBox?.x);
});

```