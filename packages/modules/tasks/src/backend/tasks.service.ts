import { listTasks } from "./repository/db/tasksRepository.js";

/** Public directory surface for other modules. */
export const tasksService = {
  listTasks,
};
