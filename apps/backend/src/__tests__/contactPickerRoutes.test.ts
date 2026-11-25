import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contacts picker routes.
 *
 * The picker handler lives in `@mms/mod-contacts` and calls its use cases via
 * relative imports, so the old app-local use-case mocks could never intercept
 * them. The suite now injects a fake repository through the module's test seam
 * and mocks the be-core field-config factory the sanitizer depends on.
 */

const mocks = vi.hoisted(() => ({ loadFieldConfig: vi.fn() }));

vi.mock("@mms/be-core/data/module-field-config", () => ({
  createModuleFieldConfigService: () => ({
    load: mocks.loadFieldConfig,
    save: vi.fn(),
  }),
}));

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const { createDemoWorkspaceMock } = await import("./helpers/buildTestMocks.js");
  const { getWorkspaceBySubdomain } = createDemoWorkspaceMock();
  return { ...actual, getWorkspaceBySubdomain };
});

import type { Contact } from "@mms/contracts";
import {
  resetContactsRepositoryForTesting,
  setContactsRepositoryForTesting,
} from "@mms/mod-contacts/backend/repository";
import { buildApp } from "../app.js";
import { createFakeContactsRepository } from "./helpers/fakeContactsRepository.js";
import { teacherToken, viewerToken } from "./helpers/tokens.js";

const HOST = { host: "demo.localhost" };

const sampleContact: Contact = {
  id: "c1",
  name: "Ali Khan",
  firstName: "Ali",
  lastName: "Khan",
  phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
  emails: [{ label: "Work", address: "ali@example.com" }],
  addresses: [{ label: "Home", city: "Lahore", isPrimary: true }],
};

/** Same role-restricted phone/email/city fixture shape as the shared sanitizer suite. */
const restrictedFieldConfig = {
  formTabs: [
    { key: "phones", label: "Phones", enabled: true, order: 1 },
    { key: "emails", label: "Emails", enabled: true, order: 2 },
    { key: "addresses", label: "Addresses", enabled: true, order: 3 },
  ],
  fields: {
    phones: [
      {
        key: "number",
        type: "text",
        label: "Phone Number",
        enabled: true,
        order: 1,
        permissions: ["admin"],
      },
    ],
    emails: [
      {
        key: "address",
        type: "text",
        label: "Email",
        enabled: true,
        order: 1,
        permissions: ["admin"],
      },
    ],
    addresses: [
      {
        key: "city",
        type: "text",
        label: "City",
        enabled: true,
        order: 1,
        permissions: ["admin"],
      },
    ],
  },
};

async function inject(
  method: "GET",
  url: string,
  token: (app: Awaited<ReturnType<typeof buildApp>>) => string,
) {
  const app = await buildApp();
  const res = await app.inject({
    method,
    url,
    headers: { ...HOST, authorization: `Bearer ${token(app)}` },
  });
  await app.close();
  return res;
}

describe("contacts picker routes", () => {
  let repo: ReturnType<typeof createFakeContactsRepository>;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    repo = createFakeContactsRepository({
      listPage: vi.fn().mockResolvedValue({
        contacts: [sampleContact],
        total: 1,
        page: 1,
        limit: 8,
        hasMore: false,
      }),
      findById: vi.fn().mockResolvedValue(sampleContact),
    });
    setContactsRepositoryForTesting(repo);
    mocks.loadFieldConfig.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    resetContactsRepositoryForTesting();
    vi.restoreAllMocks();
  });

  it("requires authentication", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/contacts/picker", headers: HOST });
    await app.close();

    expect(res.statusCode).toBe(401);
    expect(repo.listPage).not.toHaveBeenCalled();
  });

  it("lets a teacher search and returns only the lean option shape", async () => {
    const res = await inject("GET", "/api/contacts/picker?search=ali", teacherToken);

    expect(res.statusCode).toBe(200);
    const option = res.json().contacts[0] as Record<string, unknown>;
    expect(Object.keys(option).sort()).toEqual(["city", "email", "id", "name", "phone"]);
    expect(option).toMatchObject({ id: "c1", name: "Ali Khan", city: "Lahore" });
    expect(String(option.phone)).toContain("3001234567");
    expect(repo.listPage).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ page: 1, limit: 8, search: "ali" }),
    );
  });

  it("forwards filters, limit, and deduped excludeIds to the contacts page", async () => {
    await inject(
      "GET",
      "/api/contacts/picker?limit=5&gender=male&hasPhone=true&excludeIds=c9,%20c9,,c8",
      teacherToken,
    );

    expect(repo.listPage).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        page: 1,
        limit: 5,
        gender: "male",
        hasPhone: true,
        excludeIds: ["c9", "c8"],
      }),
    );
  });

  it("resolves a single picker option by id", async () => {
    const res = await inject("GET", "/api/contacts/picker/c1", teacherToken);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      contact: {
        id: "c1",
        name: "Ali Khan",
        phone: expect.stringContaining("3001234567"),
        email: "ali@example.com",
        city: "Lahore",
      },
    });
    expect(repo.findById).toHaveBeenCalledWith("demo", "c1");
  });

  it("returns 404 for a deleted or nonexistent contact", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    const res = await inject("GET", "/api/contacts/picker/missing", teacherToken);

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "not_found" });
  });

  it("rejects a role with no contacts, students, faculty, or workshops read grant", async () => {
    const res = await inject("GET", "/api/contacts/picker", viewerToken);

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(repo.listPage).not.toHaveBeenCalled();
  });

  it("omits field-config-restricted phone/email/city for the teacher viewer", async () => {
    mocks.loadFieldConfig.mockResolvedValue(restrictedFieldConfig);

    const res = await inject("GET", "/api/contacts/picker/c1", teacherToken);

    expect(res.statusCode).toBe(200);
    expect(mocks.loadFieldConfig).toHaveBeenCalled();
    expect(res.json()).toEqual({ contact: { id: "c1", name: "Ali Khan", phone: "" } });
  });

  it("rejects a limit above the picker cap", async () => {
    const res = await inject("GET", "/api/contacts/picker?limit=50", teacherToken);

    expect(res.statusCode).toBe(400);
    expect(repo.listPage).not.toHaveBeenCalled();
  });
});
