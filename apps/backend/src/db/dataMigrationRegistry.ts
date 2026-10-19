import { dataMigrationsBatch1, type DataMigrationEntry } from "./dataMigrationsBatch1.js";
import { dataMigrationsBatch2 } from "./dataMigrationsBatch2.js";

export type { DataMigrationEntry };

export const dataMigrationsToRun: DataMigrationEntry[] = [
  ...dataMigrationsBatch1,
  ...dataMigrationsBatch2,
];
