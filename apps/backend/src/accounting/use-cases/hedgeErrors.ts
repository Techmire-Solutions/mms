/**
 * HTTP error shapes shared by the hedge use-case modules.
 *
 * Its own module so `hedgeUseCases`, `hedgeSettlementUseCases` and
 * `hedgeAccountRoles` can raise them without importing each other in a cycle.
 */

export function unprocessable(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 422, type: "validation_error" });
}

export function notFound(): Error {
  return Object.assign(new Error("Hedge relationship not found"), {
    statusCode: 404,
    type: "not_found",
  });
}
