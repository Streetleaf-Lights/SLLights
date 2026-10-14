import type { InstallSubmission } from "@sllights/shared/install-submission";
import { ApiError } from "@/api/client";
import { createInstallQueue, type QueueItem, type SendResult } from "@/installs/queue";
import { sendInstall, sendResultFor } from "@/installs/sendInstall";

const submission = (n: number): InstallSubmission => ({
  id: `id-${n}`,
  projectId: "p1",
  lightHeadSerial: `LH-${n}`,
  solarPanelSerial: `SP-${n}`,
  poleNumber: `PAS-${n}`,
  latitude: 27.95,
  longitude: -82.46,
  accuracyMeters: 5,
  capturedAt: "2026-10-09T12:00:00.000Z",
  notes: null,
});

/** In-memory "phone storage" that records every save. */
function memoryStorage(initial: QueueItem[] = []) {
  let saved = initial;
  const saves: QueueItem[][] = [];
  return {
    storage: {
      load: jest.fn(async () => saved),
      save: jest.fn(async (items: QueueItem[]) => {
        saved = items;
        saves.push(items);
      }),
    },
    saved: () => saved,
    saves,
  };
}

const results = (...seq: SendResult[]) => {
  const send = jest.fn<Promise<SendResult>, [InstallSubmission]>();
  for (const r of seq) send.mockResolvedValueOnce(r);
  return send;
};

describe("install queue", () => {
  it("saves to the phone on enqueue, before anything is sent", async () => {
    const mem = memoryStorage();
    const send = results();
    const queue = createInstallQueue({ storage: mem.storage, send });
    await queue.enqueue(submission(1));
    expect(mem.saved().map((i) => i.submission.id)).toEqual(["id-1"]);
    expect(mem.saved()[0]).toMatchObject({ status: "waiting", attempts: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends oldest first and removes each only after it's accepted", async () => {
    const mem = memoryStorage();
    const order: string[] = [];
    const send = jest.fn(async (s: InstallSubmission): Promise<SendResult> => {
      order.push(s.id);
      // Still on the phone while its send is in flight.
      expect(mem.saved().some((i) => i.submission.id === s.id)).toBe(true);
      return { kind: "sent" };
    });
    const queue = createInstallQueue({ storage: mem.storage, send });
    await queue.enqueue(submission(1));
    await queue.enqueue(submission(2));
    await queue.flush();
    expect(order).toEqual(["id-1", "id-2"]);
    expect(mem.saved()).toEqual([]);
  });

  it("keeps everything, in order, when it can't send (e.g. offline), and records why", async () => {
    const mem = memoryStorage();
    const send = results({ kind: "retry-later", error: "No connection." });
    const queue = createInstallQueue({ storage: mem.storage, send, now: () => new Date("2026-10-09T13:00:00Z") });
    await queue.enqueue(submission(1));
    await queue.enqueue(submission(2));
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1); // stops; doesn't skip ahead to #2
    expect(mem.saved().map((i) => [i.submission.id, i.status, i.attempts, i.lastError])).toEqual([
      ["id-1", "waiting", 1, "No connection."],
      ["id-2", "waiting", 0, null],
    ]);
    expect(mem.saved()[0].lastAttemptAt).toBe("2026-10-09T13:00:00.000Z");
  });

  it("treats a send that throws as 'try again later', never as lost", async () => {
    const mem = memoryStorage();
    const queue = createInstallQueue({ storage: mem.storage, send: jest.fn().mockRejectedValue(new Error("socket closed")) });
    await queue.enqueue(submission(1));
    await queue.flush();
    expect(mem.saved()).toHaveLength(1);
    expect(mem.saved()[0]).toMatchObject({ status: "waiting", lastError: "socket closed" });
  });

  it("sets a refused install aside with its reason and carries on with the rest", async () => {
    const mem = memoryStorage();
    const send = results({ kind: "rejected", error: "Unknown pole number." }, { kind: "sent" });
    const queue = createInstallQueue({ storage: mem.storage, send });
    await queue.enqueue(submission(1));
    await queue.enqueue(submission(2));
    await queue.flush();
    expect(mem.saved().map((i) => [i.submission.id, i.status, i.lastError])).toEqual([["id-1", "failed", "Unknown pole number."]]);

    // A failed install isn't retried automatically…
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    // …until the crew retries it.
    send.mockResolvedValueOnce({ kind: "sent" });
    await queue.retry("id-1");
    await queue.flush();
    expect(mem.saved()).toEqual([]);
  });

  it("lets the crew delete an install from the phone", async () => {
    const mem = memoryStorage();
    const queue = createInstallQueue({ storage: mem.storage, send: results() });
    await queue.enqueue(submission(1));
    await queue.remove("id-1");
    expect(mem.saved()).toEqual([]);
  });

  it("picks up installs saved before the app was closed", async () => {
    const earlier: QueueItem[] = [{ submission: submission(7), status: "waiting", attempts: 2, lastError: "No connection.", lastAttemptAt: null }];
    const mem = memoryStorage(earlier);
    const send = results({ kind: "sent" });
    const queue = createInstallQueue({ storage: mem.storage, send });
    expect((await queue.list()).map((i) => i.submission.id)).toEqual(["id-7"]);
    await queue.flush();
    expect(send).toHaveBeenCalledWith(submission(7));
    expect(mem.saved()).toEqual([]);
  });

  it("never sends the same install twice at once, and ignores a duplicate enqueue", async () => {
    const mem = memoryStorage();
    let release!: () => void;
    const send = jest.fn(() => new Promise<SendResult>((resolve) => (release = () => resolve({ kind: "sent" }))));
    const queue = createInstallQueue({ storage: mem.storage, send });
    await queue.enqueue(submission(1));
    await queue.enqueue(submission(1));
    const a = queue.flush();
    const b = queue.flush(); // e.g. reconnect + foreground at the same moment
    await Promise.resolve();
    release();
    await Promise.all([a, b]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reports every change for the screen", async () => {
    const mem = memoryStorage();
    const onChange = jest.fn();
    const queue = createInstallQueue({ storage: mem.storage, send: results({ kind: "sent" }), onChange });
    await queue.enqueue(submission(1));
    await queue.flush();
    expect(onChange.mock.calls.map(([items]) => items.length)).toEqual([1, 0]);
  });
});

describe("sending (stubbed for now)", () => {
  it("the stub accepts every install", async () => {
    expect(await sendInstall(submission(1))).toEqual({ kind: "sent" });
  });

  it.each([
    ["no connection", new ApiError("No connection.", null), "retry-later"],
    ["timeout", new ApiError("Too slow.", null, true), "retry-later"],
    ["signed out", new ApiError("Not authenticated.", 401), "retry-later"],
    ["rate limited", new ApiError("Slow down.", 429), "retry-later"],
    ["server error", new ApiError("Oops.", 503), "retry-later"],
    ["already received", new ApiError("Duplicate.", 409), "sent"],
    ["invalid install", new ApiError("Unknown pole number.", 400), "rejected"],
    ["not allowed", new ApiError("Forbidden.", 403), "rejected"],
    ["anything unexpected", new Error("boom"), "retry-later"],
  ])("will treat %s as %s once the real endpoint exists", (_l, err, kind) => {
    expect(sendResultFor(err).kind).toBe(kind);
  });
});
