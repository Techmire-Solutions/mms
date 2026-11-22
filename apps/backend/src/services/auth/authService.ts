import { randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";
import { requiresTwoFactor, type BrandingSocialLink } from "@mms/shared";
import {
  createUser,
  findUserByLoginEmailAndWorkspace,
  validateCredentials,
  type PublicUser,
} from "./userService.js";
import { toPublicUser } from "./userServiceShared.js";
import { sendTenantWelcomeEmail } from "./tenantPasswordOtpDispatch.js";
import { resolvePlatformAppOrigin } from "../platform/platformEmailConfig.js";
import {
  createWorkspace,
  assertWorkspaceActive,
  upsertWorkspaceBranding,
} from "../workspaceService.js";
import { upsertContactModulePreferences } from "../../db/repositories/contactModulePreferencesRepository.js";
import type { Workspace } from "@mms/shared";
import { buildBrandingFromOnboarding } from "@mms/shared";
import {
  getJwtExpiresIn,
  loadGlobalSettings,
  saveGlobalSettings,
} from "../globalSettingsService.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { seedTenantDefaults } from "../tenantSeedService.js";
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

export interface OnboardInput {
  email: string;
  adminName: string;
  password?: string;
  origin?: string;
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  country?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  adminPhone?: string;
  website?: string;
  footerText?: string;
  // Extended fields
  faviconUrl?: string;
  legalName?: string;
  registrationNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  socialLinks?: BrandingSocialLink[];
  modules?: string[];
  industryType?: string;
}

export interface OnboardResult extends AuthResult {
  workspace: Workspace;
}

import { parseSessionTimeoutMinutes } from "@mms/shared";
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
  const workspace = await createWorkspace({
    subdomain: input.subdomain,
    madrasaName: input.madrasaName,
    tagline: input.tagline,
    country: input.country,
    industryType: input.industryType,
  });

  await unblockTenant(workspace.subdomain);

  await runWithTenant(workspace.subdomain, async () => {
    await seedTenantDefaults();

    if (input.modules) {
      const { SYSTEM_MODULES } = await import("@mms/shared");
      const globalSettings = await loadGlobalSettings(workspace.subdomain);
      const enabledModules: Record<string, boolean> = {};
      const inputModulesSet = new Set(input.modules);

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

    const passwordCandidate = input.password?.trim();
    let adminPassword: string;
    let passwordPolicyChecked = false;
    if (passwordCandidate) {
      adminPassword = input.password ?? passwordCandidate;
      // Password policy is enforced inside createUser.
    } else {
      adminPassword = randomBytes(32).toString("hex");
      // Cryptographically random and force-reset on first login, so it is exempt
      // from the human-entered password policy.
      passwordPolicyChecked = true;
    }
    await createUser(input.email, input.adminName, adminPassword, "admin", workspace.subdomain, {
      mustChangePassword: true,
      passwordPolicyChecked,
    });
  });

  const user = await runWithTenant(workspace.subdomain, async () => {
    const admin = await findUserByLoginEmailAndWorkspace(input.email, workspace.subdomain);
    return admin ? toPublicUser(admin) : null;
  });
  if (!user) {
    throw new Error("Failed to create workspace administrator.");
  }

  if (!input.password?.trim()) {
    const inviteOrigin = input.origin || resolvePlatformAppOrigin();
    await sendTenantWelcomeEmail({
      workspaceSubdomain: workspace.subdomain,
      email: input.email,
      name: input.adminName,
      origin: inviteOrigin,
      phone: input.adminPhone,
    });
  }

  // Organization blueprints removed — industryType retained for module recommendations only.
  void input.industryType;

  return { user, workspace };
}
