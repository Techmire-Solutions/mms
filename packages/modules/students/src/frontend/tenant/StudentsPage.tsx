import { StudentsPageView } from "./components/StudentsPageView";
import { useStudentsPageController } from "./hooks/useStudentsPageController";

/**
 * Students Directory and Records Page.
 * Implements the standard 3-tier tab system (Work | Reports | Setup).
 */
export default function Students() {
  const view = useStudentsPageController();
  return <StudentsPageView {...view} />;
}
