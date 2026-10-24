import { ALL_CONTACT_FORM_EXPORT_COLUMNS } from "./contactExportColumns.js";

export function normalizeHeaderKey(raw: string): string {
  let clean = raw.trim().toLowerCase();
  clean = clean.replace(/^contacts?\.(columns?|fields?)\./i, "");
  clean = clean.replace(/^(columns?|fields?)\./i, "");
  const norm = clean.replace(/[^a-z0-9]/g, "");
  return norm.replace(/^contacts?(columns?|fields?)/i, "");
}

const BASE_HEADER_ALIASES: Record<string, string[]> = {
  id: ["id", "contactid", "uuid", "recordid"],
  name: ["name", "fullname", "full_name", "contact", "contactname", "displayname"],
  firstName: ["firstname", "first", "first_name", "givenname", "forename"],
  lastName: ["lastname", "last", "last_name", "surname", "familyname"],
  gender: ["gender", "sex"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  solarDob: ["solardob", "solar_dob", "solardateofbirth"],
  lunarDob: ["lunardob", "lunar_dob", "hijridob", "hijridateofbirth", "lunardateofbirth"],
  cnic: ["cnic", "nationalid", "cnicnationalid", "idnumber"],
  isSyed: ["issyed", "syed"],
  avatar: ["avatar", "avatarurl", "photo", "picture", "image"],
  tag: ["tag", "tags"],
  notes: ["notes", "note", "comment", "comments", "remarks"],
  whatsappStatus: ["whatsappstatus"],
  lastCheckedAt: ["lastcheckedat", "whatsappcheckedat"],
  aiSummary: ["aisummary", "summary"],

  phone_label: ["phonetype", "phonelabel", "phonelabels", "phone_label"],
  phone_number: [
    "phone",
    "phonenumber",
    "phonenumbers",
    "mobile",
    "cell",
    "telephone",
    "phone_number",
  ],
  phone_countryCode: ["phonecountrycode", "countrycode", "phone_countrycode"],
  phone_isPrimary: ["primaryphone", "phoneisprimary", "phone_isprimary"],
  phone_whatsappStatus: ["phonewhatsappstatus", "phone_whatsappstatus"],

  email_label: ["emailtype", "emaillabel", "emaillabels", "email_label"],
  email_address: ["email", "emailaddress", "emailaddresses", "mail", "email_address"],
  email_isPrimary: ["primaryemail", "emailisprimary", "email_isprimary"],
  email_isVerified: ["verifiedemail", "emailisverified", "email_isverified"],

  address_label: ["addresstype", "addresslabel", "addresslabels", "address_label"],
  line1: ["streetaddress", "street", "line1", "address", "residentialaddress"],
  city: ["city", "town"],
  state: ["state", "stateprovince", "province", "region"],
  country: ["country", "nation"],
  address_isPrimary: ["primaryaddress", "addressisprimary", "address_isprimary"],

  socials_platform: ["socialplatform", "socialplatforms", "socials_platform"],
  socials_url: ["socialurl", "sociallinks", "sociallink", "socials_url"],

  education_degree: ["degree", "qualification", "degreequalification", "education_degree"],
  education_institution: [
    "institution",
    "school",
    "university",
    "college",
    "madrasa",
    "hawza",
    "education_institution",
  ],
  education_fieldOfStudy: ["fieldofstudy", "field", "major", "subject", "education_fieldofstudy"],
  education_year: ["graduationyear", "passingyear", "year", "education_year"],
  education_grade: ["gradescore", "grade", "score", "division", "education_grade"],
  education_isCurrentlyEnrolled: [
    "currentlyenrolled",
    "iscurrentlyenrolled",
    "education_iscurrentlyenrolled",
  ],
  education_label: ["educationlabel", "education_label"],

  experience_title: ["jobtitle", "title", "designation", "position", "role", "experience_title"],
  experience_organization: [
    "organization",
    "employer",
    "company",
    "workplace",
    "experience_organization",
  ],
  experience_employmentType: ["employmenttype", "experience_employmenttype"],
  experience_location: ["joblocation", "location", "worklocation", "experience_location"],
  experience_startDate: ["jobstartdate", "startdate", "experience_startdate"],
  experience_endDate: ["jobenddate", "enddate", "experience_enddate"],
  experience_isCurrent: ["currentlyworkinghere", "iscurrent", "experience_iscurrent"],
  experience_description: ["jobdescription", "description", "experience_description"],
  experience_label: ["experiencelabel", "experience_label"],

  skills_name: ["skillname", "skill", "skills", "skills_name"],
  skills_category: ["skillcategory", "category", "skills_category"],
  skills_proficiency: ["skillproficiency", "proficiencylevel", "proficiency", "skills_proficiency"],
  skills_yearsOfExperience: ["yearsofexperience", "experienceyears", "skills_yearsofexperience"],
  skills_isCertified: ["certified", "iscertified", "skills_iscertified"],
  skills_issuer: ["certifyingbodyissuer", "issuedby", "issuer", "certifyingbody", "skills_issuer"],
  skills_description: ["skillnotes", "skills_description"],
  skills_label: ["skilllabel", "skills_label"],

  relationship_contact: [
    "relationshipcontact",
    "linkedcontact",
    "emergencycontact",
    "relationship_contact",
  ],
  relationship_type: ["relationshiptype", "relationship", "relationship_type"],
  relationship_phone: ["relationshipphone", "relationship_phone"],
  relationship_email: ["relationshipemail", "relationship_email"],
  relationship_gender: ["relationshipgender", "relationship_gender"],
  relationship_contactId: ["relatedcontactid", "relationshipcontactid", "relationship_contactid"],
  relationship_inferred: ["inferredrelationship", "relationshipinferred", "relationship_inferred"],

  bank_name: ["bankname", "bank_name"],
  bank_accountTitle: ["bankaccounttitle", "accounttitle", "bank_accounttitle"],
  bank_accountNumber: [
    "bankaccountnumber",
    "accountnumber",
    "accountnumberiban",
    "iban",
    "account",
    "bank_accountnumber",
  ],

  activity_type: ["activitytype", "activity_type"],
  activity_content: ["activitycontent", "activity_content"],
  activity_date: ["activitydate", "activity_date"],
  activity_by: ["activityloggedby", "activityby", "activity_by"],

  attachment_name: ["attachmentname", "attachment_name"],
  attachment_type: ["attachmenttype", "attachment_type"],
  attachment_size: ["attachmentsize", "attachment_size"],
  attachment_url: ["attachmenturl", "attachment_url"],
  attachment_date: ["attachmentdate", "attachment_date"],

  createdAt: ["createdat"],
  updatedAt: ["updatedat"],
  createdBy: ["createdby"],
  updatedBy: ["updatedby"],
};

export function buildHeaderFieldMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const col of ALL_CONTACT_FORM_EXPORT_COLUMNS) {
    const normId = normalizeHeaderKey(col.id);
    const normLabel = normalizeHeaderKey(col.label);
    if (normId) map[normId] = col.id;
    if (normLabel) map[normLabel] = col.id;
  }

  for (const [field, aliases] of Object.entries(BASE_HEADER_ALIASES)) {
    for (const alias of aliases) {
      const norm = normalizeHeaderKey(alias);
      if (norm) map[norm] = field;
    }
  }

  return map;
}

export const HEADER_FIELD_MAP: Record<string, string> = buildHeaderFieldMap();
