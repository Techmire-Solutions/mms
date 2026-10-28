import { expect, test, type Locator, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../../apps/backend");

/**
 * Ensures the module's Work (first) tier tab is active. Tier labels are module-specific —
 * Faculty's Work tier is labelled "Faculties", Obligations' is "Obligations" — so this
 * activates the first tab of the section navigation instead of a hardcoded "Work" label.
 */
export async function ensureWorkTierActive(page: Page): Promise<void> {
  const sectionNav = page
    .getByRole("tablist", { name: "Section navigation" })
    .or(page.getByRole("navigation", { name: "Section navigation" }))
    .first();

  if ((await sectionNav.count()) === 0) return;

  const target = sectionNav.locator('[role="tab"], button').first();
  await expect(target).toBeVisible({ timeout: 15_000 });

  const isSelected = await target.getAttribute("aria-selected");
  const isExpanded = await target.getAttribute("aria-expanded");
  if (isSelected !== "true" && isExpanded !== "true") {
    await target.click();
    await page.waitForLoadState("domcontentloaded");
  }
}

export async function selectOptionByMatchingText(
  select: Locator,
  text: string | RegExp,
): Promise<void> {
  const optValue = await select
    .locator("option")
    .filter({ hasText: text })
    .first()
    .getAttribute("value");
  if (!optValue) throw new Error(`Could not find option matching "${String(text)}"`);
  await select.selectOption(optValue);
}

export async function waitForToastOverlayToClear(page: Page, _context = ""): Promise<void> {
  const toast = page.locator('.z-toast [data-state="open"]');
  await toast.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {
    // Toast overlay unmounted or already hidden
  });
}

/** Form data payload for parameterized contact creation */
export interface ContactFormData {
  firstName: string;
  lastName: string;
  gender?: "Male" | "Female" | "Other" | "male" | "female" | "other";
  dob?: string;
  phone?: string;
  email?: string;
}

/** Sets gender on a contact FormModal (supports both native select and Radix dropdowns) */
async function fillContactGender(dialog: Locator, page: Page, gender: string): Promise<void> {
  const genderInput = dialog.locator('[id$="-gender"]');
  if (await genderInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    const isNativeSelect = await genderInput
      .evaluate((el) => el.tagName.toLowerCase() === "select")
      .catch(() => false);
    const normalized = gender.toLowerCase();
    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    if (isNativeSelect) {
      await genderInput.selectOption(normalized).catch(async () => {
        await genderInput.selectOption({ label });
      });
    } else {
      await genderInput.click();
      const option = page
        .locator('[role="option"]')
        .filter({ hasText: new RegExp(`^${label}$`, "i") })
        .first();
      await option.waitFor({ state: "visible", timeout: 5_000 });
      // The listbox animates on open, so Playwright's actionability stability check can
      // time out (or the node detaches) before the click lands. Dispatch the click
      // directly; the option handles a plain onClick.
      await option.dispatchEvent("click");
    }
  }
}

/** Adds and fills phone number on a contact FormModal */
async function fillContactPhone(dialog: Locator, phone: string): Promise<void> {
  await dialog.getByRole("tab", { name: "Phones" }).click();
  const phoneInput = dialog.locator('[id$="-phone-number-0"]').first();
  const isInputVisible = await phoneInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (!isInputVisible) {
    const addPhoneBtn = dialog.getByRole("button", { name: "Phone Number" }).first();
    if (await addPhoneBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addPhoneBtn.click();
    }
  }
  await expect(phoneInput).toBeVisible({ timeout: 5000 });
  await phoneInput.fill(phone);
  await phoneInput.blur();
}

/** Adds and fills email address on a contact FormModal */
async function fillContactEmail(dialog: Locator, email: string): Promise<void> {
  await dialog.getByRole("tab", { name: "Emails" }).click();
  const emailInput = dialog.locator('[id$="-email-address-0"]').first();
  const isInputVisible = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (!isInputVisible) {
    const addEmailBtn = dialog.getByRole("button", { name: "Email Address" }).first();
    if (await addEmailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addEmailBtn.click();
    }
  }
  await expect(emailInput).toBeVisible({ timeout: 5000 });
  await emailInput.fill(email);
  await emailInput.dispatchEvent("change");
  await emailInput.blur();
  await expect(emailInput).toHaveValue(email);
}

/** Parameterized contact creation in Contacts module */
export async function createContact(page: Page, data: ContactFormData): Promise<void> {
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  await test.step(`Create contact: ${fullName}`, async () => {
    await page.getByRole("button", { name: "Contact" }).first().click();
    const dialog = page.getByRole("dialog", {
      name: new RegExp(`(Add New Contact|Edit ${fullName}|Edit Contact)`, "i"),
    });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.locator('input[name="firstName"]').fill(data.firstName);
    await dialog.locator('input[name="lastName"]').fill(data.lastName);

    if (data.gender) {
      await fillContactGender(dialog, page, data.gender);
    }

    if (data.dob) {
      const dobInput = dialog.locator('[id$="-dob"], input[name="dob"]').first();
      await expect(dobInput).toBeVisible({ timeout: 5000 });
      await dobInput.fill(data.dob);
      await dobInput.blur();
    }

    if (data.phone) {
      await fillContactPhone(dialog, data.phone);
    }

    if (data.email) {
      await fillContactEmail(dialog, data.email);
    }

    await dialog.getByRole("tab", { name: "Basic" }).click();
    await waitForToastOverlayToClear(page, `before saving ${fullName}`);

    const saveResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/contacts") &&
        (res.request().method() === "POST" || res.request().method() === "PUT"),
      { timeout: 15_000 },
    );

    await dialog.getByRole("button", { name: /Save Contact|Save/i }).click();
    const resp = await saveResponsePromise;
    if (!resp.ok()) {
      const errorText = await resp.text();
      throw new Error(
        `Contact save /api/contacts failed with status ${resp.status()}: ${errorText}`,
      );
    }

    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(
      page.locator("table:visible tbody tr").filter({ hasText: fullName }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await waitForToastOverlayToClear(page, `after creating ${fullName}`);
  });
}

/** Creates Jane Doe (Female contact with phone) */
export async function createTestContactJaneDoe(page: Page): Promise<void> {
  await createContact(page, {
    firstName: "Jane",
    lastName: "Doe",
    gender: "Female",
    dob: "2015-05-15",
    phone: "03001234567",
  });
}

/** Creates John Doe (Male contact with email and phone) */
export async function createTestContactJohnDoe(page: Page): Promise<void> {
  await createContact(page, {
    firstName: "John",
    lastName: "Doe",
    gender: "Male",
    phone: "03009876543",
    email: "john.doe.e2e@example.com",
  });
}

/**
 * Registers student Jane Doe and links John Doe as Parent
 */
export async function registerStudentJaneDoe(page: Page): Promise<void> {
  await test.step("Register student Jane Doe & link John Doe as Parent", async () => {
    // Exact name: the global search button ("Search students, sessions…") also matches
    // a substring "Student" and would open the command palette instead.
    await page.getByRole("button", { name: "Student", exact: true }).first().click();
    const registerDialog = page.getByRole("dialog", { name: /(Register student|Edit student)/i });
    await expect(registerDialog).toBeVisible();

    const studentContactSearch = registerDialog.getByLabel("Student contact");
    await studentContactSearch.fill("Jane Doe");
    const janeOption = page.getByRole("option", { name: /Jane Doe/ }).first();
    await expect(janeOption).toBeVisible({ timeout: 15_000 });
    await janeOption.click();

    const editRelationshipsCta = registerDialog.getByRole("button", {
      name: /Edit contact relationships/i,
    });
    // Wait for the linked contact to load before the guardian section renders the button.
    // The button depends on linkedContact?.id being truthy (fetched via useContactById after contact selection).
    await expect(editRelationshipsCta).toBeVisible({ timeout: 15_000 });
    await editRelationshipsCta.click();

    const editJaneDialog = page.getByRole("dialog", { name: /Edit Contact/i });
    await expect(editJaneDialog).toBeVisible({ timeout: 15_000 });
    await editJaneDialog.getByRole("tab", { name: "Relationship" }).click();

    // Auto-save on tab switch may have already linked John Doe — check first.
    const alreadyLinked = await editJaneDialog
      .getByText("John Doe")
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!alreadyLinked) {
      await editJaneDialog.getByRole("button", { name: /^Relationship$/i }).click();
      // Fill John Doe in the last (newly added) contact picker row
      const relContactPicker = editJaneDialog
        .getByRole("combobox", { name: /Link contact/i })
        .last();
      await relContactPicker.fill("John Doe");
      const johnRelOption = page.getByRole("option", { name: /John Doe/ }).first();
      await expect(johnRelOption).toBeVisible({ timeout: 15_000 });
      await johnRelOption.click({ force: true });
    }

    // After John Doe is linked, ensure the "Relationship type" is set to "Parent".
    await expect(editJaneDialog.getByText("John Doe").first()).toBeVisible({ timeout: 10_000 });

    // Ensure relationship type is set to Parent (supports native <select> and custom dropdown buttons)
    const relSelects = editJaneDialog.locator('select[id*="-relationship-type-"]');
    const selectCount = await relSelects.count();
    if (selectCount > 0) {
      let targetSelect = relSelects.last();
      for (let i = 0; i < selectCount; i++) {
        const sel = relSelects.nth(i);
        const selId = (await sel.getAttribute("id")) ?? "";
        const match = selId.match(/-relationship-type-(\d+)$/);
        if (match) {
          const rowSection = editJaneDialog.locator(`[id$="-relationship-contact-${match[1]}"]`);
          const rowText = await rowSection.textContent().catch(() => "");
          if (rowText?.includes("John Doe")) {
            targetSelect = sel;
            break;
          }
        }
      }
      const currentVal = await targetSelect.inputValue().catch(() => "");
      if (currentVal.toLowerCase() !== "parent") {
        await targetSelect
          .selectOption({ label: "Parent" })
          .catch(() => targetSelect.selectOption("Parent"));
      }
    } else {
      const targetBtn = await findRelationshipTypeButton(editJaneDialog, "John Doe");
      if ((await targetBtn.count()) > 0) {
        const currentType = (await targetBtn.textContent().catch(() => "")) ?? "";
        if (!currentType.toLowerCase().includes("parent")) {
          await targetBtn.click();
          await page
            .locator('[role="option"]')
            .filter({ hasText: /^Parent$/i })
            .click();
        }
      }
    }

    await waitForToastOverlayToClear(page, "before saving Jane relationship");

    const savePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/contacts") &&
          (response.request().method() === "PUT" || response.request().method() === "POST"),
        { timeout: 15_000 },
      )
      .catch(() => null);

    await editJaneDialog.getByRole("button", { name: /Save/i }).click({ force: true });
    await savePromise;
    await expect(editJaneDialog).toBeHidden({ timeout: 15_000 });

    const studentRow = page
      .locator("table:visible tbody tr")
      .filter({ hasText: "Jane Doe" })
      .first();

    // Saving the contact's relationships either returns to the register form (which then
    // still needs submitting) or finalizes registration directly — the register form derives
    // its guardians from the linked contact's relationships. Handle both outcomes.
    if (await registerDialog.isVisible().catch(() => false)) {
      await expect(registerDialog.getByText(/John Doe/i).first()).toBeVisible({ timeout: 25_000 });

      await waitForToastOverlayToClear(page, "before registering student Jane Doe");

      const saveButton = registerDialog
        .getByRole("button", { name: /Register student|Save/i })
        .first();
      await expect(saveButton).toBeEnabled({ timeout: 15_000 });

      const studentCreatePromise = page
        .waitForResponse(
          (response) =>
            response.url().includes("/api/students") &&
            response.request().method() === "POST" &&
            !response.url().includes("/duplicate-check") &&
            !response.url().includes("/bulk"),
          { timeout: 30_000 },
        )
        .catch(() => null);

      await saveButton.click();

      const saveAnywayButton = page.getByRole("button", { name: /Save anyway/i });
      if (await saveAnywayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveAnywayButton.click();
      }

      await studentCreatePromise;
      await expect(registerDialog).toBeHidden({ timeout: 20_000 });
    }

    await expect(studentRow).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Finds the relationship type trigger button corresponding to a given contact row in FormModal.
 */
async function findRelationshipTypeButton(dialog: Locator, contactName: string): Promise<Locator> {
  const allRelTypeBtns = dialog.locator('button[id*="-relationship-type-"]');
  const btnCount = await allRelTypeBtns.count();
  for (let i = 0; i < btnCount; i++) {
    const btn = allRelTypeBtns.nth(i);
    const btnId = (await btn.getAttribute("id")) ?? "";
    const match = btnId.match(/-relationship-type-(\d+)$/);
    if (!match) continue;
    const rowSection = dialog.locator(`[id$="-relationship-contact-${match[1]}"]`);
    const rowText = await rowSection.textContent().catch(() => "");
    if (rowText?.includes(contactName)) {
      return btn;
    }
  }
  return allRelTypeBtns.first();
}

/**
 * Executes backend class & enrollment seed script for a given subdomain
 */
export function seedTestClassAndEnrollment(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping class seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-test-class.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed class/enrollment for ${subdomain}:`, message);
    throw err;
  }
}

/** Derives the tenant subdomain from the current page origin (e.g. http://acad123.localhost:5173). */
function resolveSubdomainFromPage(page: Page): string {
  const host = new URL(page.url()).hostname;
  const dot = host.indexOf(".");
  return dot === -1 ? host : host.slice(0, dot);
}

/**
 * Seeds the faculty catalog (one active department + designation) a fresh tenant needs before
 * an "Add Faculty Member" form can be submitted. Idempotent.
 */
export function seedFacultySetup(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping faculty setup seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-faculty-setup.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed faculty setup for ${subdomain}:`, message);
    throw err;
  }
}

/**
 * Seeds 20 deterministic contacts into a tenant via the backend script, so the a11y
 * gate can audit a *populated* directory (rows, filters, detail drawers) — the
 * empty-tenant blind spot documented in `docs/a11y-baseline.md`. Idempotent (the
 * script writes fixed ids `c-seed-dummy-*`), so re-running cannot duplicate rows.
 */
export function seedContacts(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping contacts seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-20-contacts.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed contacts for ${subdomain}:`, message);
    throw err;
  }
}

/**
 * Seeds 20 deterministic students (each linked 1:1 to a seeded contact) into a tenant via the
 * backend script, so the a11y gate can audit a *populated* students Work table. Run
 * `seedContacts` first (the students reference `c-seed-dummy-*`). Idempotent (fixed ids).
 */
export function seedStudents(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping students seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-20-students.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed students for ${subdomain}:`, message);
    throw err;
  }
}

/**
 * Seeds 20 deterministic academic sessions into a tenant via the backend script, so the a11y gate
 * can audit a *populated* sessions Work table. Self-contained (no contact/faculty dependency).
 * Idempotent (fixed ids `sess-seed-*`).
 */
export function seedSessions(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping sessions seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-20-sessions.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed sessions for ${subdomain}:`, message);
    throw err;
  }
}

/**
 * Seeds 20 deterministic faculty members into a tenant via the backend script, so the a11y gate can
 * audit a *populated* faculty Work table. Run `seedContacts` + `seedFacultySetup` first (the members
 * reference `c-seed-dummy-*` and the `dept-default` / `desig-default` catalog). Idempotent.
 */
export function seedFaculty(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping faculty seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-20-faculty.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed faculty for ${subdomain}:`, message);
    throw err;
  }
}

/**
 * Seeds 20 deterministic invoices into a tenant via the backend script, so the a11y gate can audit a
 * *populated* finance Work table. Self-contained (no contact/student dependency). Idempotent.
 */
export function seedInvoices(subdomain: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping invoices seed on production environment.");
    return;
  }
  try {
    const output = execSync(`pnpm exec tsx src/scripts/seed-20-invoices.ts ${subdomain}`, {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E] Failed to seed invoices for ${subdomain}:`, message);
    throw err;
  }
}

/**
 * Creates Faculty record for existing John Doe contact
 */
export async function createFacultyFromContact(page: Page): Promise<void> {
  await test.step("Create Faculty record from John Doe contact", async () => {
    // A fresh tenant has no faculty catalog; "Add Faculty Member" requires a designation.
    seedFacultySetup(resolveSubdomainFromPage(page));
    // Reload so the page's cached (now non-empty) designation/department queries refetch.
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await ensureWorkTierActive(page);
    await page
      .getByRole("button", { name: /^(Teacher|Faculty)$/i })
      .first()
      .click();
    const teacherDialog = page.getByRole("dialog");
    await expect(teacherDialog).toBeVisible({ timeout: 15_000 });

    const teacherContactSearch = teacherDialog.locator('input[role="combobox"]').first();
    await teacherContactSearch.fill("John Doe");
    const johnTeacherOption = page.getByRole("option", { name: /John Doe/ }).first();
    await expect(johnTeacherOption).toBeVisible({ timeout: 15_000 });
    await johnTeacherOption.click({ force: true });

    // Select the seeded designation on the Designation step so the form validates. The step
    // renders asynchronously after the tab click, so wait for the native <select> first.
    const designationTab = teacherDialog.getByRole("tab", { name: /Designation/i }).first();
    if ((await designationTab.count()) > 0) {
      await designationTab.click();
    }
    const designationSelect = teacherDialog.locator('select[id$="-designationId"]').first();
    await designationSelect.waitFor({ state: "attached", timeout: 10_000 }).catch(() => undefined);
    if ((await designationSelect.count()) > 0) {
      await designationSelect.selectOption({ index: 1 }).catch(() => undefined);
    }

    await waitForToastOverlayToClear(page, "before creating faculty");

    const saveBtn = teacherDialog
      .locator("button")
      .filter({ hasText: /^Add (Teacher|Faculty Member|Faculty)|Save/i })
      .last();
    await expect(saveBtn).toBeEnabled({ timeout: 15_000 });

    const teacherCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/faculty") &&
        response.request().method() === "POST" &&
        !response.url().includes("/bulk"),
      { timeout: 30_000 },
    );

    await saveBtn.click();

    const saveAnywayButton = page.getByRole("button", { name: /Save anyway|Confirm/i });
    if (await saveAnywayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveAnywayButton.click({ force: true });
    }

    const teacherResponse = await teacherCreate;
    if (!teacherResponse.ok()) {
      throw new Error(
        `Teacher create failed: HTTP ${teacherResponse.status()} ${await teacherResponse.text()}`,
      );
    }
    await expect(teacherDialog).toBeHidden({ timeout: 20_000 });
    await expect(
      page
        .locator(
          'table:visible tbody tr, [data-testid="teacher-card"], [data-testid="faculty-card"]',
        )
        .filter({ hasText: "John Doe" })
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Creates Finance Invoice for Jane Doe
 */
export async function createFinanceInvoice(page: Page): Promise<void> {
  await test.step("Create Finance Invoice for Jane Doe", async () => {
    await ensureWorkTierActive(page);
    await page.getByRole("button", { name: "New Invoice" }).first().click();
    const invoiceDialog = page.getByRole("dialog", { name: "New Invoice" });
    await expect(invoiceDialog).toBeVisible();

    // Pick the student through the registry selector — it sets both the real student id and
    // name; typing the id field directly posts an id the backend rejects.
    const studentSearch = invoiceDialog.locator("#invoice-student-id-select-search");
    if ((await studentSearch.count()) > 0) {
      await studentSearch.fill("Jane Doe");
    }
    const studentSelect = invoiceDialog.locator("#invoice-student-id-select");
    await expect(studentSelect).toBeAttached({ timeout: 15_000 });
    await expect(studentSelect.locator("option", { hasText: /Jane Doe/ }).first()).toHaveCount(1, {
      timeout: 15_000,
    });
    await selectOptionByMatchingText(studentSelect, /Jane Doe/);
    await invoiceDialog.locator("#invoice-class").fill("Morning Quran Class");
    await invoiceDialog.locator("#invoice-session").fill("Hifz 2026");
    await invoiceDialog.locator("#invoice-base-fee").fill("1500");

    const invoiceCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/finance/invoices") && response.request().method() === "POST",
      { timeout: 30_000 },
    );
    await invoiceDialog.getByRole("button", { name: "Create Invoice" }).click();
    const invoiceResponse = await invoiceCreate;
    if (!invoiceResponse.ok()) {
      throw new Error(
        `Invoice create failed: HTTP ${invoiceResponse.status()} ${await invoiceResponse.text()}`,
      );
    }
    await expect(invoiceDialog).toBeHidden({ timeout: 20_000 });
    await expect(
      page.locator("table:visible tbody tr").filter({ hasText: "Jane Doe" }),
    ).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Creates Session and adds a Class ('Tajweed A') assigned to John Doe
 */
export async function createSessionAndClass(page: Page): Promise<void> {
  await test.step("Create Session and assign Tajweed Class to John Doe", async () => {
    await ensureWorkTierActive(page);
    await page.getByRole("button", { name: "New session" }).first().click();
    const sessionDialog = page.getByRole("dialog", { name: "New session" });
    await expect(sessionDialog).toBeVisible();

    await sessionDialog.getByLabel("Session name").fill("Afternoon Tajweed 2026");
    const endDate = sessionDialog.getByLabel(/Enter date in/).nth(1);
    await endDate.fill("2026-12-31");
    await endDate.blur();

    const statusSelect = sessionDialog.locator("#session-status, select[name='status']").first();
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption("open").catch(async () => {
        await selectOptionByMatchingText(statusSelect, /Open/i);
      });
    }

    const sessionCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sessions") &&
        response.request().method() === "POST" &&
        !response.url().includes("/bulk"),
      { timeout: 30_000 },
    );
    await sessionDialog.getByRole("button", { name: "Create session" }).click();
    const sessionResponse = await sessionCreate;
    if (!sessionResponse.ok()) {
      throw new Error(
        `Session create failed: HTTP ${sessionResponse.status()} ${await sessionResponse.text()}`,
      );
    }
    await expect(sessionDialog).toBeHidden({ timeout: 20_000 });
    const sessionItem = page.getByRole("button", { name: /Afternoon Tajweed 2026/i }).first();
    await expect(sessionItem).toBeVisible({ timeout: 20_000 });
    await sessionItem.click();

    await expect(page.getByRole("heading", { name: "Afternoon Tajweed 2026" }).first()).toBeVisible(
      { timeout: 20_000 },
    );

    await page
      .getByRole("button", { name: /^Class$/i })
      .first()
      .click();
    const classDialog = page.getByRole("dialog", {
      name: /(Add class|New Session Class|Class:|^Class$)/i,
    });
    await expect(classDialog).toBeVisible();

    const facultySelect = classDialog.locator("#class-faculty");
    await expect(facultySelect).toBeAttached({ timeout: 15_000 });
    await expect(facultySelect.locator("option", { hasText: /John Doe/ }).first()).toHaveCount(1, {
      timeout: 15_000,
    });
    await selectOptionByMatchingText(facultySelect, /John Doe/);
    const className = classDialog.getByRole("textbox", { name: /Class name/ });
    await className.fill("Tajweed A");
    await expect(className).toHaveValue("Tajweed A");
    const capacityInput = classDialog.locator("#class-capacity");
    if (await capacityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await capacityInput.fill("25");
    }
    const maxAgeInput = classDialog.locator("#class-max-age");
    if (await maxAgeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await maxAgeInput.fill("25");
    }
    await expect(classDialog.getByRole("button", { name: "Save" })).toBeEnabled();

    const sessionUpdate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sessions/") && response.request().method() === "PUT",
      { timeout: 30_000 },
    );
    await classDialog.getByRole("button", { name: "Save" }).click();
    const sessionUpdateResponse = await sessionUpdate;
    if (!sessionUpdateResponse.ok()) {
      throw new Error(
        `Session class save failed: HTTP ${sessionUpdateResponse.status()} ${await sessionUpdateResponse.text()}`,
      );
    }
    await expect(classDialog).toBeHidden({ timeout: 20_000 });
    await page.waitForLoadState("domcontentloaded");
    const sessionDrawer = page
      .getByRole("dialog", { name: /Session details/i })
      .or(page.getByRole("dialog").filter({ hasText: "Afternoon Tajweed 2026" }))
      .first();
    if (await sessionDrawer.isVisible({ timeout: 5000 }).catch(() => false)) {
      const closeDrawerBtn = sessionDrawer
        .getByRole("button", { name: /Close/i })
        .or(sessionDrawer.locator('button[aria-label="Close"]'))
        .first();
      await closeDrawerBtn.click().catch(async () => {
        await page.keyboard.press("Escape");
      });
      await expect(sessionDrawer).toBeHidden({ timeout: 20_000 });
    }
    await waitForToastOverlayToClear(page, "after closing session detail drawer");
  });
}

/**
 * Completes Enrollment wizard for Jane Doe -> Afternoon Tajweed 2026
 */
export async function createStudentEnrollment(page: Page): Promise<void> {
  await test.step("Enroll student Jane Doe into Afternoon Tajweed", async () => {
    await ensureWorkTierActive(page);
    await page.getByRole("button", { name: "New Enrollment" }).first().click();
    const enrollmentDialog = page.getByRole("dialog", { name: "New Enrollment" });
    await expect(enrollmentDialog).toBeVisible();

    const janeStudent = enrollmentDialog.getByRole("radio", { name: /Jane Doe/ }).first();
    await expect(janeStudent).toBeVisible({ timeout: 15_000 });
    await janeStudent.click();
    await expect(janeStudent).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });

    const nextBtn = enrollmentDialog.getByRole("button", { name: /^Next$/i });

    // Step 1: Session selection
    const afternoonSession = enrollmentDialog
      .getByRole("radio", { name: /Afternoon Tajweed 2026/ })
      .first();
    if (!(await afternoonSession.isVisible().catch(() => false))) {
      await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
      await nextBtn.click();
    }
    await expect(afternoonSession).toBeVisible({ timeout: 15_000 });
    await afternoonSession.click();
    await expect(afternoonSession).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });

    // Step 2: Eligibility Check
    const eligibilityText = enrollmentDialog.getByText(
      /Student is eligible — you may proceed to class assignment/i,
    );
    if (!(await eligibilityText.isVisible().catch(() => false))) {
      await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
      await nextBtn.click();
    }
    await expect(eligibilityText).toBeVisible({ timeout: 15_000 });

    // Step 3: Class Assignment
    const classCard = enrollmentDialog.getByRole("radio", { name: /Tajweed a/i }).first();
    if (!(await classCard.isVisible().catch(() => false))) {
      await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
      await nextBtn.click();
    }
    await expect(classCard).toBeVisible({ timeout: 15_000 });
    await classCard.click();
    await expect(classCard).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });

    // Step 4: Fee Calculation
    const feeHeading = enrollmentDialog.getByText(/Fee Breakdown|Fee Calculation/i).first();
    if (!(await feeHeading.isVisible().catch(() => false))) {
      await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
      await nextBtn.click();
    }
    await expect(feeHeading).toBeVisible({ timeout: 15_000 });

    // Step 5: Confirmation
    const confirmBtn = enrollmentDialog.getByRole("button", { name: /New Enrollment/i });
    if (!(await confirmBtn.isVisible().catch(() => false))) {
      await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
      await nextBtn.click();
    }
    await expect(confirmBtn).toBeVisible({ timeout: 15_000 });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });

    const enrollmentCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/enrollments") &&
        response.request().method() === "POST" &&
        !response.url().includes("/bulk"),
      { timeout: 30_000 },
    );
    await confirmBtn.click();
    const enrollmentResponse = await enrollmentCreate;
    if (!enrollmentResponse.ok()) {
      throw new Error(
        `Enrollment create failed: HTTP ${enrollmentResponse.status()} ${await enrollmentResponse.text()}`,
      );
    }
    await expect(enrollmentDialog).toBeHidden({ timeout: 20_000 });
    await expect(
      page.locator("table:visible tbody tr").filter({ hasText: "Afternoon Tajweed 2026" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator("table:visible tbody tr").filter({ hasText: "Afternoon Tajweed 2026" }).filter({
        hasText: "Jane Doe",
      }),
    ).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Records payment for invoice
 */
export async function recordInvoicePayment(page: Page): Promise<void> {
  await test.step("Record invoice payment for Jane Doe", async () => {
    await ensureWorkTierActive(page);
    const row = page.locator("table:visible tbody tr").filter({ hasText: "Jane Doe" }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: /Actions/i }).click();
    await page.getByRole("menuitem", { name: /Record payment/i }).click();
    const paymentDialog = page.getByRole("dialog", { name: "Record payment" });
    await expect(paymentDialog).toBeVisible();
    await expect(paymentDialog.locator("#payment-amount-input")).not.toHaveValue("", {
      timeout: 10_000,
    });
    await expect(paymentDialog.locator("#payment-amount-input")).not.toHaveValue("0");

    const paymentCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/finance/payments") && response.request().method() === "POST",
      { timeout: 30_000 },
    );
    await paymentDialog.getByRole("button", { name: "Record payment" }).click();
    const paymentResponse = await paymentCreate;
    if (!paymentResponse.ok()) {
      throw new Error(
        `Payment create failed: HTTP ${paymentResponse.status()} ${await paymentResponse.text()}`,
      );
    }
    await expect(paymentDialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Creates Messaging Preset Template & dispatches SMS Campaign
 */
export async function createMessagingTemplateAndCampaign(page: Page): Promise<void> {
  await test.step("Create messaging template & dispatch SMS campaign", async () => {
    const setupTab = page.getByRole("tab", { name: "Setup", exact: true }).first();
    await setupTab.click();
    await page.getByRole("button", { name: "Create Preset Template" }).first().click();
    await expect(page.locator("#tplLabel").locator("visible=true")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#tplLabel").locator("visible=true").fill("E2E Fee Reminder");
    await page
      .locator("#tplBody")
      .locator("visible=true")
      .fill("Assalamu Alaikum {name}, your fee balance is due. JazakAllah Khair.");

    const templateCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/messaging/templates") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: "Save New Template" }).locator("visible=true").click();
    const templateResponse = await templateCreate;
    if (!templateResponse.ok()) {
      throw new Error(
        `Messaging template create failed: HTTP ${templateResponse.status()} ${await templateResponse.text()}`,
      );
    }
    await expect(
      page
        .getByText(/E2e Fee Reminder/i)
        .locator("visible=true")
        .first(),
    ).toBeVisible({
      timeout: 20_000,
    });

    // Navigate back to Work tab so the header "New Campaign" button is visible
    await ensureWorkTierActive(page);

    // Click "New Campaign" dropdown trigger
    const newCampaignBtn = page.getByRole("button", { name: /New Campaign/i }).first();
    await expect(newCampaignBtn).toBeVisible({ timeout: 10_000 });
    await newCampaignBtn.click();

    // Pick SMS from the channel dropdown
    const smsMenuItem = page
      .getByRole("menuitem", { name: /SMS/i })
      .or(page.getByRole("option", { name: /SMS/i }));
    await expect(smsMenuItem.first()).toBeVisible({ timeout: 5_000 });
    await smsMenuItem.first().click();

    // Composer opens in 'pick' step — FormModal titled "Select Recipients"
    const composerDialog = page.getByRole("dialog").filter({ hasText: /Select Recipients/i });
    await expect(composerDialog).toBeVisible({ timeout: 15_000 });

    // Search for Jane Doe in the recipient picker
    const recipientSearch = composerDialog.getByPlaceholder(/Search recipients/i);
    await expect(recipientSearch).toBeVisible({ timeout: 5_000 });
    await recipientSearch.fill("Jane Doe");

    // Wait for Jane Doe to appear in the contacts table and select her
    const janeDoeRow = composerDialog.getByRole("row", { name: /Jane Doe/i }).first();
    await expect(janeDoeRow).toBeVisible({ timeout: 15_000 });
    // Click the checkbox in Jane's row (ContactsTable renders a checkbox per row)
    const janeCheckbox = janeDoeRow.getByRole("checkbox").first();
    const janeCheckboxVisible = await janeCheckbox.isVisible({ timeout: 2000 }).catch(() => false);
    if (janeCheckboxVisible) {
      await janeCheckbox.click();
    } else {
      // Fallback: click the row itself to toggle selection
      await janeDoeRow.click();
    }

    // Click "Next" to advance to compose step
    await composerDialog
      .getByRole("button", { name: /^Next$/i })
      .last()
      .click();

    // Compose step — select the template we created
    const smsDialog = page.getByRole("dialog").last();
    const templateSelect = smsDialog.locator("#messageTemplate");
    const templateSelectVisible = await templateSelect
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (templateSelectVisible) {
      await selectOptionByMatchingText(templateSelect, /E2e Fee Reminder/i).catch(async () => {
        await templateSelect.selectOption({ label: "E2E Fee Reminder" }).catch(() => undefined);
      });
    }
    await expect(smsDialog.locator("#messageBody")).not.toHaveValue("", { timeout: 10_000 });

    const dispatchResponsePromise = page.waitForResponse(
      (response) =>
        (response.url().includes("/api/messaging/dispatch/sms") ||
          response.url().includes("/api/messaging/logs")) &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    );
    const submitBtn = smsDialog
      .getByRole("button", { name: /Open Messages|Send/i })
      .or(smsDialog.locator('button[type="submit"]'))
      .last();
    await submitBtn.click({ timeout: 10_000 });
    const dispatchResponse = await dispatchResponsePromise;
    if (!dispatchResponse.ok()) {
      throw new Error(
        `Messaging dispatch failed: HTTP ${dispatchResponse.status()} ${await dispatchResponse.text()}`,
      );
    }
    await expect(smsDialog).toBeHidden({ timeout: 20_000 });

    await expect(
      page.locator("table:visible tbody tr").filter({ hasText: "Jane Doe" }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Creates Chart of Accounts accounts & balanced journal entry
 */
export async function createAccountsAndJournalEntry(page: Page): Promise<void> {
  await test.step("Create Chart of Accounts & post balanced journal entry", async () => {
    await ensureWorkTierActive(page);
    const coaTab = page.getByRole("tab", { name: /Chart of Accounts/i }).first();
    await expect(coaTab).toBeVisible({ timeout: 15_000 });
    await coaTab.click();
    await expect(page.getByRole("region", { name: "Chart of Accounts" })).toBeVisible({
      timeout: 15_000,
    });

    for (const account of [
      { code: "1100", name: "E2E Cash", type: "Asset" },
      { code: "4100", name: "E2E Tuition Income", type: "Revenue" },
    ] as const) {
      await page.getByRole("button", { name: "Account", exact: true }).first().click();
      const accountDialog = page.getByRole("dialog", { name: "Account" });
      await expect(accountDialog).toBeVisible();
      await accountDialog.locator("#account-type").selectOption(account.type);
      await accountDialog.locator("#account-code").fill(account.code);
      await accountDialog.locator("#account-name").fill(account.name);
      await expect(accountDialog.locator("#account-code")).toHaveValue(account.code);

      const accountSave = page.waitForResponse(
        (response) =>
          response.url().includes("/api/accounting/accounts/bulk") &&
          response.request().method() === "PUT",
        { timeout: 30_000 },
      );
      await accountDialog.getByRole("button", { name: "Save" }).click();
      const accountResponse = await accountSave;
      if (!accountResponse.ok()) {
        throw new Error(
          `Accounting account save failed: HTTP ${accountResponse.status()} ${await accountResponse.text()}`,
        );
      }
      await expect(accountDialog).toBeHidden({ timeout: 20_000 });
      await expect(page.getByText(account.name).locator("visible=true").first()).toBeVisible({
        timeout: 20_000,
      });
    }

    const journalTab = page.getByRole("tab", { name: /Journal Entries/i }).first();
    await expect(journalTab).toBeVisible({ timeout: 15_000 });
    await journalTab.click();
    const advancedTab = page.getByRole("tab", { name: /Advanced/i }).first();
    await expect(advancedTab).toBeVisible({ timeout: 15_000 });
    await advancedTab.click();
    await expect(page.getByRole("region", { name: "Advanced Journal Entries" })).toBeVisible({
      timeout: 15_000,
    });

    await page
      .getByRole("region", { name: "Advanced Journal Entries" })
      .getByRole("button", { name: "New Entry" })
      .first()
      .click();
    const entryDialog = page.getByRole("dialog", { name: "New Journal Entry" });
    await expect(entryDialog).toBeVisible();
    await entryDialog.locator("#journal-entry-description").fill("E2E fee collection journal");

    const line1Select = entryDialog.locator('select[aria-label="Account for line 1"]:visible');
    await selectOptionByMatchingText(line1Select, "1100");
    await entryDialog.locator('[aria-label="Debit amount for line 1"]:visible').fill("2500");

    const line2Select = entryDialog.locator('select[aria-label="Account for line 2"]:visible');
    await selectOptionByMatchingText(line2Select, "4100");
    await entryDialog.locator('[aria-label="Credit amount for line 2"]:visible').fill("2500");

    const entrySave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/accounting/entries/bulk") &&
        response.request().method() === "PUT",
      { timeout: 30_000 },
    );
    await entryDialog.getByRole("button", { name: "Post Entry" }).click();
    const entryResponse = await entrySave;
    if (!entryResponse.ok()) {
      throw new Error(
        `Accounting entry save failed: HTTP ${entryResponse.status()} ${await entryResponse.text()}`,
      );
    }
    await expect(entryDialog).toBeHidden({ timeout: 20_000 });
    await expect(
      page
        .getByText(/E2e Fee Collection Journal/i)
        .locator("visible=true")
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });
}

/**
 * Creates User record from John Doe contact with Teacher role
 */
export async function createUserFromContact(page: Page): Promise<void> {
  await test.step("Create User from John Doe contact with Teacher role", async () => {
    await ensureWorkTierActive(page);
    await page.getByRole("button", { name: "User" }).first().click();
    const userDialog = page.getByRole("dialog", { name: /Add New User/i });
    await expect(userDialog).toBeVisible({ timeout: 15_000 });

    const userContactSearch = userDialog.locator('input[role="combobox"]').first();
    await userContactSearch.fill("John Doe");
    const johnUserOption = page.getByRole("option", { name: /John Doe/ }).first();
    await expect(johnUserOption).toBeVisible({ timeout: 15_000 });
    await johnUserOption.click({ force: true });

    await expect(userDialog.getByText("John Doe").first()).toBeVisible({
      timeout: 10_000,
    });

    const emailField = userDialog.locator('input[type="email"]');
    if (await emailField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await emailField.fill("john.doe.e2e@example.com");
    }

    await userDialog.getByRole("button", { name: /Next/i }).click();
    const teacherRole = userDialog.getByText(/^Teacher$/i).first();
    await expect(teacherRole).toBeVisible({ timeout: 10_000 });
    await teacherRole.click();
    await userDialog.getByRole("button", { name: /Next/i }).click();

    const createBtn = userDialog.getByRole("button", { name: /Create User/i });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });

    const userCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/api/users") &&
        response.request().method() === "POST" &&
        !response.url().includes("/activity"),
      { timeout: 30_000 },
    );
    await createBtn.click();
    const userResponse = await userCreate;
    if (!userResponse.ok()) {
      throw new Error(
        `User create failed: HTTP ${userResponse.status()} ${await userResponse.text()}`,
      );
    }
    const closeBtn = userDialog.getByRole("button", { name: /Close/i }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true });
    }
    await expect(userDialog).toBeHidden({ timeout: 20_000 });
    await expect(
      page.locator("table:visible tbody tr").filter({ hasText: "John Doe" }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
}
