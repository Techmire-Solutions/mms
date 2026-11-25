import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformManifestDtoSchema,
  platformPublicBrandingResponseSchema,
} from "../schemas/platform.dto.js";

const c = initContract();

export const publicContract = c.router({
  deploymentConfig: {
    method: "GET",
    path: "/api/public/deployment-config",
    responses: {
      200: z.object({
        appDomain: z.string(),
      }),
    },
    summary: "Get deployment config",
  },
  platformBranding: {
    method: "GET",
    path: "/api/public/platform-branding",
    responses: {
      200: platformPublicBrandingResponseSchema,
    },
    summary: "Get public platform branding for the apex entry routes",
  },
  platformManifest: {
    method: "GET",
    path: "/api/public/platform-manifest.webmanifest",
    responses: {
      200: platformManifestDtoSchema,
    },
    summary: "Get the white-labelled web app manifest",
  },
});
