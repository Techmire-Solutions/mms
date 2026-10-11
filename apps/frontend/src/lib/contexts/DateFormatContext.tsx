import React, { createContext, useContext } from "react";
import { DEFAULT_GLOBAL_SETTINGS, normalizeDateFormat, type DateFormatId } from "@mms/shared";

export const DateFormatContext = createContext<DateFormatId | null>(null);

export interface DateFormatProviderProps {
  value?: DateFormatId | string | null;
  children: React.ReactNode;
}

/**
 * Provides a host-neutral date format (e.g. 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')
 * to UI primitives and hooks without coupling them to tenant settings or database stores.
 */
export function DateFormatProvider({
  value,
  children,
}: DateFormatProviderProps): React.JSX.Element {
  const resolved = normalizeDateFormat(value, DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId);

  return <DateFormatContext.Provider value={resolved}>{children}</DateFormatContext.Provider>;
}

/**
 * Returns the active date format from context, falling back to standard default format.
 */
export function useDateFormat(): DateFormatId {
  const contextValue = useContext(DateFormatContext);
  return contextValue ?? (DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId);
}
