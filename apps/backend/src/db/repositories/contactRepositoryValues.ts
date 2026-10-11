import type { Contact } from "@mms/shared";
import type { contacts } from "../schema.js";

import { mapAuditToInsert } from "./repositoryMappers.js";

export type ContactInsert = typeof contacts.$inferInsert;

export function contactWriteValues(subdomain: string, contact: Contact): ContactInsert {
  const fullName =
    contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unnamed";
  const audit = mapAuditToInsert(contact);
  return {
    id: String(contact.id),
    workspaceSubdomain: subdomain,
    firstName: contact.firstName || fullName,
    lastName: contact.lastName ?? null,
    name: fullName,
    gender: contact.gender ?? null,
    dob: contact.dob ? String(contact.dob).trim() || null : null,
    cnic: contact.cnic ?? null,
    isSyed: contact.isSyed ?? false,
    avatar: contact.avatar ?? null,
    notes: contact.notes ?? null,
    whatsappStatus: contact.whatsappStatus ?? "unknown",
    lastCheckedAt: contact.lastCheckedAt ? new Date(contact.lastCheckedAt) : null,
    aiSummary: contact.aiSummary ?? null,
    ...audit,
    createdAt: audit.createdAt ?? new Date(),
  } satisfies ContactInsert;
}

export function contactUpdateSetValues(subdomain: string, contact: Contact) {
  const {
    id: _id,
    workspaceSubdomain: _subdomain,
    createdAt: _createdAt,
    createdBy: _createdBy,
    ...setFields
  } = contactWriteValues(subdomain, contact);
  return setFields;
}
