import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

const roots = ['apps/backend/src', 'apps/frontend/src', 'packages/shared/src'];
const forbidden = [
  ['/api/teachers', 'legacy Teacher API route'],
  ['CREATE VIEW "teachers"', 'legacy Teacher compatibility view'],
  ['hydrateFacultySetupFromLegacyBackup', 'legacy Faculty backup hydrator'],
  ['hydrateTeachersSetupFromLegacyObjects', 'legacy Teacher backup hydrator'],
  ['facultyDesignationAssignments', 'retired FDA Drizzle table'],
  ['faculty_designation_assignments', 'retired FDA SQL table reference outside migrations'],
];
const violations = [];
const requiredSchemaNeedles = [
  'facultyDesignations',
  'facultyDesignationRoles',
  'facultyAssignments',
  'facultyDepartments',
];

function shouldSkipFile(file) {
  if (file.includes('/migrations_drizzle/') || file.includes('/migrations/')) return true;
  // Known remaining backup-path debt tracked in docs/faculty.md; not part of FDA retire.
  if (file.includes('hydrateFacultySetupFromLegacyBackup')) return true;
  if (file.includes('dbSyncRestoreService')) return true;
  return false;
}

for (const root of roots) {
  for await (const match of glob(`${root}/**/*.{ts,tsx,js,mjs,sql}`)) {
    // glob yields OS separators; the skip rules match POSIX paths.
    const file = match.replaceAll('\\', '/');
    if (shouldSkipFile(file)) continue;
    const source = await readFile(file, 'utf8');
    for (const [needle, label] of forbidden) {
      if (source.includes(needle)) violations.push(`${file}: ${label}`);
    }
  }
}

const facultySchema = await readFile('apps/backend/src/db/schema/faculty.ts', 'utf8');
const facultyDesignationSchema = await readFile('apps/backend/src/db/schema/facultyDesignationTables.ts', 'utf8');
const facultyAssignmentSchema = await readFile('apps/backend/src/db/schema/facultyAssignmentTables.ts', 'utf8');
const facultyDepartmentSchema = await readFile('apps/backend/src/db/schema/facultyDepartmentTables.ts', 'utf8');
const facultySchemaSource = `${facultySchema}\n${facultyDesignationSchema}\n${facultyAssignmentSchema}\n${facultyDepartmentSchema}`;
for (const needle of requiredSchemaNeedles) {
  if (!facultySchemaSource.includes(needle)) {
    violations.push(`apps/backend/src/db/schema: missing ${needle}`);
  }
}

const temporalMigration = await readFile('apps/backend/src/db/migrations_drizzle/0123_faculty_temporal_designations.sql', 'utf8');
if (!temporalMigration.includes('faculty_designation_assignments_no_overlap_excl')) {
  violations.push('0123 migration: missing non-overlapping Faculty designation period constraint');
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Faculty domain legacy-surface check passed.');
}
