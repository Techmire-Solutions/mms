import type { FastifyError, FastifyInstance } from "fastify";
import { PlatformError } from "../services/platform/platformErrorService.js";
import { HttpDomainError, errorEnvelopeExtras } from "./httpErrors.js";
import {
  dependencyForDiagnosticStage,
  getRequestDiagnosticContext,
  getRuntimeDependencySnapshot,
} from "./requestDiagnostics.js";

export function registerErrorHandlers(app: FastifyInstance, isProd: boolean): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        type: "validation_error",
        message: "Invalid request",
      });
    }

    // A domain error that escaped a handler still carries its status, type and structured context;
    // the previous fallback reported `error.code` (undefined on HttpDomainError) as `server_error`.
    if (error instanceof HttpDomainError) {
      return reply.status(error.statusCode).send({
        type: error.type,
        message: error.message,
        ...errorEnvelopeExtras(error),
      });
    }

    if (error instanceof PlatformError) {
      return reply.status(error.statusCode).send({
        type: error.code,
        message: error.message,
      });
    }

    const statusCode = error.statusCode ?? 500;
    const diagnostic = getRequestDiagnosticContext(request);
    const dependency = dependencyForDiagnosticStage(diagnostic?.stage);
    if (statusCode >= 500) {
      request.log.error(
        {
          err: error,
          statusCode,
          requestId: request.id,
          operation: diagnostic?.operation,
          failureStage: diagnostic?.stage,
          dependency,
          ...(diagnostic ? { runtimeDependencies: getRuntimeDependencySnapshot() } : {}),
        },
        "unhandled server error",
      );
    }

    if (statusCode >= 500 && isProd) {
      return reply.status(500).send({
        type: "server_error",
        message: diagnostic?.stage
          ? `Internal server error during ${diagnostic.stage.replaceAll("_", " ")}. Reference: ${request.id}`
          : `Internal server error. Reference: ${request.id}`,
        requestId: request.id,
        ...(diagnostic
          ? {
              operation: diagnostic.operation,
              stage: diagnostic.stage,
              ...(dependency ? { dependency } : {}),
            }
          : {}),
      });
    }

    return reply.status(statusCode).send({
      type: error.code ?? "server_error",
      message: error.message,
    });
  });
}
