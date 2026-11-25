import React from "react";
import type { Session } from "@mms/contracts";
import { useHasanatHost } from "../host.js";

export function SessionClassSectionSelect(props: any): React.JSX.Element {
  const C = useHasanatHost().SessionClassSectionSelect;
  return <C {...props} />;
}

export function sessionIdForClass(
  sessions: readonly Session[],
  classId: string | null | undefined,
): string {
  if (!classId) return "";
  return sessions.find((session) => session.classes.some((cls) => cls.id === classId))?.id ?? "";
}
