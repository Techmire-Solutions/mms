import { dehydrate, hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";

interface QueryPersister {
  restoreClient: () => Promise<DehydratedState | undefined>;
  persistClient: (state: DehydratedState) => Promise<void>;
  removeClient: () => Promise<void>;
}

function canPersistQuery(
  query: Pick<DehydratedState["queries"][number], "queryKey" | "state">,
): boolean {
  return (
    query.queryKey[0] !== "platform" &&
    query.state.status === "success" &&
    query.state.data !== undefined &&
    !query.queryKey.some((key) => typeof key === "string" && key.includes("auth"))
  );
}

export function createQueryPersistenceLifecycle(
  client: QueryClient,
  persister: QueryPersister,
  isCurrent = () => true,
) {
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let stopped = false;
  let startPromise: Promise<void> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let writes = Promise.resolve();

  const enqueue = (operation: () => Promise<void>) => {
    writes = writes.then(operation).catch(() => {});
  };

  function reset(): void {
    generation += 1;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    // Removal follows any in-flight save, so that save cannot resurrect the old cache.
    enqueue(() => persister.removeClient());
  }

  function scheduleSave(): void {
    if (stopped || !isCurrent()) return;
    clearTimeout(saveTimer);
    const scheduledGeneration = generation;
    saveTimer = setTimeout(() => {
      enqueue(async () => {
        if (scheduledGeneration !== generation || stopped || !isCurrent()) return;
        const state = dehydrate(client, {
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: canPersistQuery,
        });
        await persister.persistClient(state);
      });
    }, 1000);
  }

  function start(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (startPromise) return startPromise;
    const restoringGeneration = generation;
    unsubscribe = client.getQueryCache().subscribe(scheduleSave);
    startPromise = (async () => {
      try {
        const restored = await persister.restoreClient();
        if (restored && restoringGeneration === generation && !stopped && isCurrent()) {
          hydrate(client, { queries: restored.queries.filter(canPersistQuery), mutations: [] });
        }
      } catch {
        // Persistence is optional; network-backed queries remain available.
      }
    })();
    return startPromise;
  }

  function stop(): void {
    stopped = true;
    unsubscribe?.();
    reset();
  }

  return { start, reset, stop };
}
