import { Sun, Moon } from "lucide-react";
import {
  formatDate,
  calculateDetailedSolarAge,
  getLunarDateString,
  calculateDetailedLunarAge,
} from "@mms/contracts";

export function renderSolarDobMetadata({
  dob,
  showDetailedSolarAge,
  language,
  emptyNode,
}: {
  dob: string | undefined;
  showDetailedSolarAge: boolean;
  language: string;
  emptyNode: React.ReactNode;
}): React.ReactNode {
  if (!dob) return emptyNode;
  return (
    <div className="flex flex-col gap-0.5 text-xs leading-normal font-mono">
      <span className="font-semibold text-foreground flex items-center gap-1">
        <Sun className="w-3 h-3 text-warning shrink-0" aria-hidden="true" />
        <span>{formatDate(dob)}</span>
      </span>
      {showDetailedSolarAge ? (
        <span className="text-xs text-muted-foreground">
          {calculateDetailedSolarAge(dob, language)}
        </span>
      ) : null}
    </div>
  );
}

export function renderLunarDobMetadata({
  dob,
  showLunarDob,
  showDetailedLunarAge,
  language,
  emptyNode,
}: {
  dob: string | undefined;
  showLunarDob: boolean;
  showDetailedLunarAge: boolean;
  language: string;
  emptyNode: React.ReactNode;
}): React.ReactNode {
  if (!dob || !showLunarDob) return emptyNode;
  return (
    <div className="flex flex-col gap-0.5 text-xs leading-normal font-mono">
      <span className="font-semibold text-foreground flex items-center gap-1">
        <Moon className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
        <span>{getLunarDateString(dob, language)}</span>
      </span>
      {showDetailedLunarAge ? (
        <span className="text-xs text-muted-foreground">
          {calculateDetailedLunarAge(dob, language)}
        </span>
      ) : null}
    </div>
  );
}
