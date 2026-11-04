import { useMutation } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
import { invalidateMessagingQueries } from "@/hooks/useMessaging";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notifyApiFailure } from "@/lib/apiErrorNotify";

/**
 * Server dispatch summary. `skippedCount` counts recipients already claimed by an
 * earlier attempt of the same submission; `replayed` marks a stored response the
 * server returned instead of re-sending (`Idempotency-Replay`).
 */
type DispatchServerResponse = {
  sentCount: number;
  failedCount: number;
  total: number;
  skippedCount?: number;
  replayed?: boolean;
};

interface DispatchKeyedPayload {
  /**
   * Per-submission idempotency key owned by the composer: retries of one
   * submission reuse it, a new (or completed) submission mints a new one. The
   * server still binds it to the canonical body digest and rejects a mismatch
   * with 409 — the key must never be derived from the body itself, or a
   * deliberate repeat campaign would be replayed as a no-op for 24 h.
   */
  idempotencyKey: string;
}

/** Server-gateway send mutations (sms/whatsapp/email) shared by the composer. */
export function useMessagingDispatchMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const invalidate = () => invalidateMessagingQueries(queryClient);
  const onError = (error: unknown) => notifyApiFailure(error, t as TranslationFunction);

  const dispatchServerSms = useMutation({
    mutationFn: async (
      payload: {
        recipients: Array<{
          id: string | number;
          phone: string;
          name?: string;
          [key: string]: unknown;
        }>;
        message: string;
        category?: string;
      } & DispatchKeyedPayload,
    ) => {
      const { idempotencyKey, ...rest } = payload;
      const normalized = {
        ...rest,
        recipients: rest.recipients.map((r) => ({
          ...r,
          id: String(r.id),
          phone: r.phone ?? "",
        })),
      };
      return apiJson<DispatchServerResponse>("/api/messaging/dispatch/sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ ...normalized, idempotencyKey }),
      });
    },
    onSuccess: invalidate,
    onError,
  });

  const dispatchServerEmail = useMutation({
    mutationFn: async (
      payload: {
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
      } & DispatchKeyedPayload,
    ) => {
      const { idempotencyKey, ...rest } = payload;
      const normalized = {
        ...rest,
        recipients: rest.recipients.map((r) => ({
          ...r,
          id: String(r.id),
          email: r.email,
        })),
      };
      return apiJson<DispatchServerResponse>("/api/messaging/dispatch/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ ...normalized, idempotencyKey }),
      });
    },
    onSuccess: invalidate,
    onError,
  });

  const dispatchServerWhatsApp = useMutation({
    mutationFn: async (
      payload: {
        recipients: Array<{
          id: string | number;
          phone: string;
          name?: string;
          [key: string]: unknown;
        }>;
        message: string;
        category?: string;
      } & DispatchKeyedPayload,
    ) => {
      const { idempotencyKey, ...rest } = payload;
      const normalized = {
        ...rest,
        recipients: rest.recipients.map((r) => ({
          ...r,
          id: String(r.id),
          phone: r.phone ?? "",
        })),
      };
      return apiJson<DispatchServerResponse>("/api/messaging/dispatch/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ ...normalized, idempotencyKey }),
      });
    },
    onSuccess: invalidate,
    onError,
  });

  return { dispatchServerSms, dispatchServerEmail, dispatchServerWhatsApp };
}
