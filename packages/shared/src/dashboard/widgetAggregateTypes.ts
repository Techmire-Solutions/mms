import type { z } from "zod";
import type { widgetQuerySchema } from "../schemas/common.dto.js";

export type WidgetQuery = z.infer<typeof widgetQuerySchema>;
export type WidgetFilter = NonNullable<WidgetQuery["filters"]>[number];
export type { WidgetAggregateResult } from "../schemas/common.dto.js";
