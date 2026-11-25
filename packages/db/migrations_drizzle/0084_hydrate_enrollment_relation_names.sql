-- Hydrate denormalized enrollment labels after class-ID consolidation.
UPDATE enrollments e
SET
  class_name = sc.name,
  updated_at = clock_timestamp()
FROM session_classes sc
WHERE sc.workspace_subdomain = e.workspace_subdomain
  AND sc.id = e.class_id
  AND e.class_name IS DISTINCT FROM sc.name;

UPDATE enrollments e
SET
  session_name = s.name,
  updated_at = clock_timestamp()
FROM sessions s
WHERE s.workspace_subdomain = e.workspace_subdomain
  AND s.id = e.session_id
  AND e.session_name IS DISTINCT FROM s.name;
