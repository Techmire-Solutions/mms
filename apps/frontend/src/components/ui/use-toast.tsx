// Inspired by react-hot-toast library
import { useState, useEffect } from "react";
import {
  actionTypes,
  dispatch,
  genToastId,
  getToastMemoryState,
  subscribe,
  type ToasterToast,
} from "@/components/ui/toastStore";

export type { ToasterToast } from "@/components/ui/toastStore";
export { reducer } from "@/components/ui/toastStore";

const TOAST_DEFAULT_DURATION = 5000;

type ToastPropsWithoutId = Omit<ToasterToast, "id">;

function toast({ duration = TOAST_DEFAULT_DURATION, ...props }: ToastPropsWithoutId) {
  const id = genToastId();

  const update = (updateProps: ToastPropsWithoutId): void =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...updateProps, id },
    });

  const dismiss = (): void => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  if (duration !== Infinity) {
    setTimeout(dismiss, duration);
  }

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = useState(getToastMemoryState());

  useEffect(() => subscribe(setState), []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string): void => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast };
