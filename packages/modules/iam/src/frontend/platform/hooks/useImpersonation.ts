import { useMutation } from "@tanstack/react-query";
import { apiJson } from "@mms/fe-core/api";

export interface ImpersonationInput {
  tenant: string;
  userId: string;
  reason: string;
  currentPassword: string;
}

export interface ImpersonationResult {
  handoffUrl: string;
  expiresAt: string;
  auditId: string;
}

export function useImpersonation() {
  return useMutation({
    mutationFn: (input: ImpersonationInput) =>
      apiJson<ImpersonationResult>("/api/platform/iam/impersonations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}
