/**
 * @file WorkshopPhaseBadge.tsx
 * @description Single source of the workshop phase tone/label mapping (Work column + drawer).
 */

import type { AppTranslationKey, WorkshopPhase } from "@mms/contracts";
import { Badge, type BadgeTone } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

const TONE: Record<WorkshopPhase, BadgeTone> = {
  draft: "muted",
  registration_open: "info",
  registration_closed: "warning",
  ongoing: "warning",
  finished: "secondary",
  completed: "success",
  cancelled: "muted",
  archived: "muted",
};

const LABEL_KEY: Record<WorkshopPhase, AppTranslationKey> = {
  draft: "workshops.phase.draft",
  registration_open: "workshops.phase.registration_open",
  registration_closed: "workshops.phase.registration_closed",
  ongoing: "workshops.phase.ongoing",
  finished: "workshops.phase.finished",
  completed: "workshops.phase.completed",
  cancelled: "workshops.phase.cancelled",
  archived: "workshops.phase.archived",
};

export function WorkshopPhaseBadge({ phase }: { phase: WorkshopPhase }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Badge tone={TONE[phase]} dot>
      {t(LABEL_KEY[phase])}
    </Badge>
  );
}
