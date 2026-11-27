import { getWorkshopsHost } from "../host.js";

export function useWorkshops(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useWorkshops(...args);
}

export function useWorkshopMetrics(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useWorkshopMetrics(...args);
}

export function useCreateWorkshop(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useCreateWorkshop(...args);
}

export function useUpdateWorkshop(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useUpdateWorkshop(...args);
}

export function useDeleteWorkshop(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useDeleteWorkshop(...args);
}

export function useRestoreWorkshop(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useRestoreWorkshop(...args);
}

export function useTransitionWorkshop(...args: any[]): any {
  return (getWorkshopsHost() as any).workshopsCollection?.useTransitionWorkshop(...args);
}
