export class RetryableDownloadError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

export function backoffDelayMs(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * Math.min(baseDelayMs, 1000));
  return exponential + jitter;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
