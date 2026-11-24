import React from "react";
import { Button, Input, Modal } from "@mms/ui";
import { useImpersonation } from "./hooks/useImpersonation.js";

export interface TenantImpersonationModalLabels {
  title: string;
  reason: string;
  password: string;
  submit: string;
  cancel: string;
  sending: string;
  error: string;
  success: string;
  expires: string;
  done: string;
}

export interface TenantImpersonationModalProps {
  open: boolean;
  target: { tenant: string; userId: string; name: string } | null;
  labels: TenantImpersonationModalLabels;
  onClose: () => void;
}

/** Super-admin, password-confirmed, audited impersonation dialog. */
export function TenantImpersonationModal({
  open,
  target,
  labels,
  onClose,
}: TenantImpersonationModalProps): React.JSX.Element | null {
  const impersonate = useImpersonation();
  const [reason, setReason] = React.useState("");
  const [password, setPassword] = React.useState("");

  if (!target) return null;

  return (
    <Modal ariaLabel={labels.title} onClose={onClose} open={open} size="md" title={labels.title}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          impersonate.mutate({ ...target, reason, currentPassword: password });
        }}
      >
        <p className="text-sm text-muted-foreground">
          {target.name} · {target.tenant}
        </p>
        <label className="block space-y-1 text-sm">
          <span>{labels.reason}</span>
          <Input onChange={(event) => setReason(event.target.value)} required value={reason} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{labels.password}</span>
          <Input
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {impersonate.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {labels.error}
          </p>
        ) : null}
        {impersonate.data ? (
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <p>{labels.success}</p>
            <a className="break-all text-primary underline" href={impersonate.data.handoffUrl}>
              {impersonate.data.handoffUrl}
            </a>
            <p className="text-xs text-muted-foreground">
              {labels.expires} {impersonate.data.expiresAt}
            </p>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="ghost">
            {labels.cancel}
          </Button>
          {impersonate.data ? (
            <Button onClick={onClose} type="button">
              {labels.done}
            </Button>
          ) : (
            <Button disabled={impersonate.isPending || !reason.trim() || !password} type="submit">
              {impersonate.isPending ? labels.sending : labels.submit}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
