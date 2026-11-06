# MMS Contacts Module — Security & Best Practices Audit (Step 8)

Target URL: `https://tms.mmsv2.aabtaab.com/contacts`  
Auditor / Architect: Senior Full-Stack Developer & Software Architect  
Initial Lighthouse Best Practices Score: 96/100  
Status: Verified & Audited

---

## 1. Executive Summary

Lighthouse Best Practices identified 4 key areas of inquiry:

1. **Missing source maps for large first-party JavaScript:** Production builds currently strip/hide public `.map` files to protect intellectual property and business logic.
2. **CSP effectiveness against XSS:** Content Security Policy evaluation, inline scripts, and WebSocket origins.
3. **Trusted Types protection against DOM-based XSS:** Review of `innerHTML` and raw DOM injections.
4. **Browser compatibility Baseline Features:** Modern Evergreen Browser compliance and CSS pseudo-selector warnings.

All 10 inspection tasks and security controls have been rigorously evaluated against the MMS security and multi-tenancy rules.

---

## 2. In-Depth Analysis of Reported Issues

### A. Source Map Configuration: Security vs. Debuggability

- **The Finding:** Lighthouse flags "Missing source maps for large first-party JavaScript".
- **Security Assessment:**
  - **Exposing raw `.map` files in public production is a security vulnerability.** It exposes proprietary algorithm logic, internal API contracts, route models, and developer notes to anyone opening Chrome DevTools.
  - In `apps/frontend/vite.config.ts`, MMS enforces:
    ```typescript
    sourcemap: process.env.CI === "true" ? "hidden" : false,
    ```
  - **Determination:** `sourcemap: "hidden"` generates source maps for private crash reporting (e.g. Sentry) so production stack traces resolve to original TypeScript lines without linking `//# sourceMappingURL=` in the public JS bundle.
  - **Verdict:** Retaining hidden/private source maps is intentional and protects institutional intellectual property.

---

### B. Content Security Policy (CSP) & XSS Defenses

- **Audit of CSP Implementation (`apps/backend/src/plugins/security.ts`):**
  - **Script Nonces:** Every request generates a cryptographically random cryptographic nonce via `crypto.randomBytes(16).toString("base64")`.
  - **Inline Script Lockdown:** `script-src` includes `'nonce-<nonce>'` and hashes `'sha256-...'` for the theme flash prevention snippet. `'unsafe-inline'` is strictly **banned**.
  - **Attribute Injection Lockdown:** `script-src-attr: 'none'` completely neutralizes inline event handlers (`onload=`, `onerror=`) and `javascript:` URIs.
  - **Framing & Clickjacking:** `frame-ancestors: 'none'` prevents MMS from being embedded in iframes on untrusted domains.
  - **Wasm Safety:** `wasm-unsafe-eval` allows client-side image compression (AVIF/WebP) while keeping JavaScript `eval()` blocked.
  - **WebSocket Lockdown:** `connect-src` explicitly restricts WebSocket upgrades to the verified app domain and declared origins (`resolveWebSocketOrigins()`).

---

### C. Trusted Types & DOM Injection Verification

- **Codebase Sweep for `innerHTML` and `dangerouslySetInnerHTML`:**
  - Contacts module contains **zero instances** of `innerHTML` or `dangerouslySetInnerHTML` across all components (`ContactsList`, `ContactDetail`, `ContactForm`, `ContactsWorkTier`, etc.).
  - All text content renders via React's automatic JSX escaping or `BiDiText` sanitizing wrappers.
  - **Trusted Types Evaluation:**
    - Adding `require-trusted-types-for 'script'` requires all DOM sinks (`Element.innerHTML`, `ScriptElement.src`) to pass through a registered Trusted Types policy.
    - React 19 natively uses safe DOM manipulation (`createElement`, `textContent`, `setAttribute`).
    - The only diagramming component in the entire app that uses `dangerouslySetInnerHTML` is `ErdMermaidDiagram.tsx` in the Platform Console, completely isolated from the Tenant Contacts workspace.

---

### D. Safe Handling of Contacts Form Data & API Responses

- **Client-Side Validation:** All contact inputs (phones, emails, national identity numbers) are parsed and validated via `@mms/shared` Zod DTOs before submission.
- **Server-Side Authorization & RLS:**
  - Every API endpoint requires `authenticateTenant` middleware and checks `can("contacts", "read")` / `can("contacts", "write")`.
  - Database queries execute under PostgreSQL Row-Level Security (`SET LOCAL app.current_tenant = ...`), strictly prohibiting Cross-Tenant Data Access (IDOR).
- **Audit Trail Outbox:** Every contact creation, modification, or soft-deletion is recorded in RFC 8785 canonical JSON with immutable hash chaining.

---

### E. Baseline Features & DevTools Console Warnings

- **The Issue:** DevTools flags CSS warning for `.scrollspy-nav a:target-current`.
- **Root Cause:** `:target-current` is a modern Baseline Newly Available CSS feature for scrollspy navigation. Older browser engines do not yet support the pseudo-class natively.
- **Mitigation:** MMS implements feature detection with a graceful fallback class (`.\:target-current`) powered by an `IntersectionObserver` hook (`useScrollspy.ts`), ensuring cross-browser stability for Firefox, Safari, and Chrome.

---

## 3. Verification & Compliance Matrix

| Security / Best Practice Area | Status        | Evidence & Safeguard                                                    |
| :---------------------------- | :------------ | :---------------------------------------------------------------------- |
| **XSS Defense (CSP)**         | **Hardened**  | Per-request nonces, `script-src-attr 'none'`, `'unsafe-inline'` blocked |
| **Clickjacking**              | **Protected** | `frame-ancestors 'none'`, `X-Frame-Options: SAMEORIGIN`                 |
| **Data Protection**           | **Protected** | Private source maps (`hidden`), no public code exposure                 |
| **DOM Injections**            | **Clean**     | 0 `innerHTML` in Contacts module; safe React 19 JSX escaping            |
| **Multi-Tenant Isolation**    | **Enforced**  | Tenant RLS context + RBAC `can("contacts", ...)` checks                 |
| **Dependency Audits**         | **Reviewed**  | Routine dev/build dependencies triaged per `mms-vuln-response`          |
| **Cache Headers**             | **Secure**    | Sensitive APIs carry `private, no-cache, no-store, must-revalidate`     |
