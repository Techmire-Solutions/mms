import { describe, expect, it, vi } from "vitest";
import type { StandardMessagingRecipient } from "@mms/shared";
import {
  executeRecipientSend,
  findUnknownTokens,
  validateMessagingRecipients,
} from "./messageComposerDispatchService";

describe("messageComposerDispatchService", () => {
  it("identifies unknown tokens in body and subject", () => {
    const unknown = findUnknownTokens(
      "email",
      "Hello {name} and {badsubjecttoken}",
      "Message for {badbodytoken}",
    );
    expect(unknown).toContain("badsubjecttoken");
    expect(unknown).toContain("badbodytoken");
    expect(unknown).not.toContain("name");
  });

  it("validates recipients based on phone or email format", () => {
    const recipients: StandardMessagingRecipient[] = [
      { id: "1", name: "Valid User", phone: "+1234567890", email: "user@example.com" },
      { id: "2", name: "No Phone User", phone: "", email: "nophone@example.com" },
      { id: "3", name: "No Email User", phone: "+1234567891", email: "" },
    ];

    const smsValidated = validateMessagingRecipients(recipients, "sms");
    expect(smsValidated[0].isValid).toBe(true);
    expect(smsValidated[1].isValid).toBe(false);
    expect(smsValidated[2].isValid).toBe(true);

    const emailValidated = validateMessagingRecipients(recipients, "email");
    expect(emailValidated[0].isValid).toBe(true);
    expect(emailValidated[1].isValid).toBe(true);
    expect(emailValidated[2].isValid).toBe(false);
  });

  it("opens the mail composer without handing it an opener", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    const sent = executeRecipientSend({
      channel: "email",
      recipient: { id: "1", name: "A", email: "a@example.com", phone: "" } as never,
      text: "Hello",
      subject: "Subject",
      personalizeOptions: {},
      defaultSubject: "Subject",
    });

    expect(sent).toBe(true);
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("mailto:a@example.com"),
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
});
