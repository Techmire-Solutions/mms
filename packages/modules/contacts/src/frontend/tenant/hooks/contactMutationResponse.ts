export function unwrapContactMutationBody<T>(response: unknown): T {
  const payload =
    typeof response === "object" && response !== null && "body" in response
      ? (response as { body?: unknown }).body
      : response;

  if (payload === undefined || payload === null) {
    throw new Error("Contact API returned an empty response");
  }

  return payload as T;
}
