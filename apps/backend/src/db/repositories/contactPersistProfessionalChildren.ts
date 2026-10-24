import { and, eq } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import { contactSocials, contactEducations, contactExperiences, contactSkills } from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { requireDbDate } from "../../lib/dbDate.js";

type Transaction = TenantTransaction;

export async function syncContactProfessionalChildrenTx(
  tx: Transaction,
  subdomain: string,
  contactId: string,
  contact: Contact,
): Promise<void> {
  await tx
    .delete(contactSocials)
    .where(
      and(
        eq(contactSocials.workspaceSubdomain, subdomain),
        eq(contactSocials.contactId, contactId),
      ),
    );
  if (contact.socials && contact.socials.length > 0) {
    await tx.insert(contactSocials).values(
      contact.socials.map((s, idx) => ({
        id: `soc-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        platform: s.platform,
        url: s.url,
        sortOrder: idx,
      })),
    );
  }

  await tx
    .delete(contactEducations)
    .where(
      and(
        eq(contactEducations.workspaceSubdomain, subdomain),
        eq(contactEducations.contactId, contactId),
      ),
    );
  if (contact.education && contact.education.length > 0) {
    await tx.insert(contactEducations).values(
      contact.education.map((e, idx) => ({
        id: e.id || `edu-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        degree: e.degree ?? null,
        institution: e.institution,
        fieldOfStudy: e.fieldOfStudy ?? null,
        year: e.year ?? null,
        grade: e.grade ?? null,
        label: e.label ?? null,
        sortOrder: e.sortOrder ?? idx,
      })),
    );
  }

  await tx
    .delete(contactExperiences)
    .where(
      and(
        eq(contactExperiences.workspaceSubdomain, subdomain),
        eq(contactExperiences.contactId, contactId),
      ),
    );
  if (contact.experience && contact.experience.length > 0) {
    await tx.insert(contactExperiences).values(
      contact.experience.map((exp, idx) => ({
        id: exp.id || `exp-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        title: exp.title,
        organization: exp.organization,
        employmentType: exp.employmentType ?? null,
        location: exp.location ?? null,
        startDate: requireDbDate(exp.startDate, "startDate"),
        endDate: requireDbDate(exp.endDate, "endDate"),
        isCurrent: exp.isCurrent ?? false,
        description: exp.description ?? null,
        sortOrder: exp.sortOrder ?? idx,
      })),
    );
  }

  await tx
    .delete(contactSkills)
    .where(
      and(eq(contactSkills.workspaceSubdomain, subdomain), eq(contactSkills.contactId, contactId)),
    );
  if (contact.skills && contact.skills.length > 0) {
    await tx.insert(contactSkills).values(
      contact.skills.map((s, idx) => ({
        id: s.id || `skl-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        name: s.name,
        category: s.category ?? null,
        proficiency: s.proficiency ?? null,
        yearsOfExperience: s.yearsOfExperience ?? null,
        isCertified: s.isCertified ?? false,
        issuer: s.issuer ?? null,
        description: s.description ?? null,
        sortOrder: s.sortOrder ?? idx,
      })),
    );
  }
}

export async function bulkInsertContactProfessionalChildrenTx(
  tx: Transaction,
  subdomain: string,
  rawContacts: Contact[],
): Promise<void> {
  const allSocials = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.socials ?? []).map((s, idx) => ({
      id: `soc-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      platform: s.platform,
      url: s.url,
      sortOrder: idx,
    }));
  });
  if (allSocials.length > 0) await tx.insert(contactSocials).values(allSocials);

  const allEducations = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.education ?? []).map((e, idx) => ({
      id: e.id || `edu-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      degree: e.degree ?? null,
      institution: e.institution,
      fieldOfStudy: e.fieldOfStudy ?? null,
      year: e.year ?? null,
      grade: e.grade ?? null,
      label: e.label ?? null,
      sortOrder: e.sortOrder ?? idx,
    }));
  });
  if (allEducations.length > 0) await tx.insert(contactEducations).values(allEducations);

  const allExperiences = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.experience ?? []).map((exp, idx) => ({
      id: exp.id || `exp-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      title: exp.title,
      organization: exp.organization,
      employmentType: exp.employmentType ?? null,
      location: exp.location ?? null,
      startDate: requireDbDate(exp.startDate, "startDate"),
      endDate: requireDbDate(exp.endDate, "endDate"),
      isCurrent: exp.isCurrent ?? false,
      description: exp.description ?? null,
      sortOrder: exp.sortOrder ?? idx,
    }));
  });
  if (allExperiences.length > 0) await tx.insert(contactExperiences).values(allExperiences);

  const allSkills = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.skills ?? []).map((s, idx) => ({
      id: s.id || `skl-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      name: s.name,
      category: s.category ?? null,
      proficiency: s.proficiency ?? null,
      yearsOfExperience: s.yearsOfExperience ?? null,
      isCertified: s.isCertified ?? false,
      issuer: s.issuer ?? null,
      description: s.description ?? null,
      sortOrder: s.sortOrder ?? idx,
    }));
  });
  if (allSkills.length > 0) await tx.insert(contactSkills).values(allSkills);
}
