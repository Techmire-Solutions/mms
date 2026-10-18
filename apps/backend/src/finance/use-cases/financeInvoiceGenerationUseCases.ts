import { randomUUID } from "node:crypto";
import {
  billingPeriodFromDate,
  buildInvoiceDraftFromEnrollment,
  DEFAULT_FINANCE_SETTINGS,
  isEnrollmentBillable,
  shouldSkipGeneratedInvoice,
  resolveFamilyContactId,
  todayISO,
  type Enrollment,
  type EnrollmentBillingSource,
  type FeeFrequency,
  type FeeStructure,
  type GenerateInvoicesBody,
  type GenerateInvoicesResult,
  type Invoice,
} from "@mms/shared";
import { getRequestTenant, requireTenant } from "../../lib/tenantContext.js";
import { loadFinanceModulePreferences } from "../../services/financePreferencesService.js";
import {
  allocateInvoiceNumberBatch,
  listFeeStructures,
} from "../../db/repositories/financeBillingRepository.js";
import { bulkSaveInvoices } from "../../db/repositories/financeInvoicesRepository.js";
import { linkEnrollmentInvoiceIds } from "../../db/repositories/enrollmentRepositoryPersist.js";
import {
  listBillableEnrollments,
  listEnrollmentInvoiceMarks,
} from "../../db/repositories/financeInvoiceGenerationRepository.js";
import { financeUseCases } from "./financeUseCases.js";
import { logger } from "../../lib/logger.js";

function resolveFrequency(
  enrollment: EnrollmentBillingSource,
  structures: FeeStructure[],
): FeeFrequency {
  const exact = structures.find(
    (structure) =>
      structure.isActive &&
      structure.session === enrollment.sessionName &&
      structure.className === enrollment.className,
  );
  if (exact) return exact.frequency;
  const sessionOnly = structures.find(
    (structure) =>
      structure.isActive && structure.session === enrollment.sessionName && !structure.className,
  );
  return sessionOnly?.frequency ?? "monthly";
}

async function persistGeneratedInvoices(
  tenant: string,
  drafts: ReturnType<typeof buildInvoiceDraftFromEnrollment>[],
  prefix: string,
): Promise<Invoice[]> {
  if (drafts.length === 0) return [];
  if (drafts.length === 1) {
    return [await financeUseCases.createInvoice({ ...drafts[0], invoiceNumber: undefined })];
  }
  const year = Number(drafts[0]?.billingPeriod.slice(0, 4)) || new Date().getFullYear();
  const numbers = await allocateInvoiceNumberBatch(tenant, year, drafts.length, prefix);
  const invoices: Invoice[] = drafts.map((draft, index) => ({
    ...draft,
    id: `inv-${randomUUID()}`,
    invoiceNumber: numbers[index],
  }));
  await bulkSaveInvoices(tenant, invoices);
  return invoices;
}

export async function generateInvoices(
  input: GenerateInvoicesBody,
): Promise<GenerateInvoicesResult> {
  const tenant = requireTenant();
  const [prefs, structures, enrollments] = await Promise.all([
    loadFinanceModulePreferences(),
    listFeeStructures(tenant),
    listBillableEnrollments(tenant, {
      sessionId: input.sessionId,
      classId: input.classId,
      enrollmentIds: input.enrollmentIds,
    }),
  ]);
  const dueDays = Math.max(
    1,
    Number.parseInt(prefs?.dueDays ?? DEFAULT_FINANCE_SETTINGS.dueDays, 10) || 30,
  );
  const prefix = prefs?.invoicePrefix?.trim() || DEFAULT_FINANCE_SETTINGS.invoicePrefix;
  const marks = await listEnrollmentInvoiceMarks(
    tenant,
    enrollments.map((enrollment) => enrollment.id),
  );
  const billedThisPeriod = new Set(
    marks
      .filter((mark) => mark.billingPeriod === input.billingPeriod)
      .map((mark) => mark.enrollmentId),
  );
  const billedAny = new Set(marks.map((mark) => mark.enrollmentId));
  const drafts = enrollments
    .filter(
      (enrollment) =>
        isEnrollmentBillable(enrollment) && (enrollment.finalFee > 0 || enrollment.baseFee > 0),
    )
    .filter(
      (enrollment) =>
        !shouldSkipGeneratedInvoice({
          frequency: resolveFrequency(enrollment, structures),
          alreadyBilledThisPeriod: billedThisPeriod.has(enrollment.id),
          enrollmentHasAnyInvoice: billedAny.has(enrollment.id),
        }),
    )
    .map((enrollment) => buildInvoiceDraftFromEnrollment(enrollment, input.billingPeriod, dueDays));
  const { findStudentsByIds } = await import("../../db/repositories/studentRepository.js");
  const students = await findStudentsByIds(tenant, [
    ...new Set(drafts.map((draft) => draft.studentId)),
  ]);
  const familyByStudent = new Map(
    students.map((student) => [student.id, resolveFamilyContactId(student)]),
  );
  const draftsWithFamily = drafts.map((draft) => ({
    ...draft,
    familyContactId: familyByStudent.get(draft.studentId) ?? null,
  }));
  const created = await persistGeneratedInvoices(tenant, draftsWithFamily, prefix);
  await linkEnrollmentInvoiceIds(
    tenant,
    created
      .filter((invoice) => invoice.enrollmentId)
      .map((invoice) => ({ enrollmentId: invoice.enrollmentId as string, invoiceId: invoice.id })),
  );
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", "finance_invoices");
  broadcastTenantUpdate(tenant, "collection", "finance_metrics");
  broadcastTenantUpdate(tenant, "collection", "enrollments");
  return {
    created: created.length,
    skipped: enrollments.length - created.length,
    eligible: enrollments.length,
  };
}

export async function maybeGenerateInvoiceForEnrollment(
  enrollment: Enrollment,
): Promise<Enrollment> {
  const tenant = getRequestTenant();
  if (!tenant || !isEnrollmentBillable(enrollment)) return enrollment;
  if ((enrollment.finalFee || 0) <= 0 && (enrollment.baseFee || 0) <= 0) return enrollment;
  try {
    const prefs = await loadFinanceModulePreferences();
    if (prefs ? !prefs.autoGenerateInvoice : !DEFAULT_FINANCE_SETTINGS.autoGenerateInvoice) {
      return enrollment;
    }
    const period = billingPeriodFromDate(enrollment.enrolledDate || todayISO());
    const result = await generateInvoices({
      billingPeriod: period,
      enrollmentIds: [enrollment.id],
    });
    if (result.created === 0) return enrollment;
    const { findEnrollmentById } = await import("../../db/repositories/enrollmentRepository.js");
    return (await findEnrollmentById(tenant, enrollment.id)) ?? enrollment;
  } catch (error) {
    logger.warn({ err: error }, "Enrollment invoice generation skipped");
    return enrollment;
  }
}
