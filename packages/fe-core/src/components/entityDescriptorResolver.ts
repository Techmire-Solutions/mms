import type { EntityDescriptor } from "./entityRegistryTypes";

type Resolver = (entityType: string) => EntityDescriptor<unknown> | undefined;

let resolver: Resolver | null = null;

export function configureEntityDescriptorResolver(fn: Resolver): void {
  resolver = fn;
}

export function resolveEntityDescriptor(entityType: string): EntityDescriptor<unknown> | undefined {
  return resolver?.(entityType);
}
