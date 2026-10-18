import { describe, expect, it } from "vitest";
import { parseFacultyMembersCsv } from "./facultyCsvParser.js";
import { parseFacultyDepartmentsCsv } from "./facultyDepartmentCsvParser.js";
import { parseFacultyDesignationsCsv } from "./facultyDesignationCsvParser.js";
import { facultyDepartmentsToCsv, facultyDesignationsToCsv } from "./facultyCatalogCsv.js";

describe("faculty CSV parsers", () => {
  it("parses faculty member rows and maps legacy joinDate onto employmentStartDate", () => {
    // Arrange
    const csv =
      "employeeId,contactId,department,designation,joinDate\nE1,c1,HIFZ,INST,2024-01-15\n";

    // Act
    const rows = parseFacultyMembersCsv(csv);

    // Assert
    expect(rows).toEqual([
      {
        employeeId: "E1",
        contactId: "c1",
        department: "HIFZ",
        designation: "INST",
        employmentStartDate: "2024-01-15",
      },
    ]);
  });

  it("parses department rows by name/description/status and accepts legacy isActive booleans", () => {
    // Arrange
    const csv = "name,description,status\nHifz,Memorisation,active\nNazira,,inactive\n";
    const legacyCsv = "name,isActive\nTajweed,false\n";

    // Act
    const departments = parseFacultyDepartmentsCsv(csv);
    const legacy = parseFacultyDepartmentsCsv(legacyCsv);

    // Assert
    expect(departments).toEqual([
      { name: "Hifz", description: "Memorisation", status: "active" },
      { name: "Nazira", description: undefined, status: "inactive" },
    ]);
    expect(legacy[0]).toEqual({ name: "Tajweed", description: undefined, status: "inactive" });
  });

  it("parses designation rows keyed by department + name with an optional parent", () => {
    // Arrange
    const csv =
      "department,name,parentDesignation,status\nHifz,Head of Hifz,,active\nHifz,Hafiz Teacher,Head of Hifz,active\n";

    // Act
    const designations = parseFacultyDesignationsCsv(csv);

    // Assert
    expect(designations).toEqual([
      { department: "Hifz", name: "Head of Hifz", parentDesignation: undefined, status: "active" },
      {
        department: "Hifz",
        name: "Hafiz Teacher",
        parentDesignation: "Head of Hifz",
        status: "active",
      },
    ]);
  });

  it("round-trips department and designation exports through the parsers", () => {
    // Arrange
    const departmentCsv = facultyDepartmentsToCsv([
      { id: "d1", name: "Hifz", description: "Memorisation", status: "active" },
    ]);
    const designationCsv = facultyDesignationsToCsv([
      {
        id: "x1",
        departmentId: "d1",
        departmentName: "Hifz",
        name: "Head of Hifz",
        status: "active",
        assignableRoles: [],
      },
      {
        id: "x2",
        departmentId: "d1",
        departmentName: "Hifz",
        name: "Hafiz Teacher",
        parentDesignationId: "x1",
        status: "inactive",
        assignableRoles: [],
      },
    ]);

    // Act
    const departments = parseFacultyDepartmentsCsv(departmentCsv);
    const designations = parseFacultyDesignationsCsv(designationCsv);

    // Assert
    expect(departmentCsv.split("\n")[0]).toBe('"name","description","status"');
    expect(departments[0]).toEqual({ name: "Hifz", description: "Memorisation", status: "active" });
    expect(designations[1]).toEqual({
      department: "Hifz",
      name: "Hafiz Teacher",
      parentDesignation: "Head of Hifz",
      status: "inactive",
    });
  });
});
