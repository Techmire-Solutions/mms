import { describe, expect, it } from "vitest";
import type { User } from "@mms/shared";
import {
  attachmentMimeRejection,
  canUploadAttachmentForPurpose,
  resolveAttachmentPurpose,
} from "../routes/common/uploads.js";

/**
 * Excuse attachment uploads.
 *
 * The shared attachment route was contacts-only (`contacts.write`), so a teacher who may record an
 * excuse could not attach the certificate, and attachments accepted any content type. The
 * `attendance_excuse` purpose is now authorised by `attendance.write` and content-type filtered.
 */

const teacher = { id: "u-teacher", role: "teacher" } as unknown as User;

/**
 * A role with neither `attendance.write` nor `contacts.write`.
 *
 * Permissions are resolved from the role (the `permissions` property is not consulted), so this
 * fixture is a real system role — `admin` would hold every permission and prove nothing.
 */
const noAttendanceWrite = { id: "u-librarian", role: "librarian" } as unknown as User;

describe("attachment purpose resolution", () => {
  it("treats anything but the explicit purpose as a contact attachment", () => {
    expect(resolveAttachmentPurpose("attendance_excuse")).toBe("attendance_excuse");
    expect(resolveAttachmentPurpose("contact")).toBe("contact");
    expect(resolveAttachmentPurpose(undefined)).toBe("contact");
    expect(resolveAttachmentPurpose(["attendance_excuse"])).toBe("contact");
    expect(resolveAttachmentPurpose({})).toBe("contact");
  });
});

describe("purpose-scoped authorisation", () => {
  it("lets an attendance writer attach an excuse certificate", () => {
    expect(canUploadAttachmentForPurpose(teacher, "attendance_excuse")).toBe(true);
  });

  it("does not let an attendance writer upload contact attachments", () => {
    expect(canUploadAttachmentForPurpose(teacher, "contact")).toBe(false);
  });

  it("does not let a role without attendance write attach an excuse certificate", () => {
    expect(canUploadAttachmentForPurpose(noAttendanceWrite, "attendance_excuse")).toBe(false);
    expect(canUploadAttachmentForPurpose(noAttendanceWrite, "contact")).toBe(false);
  });
});

describe("attachment MIME allowlist", () => {
  it("accepts documents and photos of documents for excuses", () => {
    for (const mime of ["application/pdf", "image/jpeg", "image/png", "image/webp", "IMAGE/PNG"]) {
      expect(attachmentMimeRejection("attendance_excuse", mime)).toBeNull();
    }
  });

  it("rejects anything executable or active for excuses", () => {
    for (const mime of [
      "image/svg+xml",
      "text/html",
      "application/javascript",
      "application/x-msdownload",
      "application/octet-stream",
      "",
    ]) {
      expect(attachmentMimeRejection("attendance_excuse", mime)).toContain("Unsupported file type");
    }
  });

  it("leaves contact attachments on the previous behaviour", () => {
    expect(attachmentMimeRejection("contact", "application/zip")).toBeNull();
  });
});
