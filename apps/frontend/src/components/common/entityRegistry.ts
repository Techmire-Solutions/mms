export * from "@/components/common/entityRegistryTypes";
export * from "./entityRegistryImpl";
export { useStaticEntityDescriptor } from "./useStaticEntityDescriptor";
export { useDescriptorFilterChips } from "./useDescriptorFilterChips";

import { configureEntityDescriptorResolver } from "@mms/fe-core/components/entityDescriptorResolver";
import { getEntityDescriptor } from "./entityRegistryImpl";

configureEntityDescriptorResolver((type) => getEntityDescriptor(type as never));
