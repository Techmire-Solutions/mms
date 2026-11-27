import React from "react";
import { ProgressRing as SharedProgressRing } from "@mms/ui";

/**
 * Standard or Compact Progress Circle Ring Component.
 * Delegates to @mms/ui ProgressRing for accessibility and design system consistency.
 */
export function ProgressRing({
  percentage,
  colorHex,
  isCompact,
}: {
  percentage: number;
  colorHex: string;
  isCompact?: boolean;
}): React.JSX.Element {
  return <SharedProgressRing percentage={percentage} colorHex={colorHex} isCompact={isCompact} />;
}
