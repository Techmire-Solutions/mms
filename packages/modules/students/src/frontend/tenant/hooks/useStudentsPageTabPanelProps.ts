import type { ComponentProps } from "react";
import type { StudentsWorkTier } from "../components/StudentsWorkTier";
import {
  buildStudentsWorkTierProps,
  type StudentsWorkTierSource,
} from "./studentsPageWorkTierProps";

export type StudentsPageTabPanelProps = {
  activeTab: string;
  workTierProps: ComponentProps<typeof StudentsWorkTier>;
};

/** Tab panel bag: active tier + Work props (Reports/Setup need no props today). */
export function useStudentsPageTabPanelProps(
  activeTab: string,
  workSource: StudentsWorkTierSource,
): StudentsPageTabPanelProps {
  return {
    activeTab,
    workTierProps: buildStudentsWorkTierProps(workSource),
  };
}
