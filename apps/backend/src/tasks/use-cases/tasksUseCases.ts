import type { TasksRepository } from "../repository/tasksRepository.js";
import { tasksRepositoryAdapter } from "../repository/tasksRepositoryAdapter.js";

/**
 * Composition root for the Tasks module. `repo` is injectable so tests can supply a
 * fake repository without touching Drizzle; production uses the adapter default.
 */
export function createTasksUseCases(
  repo: TasksRepository = tasksRepositoryAdapter,
): TasksRepository {
  return {
    listTasks: repo.listTasks,
    findTaskById: repo.findTaskById,
    getTaskMetrics: repo.getTaskMetrics,
    updateTaskStatus: repo.updateTaskStatus,
    deleteTask: repo.deleteTask,
    restoreTask: repo.restoreTask,
    bulkRestoreTasks: repo.bulkRestoreTasks,
    bulkDeleteTasks: repo.bulkDeleteTasks,
  };
}

export const tasksUseCases = createTasksUseCases();

// Named exports let route handlers import the use-case surface directly.
export const {
  listTasks,
  findTaskById,
  getTaskMetrics,
  updateTaskStatus,
  deleteTask,
  restoreTask,
  bulkRestoreTasks,
  bulkDeleteTasks,
} = tasksUseCases;
