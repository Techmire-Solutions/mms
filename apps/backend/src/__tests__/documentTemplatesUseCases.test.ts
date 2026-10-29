import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentTemplate, User } from "@mms/shared";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(async (_tenant: string, cb: () => Promise<unknown>) => cb()),
  withTenantRead: vi.fn(async (_tenant: string, cb: () => Promise<unknown>) => cb()),
  getTemplate: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  broadcastCollection: vi.fn(async () => undefined),
  broadcastTenantUpdate: vi.fn(),
  recordModernAuditEvent: vi.fn(async () => undefined),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: mocks.withTenant,
  withTenantRead: mocks.withTenantRead,
}));

vi.mock("../documents/repository/documentsRepositoryAdapter.js", () => ({
  documentsRepositoryAdapter: {
    getTemplate: mocks.getTemplate,
    saveTemplate: mocks.saveTemplate,
    deleteTemplate: mocks.deleteTemplate,
    listTemplates: vi.fn(),
  },
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: mocks.broadcastCollection,
  broadcastTenantUpdate: mocks.broadcastTenantUpdate,
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
}));

import {
  deleteDocumentTemplateUseCase,
  getDocumentTemplateUseCase,
  saveDocumentTemplateUseCase,
} from "../documents/use-cases/documentTemplatesUseCases.js";

const user = { id: "u-1", role: "admin" } as User;
const template: DocumentTemplate = { pageSize: "A6", elements: [] };

describe("document template use cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTemplate.mockResolvedValue(template);
    mocks.saveTemplate.mockResolvedValue(template);
    mocks.deleteTemplate.mockResolvedValue(true);
  });

  it("reads inside a tenant-scoped transaction", async () => {
    await getDocumentTemplateUseCase("demo", "invoice");
    expect(mocks.withTenantRead).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(mocks.getTemplate).toHaveBeenCalledWith("demo", "invoice");
  });

  it("writes and audits inside one tenant transaction, then broadcasts", async () => {
    const order: string[] = [];
    mocks.withTenant.mockImplementationOnce(async (_tenant: string, cb: () => Promise<unknown>) => {
      order.push("tx:start");
      const result = await cb();
      order.push("tx:commit");
      return result;
    });
    mocks.saveTemplate.mockImplementationOnce(async () => {
      order.push("save");
      return template;
    });
    mocks.recordModernAuditEvent.mockImplementationOnce(async () => {
      order.push("audit");
    });
    mocks.broadcastCollection.mockImplementationOnce(async () => {
      order.push("broadcast");
    });

    await saveDocumentTemplateUseCase("demo", "invoice", template, user);

    expect(mocks.withTenant).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(order).toEqual(["tx:start", "save", "audit", "tx:commit", "broadcast"]);
  });

  it("does not append an audit row or broadcast when the delete removes nothing", async () => {
    mocks.deleteTemplate.mockResolvedValueOnce(false);
    await expect(deleteDocumentTemplateUseCase("demo", "invoice", user)).resolves.toBe(false);
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
    expect(mocks.broadcastCollection).not.toHaveBeenCalled();
  });
});
