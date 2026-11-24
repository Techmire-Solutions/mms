/**
 * Contacts Module Database Schema.
 *
 * Decomposed into modular tables (≤300 lines each):
 * - `contactCoreTables.ts`: Core contact record, phones, emails, addresses.
 * - `contactProfileTables.ts`: Tags, socials, education, experience, skills, relationships, activities, attachments, bank details.
 * - `contactSetupTables.ts`: Tenant users, Google sync credentials, lookups, field configs, module preferences.
 * - `contactSchemaTypes.ts`: Inferred Drizzle select and insert row types.
 */
export * from "./contactCoreTables.js";
export * from "./contactProfileTables.js";
export * from "./contactSetupTables.js";
export * from "./contactSchemaTypes.js";
