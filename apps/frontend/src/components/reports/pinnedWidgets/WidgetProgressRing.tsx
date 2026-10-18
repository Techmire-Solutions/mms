import React from "react";

/**
 * Standard or Compact Progress Circle Ring Component.
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
  const size = isCompact ? 40 : 64;
  const strokeWidth = isCompact ? 4 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted-foreground/10 fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none transition-all duration-500 ease-out"
          stroke={colorHex}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`absolute font-black tracking-tight text-foreground ${isCompact ? "text-xs" : "text-xs font-mono"}`}
      >
        {percentage}%
      </span>
    </div>
  );
}
