import {
  createContactLookupMap,
  hydrateFacultyFromContact,
  type Contact,
  type Faculty,
} from "@mms/shared";
import { loadContactsByIdsForTenant } from "../../services/contactService.js";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";

async function loadSupervisorNames(
  tenant: string,
  supervisorIds: Set<string>,
): Promise<Map<string, string>> {
  if (supervisorIds.size === 0) return new Map();
  try {
    const { findFacultyByIds } = await import("../../db/repositories/facultyRepository.js");
    const supervisors = await findFacultyByIds(tenant, [...supervisorIds]);
    const supContactIds = supervisors.map((s) => s.contactId).filter(Boolean);
    if (supContactIds.length === 0) return new Map();
    const supContacts = (await loadContactsByIdsForTenant(
      tenant,
      supContactIds as string[],
    )) as Contact[];
    const supContactMap = createContactLookupMap(supContacts as never);
    return new Map(
      supervisors
        .map((s) => hydrateFacultyFromContact(s, supContactMap as never))
        .map((s) => [String(s.id), s.name || s.employeeId || String(s.id)]),
    );
  } catch {
    // Non-blocking in decoupled unit tests
    return new Map();
  }
}

async function loadAssignableRolesByDesignation(
  tenant: string,
  needed: boolean,
): Promise<Map<string, string[]>> {
  if (!needed) return new Map();
  try {
    const definitions = await listFacultyDesignations(tenant, { limit: null });
    return new Map(definitions.map((d) => [d.id, d.assignableRoles]));
  } catch {
    return new Map();
  }
}

/**
 * Single-pass hydrate: loads the linked contacts through the contacts composition
 * root (never raw Drizzle) and fills display profile fields on the faculty rows.
 * Designation / department display fields are already projected from
 * `faculty.designation_id` by the repository; this step adds supervisor names and
 * the roles the current designation permits for a linked user account.
 */
export async function hydrateFacultyFromContacts(
  tenant: string,
  rows: Faculty[],
): Promise<Faculty[]> {
  if (rows.length === 0) return [];

  const ids = new Set<string>();
  const supervisorIds = new Set<string>();
  let hasDesignation = false;
  for (const row of rows) {
    if (row.contactId != null && row.contactId !== "") ids.add(String(row.contactId));
    if (row.reportingFacultyId != null && String(row.reportingFacultyId).trim() !== "") {
      supervisorIds.add(String(row.reportingFacultyId).trim());
    }
    if (row.designationId) hasDesignation = true;
  }

  let contactMap = new Map();
  if (ids.size > 0) {
    const contacts = (await loadContactsByIdsForTenant(tenant, [...ids])) as Contact[];
    contactMap = createContactLookupMap(contacts as never);
  }
  const [supervisorNameMap, rolesByDesignation] = await Promise.all([
    loadSupervisorNames(tenant, supervisorIds),
    loadAssignableRolesByDesignation(tenant, hasDesignation),
  ]);

  return rows.map((row) => {
    const hydrated = hydrateFacultyFromContact(row, contactMap as never);
    if (hydrated.designationId) {
      hydrated.designationAssignableRoles = rolesByDesignation.get(hydrated.designationId) ?? [];
    }
    if (hydrated.reportingFacultyId && supervisorNameMap.has(String(hydrated.reportingFacultyId))) {
      hydrated.reportingFacultyName = supervisorNameMap.get(String(hydrated.reportingFacultyId));
    }
    return hydrated;
  });
}
