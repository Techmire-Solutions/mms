import React, { useRef, useState } from "react";
import { UserMinus, Users } from "lucide-react";
import type { WorkshopDetail, WorkshopRegistrationState } from "@mms/shared";
import { resolveWorkshopRegistrationState } from "@mms/shared";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useAddWorkshopParticipant, useRemoveWorkshopParticipant } from "../hooks/useWorkshopsApi";
import {
  printWorkshopNameBadges,
  printWorkshopRoster,
  printWorkshopSignInSheet,
} from "../lib/workshopPrintables";

const REGISTRATION_STATE_KEYS = {
  registered: "workshops.registrationState.registered",
  waitlisted: "workshops.registrationState.waitlisted",
  attended: "workshops.registrationState.attended",
  completed: "workshops.registrationState.completed",
  no_show: "workshops.registrationState.noShow",
  cancelled: "workshops.registrationState.cancelled",
} as const satisfies Record<WorkshopRegistrationState, string>;

export interface WorkshopParticipantsSectionProps {
  detail: WorkshopDetail;
  canWrite: boolean;
  canDelete: boolean;
}

/**
 * Registered participants plus the waitlist. The add control turns into "Join waitlist" when the
 * workshop is full and queues registrations; withdrawing a seated participant promotes the oldest
 * queued row and the toast names who moved.
 */
function WorkshopParticipantsSectionInner({
  detail,
  canWrite,
  canDelete,
}: WorkshopParticipantsSectionProps): React.JSX.Element {
  const { t, language, isRtl } = useTranslation();
  const [contactId, setContactId] = useState<string | null>(null);
  const addParticipant = useAddWorkshopParticipant();
  const addingRef = useRef(false);
  const removeParticipant = useRemoveWorkshopParticipant();
  const { workshop, participants, waitlisted } = detail;
  const seatCount = workshop.capacity ?? null;
  const isFull = seatCount !== null && participants.length >= seatCount;
  const canQueue = isFull && workshop.waitlistEnabled;
  const knownContacts = [...participants, ...waitlisted].map(
    (participant) => participant.contactId,
  );
  const printLabels = {
    rosterTitle: t("workshops.print.roster"),
    signInTitle: t("workshops.print.signIn"),
    badgesTitle: t("workshops.print.badges"),
    name: t("workshops.print.name"),
    status: t("workshops.status"),
    signature: t("workshops.print.signature"),
    date: t("workshops.print.date"),
    number: t("workshops.print.number"),
  };
  const printWith = (kind: "roster" | "signIn" | "badges") => {
    const options = {
      workshop,
      participants,
      labels: printLabels,
      language,
      isRtl,
    };
    const result =
      kind === "roster"
        ? printWorkshopRoster(options)
        : kind === "signIn"
          ? printWorkshopSignInSheet(options)
          : printWorkshopNameBadges(options);
    if (result.printed < result.total) {
      notify.info(t("workshops.print.badgesTruncated", { count: result.printed }));
    }
  };

  const handleAdd = async () => {
    if (!contactId || addingRef.current) return;
    addingRef.current = true;
    try {
      const { participant } = await addParticipant.mutateAsync({ id: workshop.id, contactId });
      setContactId(null);
      notify.success(
        participant.waitlistedAt ? t("workshops.waitlist.joined") : t("workshops.participantAdded"),
      );
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    } finally {
      addingRef.current = false;
    }
  };

  const handleRemove = (participantId: string) => {
    removeParticipant.mutate(
      { id: workshop.id, participantId },
      {
        onSuccess: (result) => {
          if (result.promoted) {
            notify.success(
              t("workshops.waitlist.promoted", {
                name: result.promoted.contactName || result.promoted.contactId,
              }),
            );
          }
        },
        onError: (err) =>
          notify.error(err instanceof Error ? err.message : t("workshops.saveFailed")),
      },
    );
  };

  return (
    <section aria-labelledby="workshop-participants-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="workshop-participants-heading" className="text-sm font-semibold text-foreground">
          {t("workshops.participants")}
        </h3>
        {participants.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => printWith("roster")}>
              {t("workshops.print.roster")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => printWith("signIn")}>
              {t("workshops.print.signIn")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => printWith("badges")}>
              {t("workshops.print.badges")}
            </Button>
          </div>
        ) : null}
      </div>

      {canWrite && !workshop.deletedAt ? (
        isFull && !canQueue ? (
          <p className="text-sm text-muted-foreground">{t("workshops.full")}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ContactPicker
                id="workshop-participant-contact"
                label={t("workshops.participantContact")}
                value={contactId}
                onChange={(id) => setContactId(id === null ? null : String(id))}
                excludeIds={knownContacts}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!contactId || addParticipant.isPending}
              className="min-h-11"
            >
              {canQueue ? t("workshops.waitlist.join") : t("workshops.addParticipant")}
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
                <p className="text-xs text-muted-foreground">
                  {t(
                    REGISTRATION_STATE_KEYS[
                      resolveWorkshopRegistrationState({
                        participantStatus: participant.status,
                        waitlistedAt: participant.waitlistedAt,
                        workshopStatus: workshop.status,
                        workshopDeletedAt: workshop.deletedAt,
                      })
                    ],
                  )}
                </p>
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

      {waitlisted.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("workshops.waitlist.heading")}
            </h4>
            <Badge tone="warning">
              {t("workshops.waitlist.count", { count: waitlisted.length })}
            </Badge>
          </div>
          <ul className="divide-y divide-border rounded-md border border-dashed border-border">
            {waitlisted.map((participant, index) => (
              <li key={participant.id} className="flex items-center gap-3 px-3 py-2">
                <Badge tone="muted" className="tabular-nums">
                  {t("workshops.waitlist.position", { position: index + 1 })}
                </Badge>
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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            {t("workshops.waitlist.hint")}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export const WorkshopParticipantsSection = React.memo(
  WorkshopParticipantsSectionInner,
  (prev, next) =>
    prev.canWrite === next.canWrite &&
    prev.canDelete === next.canDelete &&
    prev.detail.participants === next.detail.participants &&
    prev.detail.waitlisted === next.detail.waitlisted &&
    prev.detail.workshop.id === next.detail.workshop.id &&
    prev.detail.workshop.capacity === next.detail.workshop.capacity &&
    prev.detail.workshop.waitlistEnabled === next.detail.workshop.waitlistEnabled &&
    prev.detail.workshop.status === next.detail.workshop.status &&
    prev.detail.workshop.deletedAt === next.detail.workshop.deletedAt &&
    prev.detail.workshop.updatedAt === next.detail.workshop.updatedAt,
);
