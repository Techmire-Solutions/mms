import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentDetailContactChannels } from "./StudentDetailContactChannels";
import type { EmailAddress, PhoneNumber } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StudentDetailContactChannels", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockPhones: PhoneNumber[] = [
    { number: "+1234567890", label: "mobile", isPrimary: true },
    { number: "+0987654321", label: "home", isPrimary: false },
  ];

  const mockEmails: EmailAddress[] = [
    { address: "student@example.com", label: "personal", isPrimary: true },
  ];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("returns null when both phones and emails are empty", async () => {
    await act(async () => {
      root.render(
        <StudentDetailContactChannels
          phones={[]}
          emails={[]}
          onWhatsApp={vi.fn()}
          onSms={vi.fn()}
          onEmail={vi.fn()}
        />,
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders phones and triggers whatsapp and sms callbacks", async () => {
    const onWhatsApp = vi.fn();
    const onSms = vi.fn();

    await act(async () => {
      root.render(
        <StudentDetailContactChannels
          phones={mockPhones}
          emails={[]}
          canMessage={true}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("+1234567890");
    expect(container.textContent).toContain("+0987654321");
    expect(container.textContent).toContain("mobile");
    expect(container.textContent).toContain("theme.tokenPrimary");

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders emails and triggers email callback when hasOpenComposer is true", async () => {
    const onEmail = vi.fn();

    await act(async () => {
      root.render(
        <StudentDetailContactChannels
          phones={[]}
          emails={mockEmails}
          canMessage={true}
          hasOpenComposer={true}
          onWhatsApp={vi.fn()}
          onSms={vi.fn()}
          onEmail={onEmail}
        />,
      );
    });

    expect(container.textContent).toContain("student@example.com");
    expect(container.textContent).toContain("personal");

    const emailButton = container.querySelector("button");
    expect(emailButton).toBeDefined();

    await act(async () => {
      emailButton?.click();
    });

    expect(onEmail).toHaveBeenCalledWith("student@example.com");
  });
});
