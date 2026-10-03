/** Pure helpers for dashboard refresh policy — unit-tested without DOM. */

export type RefreshController = {
  request: () => void;
  dispose: () => void;
};

/**
 * Single-flight refresh with trailing coalesce + optional debounce.
 * Used by /dashboard for SSE bursts and periodic ticks.
 */
export function createRefreshController(opts: {
  run: () => Promise<void>;
  debounceMs: number;
  now?: () => number;
}): RefreshController {
  let inFlight = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const execute = async () => {
    if (disposed) return;
    if (inFlight) {
      pending = true;
      return;
    }
    inFlight = true;
    try {
      await opts.run();
    } finally {
      inFlight = false;
      if (!disposed && pending) {
        pending = false;
        void execute();
      }
    }
  };

  return {
    request() {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void execute();
      }, opts.debounceMs);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}
