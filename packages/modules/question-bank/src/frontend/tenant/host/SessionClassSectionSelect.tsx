import React from "react";
import { getQuestionBankHost } from "../host.js";

export function SessionClassSectionSelect(props: any): React.JSX.Element {
  const C = (getQuestionBankHost() as any).SessionClassSectionSelect as React.ComponentType<any>;
  return <C {...props} />;
}

export default SessionClassSectionSelect;
