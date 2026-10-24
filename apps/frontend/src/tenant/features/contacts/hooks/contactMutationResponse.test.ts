import { describe, expect, it } from "vitest";
import { unwrapContactMutationBody } from "./contactMutationResponse";

describe("unwrapContactMutationBody", () => {
  it("unwraps the body from a ts-rest mutation response", () => {
    const body = { success: true, contact: { id: "contact-1", firstName: "Ali" } };

    expect(unwrapContactMutationBody({ status: 201, body, headers: new Headers() })).toBe(body);
  });

  it("accepts an already-unwrapped response body", () => {
    const body = { success: true, succeeded: 2, failed: 0 };

    expect(unwrapContactMutationBody(body)).toBe(body);
  });

  it("rejects an empty successful response", () => {
    expect(() => unwrapContactMutationBody({ status: 201, body: undefined })).toThrow(
      "Contact API returned an empty response",
    );
  });
});
