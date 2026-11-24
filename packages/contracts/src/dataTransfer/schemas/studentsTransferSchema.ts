/**
 * @file studentsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Students.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface StudentTransferEntity {
  name: string;
  grNumber: string;
  studentId?: string;
  gender?: string;
  dob?: string;
  solarDob?: string;
  lunarDob?: string;
  phone?: string;
  email?: string;
  city?: string;
  cnic?: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  status?: string;
  registeredDate?: string;
  enrollmentDate?: string;
  enrolledSessions?: string;
  discountType?: string;
  discountPct?: number;
  notes?: string;
}

export const studentsTransferSchema: ModuleTransferSchema<StudentTransferEntity> =
  createModuleTransferSchema<StudentTransferEntity>({
    moduleId: "students",
    entityNounPlural: "students",
    defaultFilename: "students.csv",
    fields: [
      {
        key: "name",
        label: "Student Name",
        aliases: ["Name", "student_name", "Full Name"],
        required: true,
        sample: "Ali ibn Husayn",
        extract: (s) => s.name || "",
      },
      {
        key: "grNumber",
        label: "GR Number",
        aliases: ["gr_number", "GR", "grNo", "General Register"],
        required: true,
        sample: "GR-1042",
        extract: (s) => s.grNumber || "",
      },
      {
        key: "studentId",
        label: "Student ID",
        aliases: ["student_id", "id_number"],
        sample: "STU-001",
        extract: (s) => s.studentId || "",
      },
      {
        key: "gender",
        label: "Gender",
        aliases: ["Sex"],
        sample: "male",
        extract: (s) => s.gender || "",
      },
      {
        key: "dob",
        label: "Date of Birth",
        aliases: ["dob", "date_of_birth", "Birth Date"],
        sample: "2010-04-12",
        extract: (s) => s.dob || "",
      },
      {
        key: "cnic",
        label: "National ID / B-Form",
        aliases: ["CNIC", "cnic", "b_form", "B-Form"],
        sample: "42101-5544332-1",
        extract: (s) => s.cnic || "",
      },
      {
        key: "phone",
        label: "Phone Number",
        aliases: ["Phone", "phone_number", "Mobile"],
        sample: "+923001234567",
        extract: (s) => s.phone || "",
        parse: (raw) => raw.trim().replace(/^'+/, ""),
      },
      {
        key: "email",
        label: "Email Address",
        aliases: ["Email", "email_address"],
        sample: "student@madrasa.org",
        extract: (s) => s.email || "",
        parse: (raw) => raw.trim().toLowerCase(),
      },
      {
        key: "city",
        label: "City",
        aliases: ["Town"],
        sample: "Najaf",
        extract: (s) => s.city || "",
      },
      {
        key: "fatherName",
        label: "Father Name",
        aliases: ["father_name", "Father"],
        sample: "Husayn ibn Ali",
        extract: (s) => s.fatherName || "",
      },
      {
        key: "motherName",
        label: "Mother Name",
        aliases: ["mother_name", "Mother"],
        sample: "Fatima",
        extract: (s) => s.motherName || "",
      },
      {
        key: "guardianName",
        label: "Guardian Name",
        aliases: ["guardian_name", "Guardian"],
        sample: "Husayn ibn Ali",
        extract: (s) => s.guardianName || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Enrollment Status"],
        sample: "active",
        extract: (s) => s.status || "active",
      },
      {
        key: "registeredDate",
        label: "Registration Date",
        aliases: ["registered_date", "Reg Date"],
        sample: "2024-01-10",
        extract: (s) => s.registeredDate || "",
      },
      {
        key: "enrolledSessions",
        label: "Enrolled Sessions",
        aliases: ["sessions", "Sessions"],
        sample: "Spring 2024; Quranic Studies",
        extract: (s) => s.enrolledSessions || "",
      },
      {
        key: "discountType",
        label: "Discount Type",
        aliases: ["discount_type", "Fee Concession"],
        sample: "Need-based",
        extract: (s) => s.discountType || "",
      },
      {
        key: "discountPct",
        label: "Discount %",
        aliases: ["discount_pct", "Discount Percentage"],
        sample: 10,
        extract: (s) => (s.discountPct != null ? String(s.discountPct) : ""),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks", "Comments"],
        sample: "Enrolled under scholar sponsorship",
        extract: (s) => s.notes || "",
      },
    ],
  });

registerModuleTransferSchema(studentsTransferSchema);
