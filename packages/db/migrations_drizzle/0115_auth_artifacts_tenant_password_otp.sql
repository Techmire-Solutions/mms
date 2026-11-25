-- Allow tenant "set your password" OTP codes in auth_artifacts (replaces the
-- tenant_user_invite token-link mechanism for new-user activation and also
-- backs the tenant forgot-password flow). tenant_user_invite stays in the
-- constraint — unused going forward, but forward-only migrations never remove
-- a previously-added enum value.
ALTER TABLE "auth_artifacts" DROP CONSTRAINT IF EXISTS "auth_artifacts_kind_check";
ALTER TABLE "auth_artifacts" ADD CONSTRAINT "auth_artifacts_kind_check" CHECK ("kind" IN (
	'handoff',
	'two_factor_challenge',
	'refresh_token',
	'platform_setup',
	'platform_password_reset',
	'login_email_change',
	'messaging_idempotency',
	'tenant_user_invite',
	'tenant_password_otp'
));
