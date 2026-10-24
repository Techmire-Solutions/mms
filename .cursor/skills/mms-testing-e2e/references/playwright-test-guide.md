# Playwright E2E Testing Guide

Operational guide for writing, running, and debugging end-to-end browser specs in MMS.

## 1. Directory Structure

All E2E assets live in `e2e/`:

```
e2e/
├── helpers/              # Authentication bootstrap, tenant seed helpers, axe utilities
├── tests/
│   ├── a11y/             # Automated accessibility scans (axe-core)
│   ├── features/         # Cross-module feature workflows
│   ├── platform/         # Platform Console apex specs
│   ├── responsive/       # Viewport & RTL horizontal overflow checks
│   └── tenant/           # Tenant workspace module CRUD specs
└── playwright.config.ts  # Playwright configuration, projects, webServer
```

## 2. Common Execution Commands

```bash
# Run all E2E specs
pnpm test:e2e

# Run only Platform Console apex specs
pnpm test:e2e tests/platform/

# Run only Tenant Workspace specs
pnpm test:e2e tests/tenant/

# Run responsive viewport tests
pnpm test:e2e tests/responsive/responsive-shell.spec.ts

# Run accessibility axe scan
pnpm test:e2e tests/a11y/a11y-shell.spec.ts

# Run headed for visual debugging
pnpm test:e2e --headed
```

## 3. Storage State & Auth Bootstrap

Specs avoid submitting the login form on every test. Instead, auth state is bootstrapped once via `e2e/helpers/tenantBootstrap.ts`:
- Storage states persist cookies (`mms_tenant_session`, `mms_platform_session`) into temporary test contexts.
- Tests declare dependencies on the auth setup project in `playwright.config.ts`.
