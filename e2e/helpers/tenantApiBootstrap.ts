import { expect, type Page } from '@playwright/test';
import { DEFAULT_BRANDING_SETTINGS, SYSTEM_MODULES } from '@mms/shared';
import { loginTenant } from './moduleTiers.js';
import { ensureE2ePlatformAdmin } from './platformAdminSeeder.js';
import type { TenantBootstrapCredentials } from './tenantBootstrap.js';

const APEX_ORIGIN = process.env.BASE_URL || 'http://localhost:5173';

/** Static JSON from the frontend: puts the page on `origin` without booting the SPA. */
const BLANK_DOCUMENT = '/site.webmanifest';

/**
 * POSTs JSON from inside the page on `origin`, the way apiClient does it:
 * same-origin cookies plus the double-submit `X-CSRF-Token`. Running in the
 * browser (not page.request) keeps `*.localhost` tenant hosts resolvable.
 */
async function postJsonFrom(page: Page, origin: string, path: string, body: unknown): Promise<void> {
  if (!page.url().startsWith(origin)) await page.goto(`${origin}${BLANK_DOCUMENT}`);
  const result = await page.evaluate(
    async ({ path: target, payload }) => {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
      const res = await fetch(target, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify(payload),
      });
      return { status: res.status, text: res.ok ? '' : await res.text() };
    },
    { path, payload: body },
  );
  expect(result.status, `POST ${origin}${path}: ${result.text}`).toBeLessThan(300);
}

/**
 * API equivalent of `bootstrapAuthenticatedTenant`: same platform admin,
 * workspace (wizard defaults: every system module, `madrasa`), and forced
 * password change, then a real UI login. Skips the onboarding wizard and
 * force-change screens (~20s); specs on `bootstrapAuthenticatedTenant`
 * (platform-console-critical, print-documents, …) still drive them in CI.
 */
export async function bootstrapAuthenticatedTenantViaApi(
  page: Page,
  credentials: TenantBootstrapCredentials,
): Promise<void> {
  const {
    subdomain,
    tenantOrigin,
    adminEmail,
    adminPassword,
    changedAdminPassword,
    platformEmail,
    platformPassword,
  } = credentials;

  ensureE2ePlatformAdmin(platformEmail, platformPassword);

  await postJsonFrom(page, APEX_ORIGIN, '/api/platform/auth/login', {
    email: platformEmail,
    password: platformPassword,
  });
  await postJsonFrom(page, APEX_ORIGIN, '/api/auth/onboard', {
    madrasaName: 'Responsive Shell Madrasa',
    tagline: DEFAULT_BRANDING_SETTINGS.tagline,
    adminName: 'Resp Admin',
    email: adminEmail,
    password: adminPassword,
    currentPassword: platformPassword,
    subdomain,
    modules: SYSTEM_MODULES.map((m) => m.id),
    industryType: 'madrasa',
  });

  await postJsonFrom(page, tenantOrigin, '/api/auth/login', { email: adminEmail, password: adminPassword });
  await postJsonFrom(page, tenantOrigin, '/api/auth/change-password', {
    currentPassword: adminPassword,
    newPassword: changedAdminPassword,
  });

  await loginTenant(page, tenantOrigin, adminEmail, changedAdminPassword);
}
