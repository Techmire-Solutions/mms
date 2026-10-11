import { describe, expect, it } from "vitest";
import {
  DASHBOARD_PREFERENCES_KEY,
  INVOICE_TEMPLATE_OBJECT_KEY,
  STUDENT_CARD_TEMPLATE_OBJECT_KEY,
  MESSAGING_MODULE_MANIFEST,
  type User,
} from "@mms/shared";
import {
  canBulkSync,
  canDeleteContacts,
  canDeleteCollection,
  canReadCollection,
  canReadContacts,
  canReadObject,
  canResetTenantData,
  canWriteCollection,
  canWriteContacts,
  canWriteObject,
  canClearMessagingLogs,
  isAllowedCollectionName,
  isAllowedObjectKey,
} from "../services/rbacService.js";

const admin: User = {
  id: "1",
  email: "a@test.com",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: "demo",
};
const teacher: User = {
  id: "2",
  email: "t@test.com",
  name: "Teacher",
  role: "teacher",
  workspaceSubdomain: "demo",
};
const accountant: User = {
  id: "3",
  email: "c@test.com",
  name: "Acct",
  role: "accountant",
  workspaceSubdomain: "demo",
};

const viewer: User = {
  id: "4",
  email: "v@test.com",
  name: "Viewer",
  role: "viewer",
  workspaceSubdomain: "demo",
};

describe("rbacService", () => {
  it("restricts users collection to admin", () => {
    expect(canWriteCollection(admin, "users")).toBe(true);
    expect(canWriteCollection(teacher, "users")).toBe(false);
  });

  it("restricts backups and user_activity_logs to admin only for read and write", () => {
    // Backups (Admin only)
    expect(canReadCollection(admin, "backups")).toBe(true);
    expect(canReadCollection(teacher, "backups")).toBe(false);
    expect(canReadCollection(accountant, "backups")).toBe(false);
    expect(canReadCollection(viewer, "backups")).toBe(false);
    expect(canWriteCollection(admin, "backups")).toBe(true);
    expect(canWriteCollection(teacher, "backups")).toBe(false);
    expect(canWriteCollection(accountant, "backups")).toBe(false);
    expect(canWriteCollection(viewer, "backups")).toBe(false);

    // User Activity Logs (Requires analytics.view permission, viewer denied)
    expect(canReadCollection(admin, "user_activity_logs")).toBe(true);
    expect(canReadCollection(teacher, "user_activity_logs")).toBe(true);
    expect(canReadCollection(viewer, "user_activity_logs")).toBe(false);
    expect(canWriteCollection(admin, "user_activity_logs")).toBe(true);
    expect(canWriteCollection(teacher, "user_activity_logs")).toBe(true);
    expect(canWriteCollection(viewer, "user_activity_logs")).toBe(false);
  });

  it("allows write roles on general collections if role has permission", () => {
    expect(canWriteCollection(teacher, "students")).toBe(true);
    expect(canWriteCollection(accountant, "students")).toBe(false);
    expect(canWriteCollection(accountant, "finance_invoices")).toBe(true);
  });

  it("denies unknown collection and object keys by default", () => {
    expect(canReadCollection(admin, "tenant_escape")).toBe(false);
    expect(canWriteCollection(admin, "tenant_escape")).toBe(false);
    expect(canReadObject(admin, "tenant_escape")).toBe(false);
    expect(canWriteObject(admin, "tenant_escape")).toBe(false);
  });

  it("allows staff persistence for frontend dashboard, invoice, and student card configuration objects", () => {
    for (const key of [
      DASHBOARD_PREFERENCES_KEY,
      INVOICE_TEMPLATE_OBJECT_KEY,
      STUDENT_CARD_TEMPLATE_OBJECT_KEY,
    ]) {
      expect(canReadObject(admin, key)).toBe(true);
      expect(canWriteObject(admin, key)).toBe(true);
      expect(canReadObject(teacher, key)).toBe(true);
      expect(canWriteObject(teacher, key)).toBe(true);
      expect(canReadObject(viewer, key)).toBe(false);
      expect(canWriteObject(viewer, key)).toBe(false);
    }
  });

  it("restricts students read to roles with students.read", () => {
    expect(canReadCollection(admin, "students")).toBe(true);
    expect(canReadCollection(teacher, "students")).toBe(true);
    expect(canReadCollection(viewer, "students")).toBe(false);
  });

  it("restricts contacts read to roles with contacts.read", () => {
    expect(canReadCollection(accountant, "contacts")).toBe(true);
    expect(canReadCollection(viewer, "contacts")).toBe(false);
  });

  it("restricts branding to admin", () => {
    expect(canWriteObject(admin, "branding")).toBe(true);
    expect(canWriteObject(accountant, "branding")).toBe(false);
  });

  it("restricts email integration to admin", () => {
    expect(canWriteObject(admin, "email_integration")).toBe(true);
    expect(canWriteObject(teacher, "email_integration")).toBe(false);
    expect(canReadObject(admin, "email_integration")).toBe(true);
    expect(canReadObject(teacher, "email_integration")).toBe(false);
  });

  it("restricts bulk sync to settings.global.write", () => {
    expect(canBulkSync(admin)).toBe(true);
    expect(canBulkSync(teacher)).toBe(false);
    expect(canBulkSync(accountant)).toBe(false);
  });

  it("denies legacy messages_u and whatsappTemplates document-store keys", () => {
    expect(canWriteCollection(admin, "messages_u:other-user")).toBe(false);
    expect(canWriteCollection(teacher, "messages_u:other-user")).toBe(false);
    expect(canWriteCollection(teacher, "messages_u:2")).toBe(false);
    expect(canReadCollection(admin, "messages_u:2")).toBe(false);
    expect(isAllowedCollectionName("messages_u:peer")).toBe(false);
    expect(isAllowedCollectionName("whatsappTemplates")).toBe(false);
    expect(isAllowedCollectionName("whatsappTemplates_u:other-user")).toBe(false);
    expect(isAllowedCollectionName("students")).toBe(false);
    expect(isAllowedCollectionName("contacts")).toBe(false);
    expect(isAllowedCollectionName("faculty")).toBe(false);
    expect(isAllowedCollectionName("facultyStatuses")).toBe(false);
    expect(isAllowedCollectionName("facultySpecializations")).toBe(false);
    expect(canWriteCollection(admin, "whatsappTemplates")).toBe(false);
    expect(canWriteCollection(admin, "whatsappTemplates_u:other-user")).toBe(false);
    expect(canWriteCollection(admin, "currencies")).toBe(true);
    expect(canWriteCollection(admin, "faculty")).toBe(true);
    expect(canWriteCollection(admin, "facultyStatuses")).toBe(false);
    // Legacy doc-store config collections pruned from ALLOWED_COLLECTIONS (typed tables / no runtime read).
    expect(canWriteCollection(admin, "sessionTypes")).toBe(false);
    expect(canWriteCollection(admin, "attendanceStatuses")).toBe(false);
    expect(canWriteCollection(admin, "sessionStatuses")).toBe(false);
    expect(canWriteCollection(admin, "saved_reports")).toBe(false);
    expect(isAllowedCollectionName("sessionTypes")).toBe(false);
    expect(isAllowedCollectionName("saved_reports")).toBe(false);
    expect(isAllowedCollectionName("custom_tabs")).toBe(false);
    // Pruned stale object keys (typed module prefs / column-prefs are authority; nothing reads the doc-store object).
    expect(isAllowedObjectKey("attendance_settings")).toBe(false);
    expect(isAllowedObjectKey("accounting_settings")).toBe(false);
    expect(isAllowedObjectKey("examinations_settings")).toBe(false);
    expect(isAllowedObjectKey("question_bank_settings")).toBe(false);
    expect(isAllowedObjectKey("obligations_settings")).toBe(false);
    expect(isAllowedObjectKey("workspace")).toBe(false);
    expect(isAllowedObjectKey("socialPlaceholders")).toBe(false);
    expect(isAllowedObjectKey("attendance_user_column_preferences")).toBe(false);
    expect(isAllowedObjectKey("question_bank_user_column_preferences")).toBe(false);
    expect(isAllowedObjectKey("obligations_user_column_preferences")).toBe(false);
    expect(isAllowedObjectKey(MESSAGING_MODULE_MANIFEST.recipientsColumnPreferencesObjectKey)).toBe(
      false,
    );
    expect(isAllowedObjectKey(MESSAGING_MODULE_MANIFEST.historyColumnPreferencesObjectKey)).toBe(
      false,
    );
    expect(isAllowedObjectKey(MESSAGING_MODULE_MANIFEST.templatesColumnPreferencesObjectKey)).toBe(
      false,
    );
  });

  it("restricts tenant reset to admin", () => {
    expect(canResetTenantData(admin)).toBe(true);
    expect(canResetTenantData(teacher)).toBe(false);
  });

  it("aligns contacts write with contacts.write permission", () => {
    expect(canWriteContacts(admin)).toBe(true);
    expect(canWriteContacts(teacher)).toBe(false);
    expect(canWriteContacts(accountant)).toBe(false);
    expect(canWriteContacts(viewer)).toBe(false);
  });

  it("aligns contacts delete with contacts.delete permission", () => {
    expect(canDeleteContacts(admin)).toBe(true);
    expect(canDeleteContacts(teacher)).toBe(false);
    expect(canDeleteContacts(accountant)).toBe(false);
    expect(canDeleteCollection(admin, "contacts")).toBe(true);
    expect(canDeleteCollection(teacher, "contacts")).toBe(false);
  });

  it("aligns faculty delete with faculty.delete permission", () => {
    expect(canDeleteCollection(admin, "faculty")).toBe(true);
    expect(canDeleteCollection(teacher, "faculty")).toBe(false);
    expect(canDeleteCollection(accountant, "faculty")).toBe(false);
  });

  it("aligns contacts read with contacts.read permission", () => {
    expect(canReadContacts(admin)).toBe(true);
    expect(canReadContacts(teacher)).toBe(false);
    expect(canReadContacts(accountant)).toBe(true);
    expect(canReadContacts(viewer)).toBe(false);
  });

  it("restricts messaging clear logs to messaging.clearLogs", () => {
    expect(canClearMessagingLogs(admin)).toBe(true);
    expect(canClearMessagingLogs(teacher)).toBe(false);
    expect(canClearMessagingLogs(accountant)).toBe(false);
  });
});
