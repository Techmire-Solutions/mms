import React, { useState } from "react";
import { UserMinus } from "lucide-react";
import type { WorkshopDetail } from "@mms/shared";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useAddWorkshopParticipant, useRemoveWorkshopParticipant } from "../hooks/useWorkshopsApi";

export interface WorkshopParticipantsSectionProps {
  detail: WorkshopDetail;
  canWrite: boolean;
  canDelete: boolean;
}

/** Registered participants, with register (any contact, incl. external) and withdraw. */
export function WorkshopParticipantsSection({
  detail,
  canWrite,
  canDelete,
}: WorkshopParticipantsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const [contactId, setContactId] = useState<string | null>(null);
  const addParticipant = useAddWorkshopParticipant();
  const removeParticipant = useRemoveWorkshopParticipant();
  const { workshop, participants } = detail;
  const isFull = workshop.capacity !== null && participants.length >= workshop.capacity;

  const handleAdd = async () => {
    if (!contactId) return;
    try {
      await addParticipant.mutateAsync({ id: workshop.id, contactId });
      setContactId(null);
      notify.success(t("workshops.participantAdded"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    }
  };

  const handleRemove = (participantId: string) => {
    removeParticipant.mutate(
      { id: workshop.id, participantId },
      {
        onError: (err) =>
          notify.error(err instanceof Error ? err.message : t("workshops.saveFailed")),
      },
    );
  };

  return (
    <section aria-labelledby="workshop-participants-heading" className="space-y-3">
      <h3 id="workshop-participants-heading" className="text-sm font-semibold text-foreground">
        {t("workshops.participants")}
      </h3>

      {canWrite && !workshop.deletedAt ? (
        isFull ? (
          <p className="text-sm text-muted-foreground">{t("workshops.full")}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ContactPicker
                id="workshop-participant-contact"
                label={t("workshops.participantContact")}
                value={contactId}
                onChange={(id) => setContactId(id === null ? null : String(id))}
                excludeIds={participants.map((participant) => participant.contactId)}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!contactId || addParticipant.isPending}
              className="min-h-11"
            >
              {t("workshops.addParticipant")}
            </Button>
          </div>
        )
      ) : null}

      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("workshops.noParticipants")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {participants.map((participant) => (
            <li key={participant.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {participant.contactName || participant.contactId}
                </p>
                {participant.contactPhone ? (
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {participant.contactPhone}
                  </p>
                ) : null}
              </div>
              {canDelete && !workshop.deletedAt ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={t("workshops.withdrawNamed", {
                    name: participant.contactName || participant.contactId,
                  })}
                  onClick={() => handleRemove(participant.id)}
                  disabled={removeParticipant.isPending}
                >
                  <UserMinus className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
