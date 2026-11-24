import { useState } from "react";
import { MEDIA_MD_UP } from "./breakpoints.js";
import { useMediaQuery } from "./useMediaQuery.js";

export type WorkDirectoryViewMode = "table" | "cards";

export function useWorkDirectoryViewMode(initialMode?: WorkDirectoryViewMode): {
  viewMode: WorkDirectoryViewMode;
  setViewMode: (mode: WorkDirectoryViewMode) => void;
} {
  const isMdUp = useMediaQuery(MEDIA_MD_UP);
  const [override, setOverride] = useState<WorkDirectoryViewMode | null>(initialMode ?? null);
  const viewMode = override ?? (isMdUp ? "table" : "cards");
  return { viewMode, setViewMode: setOverride };
}
