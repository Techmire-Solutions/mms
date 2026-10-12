import {
  bulkRestoreTasks,
  deleteTask,
  findTaskById,
  getTaskMetrics,
  listTasks,
  restoreTask,
  updateTaskStatus,
} from "../../db/repositories/tasksRepository.js";
import { bulkDeleteTasks } from "../../db/repositories/tasksTrashRepository.js";
import type { TasksRepository } from "./tasksRepository.js";

/**
 * Drizzle-backed implementation of {@link TasksRepository}. The only file in the
 * Tasks domain that binds to the concrete storage functions.
 */
export const tasksRepositoryAdapter: TasksRepository = {
  listTasks,
  findTaskById,
  getTaskMetrics,
  updateTaskStatus,
  deleteTask,
  restoreTask,
  bulkRestoreTasks,
  bulkDeleteTasks,
};
