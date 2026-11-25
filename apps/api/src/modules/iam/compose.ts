import { createIamService } from "@mms/mod-iam/backend/tenant";
import { iamPorts } from "./adapters.js";

export const iamService = createIamService(iamPorts);
