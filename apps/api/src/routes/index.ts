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
import { mountModuleDescriptor } from "../compose.js";

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
  });
  await mountModuleDescriptor(app, {
    moduleKey: "contacts",
    restBasePath: "/api/contacts",
    register: contactRoutes,
  });
  await app.register(emailRoutes, { prefix: "/api/email" });
  await app.register(smsRoutes, { prefix: "/api/sms" });
  await app.register(whatsappRoutes, { prefix: "/api/whatsapp" });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "students");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "students",
    restBasePath: "/api/students",
    register: studentsTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "faculty");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "faculty",
    restBasePath: "/api/faculty",
    register: facultyTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "tasks");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "tasks",
    restBasePath: "/api/tasks",
    register: tasksTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    await scope.register(documentTemplatesRoutes);
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "finance");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "finance",
    restBasePath: "/api/finance",
    register: financeTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "enrollments");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "enrollments",
    restBasePath: "/api/enrollments",
    register: enrollmentsTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "obligations");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "obligations",
    restBasePath: "/api/obligations",
    register: obligationsRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "accounting");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "accounting",
    restBasePath: "/api/accounting",
    register: tenantAccountingRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "hasanat");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "hasanat",
    restBasePath: "/api/hasanat",
    register: hasanatTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "workshops");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "workshops",
    restBasePath: "/api/workshops",
    register: workshopsRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "examinations");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "examinations",
    restBasePath: "/api/examinations",
    register: examinationsRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "questionBank");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "questionBank",
    restBasePath: "/api/question-bank",
    register: questionBankRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "users");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "users",
    restBasePath: "/api/users",
    register: usersRoutes,
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
  });
  await mountModuleDescriptor(app, {
    moduleKey: "attendance",
    restBasePath: "/api/attendance",
    register: attendanceTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "sessions");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "sessions",
    restBasePath: "/api/sessions",
    register: sessionsTenantRoutes,
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, "messaging");
  });
  await mountModuleDescriptor(app, {
    moduleKey: "messaging",
    restBasePath: "/api/messaging",
    register: messagingTenantRoutes,
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
