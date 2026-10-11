import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { startOutboxCdcListener, OUTBOX_CDC_CHANNEL } from "../worker/outboxCdcListener.js";
import type { SearchIndexAdapter } from "../worker/adapters/searchIndexAdapter.js";

const mockProcessOutboxCdcBatch = vi.fn();
vi.mock("../worker/processors/outboxCdcProcessor.js", () => ({
  processOutboxCdcBatch: (...args: unknown[]) => mockProcessOutboxCdcBatch(...args),
}));

class MockPgClient extends EventEmitter {
  query = vi.fn().mockResolvedValue({ rows: [] });
  release = vi.fn();
}

let activeMockClient: MockPgClient | null = null;
const mockPool = {
  connect: vi.fn().mockImplementation(async () => {
    activeMockClient = new MockPgClient();
    return activeMockClient;
  }),
};

vi.mock("../db/dbConnection.js", () => ({
  getPool: () => mockPool,
}));

describe("Outbox CDC Listener (PostgreSQL LISTEN / NOTIFY)", () => {
  const fakeSearchAdapter: SearchIndexAdapter = {
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    indexDocument: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessOutboxCdcBatch.mockResolvedValue({ processed: 0, skipped: 0 });
  });

  afterEach(() => {
    activeMockClient = null;
  });

  it("connects to pg pool, executes LISTEN on mms_outbox_events, and runs initial backlog drain", async () => {
    const handle = await startOutboxCdcListener(fakeSearchAdapter, {
      fallbackPollIntervalMs: 60_000,
      coalesceDebounceMs: 10,
    });

    expect(mockPool.connect).toHaveBeenCalled();
    expect(activeMockClient?.query).toHaveBeenCalledWith(`LISTEN ${OUTBOX_CDC_CHANNEL}`);

    // Wait for initial drain to execute
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockProcessOutboxCdcBatch).toHaveBeenCalledWith(fakeSearchAdapter);

    await handle.stop();
    expect(activeMockClient?.query).toHaveBeenCalledWith(`UNLISTEN ${OUTBOX_CDC_CHANNEL}`);
    expect(activeMockClient?.release).toHaveBeenCalled();
  });

  it("triggers batch processing on incoming NOTIFY event and coalesces rapid signals", async () => {
    const handle = await startOutboxCdcListener(fakeSearchAdapter, {
      fallbackPollIntervalMs: 60_000,
      coalesceDebounceMs: 25,
    });

    // Wait for initial drain
    await new Promise((resolve) => setTimeout(resolve, 40));
    mockProcessOutboxCdcBatch.mockClear();

    // Fire 3 rapid notifications
    activeMockClient?.emit("notification", { channel: OUTBOX_CDC_CHANNEL, payload: "new_event" });
    activeMockClient?.emit("notification", { channel: OUTBOX_CDC_CHANNEL, payload: "new_event" });
    activeMockClient?.emit("notification", { channel: OUTBOX_CDC_CHANNEL, payload: "new_event" });

    // Before debounce delay expires, should not have fired additional calls
    expect(mockProcessOutboxCdcBatch).not.toHaveBeenCalled();

    // After debounce delay expires, should coalesce into batch call
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockProcessOutboxCdcBatch).toHaveBeenCalledTimes(1);

    await handle.stop();
  });

  it("ignores notifications on different channels", async () => {
    const handle = await startOutboxCdcListener(fakeSearchAdapter, {
      fallbackPollIntervalMs: 60_000,
      coalesceDebounceMs: 20,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    mockProcessOutboxCdcBatch.mockClear();

    activeMockClient?.emit("notification", { channel: "other_channel", payload: "ignored" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(mockProcessOutboxCdcBatch).not.toHaveBeenCalled();
    await handle.stop();
  });
});
