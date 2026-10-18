import { describe, expect, it, vi } from 'vitest';
import { createAttendanceUseCases } from '../attendance/use-cases/attendanceUseCases.js';
import type { AttendanceRepository } from '../attendance/repository/attendanceRepository.js';
import { runWithTenant } from '../lib/tenantContext.js';
vi.mock('../attendance/use-cases/attendanceSectionStamp.js', () => ({
  stampAttendanceSections: vi.fn(async (_tenant: string, records: unknown[]) => records),
}));


function createFakeRepo(): AttendanceRepository {
  return {
    listAttendanceRecordsByWorkspace: vi.fn().mockResolvedValue([]),
    findAttendanceRecordById: vi.fn().mockResolvedValue(null),
    findAttendanceRecordsByIds: vi.fn().mockResolvedValue([]),
    saveAttendanceRecord: vi.fn().mockResolvedValue(undefined),
    bulkSaveAttendanceRecords: vi.fn().mockResolvedValue(undefined),
    replaceAttendanceRecordsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listAttendancePage: vi.fn().mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    }),
    countAttendanceActiveByWorkspace: vi.fn().mockResolvedValue(7),
    aggregateAttendanceCommandMetrics: vi.fn().mockResolvedValue({
      total: 7,
      selectedDatePresent: 4,
      selectedDateAbsent: 1,
      selectedDateLate: 1,
      selectedDateExcused: 0,
      periodTotal: 6,
      selectedDatePresentRate: 80,
      priorDatePresentRate: 75,
      overallPresentRate: 78,
    }),
    aggregateAttendanceWidgetQueries: vi.fn().mockResolvedValue({}),
    loadAttendanceReportAggregates: vi.fn().mockResolvedValue({
      overview: {
        overallRate: 0,
        totalRecords: 0,
        lowAttendanceCount: 0,
        classRates: [],
        monthlyTrend: [],
        studentRates: [],
        topPerformers: [],
        statusCounts: [],
      },
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    }),
  };
}

describe('attendance use-cases (DI with fake repository)', () => {
  it('countAttendanceRecords delegates to the injected repository with the active tenant', async () => {
    const repo = createFakeRepo();
    const useCases = createAttendanceUseCases(repo);

    const result = await runWithTenant('demo', () => useCases.countAttendanceRecords());

    expect(result).toBe(7);
    expect(repo.countAttendanceActiveByWorkspace).toHaveBeenCalledWith('demo');
  });

  it('loadAttendancePage delegates to the injected repository', async () => {
    const repo = createFakeRepo();
    const useCases = createAttendanceUseCases(repo);

    const result = await runWithTenant('demo', () => useCases.loadAttendancePage({ page: 2, limit: 15 }));

    expect(result).toEqual({ records: [], total: 0, page: 1, limit: 15, hasMore: false });
    expect(repo.listAttendancePage).toHaveBeenCalledWith('demo', { page: 2, limit: 15 });
  });

  it('upsertAttendanceRecords delegates to the injected repository', async () => {
    const repo = createFakeRepo();
    const useCases = createAttendanceUseCases(repo, {
      findStudentsByIds: vi.fn().mockResolvedValue([{ id: 'student-1', deletedAt: null }]),
      findSessionsByIds: vi.fn().mockResolvedValue([{ id: 'class-a', deletedAt: null }]),
    });
    const record = {
      id: 'class-a-2026-07-27-student-1',
      classId: 'class-a',
      date: '2026-07-27',
      studentId: 'student-1',
      studentName: 'Amina Ali',
      rollNo: '001',
      status: 'present' as const,
      timeIn: '07:00',
      timeOut: '08:30',
      notes: '',
    };

    const result = await runWithTenant('demo', () => useCases.upsertAttendanceRecords([record]));

    expect(result).toEqual([record]);
    expect(repo.bulkSaveAttendanceRecords).toHaveBeenCalledWith('demo', [record]);
  });

  it('returns empty defaults when no tenant context is bound', async () => {
    const repo = createFakeRepo();
    const useCases = createAttendanceUseCases(repo);

    const count = await useCases.countAttendanceRecords();
    const page = await useCases.loadAttendancePage({ page: 1, limit: 15 });

    expect(count).toBe(0);
    expect(page).toEqual({ records: [], total: 0, page: 1, limit: 15, hasMore: false });
    expect(repo.countAttendanceActiveByWorkspace).not.toHaveBeenCalled();
    expect(repo.listAttendancePage).not.toHaveBeenCalled();
  });

  it('loadAttendanceRecordById fetches single record and respects soft-delete', async () => {
    const activeRecord: any = { id: 'att-1', studentName: 'Student 1', deletedAt: null };
    const deletedRecord: any = { id: 'att-2', studentName: 'Student 2', deletedAt: '2026-08-01T00:00:00.000Z' };

    const repo = createFakeRepo();
    (repo.findAttendanceRecordById as any).mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'att-1') return activeRecord;
      if (id === 'att-2') return deletedRecord;
      return null;
    });
    const useCases = createAttendanceUseCases(repo);

    await runWithTenant('demo', async () => {
      const foundActive = await useCases.loadAttendanceRecordById('att-1');
      expect(foundActive).toEqual(activeRecord);

      const foundDeletedWithoutFlag = await useCases.loadAttendanceRecordById('att-2');
      expect(foundDeletedWithoutFlag).toBeNull();

      const foundDeletedWithFlag = await useCases.loadAttendanceRecordById('att-2', true);
      expect(foundDeletedWithFlag).toEqual(deletedRecord);

      const foundBlank = await useCases.loadAttendanceRecordById('   ');
      expect(foundBlank).toBeNull();
    });

    const noTenant = await useCases.loadAttendanceRecordById('att-1');
    expect(noTenant).toBeNull();
  });

  it('loadAttendanceRecordsByIds deduplicates IDs and respects soft-delete', async () => {
    const active1: any = { id: 'att-1', studentName: 'Student 1', deletedAt: null };
    const active2: any = { id: 'att-2', studentName: 'Student 2', deletedAt: null };
    const deleted: any = { id: 'att-3', studentName: 'Student 3', deletedAt: '2026-08-01T00:00:00.000Z' };

    const repo = createFakeRepo();
    (repo.findAttendanceRecordsByIds as any).mockResolvedValue([active1, active2, deleted]);
    const useCases = createAttendanceUseCases(repo);

    await runWithTenant('demo', async () => {
      const activeOnly = await useCases.loadAttendanceRecordsByIds(['att-1', ' att-2 ', 'att-1', 'att-3']);
      expect(repo.findAttendanceRecordsByIds).toHaveBeenCalledWith('demo', ['att-1', 'att-2', 'att-3']);
      expect(activeOnly).toEqual([active1, active2]);

      const includingDeleted = await useCases.loadAttendanceRecordsByIds(['att-1', 'att-3'], true);
      expect(includingDeleted).toEqual([active1, active2, deleted]);

      const emptyIds = await useCases.loadAttendanceRecordsByIds([]);
      expect(emptyIds).toEqual([]);
    });

    const noTenant = await useCases.loadAttendanceRecordsByIds(['att-1']);
    expect(noTenant).toEqual([]);
  });

  it('loadAttendanceCommandMetrics handles missing or invalid request query gracefully', async () => {
    const repo = createFakeRepo();
    const useCases = createAttendanceUseCases(repo);

    await runWithTenant('demo', async () => {
      const metricsNoReq = await useCases.loadAttendanceCommandMetrics();
      expect(metricsNoReq.total).toBe(7);
      expect(repo.aggregateAttendanceCommandMetrics).toHaveBeenCalledWith('demo', { selectedDate: undefined });

      const metricsInvalidDate = await useCases.loadAttendanceCommandMetrics({ query: { date: 'not-a-date' } } as any);
      expect(metricsInvalidDate.total).toBe(7);
      expect(repo.aggregateAttendanceCommandMetrics).toHaveBeenCalledWith('demo', { selectedDate: undefined });

      const metricsValidDate = await useCases.loadAttendanceCommandMetrics({ query: { date: '2026-09-01' } } as any);
      expect(metricsValidDate.total).toBe(7);
      expect(repo.aggregateAttendanceCommandMetrics).toHaveBeenCalledWith('demo', { selectedDate: '2026-09-01' });
    });
  });

  it('createAttendanceRecord throws 400 when student is archived', async () => {
    const repo = createFakeRepo();
    const findStudentById = vi.fn().mockResolvedValue({ id: 's1', deletedAt: '2026-01-01' });
    const useCases = createAttendanceUseCases(repo, { findStudentById });

    await expect(
      runWithTenant('demo', () =>
        useCases.createAttendanceRecord({
          id: 'att-1',
          classId: 'c1',
          studentId: 's1',
          date: '2026-09-01',
          status: 'present',
        } as any),
      ),
    ).rejects.toThrow('Referenced student is archived or does not exist');
  });

  it('createAttendanceRecord throws 400 when session is archived', async () => {
    const repo = createFakeRepo();
    const findStudentById = vi.fn().mockResolvedValue({ id: 's1', deletedAt: null });
    const findSessionById = vi.fn().mockResolvedValue({ id: 'c1', deletedAt: '2026-01-01' });
    const useCases = createAttendanceUseCases(repo, { findStudentById, findSessionById });

    await expect(
      runWithTenant('demo', () =>
        useCases.createAttendanceRecord({
          id: 'att-1',
          classId: 'c1',
          studentId: 's1',
          date: '2026-09-01',
          status: 'present',
        } as any),
      ),
    ).rejects.toThrow('Referenced class is archived or does not exist');
  });

  it('upsertAttendanceRecords throws 400 when batch contains an archived student', async () => {
    const repo = createFakeRepo();
    const findStudentsByIds = vi.fn().mockResolvedValue([{ id: 's1', deletedAt: '2026-01-01' }]);
    const useCases = createAttendanceUseCases(repo, { findStudentsByIds });

    await expect(
      runWithTenant('demo', () =>
        useCases.upsertAttendanceRecords([
          {
            id: 'att-1',
            classId: 'c1',
            studentId: 's1',
            date: '2026-09-01',
            status: 'present',
          } as any,
        ]),
      ),
    ).rejects.toThrow('Referenced student is archived or does not exist');
  });
});

