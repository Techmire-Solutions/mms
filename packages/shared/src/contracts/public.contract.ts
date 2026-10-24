import { initContract } from "@ts-rest/core";
import { z } from "zod";

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
});
