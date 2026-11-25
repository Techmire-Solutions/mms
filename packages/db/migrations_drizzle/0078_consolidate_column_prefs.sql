-- Custom Data Migration: Move all legacy column preferences into generic user_ui_preferences store
-- This runs before Drizzle automatically drops the tables.

DO $$ 
BEGIN

    -- 1. Contacts
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contact_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('contacts.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM contact_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 2. Students
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('students.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM student_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 3. Teachers
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teacher_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('teachers.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM teacher_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 4. Sessions
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'session_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('sessions.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM session_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 5. Enrollments
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'enrollment_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('enrollments.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM enrollment_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 6. Users
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('users.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM user_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 7. Attendance
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('attendance.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM attendance_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 8. Question Bank
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'question_bank_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('question-bank.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM question_bank_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 9. Finance Invoices
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('finance.invoice.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM finance_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 10. Finance Payments
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_payment_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('finance.payment.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM finance_payment_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 11. Accounting Journals
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_journal_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('accounting.journal.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM accounting_journal_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 12. Accounting Accounts
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_account_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('accounting.account.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM accounting_account_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 13. Examinations Exam
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'examination_exam_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('examinations.exam.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM examination_exam_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 14. Examinations Results
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'examination_results_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('examinations.results.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM examination_results_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 15. Hasanat Distribution
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hasanat_distribution_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('hasanat.distribution.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM hasanat_distribution_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 16. Hasanat Redemption
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hasanat_redemption_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('hasanat.redemption.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM hasanat_redemption_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 17. Obligations
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'obligations_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('obligations.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM obligations_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 18. Messaging Recipients
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messaging_recipients_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('messaging.recipients.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM messaging_recipients_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 19. Messaging History
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messaging_history_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('messaging.history.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM messaging_history_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 20. Messaging Templates
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messaging_templates_user_column_prefs') THEN
        INSERT INTO user_ui_preferences (workspace_subdomain, user_id, state, updated_at)
        SELECT p.workspace_subdomain, p.user_id, 
            jsonb_build_object('messaging.templates.table.columns', p.preferences) AS state,
            CURRENT_TIMESTAMP
        FROM messaging_templates_user_column_prefs p
        INNER JOIN tenant_users u ON u.workspace_subdomain = p.workspace_subdomain AND u.id = p.user_id
        ON CONFLICT (workspace_subdomain, user_id) 
        DO UPDATE SET state = user_ui_preferences.state || EXCLUDED.state, updated_at = CURRENT_TIMESTAMP;
    END IF;

END $$;

-- Drop tables
DROP TABLE IF EXISTS "contact_user_column_prefs";
DROP TABLE IF EXISTS "student_user_column_prefs";
DROP TABLE IF EXISTS "teacher_user_column_prefs";
DROP TABLE IF EXISTS "session_user_column_prefs";
DROP TABLE IF EXISTS "enrollment_user_column_prefs";
DROP TABLE IF EXISTS "user_user_column_prefs";
DROP TABLE IF EXISTS "attendance_user_column_prefs";
DROP TABLE IF EXISTS "question_bank_user_column_prefs";
DROP TABLE IF EXISTS "finance_user_column_prefs";
DROP TABLE IF EXISTS "finance_payment_user_column_prefs";
DROP TABLE IF EXISTS "accounting_journal_user_column_prefs";
DROP TABLE IF EXISTS "accounting_account_user_column_prefs";
DROP TABLE IF EXISTS "examination_exam_user_column_prefs";
DROP TABLE IF EXISTS "examination_results_user_column_prefs";
DROP TABLE IF EXISTS "hasanat_distribution_user_column_prefs";
DROP TABLE IF EXISTS "hasanat_redemption_user_column_prefs";
DROP TABLE IF EXISTS "obligations_user_column_prefs";
DROP TABLE IF EXISTS "messaging_recipients_user_column_prefs";
DROP TABLE IF EXISTS "messaging_history_user_column_prefs";
DROP TABLE IF EXISTS "messaging_templates_user_column_prefs";
