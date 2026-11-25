-- Allow messaging dispatch idempotency keys in auth_artifacts.
ALTER TABLE "auth_artifacts" DROP CONSTRAINT IF EXISTS "auth_artifacts_kind_check";
ALTER TABLE "auth_artifacts" ADD CONSTRAINT "auth_artifacts_kind_check" CHECK ("kind" IN (
	'handoff',
	'two_factor_challenge',
	'refresh_token',
	'platform_setup',
	'platform_password_reset',
	'login_email_change',
	'messaging_idempotency'
));
