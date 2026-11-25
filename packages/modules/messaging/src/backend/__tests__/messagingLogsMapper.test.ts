import { describe, expect, it } from "vitest";
import {
  logRowToRecord,
  mapMessageToInsertRow,
  type LogSelectRow,
} from "../repository/db/messagingLogsMapper.js";
import type { Message } from "@mms/contracts";

describe("messagingLogsMapper", () => {
  describe("logRowToRecord", () => {
    it("converts Date sentAt to ISO string and sets fields properly", () => {
      const now = new Date("2026-11-18T10:00:00.000Z");
      const row: LogSelectRow = {
        id: "msg_123",
        workspaceSubdomain: "demo",
        userId: "usr_456",
        contactId: "cnt_789",
        channel: "sms",
        body: "Test message body",
        sentAt: now,
        status: "delivered",
        subject: "Subject",
        category: "notification",
        errorMessage: null,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: null,
        restoredBy: null,
        createdAt: now,
        updatedAt: now,
      };

      const record = logRowToRecord(row);
      expect(record.id).toBe("msg_123");
      expect(record.sentAt).toBe("2026-11-18T10:00:00.000Z");
      expect(record.channel).toBe("sms");
      expect(record.status).toBe("delivered");
      expect(record.category).toBe("notification");
    });
  });

  describe("mapMessageToInsertRow", () => {
    it("converts ISO sentAt string to Date and applies default status and category", () => {
      const msg: Message = {
        id: "msg_999",
        userId: "usr_111",
        contactId: "cnt_222",
        channel: "whatsapp",
        body: "Hello",
        sentAt: "2026-11-18T12:00:00.000Z",
        status: "sent",
        category: "general",
      };

      const row = mapMessageToInsertRow(msg, "demo");
      expect(row.id).toBe("msg_999");
      expect(row.workspaceSubdomain).toBe("demo");
      expect(row.sentAt).toEqual(new Date("2026-11-18T12:00:00.000Z"));
      expect(row.status).toBe("sent");
      expect(row.category).toBe("general");
    });

    it("carries restoredAt/restoredBy provenance through the insert row", () => {
      const msg: Message = {
        id: "msg_1",
        userId: "u1",
        contactId: "c1",
        channel: "sms",
        body: "hi",
        sentAt: "2026-11-18T12:00:00.000Z",
        status: "sent",
        category: "general",
        restoredAt: "2026-11-17T12:00:00.000Z",
        restoredBy: "u-admin",
      };

      const row = mapMessageToInsertRow(msg, "demo");
      expect(row.restoredAt).toEqual(new Date("2026-11-17T12:00:00.000Z"));
      expect(row.restoredBy).toBe("u-admin");
    });
  });
});
