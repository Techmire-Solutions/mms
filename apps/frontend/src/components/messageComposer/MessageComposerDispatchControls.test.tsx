import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageComposerDispatchControls } from "./MessageComposerDispatchControls";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const baseProps = {
  skippedCount: 0,
  isBulk: false,
  opening: false,
  dispatchSpeed: "normal" as const,
  dispatchProgress: null,
  isPaused: false,
  useServerGateway: true,
  onUseServerGatewayChange: vi.fn(),
  onShowSkipped: vi.fn(),
  onDispatchSpeedChange: vi.fn(),
  onPausedChange: vi.fn(),
  onCancel: vi.fn(),
};

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("MessageComposerDispatchControls", () => {
  it.each([
    ["sms", "messaging.preferences.defaultSmsMode", 0],
    ["email", "messaging.dispatchMode.serverEmail", 1],
    ["whatsapp", "messaging.dispatchMode.serverWhatsApp", 1],
  ] as const)(
    "labels the %s dispatch row once instead of repeating the selected option",
    (channel, labelKey, expectedCount) => {
      const html = renderToStaticMarkup(
        <MessageComposerDispatchControls
          {...baseProps}
          isEmail={channel === "email"}
          isSms={channel === "sms"}
        />,
      );

      expect(html).toContain("messaging.sendVia");
      // The old label reused the first option's text (and left a dangling colon);
      // the key may still appear once as the segmented-control option itself.
      expect(occurrences(html, labelKey)).toBe(expectedCount);
      expect(html).not.toContain(" :<");
    },
  );
});
