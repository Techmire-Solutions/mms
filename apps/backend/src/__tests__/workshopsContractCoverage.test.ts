import { describe, expect, it } from "vitest";
import { workshopsCompletionContract, workshopsContract } from "@mms/shared";

type RouteLike = {
  method: string;
  path: string;
  body?: unknown;
  query?: unknown;
  pathParams?: unknown;
  headers?: unknown;
  responses?: Record<number, unknown>;
};

const routes: Array<[string, RouteLike]> = [
  ...Object.entries(workshopsContract as unknown as Record<string, RouteLike>),
  ...Object.entries(workshopsCompletionContract as unknown as Record<string, RouteLike>),
];

const responseCodes = (route: RouteLike): number[] =>
  Object.keys(route.responses ?? {}).map(Number);

describe("workshops contract coverage", () => {
  it("declares the uniform 400 for every route that accepts any input", () => {
    const offenders = routes.filter(
      ([, route]) =>
        Boolean(route.body ?? route.query ?? route.pathParams ?? route.headers) &&
        !responseCodes(route).includes(400),
    );
    expect(offenders.map(([name]) => name)).toEqual([]);
  });

  it("declares a query schema on every route (strict empty where nothing is accepted)", () => {
    expect(routes.filter(([, route]) => route.query === undefined).map(([name]) => name)).toEqual(
      [],
    );
  });

  it("declares the 409 domain-conflict status on every route that can emit one", () => {
    const conflictRoutes = [
      "createWorkshop",
      "updateWorkshop",
      "transitionWorkshop",
      "addParticipant",
      "addParticipants",
      "removeParticipant",
      "saveAttendanceDay",
      "saveScores",
      "evaluateCompletion",
      "issueCertificates",
    ];
    for (const name of conflictRoutes) {
      const route = routes.find(([key]) => key === name)?.[1];
      expect(route, name).toBeDefined();
      expect(responseCodes(route!), name).toContain(409);
    }
  });

  it("declares 428 only on the OCC-guarded transition", () => {
    const with428 = routes.filter(([, route]) => responseCodes(route).includes(428));
    expect(with428.map(([name]) => name)).toEqual(["transitionWorkshop"]);
  });

  it("declares a 200/201 success status on every route", () => {
    const offenders = routes.filter(
      ([, route]) => !responseCodes(route).some((code) => code >= 200 && code < 300),
    );
    expect(offenders.map(([name]) => name)).toEqual([]);
  });
});
