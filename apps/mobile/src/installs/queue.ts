import type { InstallSubmission } from "@sllights/shared/install-submission";

/** One saved install on the phone. "waiting" will be sent; "failed" was refused and needs the crew. */
export interface QueueItem {
  submission: InstallSubmission;
  status: "waiting" | "failed";
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
}

/**
 * The outcome of one send:
 *  - sent        — accepted (or already had it): remove from the phone;
 *  - retry-later — no connection, timeout, server trouble, signed out:
 *                  keep it, stop for now, try again later;
 *  - rejected    — the server refused this install itself (e.g. invalid):
 *                  keep it as failed with the reason, carry on with the rest.
 */
export type SendResult = { kind: "sent" } | { kind: "retry-later"; error: string } | { kind: "rejected"; error: string };

export interface QueueStorage {
  load(): Promise<QueueItem[]>;
  save(items: QueueItem[]): Promise<void>;
}

/**
 * The offline install queue. Every change is saved before anything else
 * happens, so closing the app (or a crash) mid-send loses nothing; an item
 * leaves the phone only after the server has accepted it. Sends go one at a
 * time, oldest first, and a "retry later" stops the run so the order is
 * kept for next time. Only one flush runs at a time.
 */
export function createInstallQueue({
  storage,
  send,
  now = () => new Date(),
  onChange,
}: {
  storage: QueueStorage;
  send: (submission: InstallSubmission) => Promise<SendResult>;
  now?: () => Date;
  /** Called with the current items after every change (for the UI). */
  onChange?: (items: QueueItem[]) => void;
}) {
  let items: QueueItem[] = [];
  let loaded: Promise<void> | null = null;
  let flushing: Promise<void> | null = null;

  const ensureLoaded = () => (loaded ??= storage.load().then((stored) => void (items = stored)));
  const commit = async (next: QueueItem[]) => {
    items = next;
    await storage.save(items);
    onChange?.(items);
  };

  async function flushOnce() {
    await ensureLoaded();
    for (const item of [...items]) {
      if (item.status !== "waiting") continue;
      let result: SendResult;
      try {
        result = await send(item.submission);
      } catch (err) {
        result = { kind: "retry-later", error: err instanceof Error ? err.message : "Couldn't send." };
      }
      const attempted = { ...item, attempts: item.attempts + 1, lastAttemptAt: now().toISOString() };
      if (result.kind === "sent") {
        await commit(items.filter((i) => i.submission.id !== item.submission.id));
      } else if (result.kind === "rejected") {
        await commit(items.map((i) => (i.submission.id === item.submission.id ? { ...attempted, status: "failed", lastError: result.error } : i)));
      } else {
        await commit(items.map((i) => (i.submission.id === item.submission.id ? { ...attempted, lastError: result.error } : i)));
        return; // keep the order; try again later
      }
    }
  }

  return {
    async list(): Promise<QueueItem[]> {
      await ensureLoaded();
      return items;
    },

    /** Saves an install on the phone. It's safe here before any send is attempted. */
    async enqueue(submission: InstallSubmission): Promise<void> {
      await ensureLoaded();
      if (items.some((i) => i.submission.id === submission.id)) return;
      await commit([...items, { submission, status: "waiting", attempts: 0, lastError: null, lastAttemptAt: null }]);
    },

    /** Sends what's waiting (caller decides when — e.g. only while online). Joins a flush already running. */
    flush(): Promise<void> {
      flushing ??= flushOnce().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    /** Puts a failed install back in line. */
    async retry(id: string): Promise<void> {
      await ensureLoaded();
      await commit(items.map((i) => (i.submission.id === id ? { ...i, status: "waiting" } : i)));
    },

    /** Deletes an install from the phone (e.g. a failed one the crew decided to discard). */
    async remove(id: string): Promise<void> {
      await ensureLoaded();
      await commit(items.filter((i) => i.submission.id !== id));
    },
  };
}

export type InstallQueue = ReturnType<typeof createInstallQueue>;
