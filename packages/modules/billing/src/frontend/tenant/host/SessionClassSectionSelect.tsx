import React from "react";
import { useFinanceHostValue } from "../host.js";

export interface SessionClassSectionValue {
  sessionId: string;
  classId: string;
  sectionId: string;
}

export function SessionClassSectionSelect(props: Record<string, unknown>): React.JSX.Element {
  const C = useFinanceHostValue().SessionClassSectionSelect;
  return <C {...props} />;
}

export default SessionClassSectionSelect;
