-- Ensure every enrollment references the class offering from its own session.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM session_classes
    GROUP BY workspace_subdomain, id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot repair enrollments: class IDs are reused across sessions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM enrollments e
    LEFT JOIN session_classes sc
      ON sc.workspace_subdomain = e.workspace_subdomain
     AND sc.id = e.class_id
    WHERE sc.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot repair enrollments: one or more class references are missing';
  END IF;
END
$$;

CREATE TEMP TABLE missing_enrollment_session_classes ON COMMIT DROP AS
WITH conflicts AS (
  SELECT
    e.workspace_subdomain,
    e.session_id AS target_session_id,
    sc.id AS source_class_id,
    sc.name,
    lower(btrim(regexp_replace(sc.name, '[[:space:]]+', ' ', 'g'))) AS normalized_name,
    sc.age_min,
    sc.age_max,
    sc.gender,
    sc.teacher_id,
    sc.teacher_name,
    sc.capacity,
    sc.room,
    sc.created_at
  FROM enrollments e
  INNER JOIN session_classes sc
    ON sc.workspace_subdomain = e.workspace_subdomain
   AND sc.id = e.class_id
  WHERE e.session_id <> sc.session_id
), missing AS (
  SELECT c.*
  FROM conflicts c
  WHERE NOT EXISTS (
    SELECT 1
    FROM session_classes target
    WHERE target.workspace_subdomain = c.workspace_subdomain
      AND target.session_id = c.target_session_id
      AND lower(btrim(regexp_replace(target.name, '[[:space:]]+', ' ', 'g'))) = c.normalized_name
  )
), ranked AS (
  SELECT
    m.*,
    row_number() OVER (
      PARTITION BY m.workspace_subdomain, m.target_session_id, m.normalized_name
      ORDER BY m.created_at, m.source_class_id
    ) AS source_rank
  FROM missing m
)
SELECT
  workspace_subdomain,
  target_session_id,
  normalized_name,
  name,
  age_min,
  age_max,
  gender,
  teacher_id,
  teacher_name,
  capacity,
  room
FROM ranked
WHERE source_rank = 1;

DO $$
BEGIN
  IF EXISTS (
    WITH conflicts AS (
      SELECT
        e.workspace_subdomain,
        e.session_id AS target_session_id,
        lower(btrim(regexp_replace(sc.name, '[[:space:]]+', ' ', 'g'))) AS normalized_name,
        concat_ws(
          '|', sc.age_min, sc.age_max, sc.gender, sc.teacher_id,
          coalesce(sc.teacher_name, ''), sc.capacity, coalesce(sc.room, '')
        ) AS attributes
      FROM enrollments e
      INNER JOIN session_classes sc
        ON sc.workspace_subdomain = e.workspace_subdomain
       AND sc.id = e.class_id
      WHERE e.session_id <> sc.session_id
        AND NOT EXISTS (
          SELECT 1
          FROM session_classes target
          WHERE target.workspace_subdomain = e.workspace_subdomain
            AND target.session_id = e.session_id
            AND lower(btrim(regexp_replace(target.name, '[[:space:]]+', ' ', 'g')))
              = lower(btrim(regexp_replace(sc.name, '[[:space:]]+', ' ', 'g')))
        )
    )
    SELECT 1
    FROM conflicts
    GROUP BY workspace_subdomain, target_session_id, normalized_name
    HAVING count(DISTINCT attributes) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot repair enrollments: missing session classes have conflicting templates';
  END IF;
END
$$;

INSERT INTO session_classes (
  id,
  workspace_subdomain,
  session_id,
  name,
  age_min,
  age_max,
  gender,
  teacher_id,
  teacher_name,
  capacity,
  enrolled,
  room,
  sort_order,
  created_at
)
SELECT
  gen_random_uuid()::text,
  missing.workspace_subdomain,
  missing.target_session_id,
  missing.name,
  missing.age_min,
  missing.age_max,
  missing.gender,
  missing.teacher_id,
  missing.teacher_name,
  missing.capacity,
  0,
  missing.room,
  coalesce(existing.max_sort_order, -1) + missing.session_rank,
  clock_timestamp()
FROM (
  SELECT
    m.*,
    row_number() OVER (
      PARTITION BY m.workspace_subdomain, m.target_session_id
      ORDER BY m.normalized_name
    ) AS session_rank
  FROM missing_enrollment_session_classes m
) missing
LEFT JOIN LATERAL (
  SELECT max(sc.sort_order) AS max_sort_order
  FROM session_classes sc
  WHERE sc.workspace_subdomain = missing.workspace_subdomain
    AND sc.session_id = missing.target_session_id
) existing ON true
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE enrollment_session_class_repair_map ON COMMIT DROP AS
SELECT
  e.workspace_subdomain,
  e.id AS enrollment_id,
  target.session_id,
  target.id AS class_id,
  target.name AS class_name,
  s.name AS session_name
FROM enrollments e
INNER JOIN session_classes source
  ON source.workspace_subdomain = e.workspace_subdomain
 AND source.id = e.class_id
INNER JOIN session_classes target
  ON target.workspace_subdomain = e.workspace_subdomain
 AND target.session_id = e.session_id
 AND lower(btrim(regexp_replace(target.name, '[[:space:]]+', ' ', 'g')))
   = lower(btrim(regexp_replace(source.name, '[[:space:]]+', ' ', 'g')))
INNER JOIN sessions s
  ON s.workspace_subdomain = e.workspace_subdomain
 AND s.id = e.session_id
WHERE e.session_id <> source.session_id;

CREATE UNIQUE INDEX enrollment_session_class_repair_map_enrollment_uidx
  ON enrollment_session_class_repair_map (workspace_subdomain, enrollment_id);

UPDATE enrollments e
SET
  class_id = repair.class_id,
  class_name = repair.class_name,
  session_name = repair.session_name,
  updated_at = clock_timestamp()
FROM enrollment_session_class_repair_map repair
WHERE e.workspace_subdomain = repair.workspace_subdomain
  AND e.id = repair.enrollment_id;

UPDATE session_classes sc
SET enrolled = counts.active_enrollments
FROM (
  SELECT
    affected.workspace_subdomain,
    affected.class_id,
    count(e.id) FILTER (
      WHERE e.status = 'active' AND e.deleted_at IS NULL
    )::integer AS active_enrollments
  FROM (
    SELECT DISTINCT workspace_subdomain, class_id
    FROM enrollment_session_class_repair_map
  ) affected
  LEFT JOIN enrollments e
    ON e.workspace_subdomain = affected.workspace_subdomain
   AND e.class_id = affected.class_id
  GROUP BY affected.workspace_subdomain, affected.class_id
) counts
WHERE sc.workspace_subdomain = counts.workspace_subdomain
  AND sc.id = counts.class_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM enrollments e
    INNER JOIN session_classes sc
      ON sc.workspace_subdomain = e.workspace_subdomain
     AND sc.id = e.class_id
    WHERE e.session_id <> sc.session_id
  ) THEN
    RAISE EXCEPTION 'Enrollment repair incomplete: session/class mismatches remain';
  END IF;
END
$$;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_session_class_fk
  FOREIGN KEY (workspace_subdomain, session_id, class_id)
  REFERENCES session_classes (workspace_subdomain, session_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE enrollments
  VALIDATE CONSTRAINT enrollments_session_class_fk;
