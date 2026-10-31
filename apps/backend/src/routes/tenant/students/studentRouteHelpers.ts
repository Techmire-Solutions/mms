import type { Student, User } from "@mms/shared";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";
import { studentUseCases } from "../../../students/use-cases/studentUseCases.js";
import { StudentPermissionError } from "../../../students/use-cases/studentNormalizeUseCases.js";
import { withTenant } from "../../../db/tenant-context.js";
import { enableIncludeDeleted } from "../../../lib/softDeleteHelpers.js";

/** Thin Students audit helper — shared factory, same shape as Contacts/Faculty. */
export const auditStudent = createCollectionAuditHelper("students", { subjectScoped: true });

/** Strips student properties the viewer role cannot read (field-config + viewer role). */
export async function sanitizeStudentsForUser(students: Student[], user: User): Promise<Student[]> {
  return studentUseCases.sanitizeStudentsForViewer(students, user.role);
}

export async function sanitizeOneStudentForUser(student: Student, user: User): Promise<Student> {
  return studentUseCases.sanitizeStudentForViewer(student, user.role);
}

/** Runs work within tenant context, optionally enabling soft-delete reads. */
export async function withStudentTenantScope<T>(
  tenantId: string,
  includeDeleted: boolean,
  work: () => Promise<T>,
  options?: { readOnly?: boolean },
): Promise<T> {
  return withTenant(
    tenantId,
    async (tx) => {
      if (includeDeleted) await enableIncludeDeleted(tx);
      return work();
    },
    options,
  );
}

type StudentWriteErrorBody =
  | { type: string; message: string }
  | { type: string; message: string; errors: Array<{ field: string; message: string }> };

/** Maps create/update domain errors to ts-rest status/body (403 / 400 / 409). */
export function mapStudentWriteHttpError(
  error: unknown,
): { status: 403 | 400 | 409; body: StudentWriteErrorBody } | null {
  if (error instanceof StudentPermissionError) {
    return { status: 403, body: { type: "forbidden", message: error.message } };
  }
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number" &&
    (error as { statusCode: number }).statusCode === 409
  ) {
    const type =
      "type" in error && typeof (error as { type?: unknown }).type === "string"
        ? (error as { type: string }).type
        : "conflict";
    return { status: 409, body: { type, message: error.message } };
  }
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number" &&
    (error as { statusCode: number }).statusCode === 400
  ) {
    const validationErrors =
      "validationErrors" in error &&
      Array.isArray((error as { validationErrors?: unknown }).validationErrors)
        ? (
            error as {
              validationErrors: Array<{ fieldId?: string; field?: string; message: string }>;
            }
          ).validationErrors.map((e) => ({
            field: e.field ?? e.fieldId ?? "form",
            message: e.message,
          }))
        : [{ field: "form", message: error.message }];
    return {
      status: 400,
      body: {
        type: "validation_error",
        message: error.message,
        errors: validationErrors,
      },
    };
  }
  if (error && typeof error === "object" && "type" in error && "field" in error) {
    const e = error as { type: string; message: string; field: string };
    return {
      status: 400,
      body: {
        type: e.type,
        message: e.message,
        errors: [{ field: e.field, message: e.message }],
      },
    };
  }
  return null;
}
