/**
 * @file useWorkshopsColumnLayout.ts
 * @description Module column layout SSOT for the Workshops Work directory.
 */

import { useMemo } from "react";
import {
  WORKSHOPS_MODULE_MANIFEST,
  type AppTranslationKey,
  type ModuleColumnRegistryEntry,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export const WORKSHOP_WORK_COLUMN_KEYS = [
  "title",
  "dates",
  "registrationDeadline",
  "participants",
  "fee",
] as const;

export type WorkshopWorkColumnKey = (typeof WORKSHOP_WORK_COLUMN_KEYS)[number];

/** The title has a default too: with every other column fixed, an unsized one collapses to 0. */
export const WORKSHOP_TITLE_DEFAULT_WIDTH = 260;

const WIDTHS: Record<WorkshopWorkColumnKey, number | undefined> = {
  title: WORKSHOP_TITLE_DEFAULT_WIDTH,
  dates: 200,
  registrationDeadline: 150,
  participants: 140,
  fee: 110,
};

export const WORKSHOP_WORK_COLUMN_LABEL_KEYS: Record<WorkshopWorkColumnKey, AppTranslationKey> = {
  title: "workshops.title",
  dates: "workshops.dates",
  registrationDeadline: "workshops.registrationDeadline",
  participants: "workshops.participants",
  fee: "workshops.fee",
};

export function useWorkshopsColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = useMemo<ModuleColumnRegistryEntry[]>(
    () =>
      WORKSHOP_WORK_COLUMN_KEYS.map((key, order) => ({
        key,
        label: t(WORKSHOP_WORK_COLUMN_LABEL_KEYS[key]),
        enabled: true,
        order,
        width: WIDTHS[key],
        fixed: key === "title",
      })),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: WORKSHOPS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    translationPrefix: "common.columns",
  });
}
