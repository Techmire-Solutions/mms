import { and, eq, inArray, isNull } from "drizzle-orm";
import type { EnrollmentBillingSource } from "@mms/shared";
import { enrollments, financeInvoices, sessions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

const BILLABLE_STATUSES = ["pending", "confirmed"] as const;
const PAGE_SIZE = 100;

export interface BillableEnrollmentQuery {
  sessionId?: string;
  classId?: string;
  enrollmentIds?: string[];
}

function toBillingSource(row: {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  sessionName: string;
  sessionId: string;
  classId: string;
  enrolledDate: string | null;
  baseFee: string;
  discountType: string;
  discountPct: string;
  discountAmt: string;
  finalFee: string;
  invoiceId: string | null;
  status: string;
  sessionCurrency: string | null;
}): EnrollmentBillingSource {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    className: row.className,
    sessionName: row.sessionName,
    sessionId: row.sessionId,
    classId: row.classId,
    enrolledDate: row.enrolledDate ?? "",
    baseFee: Number(row.baseFee ?? 0),
    discountType: row.discountType,
    discountPct: Number(row.discountPct ?? 0),
    discountAmt: Number(row.discountAmt ?? 0),
    finalFee: Number(row.finalFee ?? 0),
    invoiceId: row.invoiceId,
    status: row.status,
    ...(row.sessionCurrency ? { sessionCurrency: row.sessionCurrency.trim().toUpperCase() } : {}),
  };
}

const ENROLLMENT_BILLING_COLUMNS = {
  id: enrollments.id,
  studentId: enrollments.studentId,
  studentName: enrollments.studentName,
  className: enrollments.className,
  sessionName: enrollments.sessionName,
  sessionId: enrollments.sessionId,
  classId: enrollments.classId,
  enrolledDate: enrollments.enrolledDate,
  baseFee: enrollments.baseFee,
  discountType: enrollments.discountType,
  discountPct: enrollments.discountPct,
  discountAmt: enrollments.discountAmt,
  finalFee: enrollments.finalFee,
  invoiceId: enrollments.invoiceId,
  status: enrollments.status,
  sessionCurrency: sessions.currency,
} as const;

/** Active billable enrollments for one generate request (hard cap 100). */
export async function listBillableEnrollments(
  tenant: string,
  query: BillableEnrollmentQuery,
): Promise<EnrollmentBillingSource[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(enrollments.workspaceSubdomain, subdomain),
      isNull(enrollments.deletedAt),
      inArray(enrollments.status, [...BILLABLE_STATUSES]),
    ];
    if (query.sessionId?.trim()) conditions.push(eq(enrollments.sessionId, query.sessionId.trim()));
    if (query.classId?.trim()) conditions.push(eq(enrollments.classId, query.classId.trim()));
    if (query.enrollmentIds && query.enrollmentIds.length > 0) {
      conditions.push(inArray(enrollments.id, query.enrollmentIds.slice(0, PAGE_SIZE)));
    }
    const rows = await tx
      .select(ENROLLMENT_BILLING_COLUMNS)
      .from(enrollments)
      .leftJoin(
        sessions,
        and(
          eq(sessions.workspaceSubdomain, enrollments.workspaceSubdomain),
          eq(sessions.id, enrollments.sessionId),
        ),
      )
      .where(and(...conditions))
      .limit(PAGE_SIZE);
    return rows.map(toBillingSource);
  });
}

export interface EnrollmentInvoiceMark {
  enrollmentId: string;
  billingPeriod: string | null;
}

/** Existing invoices for the given enrollments (any period). */
export async function listEnrollmentInvoiceMarks(
  tenant: string,
  enrollmentIds: string[],
): Promise<EnrollmentInvoiceMark[]> {
  if (enrollmentIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        enrollmentId: financeInvoices.enrollmentId,
        billingPeriod: financeInvoices.billingPeriod,
      })
      .from(financeInvoices)
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          isNull(financeInvoices.deletedAt),
          inArray(financeInvoices.enrollmentId, enrollmentIds),
        ),
      );
    return rows
      .filter((row): row is { enrollmentId: string; billingPeriod: string | null } =>
        Boolean(row.enrollmentId),
      )
      .map((row) => ({ enrollmentId: row.enrollmentId, billingPeriod: row.billingPeriod }));
  });
}

/** Live invoice ids raised for one enrollment (any period). */
export async function findInvoiceIdsByEnrollment(
  tenant: string,
  enrollmentId: string,
): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: financeInvoices.id })
      .from(financeInvoices)
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          isNull(financeInvoices.deletedAt),
          eq(financeInvoices.enrollmentId, enrollmentId),
        ),
      );
    return rows.map((row) => row.id);
  });
}
