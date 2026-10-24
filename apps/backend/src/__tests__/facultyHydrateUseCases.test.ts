import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadContacts: vi.fn(),
  listDesignations: vi.fn(),
}));

vi.mock("../services/contactService.js", () => ({
  loadContactsByIdsForTenant: mocks.loadContacts,
}));

vi.mock("../db/repositories/facultyDesignationRepository.js", () => ({
  listFacultyDesignations: mocks.listDesignations,
}));

import { hydrateFacultyFromContacts } from "../faculty/use-cases/facultyHydrateUseCases.js";

describe("hydrateFacultyFromContacts designation roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadContacts.mockResolvedValue([]);
    mocks.listDesignations.mockResolvedValue([]);
  });

  it("given a faculty row with a designation, should attach the roles that designation permits", async () => {
    // Arrange
    mocks.listDesignations.mockResolvedValue([
      {
        id: "hod",
        name: "Head of Department",
        departmentId: "dept-1",
        assignableRoles: ["teacher", "department_manager"],
      },
      { id: "lect", name: "Lecturer", departmentId: "dept-1", assignableRoles: ["teacher"] },
    ]);

    // Act
    const [faculty] = await hydrateFacultyFromContacts("demo", [
      {
        id: "fac-1",
        contactId: "contact-1",
        status: "active",
        designationId: "hod",
        designation: "Head of Department",
        department: "Islamic Studies",
        departmentId: "dept-1",
      },
    ]);

    // Assert — repository projection is preserved; roles are layered on top
    expect(faculty).toMatchObject({
      designation: "Head of Department",
      designationId: "hod",
      department: "Islamic Studies",
      departmentId: "dept-1",
      designationAssignableRoles: ["teacher", "department_manager"],
    });
    expect(mocks.listDesignations).toHaveBeenCalledWith("demo", { limit: null });
  });

  it("given no faculty row carries a designation, should not load the designation catalog", async () => {
    // Act
    const [faculty] = await hydrateFacultyFromContacts("demo", [
      { id: "fac-2", contactId: "", status: "inactive" },
    ]);

    // Assert
    expect(faculty.designationAssignableRoles).toBeUndefined();
    expect(mocks.listDesignations).not.toHaveBeenCalled();
  });
});
