/**
 * Wraps an async operation with a timer and logs how long it took to the
 * server console (visible in your `next dev` / `next start` terminal, not
 * the browser). Useful for pinpointing whether slowness is coming from the
 * network call, a large payload, or something else entirely.
 *
 * Example: [timing] getCustomer(r2) took 842ms
 */
export async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - start);
    console.log(`[timing] ${label} took ${ms}ms`);
  }
}
