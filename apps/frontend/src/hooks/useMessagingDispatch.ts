import { useMutation } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
import { invalidateMessagingQueries } from "@/hooks/useMessaging";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notifyApiFailure } from "@/lib/apiErrorNotify";

/**
 * Idempotency key bound to the dispatch payload digest (mms-messaging checklist:
 * "Send/export: idempotency key bound to body (409 on mismatch)"). Recomputing
 * it from the same normalized payload makes retries dedupe server-side.
 */
async function computeDispatchIdempotencyKey(payload: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

type DispatchServerResponse = { sentCount: number; failedCount: number; total: number };

/** Server-gateway send mutations (sms/whatsapp/email) shared by the composer. */
export function useMessagingDispatchMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const invalidate = () => invalidateMessagingQueries(queryClient);
  const onError = (error: unknown) => notifyApiFailure(error, t as TranslationFunction);

  const dispatchServerSms = useMutation({
    mutationFn: async (payload: {
      recipients: Array<{
        id: string | number;
        phone: string;
        name?: string;
        [key: string]: unknown;
      }>;
      message: string;
      category?: string;
    }) => {
      const normalized = {
        ...payload,
        recipients: payload.recipients.map((r) => ({
          ...r,
          id: String(r.id),
          phone: r.phone ?? "",
        })),
      };
      return apiJson<DispatchServerResponse>("/api/messaging/dispatch/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...normalized,
          idempotencyKey: await computeDispatchIdempotencyKey(normalized),
        }),
      });
    },
    onSuccess: invalidate,
    onError,
  });

  const dispatchServerEmail = useMutation({
    mutationFn: async (payload: {
      recipients: Array<{
        id: string | number;
        email: string;
        name?: string;
        [key: string]: unknown;
      }>;
      subject: string;
      message: string;
      html?: string;
      category?: string;
    }) => {
      const normalized = {
        ...payload,
        recipients: payload.recipients.map((r) => ({
          ...r,
          id: String(r.id),
          email: r.email,
        })),
      };
      return apiJson<DispatchServerResponse>("/api/messaging/dispatch/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...normalized,
          idempotencyKey: await computeDispatchIdempotencyKey(normalized),
        }),
      });
    },
    onSuccess: invalidate,
    onError,
  });

  const dispatchServerWhatsApp = useMutation({
    mutationFn: async (payload: {
      recipients: Array<{
        id: string | number;
        phone: string;
        name?: string;
        [key: string]: unknown;
      }>;
      message: string;
      category?: string;
    }) => {
      const normalized = {
        ...payload,
        recipients: payload.recipients.map((r) => ({
          ...r,
          id: String(r.id),
          phone: r.phone ?? "",
        })),
      };
      return apiJson<DispatchServerResponse>("/api/messaging/dispatch/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...normalized,
          idempotencyKey: await computeDispatchIdempotencyKey(normalized),
        }),
      });
    },
    onSuccess: invalidate,
    onError,
  });

  return { dispatchServerSms, dispatchServerEmail, dispatchServerWhatsApp };
}
