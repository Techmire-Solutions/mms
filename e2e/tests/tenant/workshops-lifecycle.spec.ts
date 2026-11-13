import { test, expect, type Page } from "@playwright/test";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import type { TenantBootstrapCredentials } from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

type ApiResult = { status: number; body: Record<string, unknown> };

/** Same-origin JSON call with the double-submit CSRF header, like apiClient. */
async function api(
  page: Page,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult> {
  return page.evaluate(
    async ({ method: httpMethod, target, payload, extraHeaders }) => {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
      const response = await fetch(target, {
        method: httpMethod,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
          ...extraHeaders,
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : {} };
    },
    { method, target: path, payload: body, extraHeaders: headers },
  );
}

test.describe.serial("Workshops lifecycle E2E", { tag: "@local-only" }, () => {
  const subdomain = `ws${Date.now()}`;
  const tenantOrigin = `http://${subdomain}.localhost:5173`;
  const credentials: TenantBootstrapCredentials = {
    subdomain,
    tenantOrigin,
    adminEmail: `admin@${subdomain}.com`,
    adminPassword: "Madrasa@1234",
    changedAdminPassword: "Madrasa@5678",
    platformEmail: `platform-${subdomain}@test.com`,
    platformPassword: "Pa$$w0rd123",
  };

  test("creates a workshop, shows the seeded roster and reflects a cancellation", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await bootstrapAuthenticatedTenantViaApi(page, credentials);

    const contact = await api(page, "POST", "/api/contacts", {
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(contact.status).toBeLessThan(300);
    const contactRecord = contact.body.contact as { id: string } | undefined;
    expect(contactRecord?.id).toBeTruthy();

    const title = `E2E Calligraphy ${Date.now()}`;
    const created = await api(page, "POST", "/api/workshops", {
      title,
      description: "Created through the API for the UI journey",
      startDate: "2099-11-01",
      endDate: "2099-11-02",
      capacity: 5,
    });
    expect(created.status).toBeLessThan(300);
    const workshop = created.body.workshop as { id: string } | undefined;
    expect(workshop?.id).toBeTruthy();

    const added = await api(page, "POST", `/api/workshops/${workshop!.id}/participants`, {
      contactId: contactRecord!.id,
    });
    expect(added.status).toBeLessThan(300);

    await page.goto(`${tenantOrigin}/workshops`);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(title).first().click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    // The roster row renders the participant name and registration state as paragraphs. The
    // same name also labels the per-participant check-in and score controls, so a bare text
    // match is ambiguous — scope to the roster paragraphs.
    await expect(drawer.getByRole("paragraph").filter({ hasText: "Jane Doe" })).toBeVisible();
    await expect(drawer.getByRole("paragraph").filter({ hasText: "Registered" })).toBeVisible();

    // Cancel through the contract (the dialog itself is component-tested), then prove the page
    // reflects the new phase after a fresh read.
    const detail = await api(page, "GET", `/api/workshops/${workshop!.id}`);
    expect(detail.status).toBeLessThan(300);
    const updatedAt = (detail.body.workshop as { updatedAt?: string } | undefined)?.updatedAt;
    expect(updatedAt).toBeTruthy();
    const cancelled = await api(
      page,
      "POST",
      `/api/workshops/${workshop!.id}/transition`,
      { to: "cancelled", reason: "E2E cleanup" },
      { "x-expected-updated-at": updatedAt! },
    );
    expect(cancelled.status).toBeLessThan(300);

    await page.reload();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(title).first().click();
    // Once the workshop is cancelled the roster rows resolve to "Cancelled" too (the derived
    // registration state), so pin the phase assertion to the drawer's Status definition.
    await expect(
      page.getByRole("dialog").getByRole("definition").filter({ hasText: "Cancelled" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
