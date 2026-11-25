import React from "react";

const Devtools = React.lazy(() =>
  import("@tanstack/react-query-devtools").then((mod) => ({
    default: mod.ReactQueryDevtools,
  })),
);

/** TanStack Query devtools — dev builds only, lazy-loaded. */
export default function QueryDevtools(): React.JSX.Element | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <React.Suspense fallback={null}>
      <Devtools initialIsOpen={false} buttonPosition="bottom-left" />
    </React.Suspense>
  );
}
