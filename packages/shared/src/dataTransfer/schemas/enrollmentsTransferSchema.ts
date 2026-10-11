/**
 * @file enrollmentsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Enrollments.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface EnrollmentTransferEntity {
  studentName: string;
  studentId?: string;
  sessionName: string;
  sessionId?: string;
  className?: string;
  enrolledDate?: string;
  baseFee?: string | number;
  discountType?: string;
  discountPct?: number;
  finalFee?: string | number;
  status?: string;
  paymentStatus?: string;
  notes?: string;
}

export const enrollmentsTransferSchema: ModuleTransferSchema<EnrollmentTransferEntity> =
  createModuleTransferSchema<EnrollmentTransferEntity>({
    moduleId: "enrollments",
    entityNounPlural: "enrollments",
    defaultFilename: "enrollments.csv",
    fields: [
      {
        key: "studentName",
        label: "Student Name",
        aliases: ["student", "Student", "Student Full Name"],
        required: true,
        sample: "Ali ibn Husayn",
        extract: (e) => e.studentName || "",
      },
      {
        key: "studentId",
        label: "Student ID",
        aliases: ["student_id", "GR Number", "GR"],
        sample: "GR-1042",
        extract: (e) => e.studentId || "",
      },
      {
        key: "sessionName",
        label: "Session Name",
        aliases: ["session", "Session", "Academic Session"],
        required: true,
        sample: "Academic Year 2024-2025",
        extract: (e) => e.sessionName || "",
      },
      {
        key: "sessionId",
        label: "Session ID",
        aliases: ["session_id"],
        sample: "SES-01",
        extract: (e) => e.sessionId || "",
      },
      {
        key: "className",
        label: "Class Name",
        aliases: ["class", "Class", "Section"],
        sample: "Hifz Section A",
        extract: (e) => e.className || "",
      },
      {
        key: "enrolledDate",
        label: "Enrolled Date",
        aliases: ["enrolled_date", "Admission Date"],
        sample: "2024-08-20",
        extract: (e) => e.enrolledDate || "",
      },
      {
        key: "baseFee",
        label: "Base Fee",
        aliases: ["base_fee", "Fee"],
        sample: "15000",
        extract: (e) => (e.baseFee != null ? String(e.baseFee) : ""),
      },
      {
        key: "discountType",
        label: "Discount Type",
        aliases: ["discount_type", "Concession"],
        sample: "Need-based",
        extract: (e) => e.discountType || "",
      },
      {
        key: "discountPct",
        label: "Discount %",
        aliases: ["discount_pct"],
        sample: 10,
        extract: (e) => (e.discountPct != null ? String(e.discountPct) : ""),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "finalFee",
        label: "Final Fee",
        aliases: ["final_fee", "Payable"],
        sample: "13500",
        extract: (e) => (e.finalFee != null ? String(e.finalFee) : ""),
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Enrollment Status"],
        sample: "enrolled",
        extract: (e) => e.status || "enrolled",
      },
      {
        key: "paymentStatus",
        label: "Payment Status",
        aliases: ["payment_status", "Billing Status"],
        sample: "paid",
        extract: (e) => e.paymentStatus || "unpaid",
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks"],
        sample: "On-time enrollment",
        extract: (e) => e.notes || "",
      },
    ],
  });

registerModuleTransferSchema(enrollmentsTransferSchema);
