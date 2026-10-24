/**
 * People-side ERD domains (contacts / students / faculty).
 *
 * Stable barrel: the domains were split into one module each to stay under the
 * 300-line ceiling; consumers keep importing from this path.
 */
export * from "./erdDomainContacts.js";
export * from "./erdDomainStudents.js";
export * from "./erdDomainFaculty.js";
