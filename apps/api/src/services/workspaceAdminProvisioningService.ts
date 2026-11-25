import { listWorkspaceSuperAdminIds } from "./workspaceService.js";
import { createAdminFirstContact } from "@mms/mod-contacts/backend/services";
import { createUser, type PublicUser } from "./auth/userService.js";

export interface ProvisionWorkspaceAdminInput {
  subdomain: string;
  /** Tenant admin login email (stored lower-cased by `createUser`). */
  email: string;
  adminName: string;
  password: string;
  /** Optional phone captured during onboarding; seeds the admin's contact record. */
  adminPhone?: string;
  /** Gender collected by the platform wizard; stored on the linked first contact. */
  adminGender?: "male" | "female";
  /** Caller already validated a generated fallback password (force-reset on login). */
  passwordPolicyChecked?: boolean;
}

/**
 * Provisions the workspace administrator for the `super_admin` role as the tenant's
 * ONLY super admin and links him to the workspace's first contact.
 *
 * Caller MUST bind tenant scope (`runWithTenant`) first. No platform user is ever
 * mirrored into the tenant — the provisioned admin is the apex tenant identity.
 * The invariant is verified after the write and fails closed: a tenant must never end
 * up with a second (or a missing) super admin, so onboarding cannot report success.
 */
export async function provisionWorkspaceAdmin(
  input: ProvisionWorkspaceAdminInput,
): Promise<PublicUser> {
  const subdomain = input.subdomain.trim().toLowerCase();

  const contactId = await createAdminFirstContact({
    subdomain,
    name: input.adminName,
    email: input.email,
    phone: input.adminPhone,
    gender: input.adminGender,
  });

  const user = await createUser(
    input.email,
    input.adminName,
    input.password,
    "super_admin",
    subdomain,
    {
      mustChangePassword: true,
      passwordPolicyChecked: input.passwordPolicyChecked,
      contactId,
    },
  );

  // Fail closed: the provisioned admin must be the tenant's one and only super admin.
  const superAdminIds = await listWorkspaceSuperAdminIds(subdomain);
  if (superAdminIds.length !== 1 || superAdminIds[0] !== String(user.id)) {
    throw Object.assign(
      new Error(
        "Tenant provisioning failed: super-admin invariant violated — the provisioned admin must be the only super admin of this workspace.",
      ),
      { statusCode: 500 },
    );
  }

  return user;
}
