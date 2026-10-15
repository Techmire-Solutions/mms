import { useEffect, useState } from "react";
import { getToastState, subscribeToToasts, toast, type ToastItem } from "./toastStore";

export function useToast(): {
  toasts: ToastItem[];
  toast: typeof toast;
  dismiss: (id?: string) => void;
} {
  const [state, setState] = useState(getToastState());

  useEffect(() => {
    return subscribeToToasts((newState) => {
      setState(newState);
    });
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: (id?: string) => {
      if (id) {
        state.toasts.find((t) => t.id === id);
      }
    },
  };
}
