/**
 * @file tasksRepository.ts
 * @description Storage contract for the Tasks module.
 *
 * Use-cases depend on this interface — never on the concrete Drizzle functions in
 * `db/repositories/*`. The Drizzle-backed adapter is the only implementation.
 */
type TasksModule = typeof import("../../db/repositories/tasksRepository.js");
type TasksBulkModule = typeof import("../../db/repositories/tasksBulkRepository.js");

export interface TasksRepository {
  listTasks: TasksModule["listTasks"];
  findTaskById: TasksModule["findTaskById"];
  getTaskMetrics: TasksModule["getTaskMetrics"];
  createTask: TasksModule["createTask"];
  updateTask: TasksModule["updateTask"];
  updateTaskStatus: TasksModule["updateTaskStatus"];
  deleteTask: TasksModule["deleteTask"];
  restoreTask: TasksModule["restoreTask"];
  bulkRestoreTasks: TasksBulkModule["bulkRestoreTasksBatch"];
  bulkDeleteTasks: TasksBulkModule["bulkDeleteTasksBatch"];
  bulkUpdateTaskStatus: TasksBulkModule["bulkUpdateTaskStatusBatch"];
}
