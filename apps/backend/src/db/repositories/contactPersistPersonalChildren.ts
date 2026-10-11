import { and, eq } from "drizzle-orm";
import { dedupeTrimmedIds, getContactTags, type Contact } from "@mms/shared";
import { contactTags, contactPhones, contactEmails, contactAddresses } from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";

type Transaction = TenantTransaction;

export async function syncContactPersonalChildrenTx(
  tx: Transaction,
  subdomain: string,
  contactId: string,
  contact: Contact,
): Promise<void> {
  await tx
    .delete(contactPhones)
    .where(
      and(eq(contactPhones.workspaceSubdomain, subdomain), eq(contactPhones.contactId, contactId)),
    );
  if (contact.phones && contact.phones.length > 0) {
    await tx.insert(contactPhones).values(
      contact.phones.map((p, idx) => ({
        id: `phone-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        number: p.number,
        label: p.label || "Main",
        countryCode: p.countryCode ?? null,
        isPrimary: p.isPrimary ?? idx === 0,
        whatsappStatus: p.whatsappStatus ?? null,
        sortOrder: idx,
      })),
    );
  }

  await tx
    .delete(contactTags)
    .where(
      and(eq(contactTags.workspaceSubdomain, subdomain), eq(contactTags.contactId, contactId)),
    );
  const tagsToSave = getContactTags(contact);
  if (tagsToSave.length > 0) {
    const validTags = dedupeTrimmedIds(tagsToSave);
    if (validTags.length > 0) {
      await tx.insert(contactTags).values(
        validTags.map((t, idx) => ({
          id: `tag-${idx + 1}`,
          workspaceSubdomain: subdomain,
          contactId,
          name: t,
        })),
      );
    }
  }

  await tx
    .delete(contactEmails)
    .where(
      and(eq(contactEmails.workspaceSubdomain, subdomain), eq(contactEmails.contactId, contactId)),
    );
  if (contact.emails && contact.emails.length > 0) {
    await tx.insert(contactEmails).values(
      contact.emails.map((e, idx) => ({
        id: `email-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        address: e.address,
        label: e.label || "Primary",
        isPrimary: e.isPrimary ?? idx === 0,
        isVerified: e.isVerified ?? false,
        sortOrder: idx,
      })),
    );
  }

  await tx
    .delete(contactAddresses)
    .where(
      and(
        eq(contactAddresses.workspaceSubdomain, subdomain),
        eq(contactAddresses.contactId, contactId),
      ),
    );
  if (contact.addresses && contact.addresses.length > 0) {
    await tx.insert(contactAddresses).values(
      contact.addresses.map((a, idx) => ({
        id: `addr-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        label: a.label ?? null,
        line1: a.line1 ?? null,
        city: a.city ?? null,
        state: a.state ?? null,
        country: a.country ?? null,
        isPrimary: a.isPrimary ?? idx === 0,
        sortOrder: idx,
      })),
    );
  }
}

export async function bulkInsertContactPersonalChildrenTx(
  tx: Transaction,
  subdomain: string,
  rawContacts: Contact[],
): Promise<void> {
  const allPhones = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.phones ?? []).map((p, idx) => ({
      id: `phone-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      number: p.number,
      label: p.label || "Main",
      countryCode: p.countryCode ?? null,
      isPrimary: p.isPrimary ?? idx === 0,
      whatsappStatus: p.whatsappStatus ?? null,
      sortOrder: idx,
    }));
  });
  if (allPhones.length > 0) await tx.insert(contactPhones).values(allPhones);

  const allTags: Array<{
    id: string;
    workspaceSubdomain: string;
    contactId: string;
    name: string;
  }> = [];
  for (let i = 0; i < rawContacts.length; i++) {
    const c = rawContacts[i];
    const contactId = String(c.id);
    const validTags = dedupeTrimmedIds(getContactTags(c));
    for (let idx = 0; idx < validTags.length; idx++) {
      allTags.push({
        id: `tag-${contactId}-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        name: validTags[idx],
      });
    }
  }
  if (allTags.length > 0) await tx.insert(contactTags).values(allTags);

  const allEmails = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.emails ?? []).map((e, idx) => ({
      id: `email-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      address: e.address,
      label: e.label || "Primary",
      isPrimary: e.isPrimary ?? idx === 0,
      isVerified: e.isVerified ?? false,
      sortOrder: idx,
    }));
  });
  if (allEmails.length > 0) await tx.insert(contactEmails).values(allEmails);

  const allAddresses = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.addresses ?? []).map((a, idx) => ({
      id: `addr-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      label: a.label ?? null,
      line1: a.line1 ?? null,
      city: a.city ?? null,
      state: a.state ?? null,
      country: a.country ?? null,
      isPrimary: a.isPrimary ?? idx === 0,
      sortOrder: idx,
    }));
  });
  if (allAddresses.length > 0) await tx.insert(contactAddresses).values(allAddresses);
}
