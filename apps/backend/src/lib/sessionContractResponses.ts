import { z } from "zod";
import { HttpDomainError } from "./httpErrors.js";

/** A handler produced a body that does not match the contract it declared. */
export class SessionContractViolationError extends HttpDomainError {
  constructor(
    readonly contractKey: string,
    readonly responseStatus: number,
    detail: string,
  ) {
    super(500, "contract_violation", `[${contractKey}] ${detail}`);
    this.name = "SessionContractViolationError";
  }
}

type ContractHandler = (args: never) => Promise<{ status: number; body?: unknown }>;

interface ResponseBodySchema {
  body: z.ZodType;
}

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType;
}

/** A contract response value may be a schema, a no-body marker, or an `{ body, contentType }`. */
function schemaFor(responseType: unknown): z.ZodType | null {
  if (isZodSchema(responseType)) return responseType;
  if (
    responseType &&
    typeof responseType === "object" &&
    "body" in responseType &&
    isZodSchema((responseType as ResponseBodySchema).body)
  ) {
    return (responseType as ResponseBodySchema).body;
  }
  return null;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/**
 * Wraps ts-rest handlers so every declared response body is parsed through its contract schema.
 *
 * The adapter only routes `RequestValidationError` to a custom error handler (everything else goes
 * through `reply.send(err)`), so response validation cannot be installed reliably at the request
 * level. Parsing the handler result here is deterministic and also normalizes serialization
 * (internal fields such as `overlapExempt`/`deletedBy`/`restoredBy` are stripped).
 */
export function enforceSessionResponses<T extends Record<string, unknown>>(
  contract: unknown,
  handlers: T,
): T {
  const routes = contract as Record<string, { responses?: Record<number, unknown> } | undefined>;
  const wrapped: Record<string, unknown> = {};
  for (const [key, handler] of Object.entries(handlers)) {
    if (typeof handler !== "function") {
      wrapped[key] = handler;
      continue;
    }
    const route = routes[key];
    wrapped[key] = async (args: never) => {
      const result = (await (handler as ContractHandler)(args)) as
        { status: number; body?: unknown } | undefined;
      if (!result || typeof result.status !== "number")
        throw new SessionContractViolationError(key, 0, "handler returned no status");

      const responseSchema = schemaFor(route?.responses?.[result.status]);
      if (!responseSchema) {
        // Undeclared success is always a bug; an undeclared error body is passed through so a
        // domain failure is never re-labelled as a contract failure.
        if (result.status < 400)
          throw new SessionContractViolationError(
            key,
            result.status,
            `handler returned undeclared status ${result.status}`,
          );
        return result;
      }

      const parsed = responseSchema.safeParse(result.body);
      if (!parsed.success)
        throw new SessionContractViolationError(
          key,
          result.status,
          `response does not match the contract: ${describeIssues(parsed.error)}`,
        );
      return { status: result.status, body: parsed.data };
    };
  }
  return wrapped as T;
}
