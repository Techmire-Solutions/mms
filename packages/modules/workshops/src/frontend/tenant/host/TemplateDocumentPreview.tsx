import React from "react";
import { getWorkshopsHost } from "../host.js";

export function TemplateDocumentPreview(props: Record<string, unknown>): React.JSX.Element {
  const C = (getWorkshopsHost() as any).TemplateDocumentPreview as React.ComponentType<any>;
  return <C {...props} />;
}

export default TemplateDocumentPreview;
