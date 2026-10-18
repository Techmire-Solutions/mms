import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { adminToken, teacherToken, viewerToken } from './helpers/tokens.js';

vi.mock('../db/database.js', () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/auth/authArtifactService.js', () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock('../services/workspaceService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/workspaceService.js')>();
  const demoWorkspace = {
    id: 'ws-demo',
    subdomain: 'demo',
    madrasaName: 'Demo Madrasa',
    createdAt: '2026-01-01T00:00:00.000Z',
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi.fn().mockImplementation(async (subdomain: string) =>
      subdomain === 'demo' ? demoWorkspace : null,
    ),
  };
});

const mockLoadStudentsPage = vi.fn();
const mockCreateStudent = vi.fn();
const mockLoadStudentsCommandMetrics = vi.fn();
const mockMigrateStudentsMissingGrNumbers = vi.fn();
const mockEnqueueBackgroundJob = vi.fn();
const mockGetUserBackgroundJob = vi.fn();
const mockRecordAudit = vi.fn();
const mockBulkSoftDeleteStudents = vi.fn();
const mockBulkRestoreStudents = vi.fn();
const mockDeleteStudentById = vi.fn();
const mockRestoreStudentById = vi.fn();
const mockUpdateStudentById = vi.fn();
const mockBulkEnrollStudents = vi.fn();

vi.mock('../students/use-cases/studentUseCases.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../students/use-cases/studentUseCases.js')>();
  return {
    ...actual,
    studentUseCases: {
      ...actual.studentUseCases,
      loadStudentsPage: (...args: unknown[]) => mockLoadStudentsPage(...args),
      createStudent: (...args: unknown[]) => mockCreateStudent(...args),
      updateStudentById: (...args: unknown[]) => mockUpdateStudentById(...args),
      loadStudentsCommandMetrics: (...args: unknown[]) => mockLoadStudentsCommandMetrics(...args),
      migrateStudentsMissingGrNumbers: (...args: unknown[]) => mockMigrateStudentsMissingGrNumbers(...args),
      bulkSoftDeleteStudents: (...args: unknown[]) => mockBulkSoftDeleteStudents(...args),
      bulkRestoreStudents: (...args: unknown[]) => mockBulkRestoreStudents(...args),
      bulkEnrollStudents: (...args: unknown[]) => mockBulkEnrollStudents(...args),
      softDeleteStudentById: (...args: unknown[]) => mockDeleteStudentById(...args),
      restoreStudentById: (...args: unknown[]) => mockRestoreStudentById(...args),
      sanitizeStudentForViewer: async (student: unknown) => student,
      sanitizeStudentsForViewer: async (students: unknown) => students,
    },
  };
});

vi.mock('../services/studentValidationService.js', () => ({
  validateStudentDynamic: vi.fn().mockResolvedValue(undefined),
}));

const mockLoadStudentFieldConfig = vi.fn().mockResolvedValue(null);

vi.mock('../services/studentConfigService.js', () => ({
  loadStudentFieldConfig: (...args: unknown[]) => mockLoadStudentFieldConfig(...args),
  saveStudentFieldConfig: vi.fn(),
  loadStudentsSettingsCombined: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/auditTrailService.js', () => ({
  recordModernAuditEvent: (first: unknown, second?: unknown) => {
    const input = (second ?? first) as {
      realUserId?: string;
      tableName?: string;
      recordId?: string;
      newState?: { action?: string; summary?: string };
    };
    mockRecordAudit({
      userId: input.realUserId,
      action: input.newState?.action,
      entityType: 'collection',
      entityId: input.recordId,
      summary: input.newState?.summary,
    });
    return Promise.resolve({
      hashPrevious: '0'.repeat(64),
      hashCurrent: '1'.repeat(64),
      canonicalPayload: '{}',
    });
  },
  mapActionStringToAuditType: (action: string) => (action.includes('delete') || action.includes('archive') ? 'DELETE' : action.includes('create') ? 'CREATE' : 'UPDATE'),
  getLatestShardHash: vi.fn().mockResolvedValue('0'.repeat(64)),
}));

vi.mock('../services/backgroundJobWorkerService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/backgroundJobWorkerService.js')>();
  return {
    ...actual,
    enqueueBackgroundJob: (...args: unknown[]) => mockEnqueueBackgroundJob(...args),
    getUserBackgroundJob: (...args: unknown[]) => mockGetUserBackgroundJob(...args),
  };
});

describe('students routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    vi.clearAllMocks();
    mockEnqueueBackgroundJob.mockResolvedValue({
      id: 'job_students_export',
      moduleId: 'students',
      kind: 'export',
      status: 'running',
      label: 'Students CSV',
      createdAt: '2026-06-21T00:00:00.000Z',
    });
    mockGetUserBackgroundJob.mockResolvedValue(null);
    mockRecordAudit.mockResolvedValue(undefined);
  });

  it('GET /api/students?includeDeleted=true returns deleted-only page totals', async () => {
    mockLoadStudentsPage.mockResolvedValue({
      students: [{ id: 's-deleted', deletedAt: '2026-01-15T00:00:00.000Z' }],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/students?page=1&limit=50&includeDeleted=true',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadStudentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true, page: 1, limit: 50 }),
    );
    const body = res.json() as {
      students: Array<{ id: string; deletedAt?: string | null }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.students).toHaveLength(1);
    expect(body.students.every((row) => Boolean(row.deletedAt))).toBe(true);
    await app.close();
  });

  it('GET /api/students forwards report and sibling relationship filters', async () => {
    mockLoadStudentsPage.mockResolvedValue({
      students: [{ id: 's1', name: 'Ali' }],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/students?page=1&limit=50&sessionId=ses-1&className=Grade%20A&relatedContactIds=father-1%2Cguardian-1&fatherName=Ahmed%20Ali&excludeId=s-current',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadStudentsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 50,
        sessionId: 'ses-1',
        className: 'Grade A',
        relatedContactIds: 'father-1,guardian-1',
        fatherName: 'Ahmed Ali',
        excludeId: 's-current',
      }),
    );
    expect(res.json()).toMatchObject({ total: 1 });
    await app.close();
  });

  it('POST /api/students strips client soft-delete fields before create', async () => {
    mockCreateStudent.mockImplementation(async (student: Record<string, unknown>) => ({
      record: student,
      restored: false,
    }));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {
        contactId: 'c-1',
        status: 'active',
        deletedAt: '2026-01-01T00:00:00.000Z',
        deletedBy: 'u-evil',
        deletionReason: 'should-not-persist',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(mockCreateStudent).toHaveBeenCalled();
    const created = mockCreateStudent.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(created.deletedAt).toBeUndefined();
    expect(created.deletedBy).toBeUndefined();
    expect(created.deletionReason).toBeUndefined();
    expect(created.contactId).toBe('c-1');
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.create',
        summary: expect.stringContaining('Created student'),
      }),
    );
    await app.close();
  });

  it('POST /api/students maps StudentPermissionError to 403 (write-only re-register)', async () => {
    const { StudentPermissionError } = await import('../students/use-cases/studentNormalizeUseCases.js');
    mockCreateStudent.mockRejectedValue(
      new StudentPermissionError('Restoring soft-deleted students requires delete permissions'),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { contactId: 'c-1', status: 'active', grNumber: 'GR-1' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      type: 'forbidden',
      message: 'Restoring soft-deleted students requires delete permissions',
    });
    await app.close();
  });

  it('POST /api/students maps GR unique conflict to 409', async () => {
    const conflict = Object.assign(new Error('A student with this GR number already exists.'), {
      statusCode: 409,
      type: 'conflict',
    });
    mockCreateStudent.mockRejectedValue(conflict);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { contactId: 'c-1', status: 'active', grNumber: 'GR-1' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: 'conflict',
      message: 'A student with this GR number already exists.',
    });
    await app.close();
  });

  it('POST /api/students returns 200 when createStudent restores an archived row', async () => {
    mockCreateStudent.mockResolvedValue({
      record: { id: 's-archived', contactId: 'c-1', status: 'active', grNumber: 'GR-1' },
      restored: true,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { contactId: 'c-1', status: 'active', grNumber: 'GR-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.restore',
        summary: expect.stringContaining('Restored student s-archived via re-registration'),
      }),
    );
    await app.close();
  });

  it('PUT /api/students/:id audits update for admin', async () => {
    mockUpdateStudentById.mockResolvedValue({ id: 's1', contactId: 'c-1', status: 'active' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/students/s1',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { contactId: 'c-1', status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockUpdateStudentById).toHaveBeenCalled();
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.update',
        entityId: 's1',
        summary: expect.stringContaining('Updated student s1'),
      }),
    );
    await app.close();
  });

  it('POST /api/students denies viewers without students.write', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${viewerToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { contactId: 'c-1', status: 'active' },
    });
    expect(res.statusCode).toBe(403);
    expect(mockCreateStudent).not.toHaveBeenCalled();
    await app.close();
  });

  it('GET /api/students/metrics uses SQL metrics loader', async () => {
    mockLoadStudentsCommandMetrics.mockResolvedValue({
      total: 3,
      active: 2,
      inactive: 1,
      suspended: 0,
      newThisPeriod: 1,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/students/metrics',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadStudentsCommandMetrics).toHaveBeenCalled();
    const body = res.json() as { metrics: { total: number; active: number } };
    expect(body.metrics.total).toBe(3);
    expect(body.metrics.active).toBe(2);
    await app.close();
  });

  it('POST /api/students/migrate-gr-numbers updates missing GRs for setup writers', async () => {
    mockMigrateStudentsMissingGrNumbers.mockResolvedValue({ updated: 2 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/migrate-gr-numbers',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(mockMigrateStudentsMissingGrNumbers).toHaveBeenCalled();
    expect(res.json()).toEqual({ success: true, updated: 2 });
    await app.close();
  });

  it('POST /api/students/migrate-gr-numbers denies teachers without setupWrite', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/migrate-gr-numbers',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(mockMigrateStudentsMissingGrNumbers).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /api/students/migrate-gr-numbers denies viewers', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/migrate-gr-numbers',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${viewerToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(mockMigrateStudentsMissingGrNumbers).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /api/students/export/csv queues and audits exports on the server', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/export/csv',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {
        label: 'Students CSV',
        columns: [{ id: 'name', label: 'Name' }],
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      'demo',
      'u-teacher',
      expect.objectContaining({ moduleId: 'students', kind: 'export', label: 'Students CSV' }),
      expect.objectContaining({
        columns: [{ id: 'name', label: 'Name' }],
        label: 'Students CSV',
        viewerRole: 'teacher',
        allowDeleted: false,
      }),
    );
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.export.queue',
        entityId: expect.any(String),
      }),
    );
    await app.close();
  });

  it('POST /api/students/export/csv accepts selection ids', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/export/csv',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {
        label: 'Selection CSV',
        columns: [{ id: 'name', label: 'Name' }],
        ids: ['s1', 's2'],
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      'demo',
      'u-teacher',
      expect.objectContaining({ kind: 'export' }),
      expect.objectContaining({
        query: expect.objectContaining({ includeIds: ['s1', 's2'] }),
      }),
    );
    await app.close();
  });

  it('POST /api/students/export/csv returns 403 without read access', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/export/csv',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${viewerToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { label: 'Denied CSV' },
    });
    expect(res.statusCode).toBe(403);
    expect(mockEnqueueBackgroundJob).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /api/students/export/csv strips includeDeleted without students.delete', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/export/csv',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {
        label: 'Trash CSV',
        query: { includeDeleted: 'true', search: 'ali' },
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      'demo',
      'u-teacher',
      expect.objectContaining({ kind: 'export' }),
      expect.objectContaining({
        allowDeleted: false,
        query: { search: 'ali' },
      }),
    );
    await app.close();
  });

  it('POST /api/students/export-audit records export audit for read roles', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/export-audit',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { count: 12, scope: 'filtered' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.export',
        summary: 'Exported 12 student(s) (filtered)',
      }),
    );
    await app.close();
  });

  it('POST /api/students/export-audit returns 403 for viewer', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/export-audit',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${viewerToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { count: 1, scope: 'selection' },
    });
    expect(res.statusCode).toBe(403);
    expect(mockRecordAudit).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /api/students/setup-audit requires setup write permission', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/setup-audit',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${teacherToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { area: 'fields', summary: 'Changed fields' },
    });
    expect(res.statusCode).toBe(403);
    expect(mockRecordAudit).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /api/students/setup-audit records setup changes for admin', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/setup-audit',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { area: 'fields', summary: 'Changed fields' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.setup',
        entityId: 'setup:fields',
        summary: 'Changed fields',
      }),
    );
    await app.close();
  });

  it('POST /api/students/bulk-delete audits soft-delete for admin', async () => {
    mockBulkSoftDeleteStudents.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/bulk-delete',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { ids: ['s1', 's2'], deletionReason: 'Cleanup' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkSoftDeleteStudents).toHaveBeenCalledWith(['s1', 's2'], 'u-admin', 'Cleanup');
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.bulk_soft_delete',
        summary: expect.stringContaining('Soft-deleted 2 student(s)'),
      }),
    );
    await app.close();
  });

  it('DELETE /api/students/:id audits soft-delete for admin', async () => {
    mockDeleteStudentById.mockResolvedValue({ id: 's1' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/students/s1',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: { deletionReason: 'Duplicate' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteStudentById).toHaveBeenCalledWith('s1', 'u-admin', 'Duplicate');
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.soft_delete',
        entityId: 's1',
        summary: expect.stringContaining('Soft-deleted student s1'),
      }),
    );
    await app.close();
  });

  it('DELETE /api/students/:id maps ConflictError from delete guard to 409', async () => {
    const { ConflictError } = await import('../lib/httpErrors.js');
    mockDeleteStudentById.mockRejectedValue(
      new ConflictError('Cannot delete student with active unpaid invoices. Settle or cancel invoices first.'),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/students/s1',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      type: 'conflict',
      message: expect.stringContaining('Cannot delete student with active unpaid invoices'),
    });
    await app.close();
  });

  it('POST /api/students/:id/restore audits restore for admin', async () => {
    mockRestoreStudentById.mockResolvedValue({ id: 's1' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/s1/restore',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreStudentById).toHaveBeenCalledWith('s1', 'u-admin');
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.restore',
        entityId: 's1',
      }),
    );
    await app.close();
  });

  it('POST /api/students/bulk-enroll performs bulk session enrollment and audits', async () => {
    mockBulkEnrollStudents.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/bulk-enroll',
      headers: {
        host: 'demo.localhost',
        authorization: `Bearer ${adminToken(app)}`,
        'content-type': 'application/json',
      },
      payload: {
        studentIds: ['s1', 's2'],
        sessionId: 'sess-1',
        classId: 'cls-1',
        mode: 'add',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkEnrollStudents).toHaveBeenCalledWith({
      studentIds: ['s1', 's2'],
      sessionId: 'sess-1',
      classId: 'cls-1',
      mode: 'add',
    });
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student.bulk_enroll',
        summary: expect.stringContaining('Updated session enrollments (add) for 2 student(s)'),
      }),
    );
    await app.close();
  });

  it('POST /api/students/bulk-enroll rejects add without a class (enrollments need a class)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/students/bulk-enroll',
      headers: { host: 'demo.localhost', authorization: `Bearer ${adminToken(app)}`, 'content-type': 'application/json' },
      payload: { studentIds: ['s1'], sessionId: 'sess-1', mode: 'add' },
    });
    expect(res.statusCode).toBe(400);
    expect(mockBulkEnrollStudents).not.toHaveBeenCalled();
    await app.close();
  });
});
