import type { ComponentProps } from "react";
import type { FacultyWorkTier } from "../components/FacultyWorkTier";
import { buildFacultyWorkTierProps, type FacultyWorkTierSource } from "./facultyPageWorkTierProps";

export type FacultyPageTabPanelProps = {
  activeTab: string;
  workTierProps: ComponentProps<typeof FacultyWorkTier>;
};

export function useFacultyPageTabPanelProps(
  activeTab: string,
  workSource: FacultyWorkTierSource,
): FacultyPageTabPanelProps {
  return {
    activeTab,
    workTierProps: buildFacultyWorkTierProps(workSource),
  };
}
