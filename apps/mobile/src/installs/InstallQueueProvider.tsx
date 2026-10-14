import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { stickerKey } from "@sllights/shared/install-options";
import type { InstallSubmission } from "@sllights/shared/install-submission";
import { createInstallQueue, type InstallQueue, type QueueItem } from "./queue";
import { sendInstall } from "./sendInstall";
import { asyncStorageQueue } from "./storage";

const SUBMITTED_KEY = "streetleaf.submittedStickers.v1";
/** A sticker submitted from this phone, and the install it went with. */
interface SubmittedSticker {
  key: string;
  installId: string;
}

/** How often to try again while installs are waiting and the phone is online. */
export const RETRY_INTERVAL_MS = 60_000;

interface InstallQueueValue {
  items: QueueItem[];
  /** Best guess from the phone's connection state; sending can still fail. */
  online: boolean;
  sending: boolean;
  /** Saves the install on the phone, then tries to send it if online. "sent" once accepted, "saved" if still waiting. */
  submit: (submission: InstallSubmission) => Promise<"sent" | "saved">;
  /** Sends what's waiting now (a manual "Send now" tries even if the phone looks offline). */
  sendNow: (opts?: { force?: boolean }) => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /**
   * Stickers submitted from this phone (waiting or sent) — the Install form
   * leaves them out so a pole can't be submitted twice. Deleting a queued
   * install frees its sticker again.
   */
  submittedStickers: ReadonlySet<string>;
}

const Ctx = createContext<InstallQueueValue | null>(null);

/**
 * Runs the offline install queue while signed in: loads what's saved on the
 * phone, and sends what's waiting whenever there's a chance it'll get
 * through — right after Submit, when the connection comes back, when the
 * app returns to the foreground, and every minute while anything waits.
 */
export function InstallQueueProvider({ children, queueOverride }: { children: ReactNode; queueOverride?: InstallQueue }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [submitted, setSubmitted] = useState<SubmittedSticker[]>([]);
  const [online, setOnline] = useState(false);
  const [sending, setSending] = useState(false);
  const [queue] = useState(
    () => queueOverride ?? createInstallQueue({ storage: asyncStorageQueue, send: sendInstall, onChange: (next) => setItems(next) }),
  );

  /** Sends what's waiting, regardless of the connection guess (the queue keeps anything that fails). */
  const flushNow = useCallback(async () => {
    setSending(true);
    try {
      await queue.flush();
    } finally {
      setItems([...(await queue.list())]);
      setSending(false);
    }
  }, [queue]);

  const sendNow = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (online || force) await flushNow();
    },
    [online, flushNow],
  );

  // What was saved before the app was closed.
  useEffect(() => {
    let cancelled = false;
    void queue.list().then((saved) => !cancelled && setItems([...saved]));
    void AsyncStorage.getItem(SUBMITTED_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as SubmittedSticker[]) : []))
      .catch(() => [] as SubmittedSticker[])
      .then((saved) => !cancelled && setSubmitted(saved));
    return () => {
      cancelled = true;
    };
  }, [queue]);

  const saveSubmitted = useCallback(async (next: SubmittedSticker[]) => {
    setSubmitted(next);
    await AsyncStorage.setItem(SUBMITTED_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  // Connection changes — including the current state, reported as soon as
  // we subscribe — so being online at start, or coming back online, sends
  // whatever is waiting. "Reachable" is unknown (null) at first on some
  // phones: only an explicit false counts as offline.
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const nowOnline = state.isConnected === true && state.isInternetReachable !== false;
        setOnline(nowOnline);
        if (nowOnline) void flushNow();
      }),
    [flushNow],
  );

  const waiting = items.some((i) => i.status === "waiting");

  // Returning to the app: try again.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void sendNow();
    });
    return () => sub.remove();
  }, [sendNow]);

  // While something waits and the phone is online: try every minute.
  useEffect(() => {
    if (!online || !waiting) return;
    const timer = setInterval(() => void flushNow(), RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [online, waiting, flushNow]);

  const submit = useCallback(
    async (submission: InstallSubmission) => {
      await queue.enqueue(submission);
      setItems([...(await queue.list())]);
      // Its sticker is used now, even before it's sent.
      await saveSubmitted([...submitted, { key: stickerKey(submission.projectId, submission.poleNumber), installId: submission.id }]);
      await sendNow();
      const stillHere = (await queue.list()).some((i) => i.submission.id === submission.id);
      return stillHere ? ("saved" as const) : ("sent" as const);
    },
    [queue, sendNow, submitted, saveSubmitted],
  );
  const retry = useCallback(
    async (id: string) => {
      await queue.retry(id);
      setItems([...(await queue.list())]);
      await sendNow();
    },
    [queue, sendNow],
  );
  const remove = useCallback(
    async (id: string) => {
      await queue.remove(id);
      setItems([...(await queue.list())]);
      // A deleted (never-sent) install frees its sticker for the dropdown again.
      await saveSubmitted(submitted.filter((entry) => entry.installId !== id));
    },
    [queue, submitted, saveSubmitted],
  );
  const submittedStickers = useMemo(() => new Set(submitted.map((entry) => entry.key)), [submitted]);

  const value = useMemo(
    () => ({ items, online, sending, submit, sendNow, retry, remove, submittedStickers }),
    [items, online, sending, submit, sendNow, retry, remove, submittedStickers],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInstallQueue(): InstallQueueValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInstallQueue must be used inside <InstallQueueProvider>.");
  return ctx;
}
