import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sessionContract } from "./sessions.contract.js";
import { sessionSectionsContract } from "./sessionSections.contract.js";
import { sessionLifecycleOpsContract } from "./sessionLifecycleOps.contract.js";
import { sessionCompletionContract } from "./sessionCompletion.contract.js";
import { sessionRolloverContract } from "./sessionRollover.contract.js";
import { academicCatalogContract } from "./academicCatalog.contract.js";
import { registrationLinksContract } from "./registration.contract.js";
import { sessionErrorResponseSchema } from "./sessionContractShared.js";
import { sessionsListQuerySchema } from "../sessions/sessionsListQuery.js";

const contracts = {
  sessions: sessionContract,
  sections: sessionSectionsContract,
  lifecycleOps: sessionLifecycleOpsContract,
  completion: sessionCompletionContract,
  rollover: sessionRolloverContract,
  academicCatalog: academicCatalogContract,
  registrationLinks: registrationLinksContract,
} as const;

type RouteLike = {
  method: string;
  path: string;
  responses: Record<number, unknown>;
  query?: unknown;
};

function routesOf(contract: unknown): Array<[string, RouteLike]> {
  return Object.entries(contract as Record<string, unknown>).filter(
    (entry): entry is [string, RouteLike] =>
      Boolean(entry[1]) &&
      typeof entry[1] === "object" &&
      "method" in (entry[1] as object) &&
      "responses" in (entry[1] as object),
  );
}

describe("sessions contract coverage", () => {
  for (const [name, contract] of Object.entries(contracts)) {
    for (const [key, route] of routesOf(contract)) {
      it(`${name}.${key} declares auth, success and failure response schemas`, () => {
        const responses = route.responses;
        expect(responses[401], "401 is returned by the auth middleware").toBeDefined();
        expect(responses[500], "every route needs a typed 500").toBeDefined();
        const success = Object.keys(responses)
          .map(Number)
          .filter((status) => status >= 200 && status < 300);
        expect(success.length, "at least one success status").toBeGreaterThan(0);
        for (const status of success) expect(responses[status]).toBeDefined();
        for (const status of Object.keys(responses).map(Number)) {
          if (status >= 400 && status < 500) {
            expect(responses[status], `status ${status} needs a body schema`).toBeDefined();
          }
        }
      });
    }
  }

  it("uses the shared error envelope for a client-error response", () => {
    const parsed = sessionErrorResponseSchema.parse({
      type: "session_transition_blocked",
      message: "Illegal transition",
      violations: ["illegal_transition"],
    });
    expect(parsed.violations).toEqual(["illegal_transition"]);
  });

  it("list query is strict and rejects unknown filter keys", () => {
    expect(sessionsListQuerySchema.safeParse({ bogus: "1" }).success).toBe(false);
    expect(sessionsListQuerySchema.safeParse({ status: "draft", view: "summary" }).success).toBe(
      true,
    );
    expect(sessionsListQuerySchema.safeParse({ view: "everything" }).success).toBe(false);
  });

  it("exposes cursor and view paging inputs", () => {
    const parsed = sessionsListQuerySchema.parse({ afterId: "s-9", view: "summary" });
    expect(parsed.afterId).toBe("s-9");
    expect(parsed.view).toBe("summary");
  });

  it("has no untyped z.unknown error bodies", () => {
    for (const [name, contract] of Object.entries(contracts)) {
      for (const [key, route] of routesOf(contract)) {
        for (const status of [400, 403, 404, 409, 428, 500]) {
          const schema = route.responses[status];
          if (!schema || !(schema instanceof z.ZodType)) continue;
          expect(
            schema.safeParse({ type: "error", message: "failed" }).success,
            `${name}.${key} ${status} must accept the standard error envelope`,
          ).toBe(true);
        }
      }
    }
  });
});
