import { sql } from "drizzle-orm";
import { getDb } from "../dbClient.js";

export async function runMigration082(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO "email_integrations" (
      "workspace_subdomain",
      "provider_id",
      "from_address",
      "from_name",
      "smtp_username",
      "smtp_host",
      "smtp_port",
      "smtp_secure",
      "smtp_password",
      "connected",
      "has_credentials",
      "last_test_at",
      "last_test_ok",
      "last_error",
      "updated_at"
    )
    SELECT
      split_part(o."key", '::', 1) AS "workspace_subdomain",
      COALESCE(MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'providerId') END), 'gmail'),
      COALESCE(MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'fromAddress') END), ''),
      COALESCE(MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'fromName') END), 'Madrasa Management System'),
      COALESCE(MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'smtpUsername') END), ''),
      MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'smtpHost') END),
      MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'smtpPort')::integer END),
      bool_or(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'smtpSecure')::boolean END),
      MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration_secrets' THEN (o."data"->>'smtpPassword') END),
      COALESCE(bool_or(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'connected')::boolean END), false),
      COALESCE(bool_or(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'hasCredentials')::boolean END), false),
      MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'lastTestAt')::timestamp with time zone END),
      bool_or(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'lastTestOk')::boolean END),
      MAX(CASE WHEN split_part(o."key", '::', 2) = 'email_integration' THEN (o."data"->>'lastError') END),
      MAX(o."updated_at")
    FROM "objects" o
    WHERE split_part(o."key", '::', 2) IN ('email_integration', 'email_integration_secrets')
    GROUP BY split_part(o."key", '::', 1)
    ON CONFLICT ("workspace_subdomain") DO UPDATE SET
      "provider_id" = COALESCE(EXCLUDED."provider_id", "email_integrations"."provider_id"),
      "from_address" = COALESCE(EXCLUDED."from_address", "email_integrations"."from_address"),
      "from_name" = COALESCE(EXCLUDED."from_name", "email_integrations"."from_name"),
      "smtp_username" = COALESCE(EXCLUDED."smtp_username", "email_integrations"."smtp_username"),
      "smtp_host" = COALESCE(EXCLUDED."smtp_host", "email_integrations"."smtp_host"),
      "smtp_port" = COALESCE(EXCLUDED."smtp_port", "email_integrations"."smtp_port"),
      "smtp_secure" = COALESCE(EXCLUDED."smtp_secure", "email_integrations"."smtp_secure"),
      "smtp_password" = COALESCE(EXCLUDED."smtp_password", "email_integrations"."smtp_password"),
      "connected" = COALESCE(EXCLUDED."connected", "email_integrations"."connected"),
      "has_credentials" = COALESCE(EXCLUDED."has_credentials", "email_integrations"."has_credentials"),
      "last_test_at" = COALESCE(EXCLUDED."last_test_at", "email_integrations"."last_test_at"),
      "last_test_ok" = COALESCE(EXCLUDED."last_test_ok", "email_integrations"."last_test_ok"),
      "last_error" = COALESCE(EXCLUDED."last_error", "email_integrations"."last_error"),
      "updated_at" = COALESCE(EXCLUDED."updated_at", "email_integrations"."updated_at");
  `);
}
