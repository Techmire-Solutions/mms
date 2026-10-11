import type { PlatformServiceErrorCode } from "@mms/shared";
import { PLATFORM_SERVICE_ERROR_STATUSES } from "@mms/shared";

export type PlatformErrorCode = PlatformServiceErrorCode;

export class PlatformError<TCode extends PlatformErrorCode = PlatformErrorCode> extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: TCode,
    message: string,
  ) {
    super(message);
    this.name = "PlatformError";
    this.statusCode = PLATFORM_SERVICE_ERROR_STATUSES[code] ?? 400;
  }
}
