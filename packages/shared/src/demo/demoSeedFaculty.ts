import type { Contact } from "../contacts/contactTypes.js";
import type { FacultyMember } from "../faculty/facultyTypes.js";
import { FACULTY_SPECIALIZATION_VALUES } from "../faculty/facultyTypes.js";
import {
  DEMO_CITIES,
  DEMO_FACULTY_COUNT,
  DEMO_FACULTY_DATE,
  DEMO_FACULTY_FEMALE_TITLES,
  DEMO_FACULTY_MALE_TITLES,
  DEMO_FEMALE_FIRST,
  DEMO_LAST_NAMES,
  DEMO_MALE_FIRST,
  DEMO_QUALIFICATIONS,
  demoFacultyDob,
  demoJoinDate,
  demoPad,
  demoPhoneSuffix,
  demoPick,
  demoSlug,
} from "./demoSeedConstants.js";

/** Builds faculty contact profiles (ids 1…{@link DEMO_FACULTY_COUNT}). */
export function buildDemoFacultyContacts(): Contact[] {
  const contacts: Contact[] = [];
  for (let index = 1; index <= DEMO_FACULTY_COUNT; index += 1) {
    const female = index % 5 === 0 || index % 7 === 0;
    const firstPool = female ? DEMO_FEMALE_FIRST : DEMO_MALE_FIRST;
    const title = female
      ? demoPick(DEMO_FACULTY_FEMALE_TITLES, index)
      : demoPick(DEMO_FACULTY_MALE_TITLES, index);
    const firstName = demoPick(firstPool, index);
    const lastName = demoPick(DEMO_LAST_NAMES, index + 3);
    const name = `${title} ${firstName} ${lastName}`;
    const email = `${demoSlug(`${firstName}.${lastName}`)}@madrasa.app`;
    const phone = `+92 300 ${demoPhoneSuffix(index)}`;
    const city = demoPick(DEMO_CITIES, index);

    contacts.push({
      id: index,
      name,
      firstName: title,
      lastName: `${firstName} ${lastName}`,
      gender: female ? "female" : "male",
      dob: demoFacultyDob(index),
      email,
      phone,
      city,
      state: "Sindh",
      country: "Pakistan",
      createdAt: DEMO_FACULTY_DATE,
      updatedAt: DEMO_FACULTY_DATE,
      phones: [{ label: "Mobile", number: phone }],
      emails: [{ label: "Work", address: email }],
      relationships: [],
      activities: [],
    });
  }
  return contacts;
}

/** Builds demo faculty rows linked to {@link buildDemoFacultyContacts}. */
export function buildDemoFaculty(): FacultyMember[] {
  const facultyMembers: FacultyMember[] = [];
  for (let index = 1; index <= DEMO_FACULTY_COUNT; index += 1) {
    const status: FacultyMember["status"] =
      index % 11 === 0 ? "inactive" : index % 9 === 0 ? "on_leave" : "active";
    facultyMembers.push({
      id: `tch${index}`,
      contactId: index,
      employeeId: `TCH-${demoPad(index, 4)}`,
      specialization: demoPick([...FACULTY_SPECIALIZATION_VALUES], index),
      status,
      employmentStartDate: demoJoinDate(index),
      qualification: demoPick(DEMO_QUALIFICATIONS, index),
    });
  }
  return facultyMembers;
}
