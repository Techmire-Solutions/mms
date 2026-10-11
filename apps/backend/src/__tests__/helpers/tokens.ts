import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

type TokenRole =
  "admin" | "teacher" | "accountant" | "assistant_teacher" | "viewer" | "guardian" | "auditor";

type TenantTokenOptions = {
  role?: TokenRole;
  id?: string;
  email?: string;
  name?: string;
  workspaceSubdomain?: string;
  twoFactorVerified?: boolean;
  jti?: string;
};

export function signTenantToken(app: FastifyInstance, options: TenantTokenOptions = {}): string {
  const role = options.role ?? "admin";
  return app.jwt.sign({
    id: options.id ?? `u-${role}`,
    email: options.email ?? `${role}@test.com`,
    name: options.name ?? role.charAt(0).toUpperCase() + role.slice(1),
    role,
    workspaceSubdomain: options.workspaceSubdomain ?? "demo",
    twoFactorVerified: options.twoFactorVerified ?? true,
    tokenType: "access",
    jti: options.jti ?? randomUUID(),
  });
}

type RoleTokenOptions = Omit<TenantTokenOptions, "role">;

export function adminToken(app: FastifyInstance, options: RoleTokenOptions = {}): string {
  return signTenantToken(app, {
    id: "u-admin",
    email: "admin@test.com",
    name: "Admin",
    ...options,
    role: "admin",
  });
}

export function teacherToken(app: FastifyInstance, options: RoleTokenOptions = {}): string {
  return signTenantToken(app, {
    id: "u-teacher",
    email: "teacher@test.com",
    name: "Teacher",
    ...options,
    role: "teacher",
  });
}

export function accountantToken(app: FastifyInstance, options: RoleTokenOptions = {}): string {
  return signTenantToken(app, {
    id: "u-accountant",
    email: "accountant@test.com",
    name: "Accountant",
    ...options,
    role: "accountant",
  });
}

export function assistantTeacherToken(
  app: FastifyInstance,
  options: RoleTokenOptions = {},
): string {
  return signTenantToken(app, {
    id: "u-assistant_teacher",
    email: "assistant_teacher@test.com",
    name: "Assistant Teacher",
    ...options,
    role: "assistant_teacher",
  });
}

export function viewerToken(app: FastifyInstance, options: RoleTokenOptions = {}): string {
  return signTenantToken(app, {
    id: "u-viewer",
    email: "viewer@test.com",
    name: "Viewer",
    ...options,
    role: "viewer",
  });
}

export function guardianToken(app: FastifyInstance, options: RoleTokenOptions = {}): string {
  return signTenantToken(app, {
    id: "u-guardian",
    email: "guardian@test.com",
    name: "Guardian",
    ...options,
    role: "guardian",
  });
}

export function auditorToken(app: FastifyInstance, options: RoleTokenOptions = {}): string {
  return signTenantToken(app, {
    id: "u-auditor",
    email: "auditor@test.com",
    name: "Auditor",
    ...options,
    role: "auditor",
  });
}

export function bearerAuth(token: string): string {
  return `Bearer ${token}`;
}
