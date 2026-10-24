import { type FastifyInstance } from "fastify";
import { generateOpenApi } from "@ts-rest/open-api";
import { rootContract } from "@mms/shared";

export default async function openapiRoutes(app: FastifyInstance) {
  app.get("/api/openapi.json", async (_request, reply) => {
    // The full API contract is sensitive; only expose it in non-production or
    // when explicitly enabled via MMS_EXPOSE_OPENAPI=true.
    const expose =
      process.env.MMS_EXPOSE_OPENAPI === "true" || process.env.NODE_ENV !== "production";
    if (!expose) {
      return reply.status(404).send({ type: "not_found", message: "Not found" });
    }
    return generateOpenApi(rootContract, {
      info: {
        title: "MMS API",
        version: "1.0.0",
      },
    });
  });
}
