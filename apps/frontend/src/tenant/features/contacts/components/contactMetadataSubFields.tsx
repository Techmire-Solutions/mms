import React from "react";
import type { AppTranslationKey, Contact } from "@mms/shared";
import { Badge } from "@/components/ui/badge";

export function renderEducationSubField(
  colId: string,
  contact: Contact,
  renderJoinedList: (items: (string | undefined | null)[], showTitle?: boolean) => React.ReactNode,
): React.ReactNode | null {
  switch (colId) {
    case "education_degree":
    case "educationDegree":
      return renderJoinedList(
        (contact.education || []).map((e) => e.degree?.trim()).filter(Boolean),
        true,
      );
    case "education_institution":
    case "educationInstitution":
      return renderJoinedList(
        (contact.education || []).map((e) => e.institution?.trim()).filter(Boolean),
        true,
      );
    case "education_fieldOfStudy":
    case "educationFieldOfStudy":
      return renderJoinedList(
        (contact.education || []).map((e) => e.fieldOfStudy?.trim()).filter(Boolean),
        true,
      );
    case "education_year":
    case "educationYear":
      return renderJoinedList(
        (contact.education || []).map((e) => e.year?.trim()).filter(Boolean),
        true,
      );
    case "education_grade":
    case "educationGrade":
      return renderJoinedList(
        (contact.education || []).map((e) => e.grade?.trim()).filter(Boolean),
        true,
      );
    default:
      return null;
  }
}

export function renderExperienceSubField(
  colId: string,
  contact: Contact,
  renderJoinedList: (items: (string | undefined | null)[], showTitle?: boolean) => React.ReactNode,
): React.ReactNode | null {
  switch (colId) {
    case "experience_title":
    case "experienceTitle":
      return renderJoinedList(
        (contact.experience || []).map((e) => e.title?.trim()).filter(Boolean),
        true,
      );
    case "experience_organization":
    case "experienceOrganization":
      return renderJoinedList(
        (contact.experience || []).map((e) => e.organization?.trim()).filter(Boolean),
        true,
      );
    case "experience_employmentType":
    case "experienceEmploymentType":
      return renderJoinedList(
        (contact.experience || []).map((e) => e.employmentType?.trim()).filter(Boolean),
        true,
      );
    case "experience_location":
    case "experienceLocation":
      return renderJoinedList(
        (contact.experience || []).map((e) => e.location?.trim()).filter(Boolean),
        true,
      );
    default:
      return null;
  }
}

export function renderSkillsSubField({
  colId,
  contact,
  renderJoinedList,
  emptyNode,
  t,
}: {
  colId: string;
  contact: Contact;
  renderJoinedList: (items: (string | undefined | null)[], showTitle?: boolean) => React.ReactNode;
  emptyNode: React.ReactNode;
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}): React.ReactNode | null {
  switch (colId) {
    case "skills_name":
    case "skillsName":
      return renderJoinedList(
        (contact.skills || []).map((s) => s.name?.trim()).filter(Boolean),
        true,
      );
    case "skills_category":
    case "skillsCategory":
      return renderJoinedList(
        (contact.skills || []).map((s) => s.category?.trim()).filter(Boolean),
        true,
      );
    case "skills_proficiency":
    case "skillsProficiency":
      return renderJoinedList(
        (contact.skills || []).map((s) => s.proficiency?.trim()).filter(Boolean),
        true,
      );
    case "skills_yearsOfExperience":
    case "skillsYearsOfExperience":
      return renderJoinedList(
        (contact.skills || []).map((s) => s.yearsOfExperience?.trim()).filter(Boolean),
        true,
      );
    case "skills_isCertified":
    case "skillsIsCertified": {
      const certified = (contact.skills || []).some((s) => s.isCertified);
      return certified ? (
        <Badge tone="success" className="px-2 py-0.5 text-xs font-medium">
          {t("contacts.columns.skillsIsCertified")}
        </Badge>
      ) : (
        emptyNode
      );
    }
    case "skills_issuer":
    case "skillsIssuer":
      return renderJoinedList(
        (contact.skills || []).map((s) => s.issuer?.trim()).filter(Boolean),
        true,
      );
    default:
      return null;
  }
}
