import { buildDemoFacultyContacts, buildDemoFaculty } from "./demoSeedBuilders.js";

export { DEMO_FACULTY_COUNT } from "./demoSeedBuilders.js";

/** Faculty contact profiles (ids 1–{@link DEMO_FACULTY_COUNT}). */
export const DEMO_FACULTY_CONTACTS = buildDemoFacultyContacts();

/** Demo faculty rows — profile fields live on linked contacts. */
export const DEMO_FACULTY = buildDemoFaculty();
