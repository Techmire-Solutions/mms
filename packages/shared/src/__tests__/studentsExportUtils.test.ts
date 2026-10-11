import { describe, expect, it } from "vitest";
import {
  filterStudentExportColumnsForViewer,
  buildStudentsExportRows,
  extractStudentCell,
  type StudentExportColumn,
} from "../studentsExportUtils.js";
import type { Student } from "../studentTypes.js";
import type { StudentsSettings } from "../studentsModuleSettings.js";

describe("studentsExportUtils", () => {
  const columns: StudentExportColumn[] = [
    { id: "name", label: "Name" },
    { id: "grNumber", label: "GR Number" },
    { id: "gender", label: "Gender" },
    { id: "dob", label: "Date of Birth" },
    { id: "parents", label: "Parents" },
  ];

  const students: Student[] = [
    {
      id: "s-1",
      contactId: "c-1",
      name: "Aisha Siddiqui",
      grNumber: "0001-2026",
      gender: "female",
      dob: "2015-01-01",
      status: "active",
    },
  ];

  it("returns all columns when settings have no tab-keyed field registry", () => {
    expect(filterStudentExportColumnsForViewer(columns, null, "teacher")).toEqual(columns);
    expect(
      filterStudentExportColumnsForViewer(
        columns,
        {
          autoGenerateId: true,
          grNumberTemplate: "{seq}",
          grNumberDigits: 4,
          grNumberRestartAnnually: true,
        },
        "teacher",
      ),
    ).toEqual(columns);
  });

  it("filters columns by tab and field permissions", () => {
    const settings: StudentsSettings = {
      autoGenerateId: true,
      grNumberTemplate: "{seq}-{year}",
      grNumberDigits: 4,
      grNumberRestartAnnually: true,
      formTabs: [
        {
          key: "basic",
          label: "Basic",
          enabled: true,
          order: 0,
          permissions: ["admin", "teacher"],
        },
      ],
      fields: {
        basic: [
          {
            key: "gender",
            label: "Gender",
            type: "select",
            enabled: true,
            order: 0,
            permissions: ["admin"],
          },
          {
            key: "dob",
            label: "DOB",
            type: "date",
            enabled: true,
            order: 1,
            permissions: ["admin", "teacher"],
          },
          {
            key: "contactRelationships",
            label: "Relationships",
            type: "text",
            enabled: true,
            order: 2,
            permissions: ["admin"],
          },
        ],
      },
    };

    const forTeacher = filterStudentExportColumnsForViewer(columns, settings, "teacher");
    expect(forTeacher.map((column: StudentExportColumn) => column.id)).toEqual([
      "name",
      "grNumber",
      "dob",
    ]);

    const forAdmin = filterStudentExportColumnsForViewer(columns, settings, "admin");
    expect(forAdmin.map((column: StudentExportColumn) => column.id)).toEqual([
      "name",
      "grNumber",
      "gender",
      "dob",
      "parents",
    ]);
  });

  it("builds CSV header and rows correctly", () => {
    const rows = buildStudentsExportRows(students, columns.slice(0, 3));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Name", "GR Number", "Gender"]);
    expect(rows[1]).toEqual(["Aisha Siddiqui", "0001-2026", "female"]);
  });

  it("resolves all columns and includes custom fields and custom tabs when columns array is empty", () => {
    const settings: StudentsSettings = {
      autoGenerateId: true,
      grNumberTemplate: "{seq}",
      grNumberDigits: 4,
      grNumberRestartAnnually: false,
      formTabs: [{ key: "medical", label: "Medical Info", enabled: true, order: 2 }],
      fields: {
        registration: [
          { key: "bloodGroup", label: "Blood Group", type: "text", enabled: true, order: 10 },
        ],
      },
    };
    const resolved = filterStudentExportColumnsForViewer([], settings, "admin");
    const ids = resolved.map((c) => c.id);
    expect(ids).toContain("name");
    expect(ids).toContain("grNumber");
    expect(ids).toContain("studentId");
    expect(ids).toContain("fatherName");
    expect(ids).toContain("bloodGroup");
    expect(ids).toContain("medical");
  });

  it("extracts cells from all tabs, customFields, and complex values non-destructively", () => {
    const fullStudent: Student = {
      id: "s-2",
      contactId: "c-2",
      name: "Bilal Khan",
      grNumber: "0002-2026",
      studentId: "STU-99",
      gender: "male",
      dob: "2016-05-15",
      solarDob: "2016-05-15",
      lunarDob: "1437-08-08",
      phone: "+1234567890",
      email: "bilal@test.local",
      city: "Karachi",
      cnic: "42101-1234567-1",
      fatherName: "Tariq Khan",
      motherName: "Fatima Khan",
      guardianName: "Tariq Khan",
      status: "active",
      registeredDate: "2026-01-10",
      enrollmentDate: "2026-02-01",
      enrolledSessions: ["Session A", "Session B"],
      discountType: "sibling",
      discountPct: 15,
      registrationType: "regular",
      notes: "Excellent student",
      createdAt: "2026-01-10T00:00:00Z",
      updatedAt: "2026-01-12T00:00:00Z",
      customFields: {
        emergencyContact: "0987654321",
        metadata: { allergies: ["peanuts"] },
      },
    };

    expect(extractStudentCell(fullStudent, "studentId")).toBe("STU-99");
    expect(extractStudentCell(fullStudent, "fatherName")).toBe("Tariq Khan");
    expect(extractStudentCell(fullStudent, "motherName")).toBe("Fatima Khan");
    expect(extractStudentCell(fullStudent, "city")).toBe("Karachi");
    expect(extractStudentCell(fullStudent, "enrolledSessions")).toBe("Session A; Session B");
    expect(extractStudentCell(fullStudent, "discountPct")).toBe(15);
    expect(extractStudentCell(fullStudent, "emergencyContact")).toBe("0987654321");
    expect(extractStudentCell(fullStudent, "metadata")).toBe('{"allergies":["peanuts"]}');
  });
});
