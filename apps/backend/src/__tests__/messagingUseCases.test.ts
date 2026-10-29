import { describe, expect, it, vi } from "vitest";
import { createMessagingUseCases } from "../messaging/use-cases/messagingUseCases.js";
import type { MessagingRepository } from "../messaging/repository/messagingRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";
import type { MessageTemplate, Message } from "@mms/shared";

function createFakeRepo(): MessagingRepository {
  return {
    listMessageTemplatesByWorkspace: vi.fn().mockResolvedValue([]),
    findMessageTemplateById: vi.fn().mockResolvedValue(null),
    findMessageTemplatesByIds: vi.fn().mockResolvedValue([]),
    saveMessageTemplate: vi.fn().mockResolvedValue(undefined),
    bulkSaveMessageTemplates: vi.fn().mockResolvedValue(undefined),
    replaceMessageTemplatesForWorkspace: vi.fn().mockResolvedValue(undefined),
    deleteMessageTemplateById: vi.fn().mockResolvedValue(true),

    listMessageLogsByWorkspace: vi.fn().mockResolvedValue([]),
    findMessageLogById: vi.fn().mockResolvedValue(null),
    findMessageLogsByIds: vi.fn().mockResolvedValue([]),
    saveMessageLog: vi.fn().mockResolvedValue(undefined),
    bulkSaveMessageLogs: vi.fn().mockResolvedValue(undefined),
    replaceMessageLogsForWorkspace: vi.fn().mockResolvedValue(undefined),
    insertMessageLogs: vi.fn().mockResolvedValue(undefined),
    queryFilteredMessageLogs: vi.fn().mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      pageSize: 50,
      hasMore: false,
    }),
    queryMessagingMetrics: vi.fn().mockResolvedValue({
      total: 0,
      smsCount: 0,
      whatsappCount: 0,
      emailCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      skippedCount: 0,
      queuedCount: 0,
      successRate: 100,
      categoryBreakdown: {
        general: 0,
        academic: 0,
        financial: 0,
        attendance: 0,
        emergency: 0,
      },
    }),
    softDeleteActiveMessageLogs: vi.fn().mockResolvedValue(undefined),
    restoreArchivedMessageLog: vi.fn().mockResolvedValue(0),
    claimMessageLogForDelivery: vi.fn().mockResolvedValue(true),
    updateMessageLogDeliveryStatus: vi.fn().mockResolvedValue(undefined),
    getWhatsappIntegrationRow: vi.fn().mockResolvedValue(null),
    upsertWhatsappIntegrationConfigRow: vi.fn().mockResolvedValue(undefined),
    upsertWhatsappIntegrationSecretsRow: vi.fn().mockResolvedValue(undefined),
  };
}

describe("messaging use-cases (DI with fake repository)", () => {
  it("loadFilteredMessageLogs delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createMessagingUseCases(repo);

    const result = await useCases.loadFilteredMessageLogs("demo", { page: 1 });

    expect(result).toEqual({ logs: [], total: 0, page: 1, pageSize: 50, hasMore: false });
    expect(repo.queryFilteredMessageLogs).toHaveBeenCalledWith("demo", { page: 1 });
  });

  it("recordMessageLogs delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createMessagingUseCases(repo);
    const log = { id: "m-1", channel: "sms" } as never;

    const result = await useCases.recordMessageLogs("demo", [log]);

    expect(result).toEqual([log]);
    expect(repo.insertMessageLogs).toHaveBeenCalledWith("demo", [log]);
  });

  it("restoreMessageLogs maps absent/empty ids to restore-all and broadcasts", async () => {
    const repo = createFakeRepo();
    const useCases = createMessagingUseCases(repo);

    // null ids → restore-all passthrough
    (repo.restoreArchivedMessageLog as any).mockResolvedValue(4);
    const all = await useCases.restoreMessageLogs("demo", "u-1");
    expect(repo.restoreArchivedMessageLog).toHaveBeenNthCalledWith(1, "demo", "u-1", null);
    expect(all).toBe(4);

    // blank ids → deduped to [] (repo treats an empty list as restore-all)
    await useCases.restoreMessageLogs("demo", "u-1", ["  ", ""]);
    expect(repo.restoreArchivedMessageLog).toHaveBeenNthCalledWith(2, "demo", "u-1", []);

    // explicit ids → deduped + trimmed passthrough
    await useCases.restoreMessageLogs("demo", "u-2", ["a", " a ", "b"]);
    expect(repo.restoreArchivedMessageLog).toHaveBeenNthCalledWith(3, "demo", "u-2", ["a", "b"]);
  });

  it("restoreMessageLogs returns the repository restored count per call", async () => {
    const repo = createFakeRepo();
    (repo.restoreArchivedMessageLog as any).mockResolvedValue(0);
    const useCases = createMessagingUseCases(repo);

    const none = await useCases.restoreMessageLogs("demo", "u-1", ["m-1"]);
    expect(none).toBe(0);

    (repo.restoreArchivedMessageLog as any).mockResolvedValue(2);
    await useCases.restoreMessageLogs("demo", "u-1", ["m-1"]);
    expect(repo.restoreArchivedMessageLog).toHaveBeenLastCalledWith("demo", "u-1", ["m-1"]);
  });

  it("computeMessagingMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createMessagingUseCases(repo);

    const result = await useCases.computeMessagingMetrics("demo", { startDate: "2026-01-01" });

    expect(result.total).toBe(0);
    expect(repo.queryMessagingMetrics).toHaveBeenCalledWith("demo", { startDate: "2026-01-01" });
  });

  it("loadMessageTemplateById and loadMessageTemplatesByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeTemplate: MessageTemplate = {
      id: "tmpl-1",
      label: "Welcome",
      body: "Welcome to MMS",
      category: "general",
      channel: "sms",
    };
    (repo.findMessageTemplateById as any).mockResolvedValue(fakeTemplate);
    (repo.findMessageTemplatesByIds as any).mockResolvedValue([fakeTemplate]);
    const useCases = createMessagingUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadMessageTemplateById("tmpl-1"));
    const multiple = await runWithTenant("demo", () =>
      useCases.loadMessageTemplatesByIds(["tmpl-1", " "]),
    );

    expect(single).toEqual(fakeTemplate);
    expect(multiple).toEqual([fakeTemplate]);
    expect(repo.findMessageTemplateById).toHaveBeenCalledWith("demo", "tmpl-1");
    expect(repo.findMessageTemplatesByIds).toHaveBeenCalledWith("demo", ["tmpl-1"]);
  });

  it("saveMessageTemplate supports both tenant context and explicit workspace", async () => {
    const repo = createFakeRepo();
    const fakeTemplate: MessageTemplate = {
      id: "tmpl-1",
      label: "Welcome",
      body: "Welcome to MMS",
      category: "general",
      channel: "sms",
    };
    const useCases = createMessagingUseCases(repo);

    // Context-bound
    const result1 = await runWithTenant("demo", () => useCases.saveMessageTemplate(fakeTemplate));
    expect(result1).toEqual(fakeTemplate);
    expect(repo.saveMessageTemplate).toHaveBeenCalledWith("demo", fakeTemplate);

    // Explicit subdomain
    const result2 = await useCases.saveMessageTemplate("demo2", fakeTemplate);
    expect(result2).toEqual(fakeTemplate);
    expect(repo.saveMessageTemplate).toHaveBeenCalledWith("demo2", fakeTemplate);
  });

  it("loadMessageLogById handles soft-deleted records correctly", async () => {
    const repo = createFakeRepo();
    const activeLog: Message = {
      id: "msg-1",
      userId: "u-1",
      contactId: "c-1",
      channel: "sms",
      body: "Hello",
      sentAt: "2026-09-01T00:00:00.000Z",
      status: "sent",
      category: "general",
    };
    const deletedLog: Message = {
      ...activeLog,
      id: "msg-2",
      deletedAt: "2026-09-02T00:00:00.000Z",
    };

    (repo.findMessageLogById as any).mockImplementation((_tenant: string, id: string) => {
      if (id === "msg-1") return Promise.resolve(activeLog);
      if (id === "msg-2") return Promise.resolve(deletedLog);
      return Promise.resolve(null);
    });

    const useCases = createMessagingUseCases(repo);

    // Active lookup
    const active = await runWithTenant("demo", () => useCases.loadMessageLogById("msg-1"));
    expect(active).toEqual(activeLog);

    // Active lookup against deleted record returns null
    const hiddenDeleted = await runWithTenant("demo", () => useCases.loadMessageLogById("msg-2"));
    expect(hiddenDeleted).toBeNull();

    // Deleted lookup against active record returns null
    const hiddenActive = await runWithTenant("demo", () =>
      useCases.loadMessageLogById("msg-1", true),
    );
    expect(hiddenActive).toBeNull();

    // Deleted lookup against deleted record returns deleted record
    const foundDeleted = await runWithTenant("demo", () =>
      useCases.loadMessageLogById("msg-2", true),
    );
    expect(foundDeleted).toEqual(deletedLog);
  });

  it("loadMessageLogsByIds scopes soft-deleted records", async () => {
    const repo = createFakeRepo();
    const activeLog: Message = {
      id: "msg-1",
      userId: "u-1",
      contactId: "c-1",
      channel: "sms",
      body: "Hello",
      sentAt: "2026-09-01T00:00:00.000Z",
      status: "sent",
      category: "general",
    };
    const deletedLog: Message = {
      ...activeLog,
      id: "msg-2",
      deletedAt: "2026-09-02T00:00:00.000Z",
    };

    (repo.findMessageLogsByIds as any).mockImplementation(
      async (_tenant: string, ids: string[], opts?: { includeDeleted?: boolean }) => {
        const all = [activeLog, deletedLog].filter((l) => ids.includes(l.id));
        if (opts?.includeDeleted) return all.filter((l) => Boolean(l.deletedAt));
        return all.filter((l) => !l.deletedAt);
      },
    );
    const useCases = createMessagingUseCases(repo);

    const activeList = await runWithTenant("demo", () =>
      useCases.loadMessageLogsByIds(["msg-1", "msg-2"]),
    );
    expect(activeList).toEqual([activeLog]);

    const deletedList = await runWithTenant("demo", () =>
      useCases.loadMessageLogsByIds(["msg-1", "msg-2"], true),
    );
    expect(deletedList).toEqual([deletedLog]);
  });

  it("saveMessageLog delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const fakeLog: Message = {
      id: "msg-1",
      userId: "u-1",
      contactId: "c-1",
      channel: "sms",
      body: "Hello",
      sentAt: "2026-09-01T00:00:00.000Z",
      status: "sent",
      category: "general",
    };
    const useCases = createMessagingUseCases(repo);

    await runWithTenant("demo", () => useCases.saveMessageLog(fakeLog));

    expect(repo.saveMessageLog).toHaveBeenCalledWith("demo", fakeLog);
  });

  it("returns empty defaults when no workspace or tenant is provided", async () => {
    const repo = createFakeRepo();
    const useCases = createMessagingUseCases(repo);

    const page = await useCases.loadFilteredMessageLogs();
    const metrics = await useCases.computeMessagingMetrics();
    const singleTmpl = await useCases.loadMessageTemplateById("tmpl-1");
    const tmplList = await useCases.loadMessageTemplatesByIds(["tmpl-1"]);
    const singleLog = await useCases.loadMessageLogById("msg-1");
    const logList = await useCases.loadMessageLogsByIds(["msg-1"]);

    expect(page).toEqual({ logs: [], total: 0, page: 1, pageSize: 50, hasMore: false });
    expect(metrics.total).toBe(0);
    expect(singleTmpl).toBeNull();
    expect(tmplList).toEqual([]);
    expect(singleLog).toBeNull();
    expect(logList).toEqual([]);
    expect(repo.queryFilteredMessageLogs).not.toHaveBeenCalled();
    expect(repo.queryMessagingMetrics).not.toHaveBeenCalled();
  });
});
