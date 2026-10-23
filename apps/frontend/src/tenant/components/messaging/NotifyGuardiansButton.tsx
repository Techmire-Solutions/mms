import React from "react";
import { MessageSquare } from "lucide-react";
import { toMessagingRecipient } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";

const TenantMessageComposer = React.lazy(() => import("./TenantMessageComposer"));

export interface NotifyGuardiansButtonProps {
  studentIds: readonly string[];
  /** Prefilled text; staff review and send it from the composer (nothing is sent automatically). */
  message: string;
  label: string;
  disabled?: boolean;
}

/** Opens the message composer for the students' guardians with a prefilled notice. */
export function NotifyGuardiansButton({
  studentIds,
  message,
  label,
  disabled,
}: NotifyGuardiansButtonProps): React.JSX.Element {
  const { data: students = [] } = useStudentsByIds([...studentIds]);
  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5"
        disabled={disabled || studentIds.length === 0}
        onClick={() =>
          openComposer(
            "sms",
            students.map((student) => toMessagingRecipient(student)),
            { initialMessage: message },
          )
        }
      >
        <MessageSquare className="size-4" aria-hidden />
        {label}
      </Button>
      {messagingTarget ? (
        <React.Suspense fallback={null}>
          <TenantMessageComposer
            channel={messagingTarget.channel}
            recipients={messagingTarget.recipients}
            initialMessage={messagingTarget.initialMessage}
            initialSubject={messagingTarget.initialSubject}
            onClose={closeComposer}
          />
        </React.Suspense>
      ) : null}
    </>
  );
}
