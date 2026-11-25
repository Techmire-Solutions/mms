-- Consolidate structurally identical, session-local class rows before enforcing uniqueness.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM session_classes
    GROUP BY
      workspace_subdomain,
      session_id,
      lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
      AND count(DISTINCT concat_ws(
        '|', teacher_id, coalesce(teacher_name, ''), age_min, age_max,
        gender, capacity, coalesce(room, ''), sort_order
      )) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate session classes: duplicate names have different class attributes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM session_classes
    GROUP BY workspace_subdomain, id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate session classes: class IDs are reused across sessions';
  END IF;
END
$$;

CREATE TEMP TABLE session_class_dedupe_map ON COMMIT DROP AS
WITH class_refs AS (
  SELECT
    sc.*,
    lower(btrim(regexp_replace(sc.name, '[[:space:]]+', ' ', 'g'))) AS normalized_name,
    (SELECT count(*) FROM enrollments e
      WHERE e.workspace_subdomain = sc.workspace_subdomain AND e.class_id = sc.id) AS enrollment_refs,
    (SELECT count(*) FROM attendance a
      WHERE a.workspace_subdomain = sc.workspace_subdomain AND a.class_id = sc.id) AS attendance_refs,
    (SELECT count(*) FROM exam_classes ec
      WHERE ec.workspace_subdomain = sc.workspace_subdomain AND ec.class_id = sc.id) AS exam_refs
  FROM session_classes sc
), ranked AS (
  SELECT
    workspace_subdomain,
    session_id,
    normalized_name,
    id AS old_id,
    first_value(id) OVER (
      PARTITION BY workspace_subdomain, session_id, normalized_name
      ORDER BY enrollment_refs DESC, attendance_refs DESC, exam_refs DESC, created_at, id
    ) AS keep_id,
    count(*) OVER (
      PARTITION BY workspace_subdomain, session_id, normalized_name
    ) AS group_size
  FROM class_refs
)
SELECT workspace_subdomain, session_id, normalized_name, old_id, keep_id
FROM ranked
WHERE group_size > 1 AND old_id <> keep_id;

CREATE INDEX session_class_dedupe_map_old_idx
  ON session_class_dedupe_map (workspace_subdomain, old_id);

-- Abort rather than discard conflicting attendance if consolidation would collide.
DO $$
BEGIN
  IF EXISTS (
    WITH projected AS (
      SELECT
        a.workspace_subdomain,
        coalesce(m.keep_id, a.class_id) AS class_id,
        a.student_id,
        a.date
      FROM attendance a
      LEFT JOIN session_class_dedupe_map m
        ON m.workspace_subdomain = a.workspace_subdomain
       AND m.old_id = a.class_id
      WHERE a.deleted_at IS NULL
    )
    SELECT 1
    FROM projected
    GROUP BY workspace_subdomain, class_id, student_id, date
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate session classes: active attendance rows would conflict';
  END IF;
END
$$;

UPDATE enrollments e
SET
  class_id = m.keep_id,
  class_name = kept.name,
  updated_at = clock_timestamp()
FROM session_class_dedupe_map m
JOIN session_classes kept
  ON kept.workspace_subdomain = m.workspace_subdomain
 AND kept.session_id = m.session_id
 AND kept.id = m.keep_id
WHERE e.workspace_subdomain = m.workspace_subdomain
  AND e.class_id = m.old_id;

UPDATE attendance a
SET
  class_id = m.keep_id,
  updated_at = clock_timestamp()
FROM session_class_dedupe_map m
WHERE a.workspace_subdomain = m.workspace_subdomain
  AND a.class_id = m.old_id;

INSERT INTO exam_classes (workspace_subdomain, exam_id, class_id, created_at)
SELECT ec.workspace_subdomain, ec.exam_id, m.keep_id, min(ec.created_at)
FROM exam_classes ec
JOIN session_class_dedupe_map m
  ON m.workspace_subdomain = ec.workspace_subdomain
 AND m.old_id = ec.class_id
GROUP BY ec.workspace_subdomain, ec.exam_id, m.keep_id
ON CONFLICT (workspace_subdomain, exam_id, class_id) DO NOTHING;

DELETE FROM exam_classes ec
USING session_class_dedupe_map m
WHERE ec.workspace_subdomain = m.workspace_subdomain
  AND ec.class_id = m.old_id;

DELETE FROM session_classes sc
USING session_class_dedupe_map m
WHERE sc.workspace_subdomain = m.workspace_subdomain
  AND sc.session_id = m.session_id
  AND sc.id = m.old_id;

CREATE UNIQUE INDEX session_classes_workspace_session_name_uidx
  ON session_classes (
    workspace_subdomain,
    session_id,
    lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
  );
