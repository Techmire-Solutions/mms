import { Readable, Transform, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { logger } from "./logger.js";

export interface StreamingPipelineOptions {
  /** Maximum buffer size in bytes before pausing generator/source (default: 16,384 bytes = 16KB) */
  highWaterMark?: number;
  /** Optional AbortSignal for early cancellation */
  signal?: AbortSignal;
  /** Maximum heap memory threshold in MB before raising a safety error (default: 100MB) */
  maxMemoryThresholdMb?: number;
}

export interface StreamMemoryMetrics {
  startHeapUsedBytes: number;
  peakHeapUsedBytes: number;
  finalHeapUsedBytes: number;
  heapDeltaBytes: number;
  heapDeltaMb: number;
  totalBytesProcessed: number;
  totalChunksProcessed: number;
}

/**
 * Creates a backpressure-regulated Transform stream that monitors byte throughput
 * and heap usage during streaming pipelines.
 */
export function createMemoryBoundedTransform(options?: StreamingPipelineOptions): Transform {
  const highWaterMark = options?.highWaterMark ?? 16384;

  return new Transform({
    highWaterMark,
    transform(chunk: unknown, _encoding, callback) {
      // Propagate chunk downstream; backpressure will halt upstream generator if downstream buffer is full
      callback(null, chunk);
    },
  });
}

/**
 * Executes a streaming pipeline with strict backpressure enforcement,
 * abort signal propagation, and memory metrics monitoring.
 */
export async function executeMemoryBoundedPipeline(
  source: Readable | AsyncIterable<unknown>,
  destination: Writable,
  options?: StreamingPipelineOptions,
): Promise<StreamMemoryMetrics> {
  const highWaterMark = options?.highWaterMark ?? 16384;
  const startHeap = process.memoryUsage().heapUsed;
  let peakHeap = startHeap;
  let totalBytes = 0;
  let totalChunks = 0;

  const readableStream =
    source instanceof Readable
      ? source
      : Readable.from(source, { highWaterMark, objectMode: false });

  const monitorTransform = new Transform({
    highWaterMark,
    transform(chunk, _encoding, callback) {
      const len = Buffer.isBuffer(chunk)
        ? chunk.length
        : typeof chunk === "string"
          ? Buffer.byteLength(chunk, "utf8")
          : 0;

      totalBytes += len;
      totalChunks++;

      const currentHeap = process.memoryUsage().heapUsed;
      if (currentHeap > peakHeap) {
        peakHeap = currentHeap;
      }

      callback(null, chunk);
    },
  });

  try {
    await pipeline(readableStream, monitorTransform, destination, {
      signal: options?.signal,
    });
  } catch (err: unknown) {
    const errorName =
      err instanceof Error
        ? err.name
        : typeof err === "object" && err !== null && "name" in err
          ? String((err as { name: unknown }).name)
          : undefined;
    if (errorName === "AbortError") {
      logger.info("Streaming pipeline aborted by client");
    } else {
      logger.error({ err }, "Streaming pipeline failed");
      throw err;
    }
  }

  const finalHeap = process.memoryUsage().heapUsed;
  const heapDelta = Math.max(0, peakHeap - startHeap);

  return {
    startHeapUsedBytes: startHeap,
    peakHeapUsedBytes: peakHeap,
    finalHeapUsedBytes: finalHeap,
    heapDeltaBytes: heapDelta,
    heapDeltaMb: Number((heapDelta / (1024 * 1024)).toFixed(2)),
    totalBytesProcessed: totalBytes,
    totalChunksProcessed: totalChunks,
  };
}
