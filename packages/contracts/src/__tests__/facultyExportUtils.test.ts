import { describe, expect, it } from "vitest";
import {
  ALL_FACULTY_EXPORT_COLUMNS,
  DEFAULT_FACULTY_EXPORT_COLUMNS,
  DEFAULT_FACULTY_STATUS,
  DEFAULT_FACULTY_SETTINGS,
  buildFacultyExportRows,
  filterFacultyExportColumnsForViewer,
  type FacultyMember,
  type FacultyExportColumn,
  type FacultySettings,
} from "../index.js";

const ALL_COLUMNS: FacultyExportColumn[] = [
  ...DEFAULT_FACULTY_EXPORT_COLUMNS,
  { id: "custom:extraNote", label: "Extra" },
];

describe("filterFacultyExportColumnsForViewer", () => {
  it("keeps always-visible employeeId even when the seed field is disabled", () => {
    const settings: FacultySettings = {
      ...DEFAULT_FACULTY_SETTINGS,
      fields: {
        basic: [
          {
            key: "specialization",
            label: "Specialization",
            type: "select",
            enabled: true,
            order: 0,
          },
          { key: "qualification", label: "Qualification", type: "text", enabled: true, order: 1 },
        ],
        employment: [
          { key: "employeeId", label: "Employee ID", type: "text", enabled: false, order: 0 },
          { key: "status", label: "Status", type: "select", enabled: true, order: 1 },
          { key: "joinDate", label: "Join", type: "date", enabled: true, order: 2 },
        ],
      },
      enabledTabs: ["basic", "employment"],
    };

    const filtered = filterFacultyExportColumnsForViewer(ALL_COLUMNS, settings, "admin");
    expect(filtered.some((col) => col.id === "employeeId")).toBe(true);
    expect(filtered.some((col) => col.id === "name")).toBe(true);
  });

  it("drops retired contact-derived specialization/qualification export columns", () => {
    const settings: FacultySettings = {
      ...DEFAULT_FACULTY_SETTINGS,
      fields: {
        basic: [
          // Product locks force these off even when Setup overlays mark them enabled.
          {
            key: "specialization",
            label: "Specialization",
            type: "select",
            enabled: true,
            order: 0,
          },
          { key: "qualification", label: "Qualification", type: "text", enabled: true, order: 1 },
        ],
        employment: [
          { key: "status", label: "Status", type: "select", enabled: true, order: 0 },
          { key: "joinDate", label: "Join", type: "date", enabled: true, order: 1 },
        ],
      },
      enabledTabs: ["basic", "employment"],
    };

    const filtered = filterFacultyExportColumnsForViewer(ALL_COLUMNS, settings);
    expect(filtered.some((col) => col.id === "specialization")).toBe(false);
    expect(filtered.some((col) => col.id === "qualification")).toBe(false);
    expect(filtered.some((col) => col.id === "status")).toBe(true);
  });

  it("drops custom columns when the draft field is disabled", () => {
    const settings: FacultySettings = {
      ...DEFAULT_FACULTY_SETTINGS,
      fields: {
        employment: [
          { key: "extraNote", label: "Extra", type: "text", enabled: false, order: 0 },
          { key: "status", label: "Status", type: "select", enabled: true, order: 1 },
        ],
      },
      enabledTabs: ["basic", "employment"],
    };

    const filtered = filterFacultyExportColumnsForViewer(ALL_COLUMNS, settings);
    expect(filtered.some((col) => col.id === "custom:extraNote")).toBe(false);
  });

  it("returns all tabs columns when columns are empty and settings are absent", () => {
    const filtered = filterFacultyExportColumnsForViewer([]);
    expect(filtered.map((col) => col.id)).toEqual(ALL_FACULTY_EXPORT_COLUMNS.map((col) => col.id));
  });
});

describe("buildFacultyExportRows", () => {
  it("resolves system and custom cells via directory column keys", () => {
    const faculty = {
      id: "f1",
      contactId: "c1",
      name: "Ada",
      employeeId: "FAC-1",
      specialization: "Hifz",
      qualification: "Ijazah",
      joinDate: "2024-01-01",
      status: "",
      extraNote: "Hello",
    } as FacultyMember & { extraNote: string };

    const table = buildFacultyExportRows(
      [faculty],
      [
        { id: "name", label: "Name" },
        { id: "status", label: "Status" },
        { id: "custom:extraNote", label: "Extra" },
      ],
    );
    expect(table[0]).toEqual(["Name", "Status", "Extra"]);
    expect(table[1]).toEqual(["Ada", DEFAULT_FACULTY_STATUS, "Hello"]);
  });

  it("extracts cells from all tabs, account info, and customFields non-destructively", () => {
    const fullFaculty: FacultyMember = {
      id: "f2",
      contactId: "c2",
      name: "Zayd Tariq",
      employeeId: "FAC-02",
      phone: "+987654321",
      email: "zayd@madrasa.test",
      gender: "male",
      dob: "1985-04-12",
      cnic: "35201-1234567-3",
      department: "Academics",
      designation: "Senior Instructor",
      status: "active",
      joinDate: "2023-08-01",
      employmentStartDate: "2023-08-01",
      employmentEndDate: null,
      specialization: "Tajweed",
      qualification: "Masters in Islamic Studies",
      performanceRating: 5,
      notes: "Lead instructor",
      createdAt: "2023-08-01T00:00:00Z",
      updatedAt: "2023-09-01T00:00:00Z",
      customFields: {
        bloodGroup: "B+",
        certifications: ["Ijazah Hafs", "Ijazah Shu'bah"],
      },
    } as FacultyMember;

    const table = buildFacultyExportRows(
      [fullFaculty],
      [
        { id: "phone", label: "Phone" },
        { id: "email", label: "Email" },
        { id: "gender", label: "Gender" },
        { id: "bloodGroup", label: "Blood Group" },
        { id: "certifications", label: "Certifications" },
      ],
    );

    expect(table[1]).toEqual([
      "+987654321",
      "zayd@madrasa.test",
      "male",
      "B+",
      "Ijazah Hafs; Ijazah Shu'bah",
    ]);
  });
});
