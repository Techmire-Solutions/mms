import { createHash } from "node:crypto";
import type { AttendanceRecordStatus, AttendanceTransferEntity, User } from "@mms/contracts";
import { registerModuleCsvImportJobRunner } from "../../lib/registerModuleCsvImportJobRunner.js";
import { throwIfBackgroundJobAborted } from "@mms/be-core/jobs/backgroundJobAbort";
import { attendanceUseCases } from "./attendanceUseCases.js";
import { sessionsUseCases } from "@mms/mod-sessions/backend/use-cases";
import { findStudentsByNames } from "@mms/mod-hasanat/backend/repository";
import { resolveCurrentTenantRole } from "../../lib/currentTenantRole.js";

/** `attendance:import` — resolves the schema's names to ids and bulk-marks daily attendance. */
export function registerAttendanceImportJobRunner(): void {
  registerModuleCsvImportJobRunner<AttendanceTransferEntity>({
    moduleId: "attendance",
    entityNounPlural: "attendance records",
    importBatch: async (rows, ctx) => {
      const tenant = ctx.tenant;
      const [studentRows, sessions] = await Promise.all([
        findStudentsByNames(tenant, rows.map((r) => r.personName?.trim() ?? "").filter(Boolean)),
        sessionsUseCases.loadSessions(),
      ]);
      const studentByName = new Map<string, { id: string; name: string }>();
      for (const s of studentRows) {
        studentByName.set(s.studentName.trim().toLowerCase(), {
          id: s.studentId,
          name: s.studentName,
        });
      }

      const sessionByName = new Map<string, { id: string; classIdByName: Map<string, string> }>();
      for (const session of sessions) {
        const key = (session.name ?? "").trim().toLowerCase();
        if (!key) continue;
        const classIdByName = new Map<string, string>();
        for (const cls of session.classes ?? []) {
          const cname = (cls.name ?? "").trim().toLowerCase();
          if (cname) classIdByName.set(cname, cls.id);
        }
        sessionByName.set(key, { id: session.id, classIdByName });
      }

      const role = (await resolveCurrentTenantRole(tenant, ctx.userId)) ?? "viewer";
      const actor: User = {
        id: ctx.userId,
        email: "",
        name: "",
        role,
        workspaceSubdomain: tenant,
      };

      let imported = 0;
      const errors: Array<{ row: number; reason: string }> = [];
      for (let index = 0; index < rows.length; index += 1) {
        throwIfBackgroundJobAborted(ctx.signal);
        const row = rows[index];
        const student = studentByName.get((row.personName ?? "").trim().toLowerCase());
        const session = sessionByName.get((row.sessionName ?? "").trim().toLowerCase());
        const classId = session?.classIdByName.get((row.className ?? "").trim().toLowerCase());
        if (!student) {
          errors.push({ row: index + 1, reason: `Student "${row.personName}" not found` });
        } else if (!session) {
          errors.push({ row: index + 1, reason: `Session "${row.sessionName}" not found` });
        } else if (!classId) {
          errors.push({
            row: index + 1,
            reason: `Class "${row.className}" not found in session "${row.sessionName}"`,
          });
        } else {
          try {
            await attendanceUseCases.upsertAttendanceRecords(
              [
                {
                  id: `imp-${createHash("sha256")
                    .update(`${ctx.jobId}:${index}`)
                    .digest("hex")
                    .slice(0, 24)}`,
                  classId,
                  date: row.date,
                  studentId: student.id,
                  studentName: student.name,
                  rollNo: "",
                  status: ["present", "absent", "late", "half_day", "excused"].includes(
                    row.status ?? "",
                  )
                    ? (row.status as AttendanceRecordStatus)
                    : "present",
                  timeIn: "",
                  timeOut: "",
                  notes: row.notes ?? "",
                  markedBy: ctx.userId,
                },
              ],
              actor,
            );
            imported += 1;
          } catch (error) {
            errors.push({
              row: index + 1,
              reason: error instanceof Error ? error.message.slice(0, 300) : "Invalid row",
            });
          }
        }
        if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
          await ctx.updateProgress(index + 1, rows.length);
        }
      }

      return { imported, failed: errors.length, total: rows.length, errors };
    },
  });
}
