import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  changePasswordBodySchema,
  requestLoginEmailChangeBodySchema,
  confirmLoginEmailChangeBodySchema,
} from "../schemas/profile.dto.js";
import {
  loginBodySchema,
  challengeCodeBodySchema,
  challengeIdBodySchema,
  tenantLoginResponseSchema,
  tenantAuthErrorSchema,
} from "../schemas/auth.dto.js";

const c = initContract();

export const authContract = c.router({
  login: {
    method: "POST",
    path: "/api/auth/login",
    body: loginBodySchema,
    responses: {
      200: tenantLoginResponseSchema,
      400: tenantAuthErrorSchema,
      401: tenantAuthErrorSchema,
      403: tenantAuthErrorSchema,
    },
    summary: "Tenant user login",
  },
  verifyTwoFactor: {
    method: "POST",
    path: "/api/auth/2fa/verify",
    body: challengeCodeBodySchema,
    responses: {
      200: tenantLoginResponseSchema,
      401: tenantAuthErrorSchema,
    },
    summary: "Verify tenant two-factor authentication challenge",
  },
  resendTwoFactor: {
    method: "POST",
    path: "/api/auth/2fa/resend",
    body: challengeIdBodySchema,
    responses: {
      200: z.object({ success: z.boolean() }),
      404: tenantAuthErrorSchema,
    },
    summary: "Resend tenant two-factor challenge",
  },
  institutionSetupStatus: {
    method: "GET",
    path: "/api/auth/institution-setup-status",
    responses: {
      200: z.object({ complete: z.boolean() }),
      401: z.unknown(),
      403: z.unknown(),
    },
    summary: "Get workspace institution setup completion status",
  },
  changePassword: {
    method: "POST",
    path: "/api/auth/change-password",
    body: changePasswordBodySchema,
    responses: {
      200: z.object({
        success: z.boolean(),
        requiresSignIn: z.boolean().optional(),
      }),
      400: z.unknown(),
      401: z.unknown(),
      403: z.unknown(),
    },
    summary: "Change user password",
  },
  requestLoginEmail: {
    method: "POST",
    path: "/api/auth/login-email/request",
    body: requestLoginEmailChangeBodySchema,
    responses: {
      200: z.object({
        challengeId: z.string(),
        devCode: z.string().optional(),
      }),
      400: z.unknown(),
      401: z.unknown(),
      403: z.unknown(),
    },
    summary: "Request login email change",
  },
  confirmLoginEmail: {
    method: "POST",
    path: "/api/auth/login-email/confirm",
    body: confirmLoginEmailChangeBodySchema,
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
      400: z.unknown(),
      401: z.unknown(),
      403: z.unknown(),
    },
    summary: "Confirm login email change",
  },
  // Server-synced per-user UI preferences (`/api/auth/me/ui-state`, plain Fastify handler).
  getUiState: {
    method: "GET",
    path: "/api/auth/me/ui-state",
    responses: { 200: z.unknown(), 401: z.unknown() },
    summary: "Get the current user's UI state",
  },
  patchUiState: {
    method: "PATCH",
    path: "/api/auth/me/ui-state",
    body: z.unknown(),
    responses: { 200: z.unknown(), 400: z.unknown(), 401: z.unknown() },
    summary: "Update the current user's UI state",
  },
});
