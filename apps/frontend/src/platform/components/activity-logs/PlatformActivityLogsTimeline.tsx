import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ActivityLogRow } from "./ActivityLogRow";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

export interface PlatformActivityLogsTimelineProps {
  logs: PlatformActivityLogItem[];
  onInspect: (log: PlatformActivityLogItem) => void;
}

export function PlatformActivityLogsTimeline({
  logs,
  onInspect,
}: PlatformActivityLogsTimelineProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isVirtualized = logs.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 5,
    enabled: isVirtualized,
  });

  if (!isVirtualized) {
    return (
      <div className="relative border-s-2 border-border/60 ms-4 ps-6 space-y-4 pt-2">
        {logs.map((log) => (
          <ActivityLogRow key={log.id} log={log} onInspect={onInspect} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative max-h-[70vh] overflow-y-auto ms-4 ps-6 pt-2"
      tabIndex={0}
      role="region"
      aria-label="Activity logs timeline"
    >
      <div className="absolute start-0 top-0 bottom-0 w-0.5 bg-border/60" aria-hidden />
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
          width: "100%",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const log = logs[virtualRow.index];
          return (
            <div
              key={log.id}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                insetInlineStart: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="pb-4"
            >
              <ActivityLogRow log={log} onInspect={onInspect} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
