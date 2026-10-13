import type { Contact } from "../contacts/contactTypes.js";
import type { Student } from "../students/studentTypes.js";
import {
  DEMO_CITIES,
  DEMO_FEMALE_FIRST,
  DEMO_LAST_NAMES,
  DEMO_MALE_FIRST,
  DEMO_PARENT_CONTACT_ID_START,
  DEMO_STUDENT_CONTACT_ID_START,
  DEMO_STUDENT_COUNT,
  DEMO_STUDENT_DATE,
  demoPad,
  demoPhoneSuffix,
  demoPick,
  demoRegisteredDate,
  demoSlug,
  demoStudentDob,
} from "./demoSeedConstants.js";

/** Builds parent contacts for demo students (ids 2001…). */
export function buildDemoStudentParentContacts(): Contact[] {
  const contacts: Contact[] = [];
  for (let index = 1; index <= DEMO_STUDENT_COUNT; index += 1) {
    const firstName = demoPick(DEMO_FEMALE_FIRST, index + 11);
    const lastName = demoPick(DEMO_LAST_NAMES, index + 7);
    const name = `${firstName} ${lastName}`;
    const email = `${demoSlug(`${firstName}.${lastName}`)}@parent.com`;
    const phone = `+92 300 ${demoPhoneSuffix(2000 + index)}`;

    contacts.push({
      id: DEMO_PARENT_CONTACT_ID_START + index - 1,
      name,
      firstName,
      lastName,
      gender: "female",
      createdAt: DEMO_STUDENT_DATE,
      updatedAt: DEMO_STUDENT_DATE,
      phones: [{ label: "Mobile", number: phone }],
      emails: [{ label: "Personal", address: email }],
      relationships: [],
      activities: [],
    });
  }
  return contacts;
}

/** Builds student contact profiles (ids 1001…). */
export function buildDemoStudentContacts(): Contact[] {
  const contacts: Contact[] = [];
  for (let index = 1; index <= DEMO_STUDENT_COUNT; index += 1) {
    const female = index % 4 === 0;
    const firstName = female
      ? demoPick(DEMO_FEMALE_FIRST, index)
      : demoPick(DEMO_MALE_FIRST, index);
    const lastName = demoPick(DEMO_LAST_NAMES, index);
    const name = `${firstName} ${lastName}`;
    const email = `${demoSlug(`${firstName}.${lastName}`)}@student.com`;
    const phone = `+92 333 ${demoPhoneSuffix(1000 + index)}`;
    const parentId = DEMO_PARENT_CONTACT_ID_START + index - 1;

    contacts.push({
      id: DEMO_STUDENT_CONTACT_ID_START + index - 1,
      name,
      firstName,
      lastName,
      gender: female ? "female" : "male",
      dob: demoStudentDob(index),
      email,
      phone,
      city: demoPick(DEMO_CITIES, index + 2),
      country: "Pakistan",
      createdAt: DEMO_STUDENT_DATE,
      updatedAt: DEMO_STUDENT_DATE,
      phones: [{ label: "Mobile", number: phone }],
      emails: [{ label: "Personal", address: email }],
      relationships: [{ contactId: parentId, relationship: "Parent" }],
      activities: [],
    });
  }
  return contacts;
}

/** Builds demo student rows linked to {@link buildDemoStudentContacts}. */
export function buildDemoStudents(): Student[] {
  const students: Student[] = [];
  for (let index = 1; index <= DEMO_STUDENT_COUNT; index += 1) {
    const status: Student["status"] =
      index % 13 === 0 ? "suspended" : index % 9 === 0 ? "inactive" : "active";
    students.push({
      id: `st${index}`,
      contactId: DEMO_STUDENT_CONTACT_ID_START + index - 1,
      motherContactId: DEMO_PARENT_CONTACT_ID_START + index - 1,
      grNumber: `${demoPad(index, 4)}-2026`,
      status,
      registeredDate: demoRegisteredDate(index),
      enrolledSessions: index % 3 === 0 ? ["s1"] : [],
    });
  }
  return students;
}
