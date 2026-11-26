import { TasksPageView } from "./components/TasksPageView";
import { useTasksPageController } from "./hooks/useTasksPageController";

export default function TasksPage() {
  const view = useTasksPageController();
  return <TasksPageView {...view} />;
}
