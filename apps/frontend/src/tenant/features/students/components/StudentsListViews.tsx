import { StudentsListCards } from "@/tenant/features/students/components/StudentsListCards";
import { StudentsListDesktopTable } from "@/tenant/features/students/components/StudentsListDesktopTable";
import type { StudentsListViewsProps } from "@/tenant/features/students/components/studentsListTypes";

/** Table/cards directory only — empty state mounts on StudentsList (Contacts-shaped). */
export function StudentsListViews(props: StudentsListViewsProps): React.JSX.Element {
  if (props.viewMode === "cards") {
    return <StudentsListCards {...props} />;
  }

  return <StudentsListDesktopTable {...props} />;
}
