import React from "react";
import { getExaminationsHost } from "../host.js";

export function AcademicCatalogSelect(props: any): React.JSX.Element {
  const C = (getExaminationsHost() as any).AcademicCatalogSelect as React.ComponentType<any>;
  return <C {...props} />;
}

export default AcademicCatalogSelect;
