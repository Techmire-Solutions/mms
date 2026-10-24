/**
 * Academic Sessions Module Database Schema.
 *
 * Decomposed into modular tables (≤300 lines each):
 * - `sessionCoreTables.ts`: Core sessions, session faculty, and session classes.
 * - `sessionClassSubTables.ts`: Class fees, schedules, budgets, discounts, timetables, periods, refreshments.
 * - `sessionSetupTables.ts`: Scholarship eligibilities, class scholarships, lookups, field configs, module preferences.
 * - `sessionSchemaTypes.ts`: Inferred Drizzle select and insert row types.
 */
export * from "./sessionCoreTables.js";
export * from "./sessionClassSubTables.js";
export * from "./sessionSetupTables.js";
export * from "./sessionSchemaTypes.js";
