import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ToastProvider component provides the context/container for toasts.
 */
function ToastProvider({ className, ref, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none fixed top-0 z-toast flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:end-0 sm:top-auto sm:flex-col md:max-w-toast",
        className,
      )}
      {...props}
    />
  );
}

/**
 * ToastViewport component defines the area where toasts are rendered.
 */
function ToastViewport({ className, ref, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none fixed top-0 z-toast flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:end-0 sm:top-auto sm:flex-col md:max-w-toast",
        className,
      )}
      {...props}
    />
  );
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-md border p-6 pe-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full rtl:data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        info: "border-info/30 bg-info/10 text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ToastProps
  extends React.ComponentProps<"div">, VariantProps<typeof toastVariants> {}

/**
 * Toast component representing an individual alert notification.
 */
function Toast({ className, variant, ref, ...props }: ToastProps) {
  return <div ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
}

/**
 * ToastAction component for actions within a toast.
 */
function ToastAction({ className, ref, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
        className,
      )}
      {...props}
    />
  );
}

/**
 * ToastClose component provides a close button for the toast.
 */
function ToastClose({ className, ref, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      ref={ref}
      className={cn(
        "absolute end-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 text-current opacity-50 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/40",
        className,
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

/**
 * ToastTitle component displays the main header/title of a toast.
 */
function ToastTitle({ className, ref, ...props }: React.ComponentProps<"div">) {
  return <div ref={ref} className={cn("text-sm font-semibold", className)} {...props} />;
}

/**
 * ToastDescription component displays the detailed description text of a toast.
 */
function ToastDescription({ className, ref, ...props }: React.ComponentProps<"div">) {
  return <div ref={ref} className={cn("text-sm opacity-90", className)} {...props} />;
}

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
