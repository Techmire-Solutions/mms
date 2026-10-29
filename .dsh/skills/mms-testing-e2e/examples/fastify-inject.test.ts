import { describe, expect, it, vi } from 'vitest';
import { createServer } from '../server.js';

describe('Fastify inject() API Route Testing', () => {
  it('rejects unauthenticated requests to tenant endpoints', async () => {
    const app = await createServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { name: 'Test Contact' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('soft-deletes entity and returns 404 on subsequent read', async () => {
    const app = await createServer();
    const contactId = '00000000-0000-0000-0000-000000000001';
    const validSessionCookie = 'test-token';

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/contacts/${contactId}`,
      headers: { host: 'tenant.localhost' },
      cookies: { mms_tenant_session: validSessionCookie },
    });
    expect(deleteRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/contacts/${contactId}`,
      headers: { host: 'tenant.localhost' },
      cookies: { mms_tenant_session: validSessionCookie },
    });
    expect(getRes.statusCode).toBe(404);
  });
});
