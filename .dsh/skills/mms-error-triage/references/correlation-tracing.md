# Correlation Tracing & Sentry Triage

Practical guide for navigating the request correlation chain across Frontend, Fastify Backend, Pino, and Postgres Audit Trail.

## 1. Tracing Identifiers & Headers

MMS standardizes on W3C Trace Context and Request IDs across every layer (`mms-api-interface.md`):

| Header / Field | Origin | Purpose | Sample Value |
|---|---|---|---|
| `x-request-id` | Fastify or Client Proxy | Unique UUID per HTTP transaction | `req-c7a31b40-9f21-4f1e` |
| `traceparent` | W3C Distributed Tracing | 4-part trace context: version-traceId-spanId-flags | `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01` |
| `correlation_id` | Fastify / Database Service | Database audit trail anchor in `audit_trail_events` | Matches `x-request-id` |

## 2. Searching Fastify Pino Logs

Logs are emitted as JSON in production (`apps/backend`):

```bash
# Grep production logs by Request ID
grep '"reqId":"req-c7a31b40-9f21-4f1e"' /var/log/mms/backend.log

# Inspect errors for a specific tenant subdomain
grep '"tenant":"darulquran"' /var/log/mms/backend.log | grep '"level":50'
```

## 3. Correlating Sentry Issues to DB Audit Rows

When investigating a Sentry issue:
1. Copy the `request_id` or `traceparent` tag from the Sentry issue detail.
2. Query the audit trail partition for matching database events:
   ```sql
   SELECT id, event_type, entity_type, entity_id, user_id, timestamp, correlation_id
   FROM audit_trail_events
   WHERE correlation_id = 'req-c7a31b40-9f21-4f1e'
   ORDER BY timestamp ASC;
   ```
3. Compare the requested mutation with the committed state to identify whether the bug was a client mapping fault, validation rejection, or an uncommitted transaction rollback.
