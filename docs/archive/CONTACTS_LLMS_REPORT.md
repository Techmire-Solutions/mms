# TMS Contacts Module — llms.txt & Agent Discoverability Audit (Step 9)

Target URL: `https://tms.mmsv2.aabtaab.com/llms.txt`  
Auditor / Architect: Senior Full-Stack Developer & Software Architect  
Initial Lighthouse Agentic Browsing Score: 2/3  
Reported Warning: `llms.txt does not follow recommendations`

---

## 1. Executive Summary & Privacy Policy

> [!IMPORTANT]
> **Privacy Invariant:**
> MMS is a multi-tenant enterprise portal containing private, sensitive educational, personal, and financial records. Under no circumstance should `llms.txt` expose:
>
> - Private student, employee, or contact records.
> - Private REST API endpoints (`/api/contacts`, `/api/students`, etc.).
> - Internal database schemas, connection parameters, or cryptographic keys.
> - Authentication tokens, password formats, or session details.

---

## 2. Root Cause of the Lighthouse Agentic Browsing Warning

### Investigation of `https://tms.mmsv2.aabtaab.com/llms.txt`:

1. **Live Probe:**
   - Request: `GET /llms.txt`
   - Response: `HTTP/1.1 200 OK`
   - `Content-Type: text/html; charset=utf-8` (serving `index.html`).
2. **Root Cause:**
   - Just like `robots.txt` in Step 7, no physical `llms.txt` existed on the server.
   - The SPA catch-all rewrite served the HTML single page application instead of Markdown/plain-text adhering to the [llmstxt.org](https://llmstxt.org/) standard.
   - Automated AI agents and Lighthouse parsers attempting to interpret the HTML as markdown directives encountered syntax validation errors, resulting in the 2/3 score.

---

## 3. Implementation of Compliant `llms.txt`

Created a clean, standard-compliant `apps/frontend/public/llms.txt` describing the application's high-level purpose and public architecture while explicitly establishing privacy boundaries:

```markdown
# Madrasa Management System (MMS) — LLM Information File

> https://llmstxt.org/ specification compliance

## Overview

Madrasa Management System (MMS) is a dedicated multi-tenant enterprise resource planning (ERP) platform designed for Islamic educational institutions, madrasas, and schools.

## Public Interface & Access Model

- **Product Classification:** Multi-Tenant Administrative ERP & Management Portal.
- **Access Policy:** All application modules (including Contacts, Students, Staff, Attendance, Examinations, and Financial Ledgers) require strict authentication and tenant-scoped session authorization.
- **Search & Crawling Policy:** Crawlers and automated indexers are restricted via `robots.txt` (`Disallow: /`) and `<meta name="robots" content="noindex, nofollow">` to protect student and staff privacy in accordance with GDPR and FERPA regulations.

## Key Capabilities

- **Student Information System (SIS):** Admissions, enrollment, guardian tracking, and progress reporting.
- **Directory & Contacts:** Institutional directory, role management, and verified contact points.
- **Academic Lifecycle:** Examination scheduling, grade calculations, and attendance tracking grids.
- **Financial Accounting:** Fee structures, payment processing, double-entry ledgers, and automated invoicing.
- **Communication Gateway:** Integrated notifications and templated messaging channels.

## System Architecture & Security

- **Authentication:** Multi-tenant session cookies and cryptographically signed JWTs.
- **Data Protection:** PostgreSQL Row-Level Security (RLS) ensuring strict tenant isolation.
- **Integrity:** RFC 8785 canonical JSON audit trails with cryptographic hash chaining.
- **API Standards:** REST endpoints governed by strict Zod schema contracts with zero public unauthenticated surface.
```

---

## 4. Verification & Testing

- Verified via `curl -i http://localhost:5173/llms.txt`:
  - **HTTP Status:** 200 OK
  - **Content-Type:** `text/plain`
  - **Specification:** Complies with Markdown structure recommended by `llmstxt.org`.
  - **Data Safety:** Zero sensitive tenant records, internal endpoints, or private PII exposed.
