import { sql } from "drizzle-orm";
import { withTenantRead } from "../../db/tenant-context.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";

export interface ContactLinkResolution {
  /** Tenant user already registered for this contact (by contact link or login email), if any. */
  userId: string | null;
}

export interface DesignationLinkResolution {
  departmentId: string;
}

/**
 * Contact ID guard (Faculty Management model): the contact must be live, carry at
 * least one email, that email must not belong to another faculty profile, and any
 * registered user account must belong to the same contact.
 */
export async function validateFacultyContactLink(
  tenant: string,
  contactId: string,
  excludeFacultyId?: string,
): Promise<ContactLinkResolution> {
  const subdomain = tenant.trim().toLowerCase();
  const excludeId = excludeFacultyId ?? "";
  return withTenantRead(subdomain, async (tx) => {
    const contact = await tx.execute<{ id: string }>(sql`
      SELECT id FROM contacts WHERE workspace_subdomain = ${subdomain} AND id = ${contactId} AND deleted_at IS NULL LIMIT 1
    `);
    if (!contact.rows.length) throw new ValidationError("Linked contact not found");

    const emails = await tx.execute<{ address: string }>(sql`
      SELECT DISTINCT lower(btrim(address)) AS address FROM contact_emails
      WHERE workspace_subdomain = ${subdomain} AND contact_id = ${contactId} AND btrim(address) <> ''
    `);
    const addresses = emails.rows.map((row) => row.address);
    if (addresses.length === 0)
      throw new ValidationError("The linked contact must have an email address");

    const addressList = sql.join(
      addresses.map((address) => sql`${address}`),
      sql`, `,
    );

    const duplicateEmail = await tx.execute<{ id: string }>(sql`
      SELECT f.id FROM faculty f
      JOIN faculty_employments fe
        ON fe.workspace_subdomain = f.workspace_subdomain
       AND fe.id = f.employment_id
       AND fe.deleted_at IS NULL
      JOIN contact_emails e
        ON e.workspace_subdomain = fe.workspace_subdomain
       AND e.contact_id = fe.contact_id
      WHERE f.workspace_subdomain = ${subdomain}
        AND f.deleted_at IS NULL
        AND f.id <> ${excludeId}
        AND fe.contact_id <> ${contactId}
        AND lower(btrim(e.address)) IN (${addressList})
      LIMIT 1
    `);
    if (duplicateEmail.rows.length) {
      throw new ConflictError("Another faculty profile already uses this contact email");
    }

    const users = await tx.execute<{ id: string; contact_id: string | null }>(sql`
      SELECT id, contact_id FROM tenant_users
      WHERE workspace_subdomain = ${subdomain} AND deleted_at IS NULL
        AND (contact_id = ${contactId} OR lower(btrim(login_email)) IN (${addressList}))
      ORDER BY (contact_id = ${contactId}) DESC
      LIMIT 2
    `);
    const mismatched = users.rows.find((row) => row.contact_id && row.contact_id !== contactId);
    if (mismatched) {
      throw new ConflictError(
        "The contact email is registered to a user account linked to a different contact",
      );
    }
    const user = users.rows[0] ?? null;
    if (user) {
      const otherFaculty = await tx.execute<{ id: string }>(sql`
        SELECT id FROM faculty WHERE workspace_subdomain = ${subdomain} AND deleted_at IS NULL
          AND user_id = ${user.id} AND id <> ${excludeId} LIMIT 1
      `);
      if (otherFaculty.rows.length) {
        throw new ConflictError(
          "The registered user account is already linked to another faculty profile",
        );
      }
    }
    return { userId: user?.id ?? null };
  });
}

/** Designation ID guard: must be a live, active designation; returns its department. */
export async function validateFacultyDesignationLink(
  tenant: string,
  designationId: string,
): Promise<DesignationLinkResolution> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx.execute<{ department_id: string | null; status: string }>(sql`
      SELECT department_id, status FROM faculty_designations
      WHERE workspace_subdomain = ${subdomain} AND id = ${designationId} AND deleted_at IS NULL LIMIT 1
    `);
    const designation = rows.rows[0];
    if (!designation) throw new ValidationError("Selected designation not found");
    if (designation.status !== "active")
      throw new ValidationError("Selected designation is inactive");
    if (!designation.department_id)
      throw new ValidationError("Selected designation must belong to a department");
    return { departmentId: designation.department_id };
  });
}
