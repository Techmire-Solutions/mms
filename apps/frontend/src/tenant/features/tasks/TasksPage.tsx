import { TasksPageView } from "@/tenant/features/tasks/components/TasksPageView";
import { useTasksPageController } from "@/tenant/features/tasks/hooks/useTasksPageController";

export default function TasksPage() {
  const view = useTasksPageController();
  return <TasksPageView {...view} />;
}
