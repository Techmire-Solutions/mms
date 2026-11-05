import { describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import {
  syncContactEngagementChildrenTx,
  bulkInsertContactEngagementChildrenTx,
} from "../db/repositories/contactPersistEngagementChildren.js";

describe("contactPersistEngagementChildren", () => {
  it("bounds attachment name, type, and size on sync", async () => {
    const insertedValues: unknown[] = [];
    const tx = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedValues.push(val);
          return Promise.resolve();
        }),
      }),
    } as any;

    const longName = "a".repeat(300);
    const longType = "application/".concat("x".repeat(120));

    const contact: Contact = {
      id: "c-1",
      name: "Test Contact",
      attachments: [
        {
          id: "att-1",
          name: longName,
          type: longType,
          size: 1024.9,
          url: "https://example.com/file.pdf",
          date: "2026-11-05",
        },
        {
          id: "att-2",
          name: "",
          type: "",
          size: -50,
          url: "https://example.com/file2.pdf",
          date: "2026-11-05",
        },
      ],
    } as any;

    await syncContactEngagementChildrenTx(tx, "demo", "c-1", contact);

    expect(tx.delete).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();

    const attachmentInsert = insertedValues.find(
      (v) => Array.isArray(v) && v[0]?.contactId === "c-1",
    ) as any[];

    expect(attachmentInsert).toBeDefined();
    expect(attachmentInsert[0].name.length).toBe(255);
    expect(attachmentInsert[0].type.length).toBe(100);
    expect(attachmentInsert[0].size).toBe(1024);

    expect(attachmentInsert[1].name).toBe("attachment");
    expect(attachmentInsert[1].type).toBe("application/octet-stream");
    expect(attachmentInsert[1].size).toBe(0);
  });

  it("bounds attachment name, type, and size on bulkInsert", async () => {
    const insertedValues: unknown[] = [];
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedValues.push(val);
          return Promise.resolve();
        }),
      }),
    } as any;

    const longName = "b".repeat(350);
    const contact: Contact = {
      id: "c-2",
      name: "Bulk Contact",
      attachments: [
        {
          name: longName,
          type: "image/png",
          size: 5000,
          url: "https://example.com/img.png",
          date: "2026-11-05",
        },
      ],
    } as any;

    await bulkInsertContactEngagementChildrenTx(tx, "demo", [contact]);

    expect(tx.insert).toHaveBeenCalled();
    const rows = insertedValues[0] as any[];
    expect(rows[0].name.length).toBe(255);
    expect(rows[0].size).toBe(5000);
  });
});
