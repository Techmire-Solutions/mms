import type {
  ContactActivity,
  ContactAttachment,
  ContactBankDetail,
  ContactEducation,
  ContactExperience,
  ContactSkill,
  RelationshipContact,
} from "./contactEntityTypes.js";
import { parseBool, splitList, type ParseContactsRowContext } from "./contactsCsvRowParserTypes.js";

export * from "./contactsCsvRowParserTypes.js";
export * from "./contactsCsvRowParsersPersonal.js";

export function buildEducation(ctx: ParseContactsRowContext): ContactEducation[] {
  const insts = splitList(ctx.getVal("education_institution"));
  const degs = splitList(ctx.getVal("education_degree"));
  const fields = splitList(ctx.getVal("education_fieldOfStudy"));
  const years = splitList(ctx.getVal("education_year"));
  const grades = splitList(ctx.getVal("education_grade"));
  const enrolleds = splitList(ctx.getVal("education_isCurrentlyEnrolled"));
  const labels = splitList(ctx.getVal("education_label"));
  const count = Math.max(insts.length, degs.length);

  return Array.from({ length: count }, (_, i) => ({
    institution: insts[i] || "",
    degree: degs[i] || "",
    fieldOfStudy: fields[i] || "",
    year: years[i] || "",
    grade: grades[i] || "",
    ...(enrolleds[i] ? { isCurrentlyEnrolled: parseBool(enrolleds[i]) } : {}),
    ...(labels[i] ? { label: labels[i] } : {}),
  }));
}

export function buildExperience(ctx: ParseContactsRowContext): ContactExperience[] {
  const titles = splitList(ctx.getVal("experience_title"));
  const orgs = splitList(ctx.getVal("experience_organization"));
  const types = splitList(ctx.getVal("experience_employmentType"));
  const locs = splitList(ctx.getVal("experience_location"));
  const starts = splitList(ctx.getVal("experience_startDate"));
  const ends = splitList(ctx.getVal("experience_endDate"));
  const currents = splitList(ctx.getVal("experience_isCurrent"));
  const descs = splitList(ctx.getVal("experience_description"));
  const labels = splitList(ctx.getVal("experience_label"));
  const count = Math.max(titles.length, orgs.length);

  return Array.from({ length: count }, (_, i) => ({
    title: titles[i] || "",
    organization: orgs[i] || "",
    employmentType: types[i] || undefined,
    location: locs[i] || undefined,
    startDate: starts[i] || undefined,
    endDate: ends[i] || undefined,
    isCurrent: parseBool(currents[i]),
    description: descs[i] || undefined,
    ...(labels[i] ? { label: labels[i] } : {}),
  }));
}

export function buildSkills(ctx: ParseContactsRowContext): ContactSkill[] {
  const names = splitList(ctx.getVal("skills_name"));
  const cats = splitList(ctx.getVal("skills_category"));
  const profs = splitList(ctx.getVal("skills_proficiency"));
  const years = splitList(ctx.getVal("skills_yearsOfExperience"));
  const certs = splitList(ctx.getVal("skills_isCertified"));
  const issuers = splitList(ctx.getVal("skills_issuer"));
  const descs = splitList(ctx.getVal("skills_description"));
  const labels = splitList(ctx.getVal("skills_label"));

  return names.map((name, i) => ({
    name,
    category: cats[i] || undefined,
    proficiency: profs[i] || undefined,
    yearsOfExperience: years[i] || undefined,
    isCertified: parseBool(certs[i]),
    issuer: issuers[i] || undefined,
    description: descs[i] || undefined,
    ...(labels[i] ? { label: labels[i] } : {}),
  }));
}

export function buildRelationships(ctx: ParseContactsRowContext): RelationshipContact[] {
  const names = splitList(ctx.getVal("relationship_contact"));
  const types = splitList(ctx.getVal("relationship_type"));
  const phones = splitList(ctx.getVal("relationship_phone"));
  const emails = splitList(ctx.getVal("relationship_email"));
  const genders = splitList(ctx.getVal("relationship_gender"));
  const ids = splitList(ctx.getVal("relationship_contactId"));
  const inferreds = splitList(ctx.getVal("relationship_inferred"));
  const count = Math.max(names.length, types.length, ids.length);

  return Array.from({ length: count }, (_, i) => ({
    name: names[i] || "",
    relationship: types[i] || "",
    phone: phones[i] || undefined,
    email: emails[i] || undefined,
    gender: genders[i] || undefined,
    contactId: ids[i] || undefined,
    ...(inferreds[i] ? { inferred: parseBool(inferreds[i]) } : {}),
  }));
}

export function buildBankDetails(ctx: ParseContactsRowContext): ContactBankDetail[] {
  const names = splitList(ctx.getVal("bank_name"));
  const titles = splitList(ctx.getVal("bank_accountTitle"));
  const nums = splitList(ctx.getVal("bank_accountNumber"));
  const count = Math.max(names.length, nums.length, titles.length);

  return Array.from({ length: count }, (_, i) => ({
    bankName: names[i] || null,
    accountTitle: titles[i] || null,
    accountNumber: nums[i] || null,
  }));
}

export function buildActivities(ctx: ParseContactsRowContext): ContactActivity[] {
  const types = splitList(ctx.getVal("activity_type"));
  const contents = splitList(ctx.getVal("activity_content"));
  const dates = splitList(ctx.getVal("activity_date"));
  const bys = splitList(ctx.getVal("activity_by"));
  const count = Math.max(types.length, contents.length);

  return Array.from({ length: count }, (_, i) => ({
    id: `act_${i + 1}`,
    type: (types[i] as ContactActivity["type"]) || "note",
    content: contents[i] || "",
    date: dates[i] || new Date().toISOString(),
    by: bys[i] || undefined,
  }));
}

export function buildAttachments(ctx: ParseContactsRowContext): ContactAttachment[] {
  const names = splitList(ctx.getVal("attachment_name"));
  const types = splitList(ctx.getVal("attachment_type"));
  const sizes = splitList(ctx.getVal("attachment_size"));
  const urls = splitList(ctx.getVal("attachment_url"));
  const dates = splitList(ctx.getVal("attachment_date"));
  const count = Math.max(names.length, urls.length);

  return Array.from({ length: count }, (_, i) => ({
    id: `att_${i + 1}`,
    name: names[i] || "attachment",
    type: types[i] || "application/octet-stream",
    size: parseInt(sizes[i] || "0", 10) || 0,
    url: urls[i] || "",
    date: dates[i] || new Date().toISOString(),
  }));
}
