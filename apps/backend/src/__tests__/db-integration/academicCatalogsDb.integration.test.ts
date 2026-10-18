import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { SessionSchema, type Session } from '@mms/shared';
import { closeDatabase } from '../../db/dbConnection.js';
import { applyDrizzleMigrations } from '../../db/dbInit.js';
import { withTenant } from '../../db/tenant-context.js';
import { sessions, workspaces } from '../../db/schema.js';
import { seedAcademicCatalogDefaults } from '../../db/repositories/academicCatalogSeed.js';
import { saveSession } from '../../db/repositories/sessionRepositoryPersist.js';
import { findSessionById } from '../../db/repositories/sessionRepositoryQueries.js';
import { createAcademicCatalogUseCases } from '../../sessions/use-cases/academicCatalogUseCases.js';
import { requireDatabaseConnection } from './dbTestSupport.js';

const TENANT = 'academic-catalog-test';
const useCases = createAcademicCatalogUseCases();

function sessionWith(overrides: Partial<Session>): Session {
  return SessionSchema.parse({ id: 'ses-cat-1', name: 'Catalog Session', ...overrides });
}

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, (tx) => tx.insert(workspaces).values({ id: TENANT, subdomain: TENANT, madrasaName: 'Catalog test', enabled: true }));
  await seedAcademicCatalogDefaults(TENANT);
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe('academic catalogs (real Postgres)', () => {
  it('given seeded defaults, should list system entries and reject a case-insensitive duplicate name when saved', async () => {
    // Arrange
    const programs = await useCases.list(TENANT, 'programs');

    // Act
    const duplicate = await useCases.save(TENANT, 'programs', 'p-dup', { name: '  hifz ' }, 'user-1').catch((error: unknown) => error);

    // Assert
    expect(programs.map((p) => p.name)).toContain('Hifz');
    expect(programs.every((p) => p.isSystem)).toBe(true);
    expect(duplicate).toMatchObject({ statusCode: 409 });
  });

  it('given a legacy type and a subject id, should link catalog ids and refresh snapshots when a session is saved', async () => {
    // Arrange
    const [fiqh] = (await useCases.list(TENANT, 'subjects')).filter((s) => s.name === 'Fiqh');
    const record = sessionWith({
      type: 'nazra',
      classes: [{
        id: 'cls-cat-1', name: 'Class 1',
        timetables: [{ id: 'tt-cat-1', date: '2026-01-05', periods: [{ id: 'per-cat-1', startTime: '08:00', endTime: '09:00', subject: 'stale text', subjectId: fiqh.id }] }],
      }],
    } as Partial<Session>);

    // Act
    await saveSession(TENANT, record);
    const saved = await withTenant(TENANT, () => findSessionById(TENANT, 'ses-cat-1'));
    const categories = await useCases.list(TENANT, 'categories');

    // Assert
    expect(saved?.type).toBe('Nazra');
    expect(saved?.categoryId).toBe(categories.find((c) => c.code === 'academic_year')?.id);
    expect(saved?.classes[0]?.programId).toBe(saved?.programId);
    expect(saved?.classes[0]?.timetables[0]?.periods[0]).toMatchObject({ subjectId: fiqh.id, subject: 'Fiqh' });
  });

  it('given a referenced subject, should block delete but allow delete and restore of an unused entry', async () => {
    // Arrange
    const [fiqh] = (await useCases.list(TENANT, 'subjects')).filter((s) => s.name === 'Fiqh');
    const created = await useCases.save(TENANT, 'subjects', 'sub-new', { name: 'Seerah' }, 'user-1');

    // Act
    const blocked = await useCases.remove(TENANT, 'subjects', fiqh.id, 'user-1').catch((error: unknown) => error);
    const removed = await useCases.remove(TENANT, 'subjects', created.id, 'user-1');
    const liveAfterDelete = await useCases.list(TENANT, 'subjects');
    const restored = await useCases.restore(TENANT, 'subjects', created.id, 'user-1');

    // Assert
    expect(blocked).toMatchObject({ statusCode: 409 });
    expect(removed).toBe(true);
    expect(liveAfterDelete.some((s) => s.id === created.id)).toBe(false);
    expect(restored).toMatchObject({ id: created.id, name: 'Seerah', deletedAt: null });
    const [row] = await withTenant(TENANT, (tx) => tx.select({ programId: sessions.programId }).from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, 'ses-cat-1'))));
    expect(row.programId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
