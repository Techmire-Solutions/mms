import { formatMoney, todayISO } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type Enrollment, type CalculatedFee } from '@/lib/data/enrollmentData';
import { type Student } from '@/lib/data/studentsData';
import { type Session, type Class } from '@/lib/data/sessionsData';

export function buildEnrollmentPayload(params: {
  student: Student;
  session: Session;
  classInfo: Class | null;
  feeResult: CalculatedFee;
  notes: string;
  customFieldValues: Record<string, unknown>;
  t: TranslationFunction;
  /** Section + roll number; the server defaults the section when omitted. */
  placement?: { sectionId: string; rollNo: string };
}): Enrollment {
  const { student, session, classInfo, feeResult, notes, customFieldValues, t, placement } = params;
  const nowISO = new Date().toISOString();

  return {
    id: `enr-${crypto.randomUUID()}`,
    studentId: student.id,
    studentName: student.name || "",
    sessionId: session.id,
    sessionName: session.name,
    classId: classInfo?.id || "",
    className: classInfo?.name || "",
    ...(placement?.sectionId ? { sectionId: placement.sectionId } : {}),
    ...(placement?.rollNo.trim() ? { rollNo: placement.rollNo.trim() } : {}),
    enrolledDate: todayISO(),
    baseFee: session.baseFee,
    discountType: feeResult.id,
    discountLabel: feeResult.label,
    discountPct: feeResult.pct,
    discountAmt: feeResult.discountAmt,
    finalFee: feeResult.finalFee,
    status: "pending" as const,
    invoiceId: null,
    paymentStatus: "pending" as const,
    notes,
    timeline: [
      { ts: nowISO, event: t("enrollments.wizard.timelineCreated"), by: "Admin" },
      {
        ts: nowISO,
        event: t("enrollments.wizard.timelineInvoice", { amount: formatMoney(feeResult.finalFee) }),
        by: "System",
      },
    ],
  } satisfies Enrollment;
}
