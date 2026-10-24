/**
 * @file facultyTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Faculty.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface FacultyTransferEntity {
  name: string;
  employeeId: string;
  contactId?: string;
  specialization?: string;
  department?: string;
  designation?: string;
  status?: string;
  qualification?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export const facultyTransferSchema: ModuleTransferSchema<FacultyTransferEntity> =
  createModuleTransferSchema<FacultyTransferEntity>({
    moduleId: "faculty",
    entityNounPlural: "faculty members",
    defaultFilename: "faculty.csv",
    fields: [
      {
        key: "name",
        label: "Faculty Name",
        aliases: ["Name", "faculty_name", "Full Name"],
        required: true,
        sample: "Shaykh Ahmad",
        extract: (f) => f.name || "",
      },
      {
        key: "employeeId",
        label: "Employee ID",
        aliases: ["employee_id", "employeeid", "Emp ID", "Faculty ID"],
        required: true,
        sample: "FAC-101",
        extract: (f) => f.employeeId || "",
      },
      {
        key: "contactId",
        label: "Contact ID",
        aliases: ["contact_id", "contactid"],
        sample: "CON-001",
        extract: (f) => f.contactId || "",
      },
      {
        key: "department",
        label: "Department",
        aliases: ["dept", "Department Name"],
        sample: "Quranic Sciences",
        extract: (f) => f.department || "",
      },
      {
        key: "designation",
        label: "Designation",
        aliases: ["title", "Job Title", "Role"],
        sample: "Senior Instructor",
        extract: (f) => f.designation || "",
      },
      {
        key: "specialization",
        label: "Specialization",
        aliases: ["field", "Subject"],
        sample: "Tafsir & Hadith",
        extract: (f) => f.specialization || "",
      },
      {
        key: "qualification",
        label: "Qualification",
        aliases: ["degree", "Education"],
        sample: "Dars-e-Nizami; MA Islamic Studies",
        extract: (f) => f.qualification || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Employment Status"],
        sample: "active",
        extract: (f) => f.status || "active",
      },
      {
        key: "employmentStartDate",
        label: "Start Date",
        aliases: ["employment_start_date", "join_date", "Join Date", "joindate", "startdate"],
        sample: "2020-09-01",
        extract: (f) => f.employmentStartDate || "",
      },
      {
        key: "employmentEndDate",
        label: "End Date",
        aliases: ["employment_end_date", "end_date"],
        sample: "",
        extract: (f) => f.employmentEndDate || "",
      },
      {
        key: "phone",
        label: "Phone Number",
        aliases: ["Phone", "phone_number", "Mobile"],
        sample: "+923009876543",
        extract: (f) => f.phone || "",
        parse: (raw) => raw.trim().replace(/^'+/, ""),
      },
      {
        key: "email",
        label: "Email Address",
        aliases: ["Email", "email_address"],
        sample: "ahmad@madrasa.org",
        extract: (f) => f.email || "",
        parse: (raw) => raw.trim().toLowerCase(),
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks"],
        sample: "Head of Department",
        extract: (f) => f.notes || "",
      },
    ],
  });

registerModuleTransferSchema(facultyTransferSchema);
