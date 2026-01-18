/**
 * Concurrency Utilities
 * Provides semaphore and rate limiting for parallel processing
 */

/**
 * Semaphore for limiting concurrent operations
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit, waiting if none available
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Execute a function with automatic acquire/release
   */
  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of waiting operations
   */
  queueLength(): number {
    return this.waiting.length;
  }
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /**
   * Try to acquire tokens, returns true if successful
   */
  tryAcquire(tokens: number = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * Acquire tokens, waiting if necessary
   */
  async acquire(tokens: number = 1): Promise<void> {
    while (!this.tryAcquire(tokens)) {
      const needed = tokens - this.tokens;
      const waitMs = Math.ceil(needed / this.refillRate);
      await sleep(Math.min(waitMs, 100)); // Check every 100ms max
    }
  }

  /**
   * Get current available tokens
   */
  availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Process items in parallel with concurrency limit
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const semaphore = new Semaphore(concurrency);
  const results = new Array<R>(items.length);

  await Promise.all(
    items.map(async (item, index) => {
      results[index] = await semaphore.withPermit(() => fn(item, index));
    })
  );

  return results;
}

/**
 * Process items in parallel, collecting both successes and errors
 */
export async function parallelMapSettled<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: Error }>> {
  const semaphore = new Semaphore(concurrency);

  return Promise.all(
    items.map(async (item, index) => {
      try {
        const value = await semaphore.withPermit(() => fn(item, index));
        return { status: 'fulfilled' as const, value };
      } catch (error) {
        return { status: 'rejected' as const, reason: error as Error };
      }
    })
  );
}

/**
 * Process items in batches
 */
export async function batchProcess<T, R>(
  items: T[],
  fn: (batch: T[]) => Promise<R[]>,
  batchSize: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await fn(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryIf?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryIf = () => true,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !retryIf(lastError)) {
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(maxDelayMs, delay * backoffMultiplier);
    }
  }

  throw lastError;
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Debounce async function calls
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  delayMs: number
): T {
  let timeoutId: NodeJS.Timeout | undefined;
  let pendingPromise: Promise<unknown> | undefined;
  let pendingResolve: ((value: unknown) => void) | undefined;
  let pendingReject: ((reason: unknown) => void) | undefined;

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await fn(...args);
        pendingResolve!(result);
      } catch (error) {
        pendingReject!(error);
      } finally {
        pendingPromise = undefined;
        pendingResolve = undefined;
        pendingReject = undefined;
      }
    }, delayMs);

    return pendingPromise;
  }) as T;
}

/**
 * Throttle async function calls
 */
export function throttleAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  intervalMs: number
): T {
  let lastCallTime = 0;
  let pendingPromise: Promise<unknown> | undefined;

  return (async (...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed < intervalMs) {
      if (!pendingPromise) {
        pendingPromise = new Promise((resolve) => {
          setTimeout(async () => {
            lastCallTime = Date.now();
            pendingPromise = undefined;
            resolve(await fn(...args));
          }, intervalMs - elapsed);
        });
      }
      return pendingPromise;
    }

    lastCallTime = now;
    return fn(...args);
  }) as T;
}

/**
 * Create a mutex for exclusive access
 */
export class Mutex {
  private locked = false;
  private waiting: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Create a queue for sequential processing
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private processor: (item: T) => Promise<void>;

  constructor(processor: (item: T) => Promise<void>) {
    this.processor = processor;
  }

  async enqueue(item: T): Promise<void> {
    this.queue.push(item);
    await this.processQueue();
  }

  async enqueueMany(items: T[]): Promise<void> {
    this.queue.push(...items);
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!;
        await this.processor(item);
      }
    } finally {
      this.processing = false;
    }
  }

  length(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}

/**
 * Helper: sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise
 */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
