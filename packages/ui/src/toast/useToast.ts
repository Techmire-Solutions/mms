import { useEffect, useState } from "react";
import {
  dismissToast,
  getToastState,
  subscribeToToasts,
  toast,
  type ToastItem,
} from "./toastStore";

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
      dismissToast(id);
    },
  };
}

export { toast };
