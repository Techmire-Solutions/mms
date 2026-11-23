import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformSettingsDtoSchema as platformSettingsSchema,
  platformBrandingDtoSchema,
  platformBrandingSaveSchema,
  platformModuleCatalogDtoSchema,
  platformModulesUpdateSchema,
  platformLlmUpdateSchema,
  platformLlmTestBodySchema,
  platformBackupExportBodySchema,
  platformBackupExportResponseSchema,
  platformBackupImportBodySchema,
  platformConfigBackupApplyResultSchema,
  platformErrorDtoSchema as platformErrorSchema,
} from "../schemas/platform.dto.js";
import {
  aiModelsBodySchema,
  aiModelsResponseSchema,
  aiTestResultResponseSchema,
} from "./ai.contract.js";

const c = initContract();

// Branding / appearance (platform console white-label)
export const platformBrandingRoutes = {
  getBranding: {
    method: "GET",
    path: "/api/platform/branding",
    responses: {
      200: z.object({ branding: platformBrandingDtoSchema }),
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Get platform branding",
  },
  updateBranding: {
    method: "PUT",
    path: "/api/platform/branding",
    body: platformBrandingSaveSchema,
    responses: {
      200: z.object({ branding: platformBrandingDtoSchema, success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      409: platformErrorSchema,
    },
    summary: "Update platform branding and instance theme mode",
  },
} as const;

// Module availability + provisioning defaults
export const platformModuleRoutes = {
  getModuleCatalog: {
    method: "GET",
    path: "/api/platform/modules/catalog",
    responses: {
      200: platformModuleCatalogDtoSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Get platform module availability catalog",
  },
  updateModules: {
    method: "PUT",
    path: "/api/platform/modules",
    body: platformModulesUpdateSchema,
    responses: {
      200: z.object({ settings: platformSettingsSchema, success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      409: platformErrorSchema,
    },
    summary: "Update platform module availability and provisioning defaults",
  },
} as const;

// Platform AI provider configuration
export const platformLlmRoutes = {
  updateLlm: {
    method: "PUT",
    path: "/api/platform/llm",
    body: platformLlmUpdateSchema,
    responses: {
      200: z.object({ settings: platformSettingsSchema, success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      409: platformErrorSchema,
    },
    summary: "Update platform AI provider configuration",
  },
  testLlm: {
    method: "POST",
    path: "/api/platform/llm/test",
    body: platformLlmTestBodySchema,
    responses: {
      200: aiTestResultResponseSchema,
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Test the platform AI provider connection",
  },
  getLlmModels: {
    method: "POST",
    path: "/api/platform/llm/models",
    body: aiModelsBodySchema,
    responses: {
      200: aiModelsResponseSchema,
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Discover models for the platform AI provider",
  },
} as const;

// Platform configuration backup
export const platformBackupRoutes = {
  exportBackup: {
    method: "POST",
    path: "/api/platform/backup/export",
    body: platformBackupExportBodySchema,
    responses: {
      200: platformBackupExportResponseSchema,
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Export an encrypted platform configuration backup",
  },
  importBackup: {
    method: "POST",
    path: "/api/platform/backup/import",
    body: platformBackupImportBodySchema,
    responses: {
      200: platformConfigBackupApplyResultSchema,
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      409: platformErrorSchema,
    },
    summary: "Validate and apply an encrypted platform configuration backup",
  },
} as const;

export const platformBrandingContract = c.router(platformBrandingRoutes);
export const platformModuleContract = c.router(platformModuleRoutes);
export const platformLlmContract = c.router(platformLlmRoutes);
export const platformBackupContract = c.router(platformBackupRoutes);
