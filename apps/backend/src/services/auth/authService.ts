import { randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";
import { requiresTwoFactor } from "@mms/contracts";
import type { OnboardInput } from "./onboardInput.js";
import { findPlatformBlockedModule, resolvePlatformProvisionedModuleIds } from "@mms/contracts";
import { getPlatformSettings } from "../platform/platformSettingsService.js";
import {
  findUserByLoginEmailAndWorkspace,
  validateCredentials,
  type PublicUser,
} from "./userService.js";
import { toPublicUser } from "./userServiceShared.js";
import { sendTenantWelcomeEmail } from "./tenantPasswordOtpDispatch.js";
import { resolvePlatformAppOrigin } from "../platform/platformEmailConfig.js";
import {
  createWorkspace,
  deleteWorkspace,
  assertWorkspaceActive,
  upsertWorkspaceBranding,
} from "../workspaceService.js";
import { upsertContactModulePreferences } from "@mms/mod-contacts/backend/repository";
import type { Workspace } from "@mms/contracts";
import { buildBrandingFromOnboarding } from "@mms/contracts";
import {
  getJwtExpiresIn,
  loadGlobalSettings,
  saveGlobalSettings,
} from "../globalSettingsService.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { seedTenantDefaults } from "../tenantSeedService.js";
import { provisionWorkspaceAdmin } from "../workspaceAdminProvisioningService.js";
import { createTwoFactorChallenge, issueRefreshToken } from "./twoFactorService.js";
import { setAuthCookies } from "./authCookieService.js";
import { clearPlatformAccessCookie } from "../platform/platformCookieService.js";
import { unblockTenant } from "../authSessionService.js";

/** Public user shape re-exported for route usage. */
export type { PublicUser as User };

export interface AuthResult {
  user: PublicUser;
  requires2FA?: boolean;
  challengeId?: string;
  /** Legacy field — cookies are authoritative; omitted in new clients. */
  token?: string;
}

export interface OnboardResult extends AuthResult {
  workspace: Workspace;
  /** Email-activation mode: whether the activation link was actually dispatched. */
  inviteEmailSent?: boolean;
  inviteEmailError?: string;
}

import { parseSessionTimeoutMinutes } from "@mms/contracts";
import { tenantSessionScope } from "../sessionClockService.js";
import { tenantSessionPolicy } from "../sessionPolicyService.js";
import { establishSession as establishSessionShared } from "./sessionEstablishment.js";

export async function establishSession(
  user: PublicUser,
  jwtSigner: JWT,
  reply: FastifyReply,
  twoFactorVerified = true,
): Promise<AuthResult> {
  const accessExpiresIn = await getJwtExpiresIn();
  const scope = tenantSessionScope(user.workspaceSubdomain, String(user.id));
  const settings = await loadGlobalSettings(user.workspaceSubdomain);
  const sessionPolicy = tenantSessionPolicy(parseSessionTimeoutMinutes(settings.sessionTimeout));

  await establishSessionShared({
    domain: "tenant",
    jwtSigner,
    reply,
    claims: { ...user, twoFactorVerified, tokenType: "access", iat_ms: Date.now() },
    expiresIn: accessExpiresIn,
    refreshTokenProvider: () => issueRefreshToken(user),
    clearOtherDomainCookies: () => clearPlatformAccessCookie(reply),
    setDomainCookies: (accessToken, refreshToken) =>
      setAuthCookies(reply, accessToken, refreshToken ?? ""),
    sessionScope: scope,
    idleMs: sessionPolicy.idleMs,
  });

  return { user };
}

export async function loginUser(
  email: string,
  password: string,
  workspaceSubdomain: string,
  jwtSigner: JWT,
  reply: FastifyReply,
): Promise<AuthResult | null> {
  try {
    await assertWorkspaceActive(workspaceSubdomain);
  } catch (error: unknown) {
    const err = error as Error & { statusCode?: number; type?: string };
    if (err.statusCode === 403 && err.type === "workspace_disabled") {
      throw err;
    }
    return null;
  }

  const user = await validateCredentials(email, password, workspaceSubdomain);
  if (!user) return null;

  const { getTenantUsersSettings } = await import("../users/usersSettingsService.js");
  const usersSettings = await getTenantUsersSettings();
  if (usersSettings.requireEmailVerification && !user.emailVerifiedAt) {
    const err = new Error("Verify your email before signing in") as Error & {
      statusCode?: number;
      type?: string;
    };
    err.statusCode = 403;
    err.type = "email_not_verified";
    throw err;
  }

  const settings = await loadGlobalSettings();
  if (requiresTwoFactor(settings, user)) {
    const challengeId = await createTwoFactorChallenge(user);
    return { user, requires2FA: true, challengeId };
  }

  return establishSession(user, jwtSigner, reply, true);
}

export async function completeTwoFactorLogin(
  challengeId: string,
  code: string,
  jwtSigner: JWT,
  reply: FastifyReply,
  expectedTenant: string,
): Promise<AuthResult | null> {
  const { verifyTwoFactorChallenge } = await import("./twoFactorService.js");
  const user = await verifyTwoFactorChallenge(challengeId, code, expectedTenant);
  if (!user) return null;
  await assertWorkspaceActive(user.workspaceSubdomain);
  return establishSession(user, jwtSigner, reply, true);
}

/** Onboarding is always available for new, unused subdomains. */
export async function isOnboardingAvailable(): Promise<boolean> {
  return true;
}

export async function onboardUser(input: OnboardInput): Promise<OnboardResult> {
  const platformSettings = getPlatformSettings();
  const blockedModule = findPlatformBlockedModule(input.modules, platformSettings);
  if (blockedModule) {
    throw Object.assign(
      new Error(`Module "${blockedModule}" is disabled platform-wide by the operator`),
      { statusCode: 400, type: "validation_error" },
    );
  }
  const requestedModules = input.modules?.length
    ? input.modules
    : resolvePlatformProvisionedModuleIds(platformSettings);

  const workspace = await createWorkspace({
    subdomain: input.subdomain,
    madrasaName: input.madrasaName,
    tagline: input.tagline,
    country: input.country,
    industryType: input.industryType,
    provisionedAdmin: {
      name: input.adminName,
      email: input.email,
      gender: input.adminGender,
    },
  });

  try {
    await unblockTenant(workspace.subdomain);

    await runWithTenant(workspace.subdomain, async () => {
      await seedTenantDefaults();

      if (requestedModules.length > 0) {
        const { SYSTEM_MODULES } = await import("@mms/contracts");
        const globalSettings = await loadGlobalSettings(workspace.subdomain);
        const enabledModules: Record<string, boolean> = {};
        const inputModulesSet = new Set(requestedModules);

        for (const mod of SYSTEM_MODULES) {
          if (mod.required) {
            enabledModules[mod.id] = true;
          } else {
            enabledModules[mod.id] = inputModulesSet.has(mod.id);
          }
        }

        await saveGlobalSettings(
          {
            ...globalSettings,
            enabledModules,
          },
          workspace.subdomain,
        );
      }

      const branding = buildBrandingFromOnboarding({
        madrasaName: input.madrasaName,
        tagline: input.tagline,
        subdomain: workspace.subdomain,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        logoUrl: input.logoUrl,
        adminEmail: input.email,
        adminPhone: input.adminPhone,
        website: input.website,
        footerText: input.footerText,
        country: input.country,
        faviconUrl: input.faviconUrl,
        legalName: input.legalName,
        registrationNumber: input.registrationNumber,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        socialLinks: input.socialLinks,
      });
      await upsertWorkspaceBranding(workspace.subdomain, branding);

      await upsertContactModulePreferences(workspace.subdomain, {
        defaultCountry: input.country?.trim() || "",
        defaultProvince: input.region?.trim() || "",
        defaultCity: input.city?.trim() || "",
        showDetailedSolarAge: false,
        showLunarDob: false,
        showDetailedLunarAge: false,
      });

      let adminPassword: string;
      let passwordPolicyChecked = false;
      if (input.adminPasswordMode === "temporary") {
        adminPassword = input.password ?? "";
        // Password policy is enforced inside createUser.
      } else {
        adminPassword = randomBytes(32).toString("hex");
        // Cryptographically random and force-reset on first login, so it is exempt
        // from the human-entered password policy.
        passwordPolicyChecked = true;
      }
      await provisionWorkspaceAdmin({
        subdomain: workspace.subdomain,
        email: input.email,
        adminName: input.adminName,
        password: adminPassword,
        adminPhone: input.adminPhone,
        adminGender: input.adminGender,
        passwordPolicyChecked,
      });
    });
  } catch (error) {
    // Compensating action (provisioning saga): a workspace row without its super admin
    // cannot be completed through the wizard (a retry hits the 409 subdomain conflict),
    // so purge the partial tenant and let the operator retry the same subdomain.
    await deleteWorkspace(workspace.subdomain).catch(() => undefined);
    throw error;
  }

  const user = await runWithTenant(workspace.subdomain, async () => {
    const admin = await findUserByLoginEmailAndWorkspace(input.email, workspace.subdomain);
    return admin ? toPublicUser(admin) : null;
  });
  if (!user) {
    throw new Error("Failed to create workspace administrator.");
  }

  let inviteEmailSent: boolean | undefined;
  let inviteEmailError: string | undefined;
  if (input.adminPasswordMode === "email") {
    const inviteOrigin = input.origin || resolvePlatformAppOrigin();
    const dispatch = await sendTenantWelcomeEmail({
      workspaceSubdomain: workspace.subdomain,
      email: input.email,
      name: input.adminName,
      origin: inviteOrigin,
      phone: input.adminPhone,
    });
    inviteEmailSent = dispatch.sent;
    inviteEmailError = dispatch.error;
  }

  // Organization blueprints removed — industryType retained for module recommendations only.
  void input.industryType;

  return { user, workspace, inviteEmailSent, inviteEmailError };
}
