import React from "react";
import type { WorkspaceRole } from "@mms/contracts";
import { Button, INPUT_CLASS, Input, Modal } from "@mms/ui";
import { useInviteMember } from "./hooks/useTeamMembers.js";

export interface InviteMemberModalLabels {
  title: string;
  email: string;
  role: string;
  submit: string;
  cancel: string;
  sending: string;
  error: string;
  sent: string;
  /** Shown when the typed email does not resolve to an existing contact. */
  contactNotFound: string;
}

export interface InviteMemberModalProps {
  open: boolean;
  roles: readonly WorkspaceRole[];
  labels: InviteMemberModalLabels;
  onClose: () => void;
  onInvited?: (email: string, inviteEmailSent?: boolean) => void;
  /**
   * Resolves the typed email to the contact id the invite contract requires
   * (`InviteWorkspaceUserInput.contactId`). The module never guesses: an
   * unresolved address surfaces `labels.contactNotFound`.
   */
  resolveContact: (email: string) => Promise<string | number | null> | string | number | null;
}

/**
 * Minimal accessible invite dialog: email + role + submit. Contact-picker /
 * advanced invite fields stay in the app wrapper; the app supplies
 * `resolveContact` so the module can post a real `contactId`.
 */
export function InviteMemberModal({
  open,
  roles,
  labels,
  onClose,
  onInvited,
  resolveContact,
}: InviteMemberModalProps): React.JSX.Element {
  const invite = useInviteMember();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState(roles[0]?.id ?? "teacher");
  const [resolving, setResolving] = React.useState(false);
  const [missingContact, setMissingContact] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMissingContact(false);
    setResolving(true);
    try {
      const contactId = await resolveContact(email.trim());
      if (contactId === null || contactId === undefined || String(contactId).trim() === "") {
        setMissingContact(true);
        return;
      }
      invite.mutate(
        // Pending until the invitee activates: mirrors the legacy invite flow.
        { contactId, role, status: "inactive", sendEmail: true },
        {
          onSuccess: (result) => {
            onInvited?.(email, result.inviteEmailSent);
            onClose();
          },
        },
      );
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal ariaLabel={labels.title} onClose={onClose} open={open} size="md" title={labels.title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm">
          <span>{labels.email}</span>
          <Input
            aria-label={labels.email}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{labels.role}</span>
          <select
            aria-label={labels.role}
            className={INPUT_CLASS}
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            {roles.map((workspaceRole) => (
              <option key={workspaceRole.id} value={workspaceRole.id}>
                {workspaceRole.customLabel ?? workspaceRole.id}
              </option>
            ))}
          </select>
        </label>
        {missingContact ? (
          <p className="text-sm text-destructive" role="alert">
            {labels.contactNotFound}
          </p>
        ) : null}
        {invite.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {labels.error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="ghost">
            {labels.cancel}
          </Button>
          <Button disabled={invite.isPending || resolving || !email.trim()} type="submit">
            {invite.isPending || resolving ? labels.sending : labels.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
