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

const mockAssign = vi.fn();
const mockListStaff = vi.fn();

vi.mock('../db/repositories/sectionStaffRepository.js', () => ({
  assignSectionStaff: (...args: unknown[]) => mockAssign(...args),
  endSectionStaff: vi.fn(),
  listSectionStaff: (...args: unknown[]) => mockListStaff(...args),
}));

const ASSIGNMENT = {
  id: 'a-1', sectionId: 'sec-a', facultyId: 'f1', facultyName: 'Teacher', role: 'class_teacher', subjectId: null,
  subjectName: null, startOn: '2026-01-01', endOn: null, changeReason: null, createdAt: '2026-01-01T00:00:00.000Z',
};

function headers(token: string) {
  return { host: 'demo.localhost', authorization: `Bearer ${token}` };
}

describe('section staff routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    vi.clearAllMocks();
  });

  it('given a teacher, should list staff but given a viewer forbid assigning when POST is sent', async () => {
    // Arrange
    mockListStaff.mockResolvedValueOnce([ASSIGNMENT]);
    const app = await buildApp();

    // Act
    const list = await app.inject({ method: 'GET', url: '/api/sessions/sections/sec-a/staff', headers: headers(teacherToken(app)) });
    const assign = await app.inject({ method: 'POST', url: '/api/sessions/sections/sec-a/staff', headers: headers(viewerToken(app)),
      payload: { facultyId: 'f1', role: 'class_teacher', startOn: '2026-01-01' } });

    // Assert
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body)).toEqual({ assignments: [ASSIGNMENT] });
    expect(assign.statusCode).toBe(403);
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('given an admin, should assign with the caller id and reject an invalid date or role when POST is sent', async () => {
    // Arrange
    mockAssign.mockResolvedValueOnce(ASSIGNMENT);
    const app = await buildApp();
    const token = adminToken(app);

    // Act
    const ok = await app.inject({ method: 'POST', url: '/api/sessions/sections/sec-a/staff', headers: headers(token),
      payload: { facultyId: 'f1', role: 'class_teacher', startOn: '2026-01-01' } });
    const badDate = await app.inject({ method: 'POST', url: '/api/sessions/sections/sec-a/staff', headers: headers(token),
      payload: { facultyId: 'f1', role: 'class_teacher', startOn: '2026-13-40' } });
    const badRole = await app.inject({ method: 'POST', url: '/api/sessions/sections/sec-a/staff', headers: headers(token),
      payload: { facultyId: 'f1', role: 'principal', startOn: '2026-01-01' } });

    // Assert
    expect(ok.statusCode).toBe(201);
    expect(mockAssign).toHaveBeenCalledWith('demo', 'sec-a', { facultyId: 'f1', role: 'class_teacher', startOn: '2026-01-01' }, expect.any(String));
    expect(badDate.statusCode).toBe(400);
    expect(badRole.statusCode).toBe(400);
  });
});
