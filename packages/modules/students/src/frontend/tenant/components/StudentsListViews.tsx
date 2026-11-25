import { StudentsListCards } from "./StudentsListCards";
import { StudentsListDesktopTable } from "./StudentsListDesktopTable";
import type { StudentsListViewsProps } from "../lib/studentsListTypes";

/** Table/cards directory only — empty state mounts on StudentsList (Contacts-shaped). */
export function StudentsListViews(props: StudentsListViewsProps): React.JSX.Element {
  if (props.viewMode === "cards") {
    return <StudentsListCards {...props} />;
  }

  return <StudentsListDesktopTable {...props} />;
}
