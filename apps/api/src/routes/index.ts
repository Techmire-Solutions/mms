import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import authRoutes from "./common/auth.js";
import { contactRoutes } from "@mms/mod-contacts/backend/tenant";
import dbRoutes from "./common/db.js";
import emailRoutes from "./common/email.js";
import smsRoutes from "./common/sms.js";
import whatsappRoutes from "./common/whatsapp.js";
import healthRoutes from "./common/health.js";
import metricsRoutes from "./common/metrics.js";
import platformContactsRoutes from "@mms/mod-contacts/backend/platform";
import publicRoutes from "./common/public.js";
import { publicRegistrationRoutes } from "./common/publicRegistrationRoutes.js";
import studentsTenantRoutes from "@mms/mod-students/backend/tenant";
import facultyTenantRoutes from "@mms/mod-faculty/backend/tenant";
import financeTenantRoutes from "@mms/mod-billing/backend/tenant";
import enrollmentsTenantRoutes from "@mms/mod-enrollments/backend/tenant";
import { obligationsRoutes } from "@mms/mod-obligations/backend/tenant";
import hasanatTenantRoutes from "@mms/mod-hasanat/backend/tenant";
import { workshopsRoutes } from "@mms/mod-workshops/backend/tenant";
import { examinationsRoutes } from "@mms/mod-examinations/backend/tenant";
import { questionBankRoutes } from "@mms/mod-question-bank/backend/tenant";
import usersRoutes from "@mms/mod-iam/backend/tenant/users";
import attendanceTenantRoutes from "@mms/mod-attendance/backend/tenant";
import sessionsTenantRoutes from "@mms/mod-sessions/backend/tenant";
import backgroundJobRoutes from "./common/backgroundJobs.js";
import uploadRoutes from "./common/uploads.js";
import workspaceRoutes from "./tenant/workspace.js";
import aiRoutes from "./common/ai.js";
import websocketRoutes from "./common/websocket.js";
import messagingTenantRoutes from "@mms/mod-messaging/backend/tenant";
import savedReportsRoutes from "./tenant/savedReports.js";
import dashboardRoutes from "./tenant/dashboard.js";
import openapiRoutes from "./common/openapi.js";
import { auditRoutes } from "@mms/mod-audit/backend/tenant";
import { notificationsRoutes } from "@mms/mod-notifications/backend/tenant";
import moduleAccessRoutes from "./tenant/moduleAccess.js";
import tasksTenantRoutes from "@mms/mod-tasks/backend/tenant";
import platformRoutes from "@mms/mod-platform/backend/platform/router";
import { documentTemplatesRoutes } from "@mms/mod-documents/backend/tenant";
import { tenantIamRoutes } from "@mms/mod-iam/backend/tenant";
import { platformIamRoutes } from "@mms/mod-iam/backend/platform";
import { platformAccountingRoutes } from "@mms/mod-accounting/backend/platform";
import { tenantAccountingRoutes } from "@mms/mod-accounting/backend/tenant";
import "../modules/accounting/configure.js";
import { configureFacultyAccountDeletionGuard } from "../modules/faculty/adapters.js";
import { iamService } from "../modules/iam/compose.js";
import { authenticateTenant } from "../middleware/authenticate.js";
import {
  authenticatePlatform,
  requirePlatformPermission,
  requirePlatformSuperUser,
} from "../middleware/authenticatePlatform.js";
import { registerModuleAccess } from "../middleware/requireTenantModule.js";

// Composition root: bind the faculty domain's soft-deleted-account probe to the
// auth middleware port. Runs on module load (app.ts imports this file), before any
// request reaches `authenticateTenant`.
configureFacultyAccountDeletionGuard();

const requireIamSuperUser: preHandlerAsyncHookHandler = async (request, reply) => {
  await requirePlatformSuperUser()(request, reply);
};

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(openapiRoutes);
  await app.register(healthRoutes);
  await app.register(metricsRoutes);
  await app.register(platformRoutes);
  await app.register(publicRoutes, { prefix: "/api/public" });
  await app.register(publicRegistrationRoutes);
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticatePlatform);
    scope.addHook("preHandler", requirePlatformPermission("contacts"));
    await scope.register(platformContactsRoutes);
  });
  await app.register(workspaceRoutes, { prefix: "/api/workspace" });
  await app.register(workspaceRoutes, { prefix: "/api/workspaces" });
  await app.register(uploadRoutes, { prefix: "/api/uploads" });
  await app.register(dbRoutes, { prefix: "/api/db" });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "contacts");
    await scope.register(contactRoutes);
  });
  await app.register(emailRoutes, { prefix: "/api/email" });
  await app.register(smsRoutes, { prefix: "/api/sms" });
  await app.register(whatsappRoutes, { prefix: "/api/whatsapp" });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "students");
    await scope.register(studentsTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "faculty");
    await scope.register(facultyTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "tasks");
    await scope.register(tasksTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    await scope.register(documentTemplatesRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "finance");
    await scope.register(financeTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "enrollments");
    await scope.register(enrollmentsTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "obligations");
    await scope.register(obligationsRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "accounting");
    await scope.register(tenantAccountingRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "hasanat");
    await scope.register(hasanatTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "workshops");
    await scope.register(workshopsRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "examinations");
    await scope.register(examinationsRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "questionBank");
    await scope.register(questionBankRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "users");
    await scope.register(usersRoutes);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "users");
    await scope.register(tenantIamRoutes, { service: iamService });
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticatePlatform);
    scope.addHook("preHandler", requirePlatformPermission("workspaces"));
    await scope.register(platformAccountingRoutes);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticatePlatform);
    scope.addHook("preHandler", requirePlatformPermission("admins"));
    await scope.register(platformIamRoutes, {
      service: iamService,
      requireSuperUser: requireIamSuperUser,
    });
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "attendance");
    await scope.register(attendanceTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "sessions");
    await scope.register(sessionsTenantRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "messaging");
    await scope.register(messagingTenantRoutes);
  });
  await app.register(savedReportsRoutes);
  await app.register(dashboardRoutes);
  await app.register(moduleAccessRoutes);
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    await scope.register(auditRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    await scope.register(notificationsRoutes);
  });
  await app.register(backgroundJobRoutes, { prefix: "/api/background-jobs" });
  await app.register(aiRoutes, { prefix: "/api/ai" });
  await app.register(websocketRoutes);
  await app.register(websocketRoutes, { prefix: "/api" });
}
