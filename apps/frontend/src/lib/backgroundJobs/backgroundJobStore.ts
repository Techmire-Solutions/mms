import type { BackgroundJobRecord } from "@mms/shared";
import {
  clearFinishedBackgroundJobsRemote,
  dismissBackgroundJobRemote,
  upsertBackgroundJobRemote,
} from "@/lib/backgroundJobs/backgroundJobApi";

/** Unscoped fallback — the auth contexts register a tenant/user-scoped provider on sign-in. */
const UNSCOPED_KEY = "mms_background_jobs_v2";

let storageKeyProvider: () => string = () => UNSCOPED_KEY;

/**
 * Registers how the store's localStorage key is derived (workspace + user
 * scope). Called by the tenant and platform auth contexts so each console and
 * account keeps its own job mirror; re-registering updates the scope for the
 * next store access.
 */
export function registerBackgroundJobStorageKeyProvider(provider: () => string): void {
  storageKeyProvider = provider;
}

/** Removes the store under the currently registered scope (logout cleanup). */
export function clearBackgroundJobStorageLocal(): void {
  try {
    localStorage.removeItem(storageKeyProvider());
  } catch {
    /* ignore */
  }
}

function storageKey(): string {
  return storageKeyProvider();
}

const MAX_JOBS_PER_MODULE = 20;
export const BACKGROUND_JOBS_EVENT = "mms-background-jobs-changed";

export type BackgroundJobStatus = BackgroundJobRecord["status"];
export type BackgroundJob = BackgroundJobRecord;

type JobStore = Record<string, BackgroundJob[]>;

function readStore(): JobStore {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) return JSON.parse(raw) as JobStore;
  } catch {
    /* ignore */
  }
  return {};
}

function writeStore(store: JobStore): void {
  localStorage.setItem(storageKey(), JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(BACKGROUND_JOBS_EVENT));
}

function syncRemote(job: BackgroundJob): void {
  void upsertBackgroundJobRemote(job).catch(() => {});
}

export function mergeServerBackgroundJobs(serverJobs: BackgroundJob[]): BackgroundJob[] {
  const local = getAllBackgroundJobs();
  const byId = new Map<string, BackgroundJob>();
  for (const job of serverJobs) byId.set(job.id, job);
  for (const job of local) {
    const existing = byId.get(job.id);
    if (!existing || (job.status === "running" && existing.status === "running")) {
      byId.set(job.id, job);
    }
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function upsertLocalBackgroundJob(job: BackgroundJob): void {
  const store = readStore();
  const list = store[job.moduleId] ?? [];
  const jobIndex = list.findIndex((storedJob) => storedJob.id === job.id);
  if (jobIndex >= 0) {
    list[jobIndex] = job;
  } else {
    list.unshift(job);
  }
  store[job.moduleId] = list.slice(0, MAX_JOBS_PER_MODULE);
  writeStore(store);
}

export function getAllBackgroundJobs(): BackgroundJob[] {
  const store = readStore();
  return Object.values(store)
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function startBackgroundJob(
  moduleId: string,
  kind: string,
  label: string,
  total?: number,
): string {
  const id = crypto.randomUUID();
  const job: BackgroundJob = {
    id,
    moduleId,
    kind,
    status: "running",
    label,
    progress: total != null ? { current: 0, total } : undefined,
    createdAt: new Date().toISOString(),
  };
  const store = readStore();
  const list = [job, ...(store[moduleId] ?? [])].slice(0, MAX_JOBS_PER_MODULE);
  store[moduleId] = list;
  writeStore(store);
  syncRemote(job);
  return id;
}

export function completeBackgroundJob(id: string): void {
  patchJob(id, { status: "completed", completedAt: new Date().toISOString() });
}

export function failBackgroundJob(id: string, error: string): void {
  patchJob(id, { status: "failed", error, completedAt: new Date().toISOString() });
}

function patchJob(id: string, patch: Partial<BackgroundJob>): void {
  const store = readStore();
  for (const moduleId of Object.keys(store)) {
    const jobIndex = store[moduleId].findIndex((storedJob) => storedJob.id === id);
    if (jobIndex < 0) continue;
    const job = { ...store[moduleId][jobIndex], ...patch };
    store[moduleId][jobIndex] = job;
    writeStore(store);
    syncRemote(job);
    return;
  }
}

export function patchLocalBackgroundJobOnly(id: string, patch: Partial<BackgroundJob>): boolean {
  const store = readStore();
  for (const moduleId of Object.keys(store)) {
    const jobIndex = store[moduleId].findIndex((storedJob) => storedJob.id === id);
    if (jobIndex < 0) continue;
    store[moduleId][jobIndex] = { ...store[moduleId][jobIndex], ...patch };
    writeStore(store);
    return true;
  }
  return false;
}

export function dismissBackgroundJob(id: string): void {
  const store = readStore();
  for (const moduleId of Object.keys(store)) {
    store[moduleId] = (store[moduleId] ?? []).filter((job) => job.id !== id);
  }
  writeStore(store);
  void dismissBackgroundJobRemote(id).catch(() => {});
}

export function clearFinishedBackgroundJobs(): void {
  const store = readStore();
  for (const moduleId of Object.keys(store)) {
    store[moduleId] = (store[moduleId] ?? []).filter((job) => job.status === "running");
  }
  writeStore(store);
  void clearFinishedBackgroundJobsRemote().catch(() => {});
}
