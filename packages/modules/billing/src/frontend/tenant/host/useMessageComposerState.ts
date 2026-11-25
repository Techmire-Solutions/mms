import { useFinanceHostValue } from "../host.js";

export type MessagingTarget = Record<string, unknown>;
export type UseMessageComposerStateResult = any;

export function useMessageComposerState<T = any>(...args: any[]): T {
  return (useFinanceHostValue() as any).useMessageComposerState(...args);
}
