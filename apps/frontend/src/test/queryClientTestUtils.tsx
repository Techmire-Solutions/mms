/**
 * @file queryClientTestUtils.tsx
 * @description Minimal QueryClient wrapper for component tests that render hooks
 * (the template editors now read and write through TanStack Query).
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function withQueryClient(
  node: React.ReactNode,
  client: QueryClient = createTestQueryClient(),
): React.ReactElement {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}
