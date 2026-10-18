import { describe, expect, it } from "vitest";
import {
  normalizeSessionClasses,
  hydrateSessionClasses,
  normalizeStudentLinkedRows,
  hydrateStudentLinkedRows,
  normalizeActivityLog,
  hydrateActivityLog,
  hydrateActivityLogList,
  hydrateAssessmentResultList,
  hydrateHasanatDistributionList,
  hydrateWorkspaceUserProfileList,
} from "../core/linkedCollectionUtils.js";

describe("linkedCollectionUtils", () => {
  describe("Session classes normalization & hydration", () => {
    it("normalizes session classes by stripping redundant facultyName when facultyId is set", () => {
      const classes = [{ id: "c1", facultyId: "f1", facultyName: "Ustadh Ali" }];
      const normalized = normalizeSessionClasses(classes);
      expect(normalized[0].facultyId).toBe("f1");
      expect(normalized[0].facultyName).toBeUndefined();
    });

    it("hydrates session classes with faculty names from entity lookup", () => {
      const classes = [{ id: "c1", facultyId: "f1" }];
      const faculty = [{ id: "f1", name: "Ustadh Ali" }];
      const hydrated = hydrateSessionClasses(classes, faculty);
      expect(hydrated[0].facultyName).toBe("Ustadh Ali");
    });
  });

  describe("Student linked rows normalization & hydration", () => {
    it("normalizes student linked rows", () => {
      const rows: Record<string, unknown>[] = [{ id: "e1", studentId: "s1", studentName: "Jane" }];
      const normalized = normalizeStudentLinkedRows(rows);
      expect(normalized[0].studentName).toBeUndefined();
    });

    it("hydrates student linked rows from student entities", () => {
      const rows: Record<string, unknown>[] = [{ id: "e1", studentId: "s1" }];
      const students = [{ id: "s1", name: "Jane Doe" }];
      const hydrated = hydrateStudentLinkedRows(rows, students);
      expect(hydrated[0].studentName).toBe("Jane Doe");
    });
  });

  describe("Activity log normalization & hydration", () => {
    it("normalizes activity log user link", () => {
      const log: Record<string, unknown> = { id: "l1", userId: "u1", userName: "Admin" };
      const normalized = normalizeActivityLog(log);
      expect(normalized.userName).toBeUndefined();
    });

    it("hydrates activity log user link", () => {
      const log: Record<string, unknown> = { id: "l1", userId: "u1" };
      const users = [{ id: "u1", name: "Super Admin" }];
      const hydrated = hydrateActivityLog(log, users);
      expect(hydrated.userName).toBe("Super Admin");
    });
  });

  describe("Batch hydration helpers", () => {
    it("hydrates activity log list with auto-indexed users", () => {
      const logs: Record<string, unknown>[] = [
        { id: "l1", userId: "u1" },
        { id: "l2", userId: "u2" },
      ];
      const users = [
        { id: "u1", name: "User 1" },
        { id: "u2", name: "User 2" },
      ];
      const hydrated = hydrateActivityLogList(logs, users);
      expect(hydrated[0].userName).toBe("User 1");
      expect(hydrated[1].userName).toBe("User 2");
    });

    it("hydrates assessment result list with auto-indexed students", () => {
      const results: Record<string, unknown>[] = [
        { id: "r1", studentId: "s1" },
        { id: "r2", studentId: "s2" },
      ];
      const students = [
        { id: "s1", name: "Student 1" },
        { id: "s2", name: "Student 2" },
      ];
      const hydrated = hydrateAssessmentResultList(results, students);
      expect(hydrated[0].studentName).toBe("Student 1");
      expect(hydrated[1].studentName).toBe("Student 2");
    });

    it("hydrates hasanat distribution list with student and faculty lookups", () => {
      const rows: Record<string, unknown>[] = [
        { id: "d1", recipientStudentId: "s1", recipientFacultyId: undefined },
        { id: "d2", recipientStudentId: undefined, recipientFacultyId: "f1" },
      ];
      const students = [{ id: "s1", name: "Student 1" }];
      const faculty = [{ id: "f1", name: "Faculty 1" }];
      const hydrated = hydrateHasanatDistributionList(rows, students, faculty);
      expect(hydrated[0].recipientName).toBe("Student 1");
      expect(hydrated[1].recipientName).toBe("Faculty 1");
    });

    it("hydrates workspace user profile list with contact lookup", () => {
      const users: Record<string, unknown>[] = [{ id: "u1", contactId: "c1" }];
      const contacts = [{ id: "c1", name: "Fatima Zahra" }];
      const hydrated = hydrateWorkspaceUserProfileList(users, contacts);
      expect(hydrated[0].name).toBe("Fatima Zahra");
      expect(hydrated[0].avatarInitials).toBe("FZ");
    });
  });
});
