import React from "react";
import { useFacultyHost } from "../host.js";

export default function ContactPicker(props: Record<string, unknown>): React.JSX.Element {
  const C = useFacultyHost().ContactPicker;
  return <C {...props} />;
}
