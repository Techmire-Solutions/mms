import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BackgroundJobRecord } from '@mms/shared';
import {
  enqueueBackgroundJob,
  QueueUnavailableError,
} from '../services/backgroundJobWorkerService.js';

const { dispatchMock, txMock } = vi.hoisted(() => {
  const row = {
    id: 'job-1',
    tenantId: 'alpha',
    userId: 'user-1',
    moduleId: 'contacts',
    kind: 'export-csv',
    status: 'failed',
    label: 'Export Contacts',
    createdAt: new Date().toISOString(),
  };
  const tx = {
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [row] }) }) }),
  };
  return { dispatchMock: vi.fn(), txMock: tx };
});

vi.mock('../worker/queues/index.js', () => ({ dispatchJobToQueue: dispatchMock }));
vi.mock('../lib/tenantContext.js', () => ({
  runWithTenant: (_tenant: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('../db/tenant-context.js', () => ({
  withTenant: async (_tenant: string, cb: (tx: unknown) => Promise<unknown>) => cb(txMock),
}));
vi.mock('../worker/pubsub/jobPubSub.js', () => ({
  publishJobEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/backgroundJobService.js', () => ({
  createDatabaseBackgroundJob: vi.fn().mockResolvedValue(undefined),
  rowToJobRecord: (row: unknown) => row,
  getUserBackgroundJob: vi.fn(),
  getUserBackgroundJobPayload: vi.fn(),
}));

const job: BackgroundJobRecord = {
  id: 'job-1',
  moduleId: 'contacts',
  kind: 'export-csv',
  label: 'Export Contacts',
  status: 'running',
  createdAt: new Date().toISOString(),
};

const flushImmediate = () => new Promise((resolve) => setImmediate(resolve));

describe('enqueueBackgroundJob queue-unavailable handling', () => {
  const originalFlag = process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK;

  beforeEach(() => {
    dispatchMock.mockReset();
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK;
    else process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK = originalFlag;
  });

  it('throws QueueUnavailableError and fails the job when the queue rejects dispatch', async () => {
    dispatchMock.mockResolvedValue(false);
    delete process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK;

    await expect(enqueueBackgroundJob('alpha', 'user-1', job, {})).rejects.toBeInstanceOf(
      QueueUnavailableError,
    );
  });

  it('runs in-process only when MMS_ALLOW_IN_PROCESS_JOB_FALLBACK=true', async () => {
    dispatchMock.mockResolvedValue(false);
    process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK = 'true';

    const result = await enqueueBackgroundJob('alpha', 'user-1', job, {});
    await flushImmediate();

    expect(result.status).toBe('pending');
  });

  it('returns the persisted pending record on a successful enqueue', async () => {
    dispatchMock.mockResolvedValue(true);

    const result = await enqueueBackgroundJob('alpha', 'user-1', job, {});

    expect(result.status).toBe('pending');
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
