import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AUDIT_EVENTS_QUERY_KEY, auditEventsQueryOptions } from './audit';

vi.mock('@/lib/apiClient', () => ({
  apiJson: vi.fn().mockResolvedValue({}),
}));

import { apiJson } from '@/lib/apiClient';

describe('auditEventsQueryOptions', () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockClear();
  });

  it('targets the unfiltered events endpoint with the shared query key', async () => {
    const options = auditEventsQueryOptions();
    expect(options.queryKey).toEqual([...AUDIT_EVENTS_QUERY_KEY, {}]);
    expect(options.staleTime).toBe(30_000);

    const signal = new AbortController().signal;
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(apiJson).toHaveBeenCalledWith('/api/audit/events', { signal });
  });

  it('serializes active filters into the request path', async () => {
    const options = auditEventsQueryOptions({ limit: 10, offset: 20, tableName: 'students' });

    const signal = new AbortController().signal;
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(apiJson).toHaveBeenCalledWith(
      '/api/audit/events?limit=10&offset=20&tableName=students',
      { signal },
    );
  });
});
