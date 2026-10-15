import React from "react";
import { Toast } from "./Toast";
import { useToast } from "./useToast";

export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-0 end-0 z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-md gap-2"
    >
      {toasts.map((item) => (
        <Toast
          key={item.id}
          variant={item.variant}
          title={item.title}
          description={item.description}
          action={item.action}
          onClose={() => dismiss(item.id)}
        />
      ))}
    </div>
  );
}
