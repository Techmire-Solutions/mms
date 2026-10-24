import { sql } from "drizzle-orm";
import type {
  ContactChildMaps,
  SocialRow,
  EducationRow,
  ExperienceRow,
  SkillRow,
} from "./contactRepositoryHydrateTypes.js";

export function buildSocialsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', s.id,
      'contactId', s.contact_id,
      'workspaceSubdomain', s.workspace_subdomain,
      'platform', s.platform,
      'url', s.url,
      'sortOrder', s.sort_order,
      'createdAt', s.created_at
    ) ORDER BY s.sort_order)
    FROM contact_socials s
    WHERE s.contact_id = c.id AND s.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS socials`;
}

export function buildEducationsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', ed.id,
      'contactId', ed.contact_id,
      'workspaceSubdomain', ed.workspace_subdomain,
      'institution', ed.institution,
      'degree', ed.degree,
      'fieldOfStudy', ed.field_of_study,
      'year', ed.year,
      'grade', ed.grade,
      'label', ed.label,
      'sortOrder', ed.sort_order,
      'createdAt', ed.created_at
    ) ORDER BY ed.sort_order)
    FROM contact_educations ed
    WHERE ed.contact_id = c.id AND ed.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS educations`;
}

export function buildExperiencesAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', ex.id,
      'contactId', ex.contact_id,
      'workspaceSubdomain', ex.workspace_subdomain,
      'title', ex.title,
      'organization', ex.organization,
      'employmentType', ex.employment_type,
      'location', ex.location,
      'startDate', ex.start_date,
      'endDate', ex.end_date,
      'isCurrent', ex.is_current,
      'description', ex.description,
      'sortOrder', ex.sort_order,
      'createdAt', ex.created_at
    ) ORDER BY ex.sort_order)
    FROM contact_experiences ex
    WHERE ex.contact_id = c.id AND ex.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS experiences`;
}

export function buildSkillsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', sk.id,
      'contactId', sk.contact_id,
      'workspaceSubdomain', sk.workspace_subdomain,
      'name', sk.name,
      'category', sk.category,
      'proficiency', sk.proficiency,
      'yearsOfExperience', sk.years_of_experience,
      'isCertified', sk.is_certified,
      'issuer', sk.issuer,
      'description', sk.description,
      'sortOrder', sk.sort_order,
      'createdAt', sk.created_at
    ) ORDER BY sk.sort_order)
    FROM contact_skills sk
    WHERE sk.contact_id = c.id AND sk.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS skills`;
}

export function assignProfessionalChildRows(
  result: ContactChildMaps,
  contactId: string,
  row: Record<string, unknown>,
) {
  if (Array.isArray(row.socials)) result.socialsMap.set(contactId, row.socials as SocialRow[]);
  if (Array.isArray(row.educations))
    result.educationsMap.set(contactId, row.educations as EducationRow[]);
  if (Array.isArray(row.experiences))
    result.experiencesMap.set(contactId, row.experiences as ExperienceRow[]);
  if (Array.isArray(row.skills)) result.skillsMap.set(contactId, row.skills as SkillRow[]);
}
