import React from "react";
import { getQuestionBankHost } from "../host.js";

export function WorkTaskToolbar(props: any): React.JSX.Element {
  const C = (getQuestionBankHost() as any).WorkTaskToolbar as React.ComponentType<any>;
  return <C {...props} />;
}

export default WorkTaskToolbar;
