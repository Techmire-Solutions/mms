export * from "@mms/fe-core/components/entityRegistryTypes";
export * from "./entityRegistryImpl";
export { useStaticEntityDescriptor } from "./useStaticEntityDescriptor";
export { useDescriptorFilterChips } from "@mms/fe-core/lib/useDescriptorFilterChips";

import { configureEntityDescriptorResolver } from "@mms/fe-core/components/entityDescriptorResolver";
import { getEntityDescriptor } from "./entityRegistryImpl";

configureEntityDescriptorResolver((type) => getEntityDescriptor(type as never));
