import { describe, expect, it, vi } from 'vitest';
import { createSessionsUseCases } from '../sessions/use-cases/sessionsUseCases.js';
import type { SessionsRepository } from '../sessions/repository/sessionsRepository.js';
import { runWithTenant } from '../lib/tenantContext.js';
import { NotFoundError } from '../lib/httpErrors.js';

function createFakeRepo(): SessionsRepository {
  return {
    listSessionsByWorkspace: vi.fn().mockResolvedValue([]),
    findSessionById: vi.fn().mockResolvedValue(null),
    findSessionsByIds: vi.fn().mockResolvedValue([]),
    saveSession: vi.fn().mockResolvedValue(undefined),
    listSessionsPage: vi.fn().mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    countSessionsActive: vi.fn().mockResolvedValue(3),
    aggregateSessionsCommandMetrics: vi.fn().mockResolvedValue({
      total: 3,
      active: 2,
      upcoming: 1,
      completed: 0,
      cancelled: 0,
      totalEnrolled: 0,
      totalCapacity: 0,
      totalClasses: 0,
      sessionsThisWeek: 0,
      sessionsLastWeek: 0,
    }),
    bulkUpdateSessionsStatus: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
    aggregateSessionsWidgetQueries: vi.fn().mockResolvedValue({}),
    loadSessionsReportAggregates: vi.fn().mockResolvedValue({
      capacity: [],
      enrollmentTrends: [],
      todaysSessions: [],
    }),
    softDeleteSessionWithCascade: vi.fn().mockResolvedValue(true),
    restoreSessionWithCascade: vi.fn().mockResolvedValue(true),
    bulkSoftDeleteSessionsWithCascade: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreSessionsWithCascade: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
  };
}

describe('sessions use-cases (DI with fake repository)', () => {
  it('countSessions delegates to the injected repository with the active tenant', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const result = await runWithTenant('demo', () => useCases.countSessions());

    expect(result).toBe(3);
    expect(repo.countSessionsActive).toHaveBeenCalledWith('demo');
  });

  it('loadSessionsPage delegates to the injected repository', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const result = await runWithTenant('demo', () =>
      useCases.loadSessionsPage({ page: 2, limit: 12 }),
    );

    expect(result).toEqual({ sessions: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listSessionsPage).toHaveBeenCalledWith('demo', { page: 2, limit: 12 });
  });

  it('given mixed lifecycle states, should apply only allowed transitions (normalized) and count the rest as failed', async () => {
    // Arrange
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionById).mockImplementation(async (_tenant: string, id: string) =>
      ({ id, status: id === 's1' ? 'open' : 'completed' }) as never);
    vi.mocked(repo.bulkUpdateSessionsStatus).mockResolvedValue({ succeeded: 1, failed: 0 });
    const useCases = createSessionsUseCases(repo);

    // Act
    const result = await runWithTenant('demo', () => useCases.bulkUpdateSessionsStatus(['s1', 's2'], 'active'));

    // Assert
    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(repo.bulkUpdateSessionsStatus).toHaveBeenCalledWith('demo', ['s1'], 'in_progress');
  });

  it('loadSessionsByIds filters out soft-deleted sessions', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionsByIds).mockResolvedValue([
      { id: 's1', name: 'Active Session' } as never,
      { id: 's2', name: 'Deleted Session', deletedAt: '2026-07-27T00:00:00.000Z' } as never,
    ]);
    const useCases = createSessionsUseCases(repo);

    const result = await runWithTenant('demo', () =>
      useCases.loadSessionsByIds(['s1', 's2']),
    );

    expect(result.map((s) => s.id)).toEqual(['s1']);
  });

  it('returns empty defaults when no tenant context is bound', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const count = await useCases.countSessions();
    const page = await useCases.loadSessionsPage({ page: 1, limit: 12 });

    expect(count).toBe(0);
    expect(page).toEqual({ sessions: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.countSessionsActive).not.toHaveBeenCalled();
    expect(repo.listSessionsPage).not.toHaveBeenCalled();
  });

  it('deleteSessionById delegates cascade soft-delete to the repository', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const ok = await runWithTenant('demo', () =>
      useCases.deleteSessionById('s1', 'u-admin', 'Cancelled session'),
    );

    expect(ok).toBe(true);
    expect(repo.softDeleteSessionWithCascade).toHaveBeenCalledWith(
      'demo',
      's1',
      'u-admin',
      'Cancelled session',
    );
  });

  it('restoreSessionById delegates cascade restore to the repository', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const ok = await runWithTenant('demo', () =>
      useCases.restoreSessionById('s1', 'u-admin'),
    );

    expect(ok).toBe(true);
    expect(repo.restoreSessionWithCascade).toHaveBeenCalledWith('demo', 's1', 'u-admin');
  });

  it('deleteSessionById throws NotFoundError with "already archived" if session is already soft-deleted', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.softDeleteSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue({ id: 's1', deletedAt: '2026-08-01T00:00:00.000Z' } as never);
    const useCases = createSessionsUseCases(repo);

    await expect(
      runWithTenant('demo', () => useCases.deleteSessionById('s1')),
    ).rejects.toThrow(new NotFoundError('Session is already archived'));
  });

  it('deleteSessionById throws NotFoundError with "not found" if session does not exist', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.softDeleteSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue(null);
    const useCases = createSessionsUseCases(repo);

    await expect(
      runWithTenant('demo', () => useCases.deleteSessionById('s1')),
    ).rejects.toThrow(new NotFoundError('Session not found'));
  });

  it('restoreSessionById throws NotFoundError with "already active" if session is not soft-deleted', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.restoreSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue({ id: 's1', deletedAt: null } as never);
    const useCases = createSessionsUseCases(repo);

    await expect(
      runWithTenant('demo', () => useCases.restoreSessionById('s1')),
    ).rejects.toThrow(new NotFoundError('Session is already active'));
  });

  it('restoreSessionById throws NotFoundError with "not found" if session does not exist', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.restoreSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue(null);
    const useCases = createSessionsUseCases(repo);

    await expect(
      runWithTenant('demo', () => useCases.restoreSessionById('s1')),
    ).rejects.toThrow(new NotFoundError('Session not found'));
  });

  it('bulkSoftDeleteSessions delegates to bulkSoftDeleteSessionsWithCascade', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const res = await runWithTenant('demo', () =>
      useCases.bulkSoftDeleteSessions(['s1', 's2'], 'u-admin', 'Batch archive'),
    );

    expect(res).toEqual({ succeeded: 1, failed: 0 });
    expect(repo.bulkSoftDeleteSessionsWithCascade).toHaveBeenCalledWith(
      'demo',
      ['s1', 's2'],
      'u-admin',
      'Batch archive',
    );
  });

  it('bulkRestoreSessions delegates to bulkRestoreSessionsWithCascade', async () => {
    const repo = createFakeRepo();
    const useCases = createSessionsUseCases(repo);

    const res = await runWithTenant('demo', () =>
      useCases.bulkRestoreSessions(['s1', 's2'], 'u-admin'),
    );

    expect(res).toEqual({ succeeded: 1, failed: 0 });
    expect(repo.bulkRestoreSessionsWithCascade).toHaveBeenCalledWith(
      'demo',
      ['s1', 's2'],
      'u-admin',
    );
  });
});
