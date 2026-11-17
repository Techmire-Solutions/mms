import React from "react";
import { FacultyPageView } from "@/tenant/features/faculty/components/FacultyPageView";
import { useFacultyPageController } from "@/tenant/features/faculty/hooks/useFacultyPageController";

/**
 * Faculty — roster, catalogs, reports, and setup as peer tabs
 * (Faculties | Departments | Designations | Reports | Setup).
 */
export default function FacultyPage(): React.JSX.Element {
  const view = useFacultyPageController();
  return <FacultyPageView {...view} />;
}

export { FacultyPage };
