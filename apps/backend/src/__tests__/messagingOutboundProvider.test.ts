import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendGenericOutboundMessage } from "../services/messagingOutboundProvider.js";
import { sendLogiqueuesSms } from "../services/sms/providers/logiqueuesProvider.js";
import * as outboundUrl from "../lib/outboundUrl.js";

describe("messagingOutboundProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendGenericOutboundMessage", () => {
    it("defaults to LogiQueues smart URL when apiBaseUrl is omitted", async () => {
      const fetchSpy = vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
        new Response(JSON.stringify({ id: "msg_def" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await sendGenericOutboundMessage("+923001234567", "Hello", {
        accountSecret: "ngw_live_test",
      });
      expect(res.success).toBe(true);
      expect(fetchSpy.mock.calls[0][0]).toBe("https://logiqueues.com/gateway/v1/messages/smart");
    });

    it("sends standard POST to custom URL with Bearer token", async () => {
      const fetchSpy = vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
        new Response(JSON.stringify({ id: "msg_123", status: "queued" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await sendGenericOutboundMessage("+923001234567", "Your code is 1234", {
        apiBaseUrl: "https://logiqueues.com/gateway/v1/messages/smart",
        accountSecret: "ngw_live_testkey",
        senderId: "+923000000000",
      });

      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe("msg_123");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [calledUrl, init] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://logiqueues.com/gateway/v1/messages/smart");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer ngw_live_testkey",
      });
      expect(JSON.parse(init?.body as string)).toEqual({
        to: "+923001234567",
        body: "Your code is 1234",
        from: "+923000000000",
      });
    });

    it("handles error response from gateway", async () => {
      vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
        new Response(JSON.stringify({ error: "no_device_online", message: "Phone is offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await sendGenericOutboundMessage("+923001234567", "Hello", {
        apiBaseUrl: "https://logiqueues.com/gateway/v1/messages/sms",
        accountSecret: "ngw_live_test",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Phone is offline");
    });
  });

  describe("sendLogiqueuesSms URL handling", () => {
    it("uses full endpoint URL without appending /messages when provided", async () => {
      const fetchSpy = vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
        new Response(JSON.stringify({ id: "sms_456" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await sendLogiqueuesSms("+923001234567", "Test SMS", {
        accountId: "test",
        accountSecret: "sgw_live_key",
        senderId: "MMS",
        apiBaseUrl: "https://logiqueues.com/gateway/v1/messages/sms",
      });

      expect(res.success).toBe(true);
      expect(fetchSpy.mock.calls[0][0]).toBe("https://logiqueues.com/gateway/v1/messages/sms");
    });

    it("appends /messages when given base URL prefix without endpoint path", async () => {
      const fetchSpy = vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
        new Response(JSON.stringify({ id: "sms_789" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await sendLogiqueuesSms("+923001234567", "Test SMS", {
        accountId: "test",
        accountSecret: "sgw_live_key",
        senderId: "MMS",
        apiBaseUrl: "https://logiqueues.com/gateway/v1",
      });

      expect(res.success).toBe(true);
      expect(fetchSpy.mock.calls[0][0]).toBe("https://logiqueues.com/gateway/v1/messages");
    });
  });
});
