import React from "react";
import { Calendar as UiCalendar, type CalendarProps } from "@mms/ui/calendar";
import { UiConfigProvider } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

export type { CalendarProps };

/** App adapter: injects the active tenant language/direction into the UI calendar. */
export function Calendar(props: CalendarProps): React.JSX.Element {
  const { language, dir, t } = useTranslation();
  return (
    <UiConfigProvider
      config={{ dir, language, translate: t as unknown as (key: string) => string }}
    >
      <UiCalendar {...props} />
    </UiConfigProvider>
  );
}
