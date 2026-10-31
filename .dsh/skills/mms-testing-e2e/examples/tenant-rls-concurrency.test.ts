import { describe, it, expect } from 'vitest';
import { withTenant } from '../db/tenant-context.js';
import { students } from '../db/schema.js';

describe('Row Level Security Concurrency Test', () => {
  it('prevents cross-tenant data leakage within the shared connection pool', async () => {
    const tenantA = '00000000-0000-0000-0000-000000000001';
    const tenantB = '00000000-0000-0000-0000-000000000002';

    // Seed records within tenant transactions
    await withTenant(tenantA, async (tx) => {
      await tx.insert(students).values({ name: 'Tenant A Student', tenantId: tenantA });
    });
    await withTenant(tenantB, async (tx) => {
      await tx.insert(students).values({ name: 'Tenant B Student', tenantId: tenantB });
    });

    // Concurrently query across both tenants with explicit column projection (no SELECT *)
    const [resultA, resultB] = await Promise.all([
      withTenant(tenantA, async (tx) => tx.select({ id: students.id, name: students.name, tenantId: students.tenantId }).from(students)),
      withTenant(tenantB, async (tx) => tx.select({ id: students.id, name: students.name, tenantId: students.tenantId }).from(students)),
    ]);

    expect(resultA.every((s) => s.tenantId === tenantA)).toBe(true);
    expect(resultB.every((s) => s.tenantId === tenantB)).toBe(true);
    expect(resultA.find((s) => s.name === 'Tenant B Student')).toBeUndefined();
    expect(resultB.find((s) => s.name === 'Tenant A Student')).toBeUndefined();
  });
});
