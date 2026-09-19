import { IngestOptions, IngestStatus } from './client.js';
/**
 * Transport callback used by {@link Batch} to send queued events.
 */
export type IngestFunction = (id: string, events: Array<object> | object, options?: IngestOptions) => Promise<IngestStatus>;
/**
 * Runtime configuration for a {@link Batch} instance.
 */
export interface BatchConfig {
    /**
     * Maximum number of queued events before triggering an immediate flush.
     * @defaultValue 1000
     */
    maxBatchSize?: number;
    /**
     * Maximum time in milliseconds between successful flush attempts.
     * @defaultValue 1000
     */
    flushIntervalMs?: number;
    /**
     * Error hook used for background flush failures.
     */
    onError?: (error: unknown) => void;
    /**
     * Clock function used for flush timing; primarily useful for tests.
     */
    now?: () => number;
}
/**
 * Internal batch lifecycle state.
 */
export type BatchState = 'idle' | 'scheduled' | 'flushing';
/**
 * Builds a deterministic key for grouping events into a single batch queue.
 *
 * The key includes dataset identity and ingest options that influence server
 * parsing so incompatible payloads do not share the same queue.
 */
export declare function createBatchKey(id: string, options?: IngestOptions): string;
/**
 * In-memory FIFO event queue with time/size-based flushing.
 *
 * Events are buffered and flushed either when enough events have accumulated or
 * when the flush interval elapses. Flushes are serialized to preserve ordering.
 */
export declare class Batch {
    ingestFn: IngestFunction;
    id: string;
    options?: IngestOptions;
    events: Array<object>;
    state: BatchState;
    activeFlush: Promise<IngestStatus | void>;
    nextFlush?: ReturnType<typeof setTimeout>;
    lastFlush: Date;
    private maxBatchSize;
    private flushIntervalMs;
    private onError?;
    private now;
    /**
     * Creates a background batch queue for one dataset/options combination.
     */
    constructor(ingestFn: IngestFunction, id: string, options?: IngestOptions, config?: BatchConfig);
    /**
     * Appends event(s) to the queue and triggers or schedules a flush.
     *
     * This method is intentionally fire-and-forget. Background flush failures are
     * reported through the configured `onError` callback.
     */
    ingest: (events: Array<object> | object) => void;
    /**
     * Flushes currently queued events and resolves when this flush finishes.
     *
     * Flushes are serialized with any in-flight flush to avoid concurrent sends.
     */
    flush: () => Promise<IngestStatus | undefined>;
    /**
     * Appends events to the queue while preserving FIFO order.
     */
    private enqueue;
    /**
     * Drains the current queue in O(1) by swapping array references.
     */
    private drainEvents;
    /**
     * Returns true when queue size or elapsed time requires an immediate flush.
     */
    private shouldFlushNow;
    /**
     * Schedules a deferred flush to ensure low-volume traffic is eventually sent.
     */
    private scheduleFlush;
    /**
     * Starts a flush without awaiting it and forwards failures to `onError`.
     */
    private startBackgroundFlush;
    /**
     * Cancels a pending timer-based flush, if one exists.
     */
    private clearScheduledFlush;
    /**
     * Finishes a flush without overriding a newly scheduled flush.
     */
    private finishFlush;
}
//# sourceMappingURL=batch.d.ts.map