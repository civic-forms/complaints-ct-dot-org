// Debounced saving (CLAUDE.md §9.2). `write` reads the latest data itself, so
// a burst of changes becomes one write. Writes run one at a time. `stop()` is
// for erase (§9.3): it cancels a pending write and blocks every later one,
// including the pagehide flush, until the next page load.

export interface Saver {
  /** Write ~`delay` ms after the last call. */
  schedule(): void;
  /** Write now (pagehide, or a mode switch). */
  flush(): Promise<void>;
  stop(): void;
  readonly stopped: boolean;
}

export function createSaver({
  write,
  delay = 500,
  onError,
}: {
  write: () => Promise<void> | void;
  delay?: number;
  onError?: (error: unknown) => void;
}): Saver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let chain: Promise<void> = Promise.resolve();

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const run = (): Promise<void> => {
    chain = chain.then(async () => {
      // Checked when the write actually starts, so a write queued behind
      // another one doesn't run after stop().
      if (stopped) return;
      try {
        await write();
      } catch (error) {
        onError?.(error);
      }
    });
    return chain;
  };

  return {
    schedule() {
      if (stopped) return;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delay);
    },
    flush() {
      if (stopped) return chain;
      cancel();
      return run();
    },
    stop() {
      stopped = true;
      cancel();
    },
    get stopped() {
      return stopped;
    },
  };
}
