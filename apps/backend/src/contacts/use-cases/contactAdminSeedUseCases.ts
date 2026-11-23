import { randomUUID } from "node:crypto";
import type { Contact } from "@mms/shared";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";
import { prepareContactRecord } from "./contactValidationUseCases.js";
import { auditContactPersisted } from "./contactWriteAudit.js";

export interface CreateAdminFirstContactInput {
  subdomain: string;
  name: string;
  email: string;
  phone?: string;
  /** Tenant contact gender value (`male`/`female`, matching the contacts lookups). */
  gender?: string;
  actorId?: string;
}

/**
 * Seeds the provisioning admin's own contact as the workspace's first contact.
 *
 * Runs inside the caller's tenant scope (workspace onboarding) and returns the new
 * contact id so `tenant_users.contact_id` can link the admin profile to it. The write
 * goes through the canonical contact seam — `prepareContactRecord` (title case, E.164
 * phone normalization, scalar sync) + repository save + collection audit — instead of
 * hand-inserted rows, so the first contact behaves like every UI-created contact.
 */
export async function createAdminFirstContact(
  input: CreateAdminFirstContactInput,
): Promise<string> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim();
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.length > 0 ? rest.join(" ") : undefined;

  const contact: Contact = {
    id: randomUUID(),
    name,
    firstName: firstName || name,
    ...(lastName ? { lastName } : {}),
    // Scalar phone is expanded by `prepareContactRecord` into a normalized
    // `phones` row using the tenant's default label and dial code.
    ...(phone ? { phone } : {}),
    ...(input.gender?.trim() ? { gender: input.gender.trim() } : {}),
    email,
    emails: [{ label: "Primary", address: email, isPrimary: true }],
  };

  const prepared = await prepareContactRecord(contact);
  await contactsRepository.save(input.subdomain, prepared);
  await auditContactPersisted({
    tenant: input.subdomain,
    contactId: String(prepared.id),
    actorId: input.actorId,
    created: true,
    restored: false,
  });

  return String(prepared.id);
}
