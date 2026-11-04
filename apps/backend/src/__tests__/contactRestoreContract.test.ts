import { describe, expect, it } from "vitest";
import { contactsContract } from "@mms/shared";

/**
 * The bulk-restore route is hand-written (not registered through ts-rest), so the
 * contract is only a type-level promise. Pin the runtime payload against it: the
 * FE reads `conflicts[].errors[].message`, and a drifted shape would silently
 * drop the field-level detail.
 */
const bulkRestoreResponse = contactsContract.bulkRestore.responses[200];

describe("contacts bulk-restore contract parity", () => {
  it("parses the server's ValidationError-shaped conflict payload", () => {
    const serverPayload = {
      success: true,
      succeeded: 1,
      failed: 1,
      conflicts: [
        {
          id: "c-2",
          errors: [
            {
              fieldId: "number",
              tabId: "phones",
              message: "Phone number must be unique per contact",
              index: 0,
            },
          ],
        },
      ],
    };

    const parsed = bulkRestoreResponse.safeParse(serverPayload);
    expect(parsed.success).toBe(true);
  });

  it("rejects the retired `field` shape so the drift cannot come back", () => {
    const drifted = {
      success: true,
      succeeded: 0,
      failed: 1,
      conflicts: [{ id: "c-2", errors: [{ field: "number", message: "duplicate" }] }],
    };

    expect(bulkRestoreResponse.safeParse(drifted).success).toBe(false);
  });
});
