import { StudentsPageView } from "@/tenant/features/students/components/StudentsPageView";
import { useStudentsPageController } from "@/tenant/features/students/hooks/useStudentsPageController";

/**
 * Students Directory and Records Page.
 * Implements the standard 3-tier tab system (Work | Reports | Setup).
 */
export default function Students() {
  const view = useStudentsPageController();
  return <StudentsPageView {...view} />;
}
