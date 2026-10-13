import {
  getPrimaryAddress,
  hasWhatsApp,
  isRelationshipContactColumnKey,
  isRelationshipTypeColumnKey,
  type Contact,
} from "@mms/shared";

/** Whether a card metadata column has renderable data for the contact. */
export function hasContactCardColumnData(contact: Contact, colId: string): boolean {
  switch (colId) {
    case "dob":
    case "solarDob":
    case "lunarDob":
      return Boolean(contact.dob);
    case "whatsapp":
      return hasWhatsApp(contact);
    case "gender":
      return Boolean(contact.gender);
    case "isSyed":
      return contact.isSyed !== undefined && contact.isSyed !== null;
    case "socials_platform":
      return Boolean(
        contact.socials && contact.socials.some((s) => s.platform && s.platform.trim().length > 0),
      );
    case "socials_url":
      return Boolean(
        contact.socials && contact.socials.some((s) => s.url && s.url.trim().length > 0),
      );
    case "cnic":
      return Boolean(contact.cnic && contact.cnic.trim().length > 0);
    case "tag":
    case "tags":
      return Boolean(
        (contact.tags && contact.tags.length > 0) || (contact.tag && contact.tag.trim().length > 0),
      );
    case "notes":
      return Boolean(contact.notes && contact.notes.trim().length > 0);
    case "education":
      return Boolean(
        contact.education &&
        contact.education.some((e) => e.institution?.trim() || e.degree?.trim()),
      );
    case "education_degree":
    case "educationDegree":
      return Boolean(contact.education && contact.education.some((e) => e.degree?.trim()));
    case "education_institution":
    case "educationInstitution":
      return Boolean(contact.education && contact.education.some((e) => e.institution?.trim()));
    case "education_fieldOfStudy":
    case "educationFieldOfStudy":
      return Boolean(contact.education && contact.education.some((e) => e.fieldOfStudy?.trim()));
    case "education_year":
    case "educationYear":
      return Boolean(contact.education && contact.education.some((e) => e.year?.trim()));
    case "education_grade":
    case "educationGrade":
      return Boolean(contact.education && contact.education.some((e) => e.grade?.trim()));
    case "experience":
      return Boolean(
        contact.experience &&
        contact.experience.some((e) => e.organization?.trim() || e.title?.trim()),
      );
    case "experience_title":
    case "experienceTitle":
      return Boolean(contact.experience && contact.experience.some((e) => e.title?.trim()));
    case "experience_organization":
    case "experienceOrganization":
      return Boolean(contact.experience && contact.experience.some((e) => e.organization?.trim()));
    case "experience_employmentType":
    case "experienceEmploymentType":
      return Boolean(
        contact.experience && contact.experience.some((e) => e.employmentType?.trim()),
      );
    case "experience_location":
    case "experienceLocation":
      return Boolean(contact.experience && contact.experience.some((e) => e.location?.trim()));
    case "skills":
      return Boolean(contact.skills && contact.skills.some((s) => s.name?.trim()));
    case "skills_name":
    case "skillsName":
      return Boolean(contact.skills && contact.skills.some((s) => s.name?.trim()));
    case "skills_category":
    case "skillsCategory":
      return Boolean(contact.skills && contact.skills.some((s) => s.category?.trim()));
    case "skills_proficiency":
    case "skillsProficiency":
      return Boolean(contact.skills && contact.skills.some((s) => s.proficiency?.trim()));
    case "skills_yearsOfExperience":
    case "skillsYearsOfExperience":
      return Boolean(contact.skills && contact.skills.some((s) => s.yearsOfExperience?.trim()));
    case "skills_isCertified":
    case "skillsIsCertified":
      return Boolean(contact.skills && contact.skills.some((s) => s.isCertified));
    case "skills_issuer":
    case "skillsIssuer":
      return Boolean(contact.skills && contact.skills.some((s) => s.issuer?.trim()));
    case "line1":
    case "city":
    case "state":
    case "country": {
      const scalar = contact[colId as keyof Contact];
      if (scalar !== undefined && scalar !== null && String(scalar).trim().length > 0) return true;
      const addr = getPrimaryAddress(contact);
      if (!addr) return false;
      const addrVal = addr[colId as keyof typeof addr];
      return addrVal !== undefined && addrVal !== null && String(addrVal).trim().length > 0;
    }
    default: {
      if (isRelationshipContactColumnKey(colId)) {
        return Boolean(
          contact.relationshipContacts &&
          contact.relationshipContacts.some(
            (link) => (link.name && link.name.trim().length > 0) || link.contactId,
          ),
        );
      }
      if (isRelationshipTypeColumnKey(colId)) {
        return Boolean(
          contact.relationshipContacts &&
          contact.relationshipContacts.some(
            (link) => link.relationship && link.relationship.trim().length > 0,
          ),
        );
      }
      const val = contact[colId as keyof Contact];
      if (typeof val === "boolean") return true;
      if (typeof val === "number") return true;
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && String(val).trim().length > 0;
    }
  }
}
