import { AppState, Text } from "react-native";
import { act, render } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import { InstallQueueProvider, RETRY_INTERVAL_MS } from "@/installs/InstallQueueProvider";
import { createInstallQueue, type QueueItem, type SendResult } from "@/installs/queue";

let emitConnection: (online: boolean) => void = () => undefined;
let emitAppState: (state: string) => void = () => undefined;

beforeEach(() => {
  jest.useFakeTimers();
  (NetInfo.addEventListener as jest.Mock).mockImplementation((listener: (s: object) => void) => {
    emitConnection = (online) => listener({ isConnected: online, isInternetReachable: online });
    return jest.fn();
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    emitAppState = listener as (state: string) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const waitingItem = (n: number): QueueItem => ({
  submission: {
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
  },
  status: "waiting",
  attempts: 1,
  lastError: "No connection.",
  lastAttemptAt: null,
});

async function mount(send: jest.Mock, saved: QueueItem[]) {
  let store = saved;
  const queue = createInstallQueue({ storage: { load: async () => store, save: async (i) => void (store = i) }, send });
  await render(
    <InstallQueueProvider queueOverride={queue}>
      <Text>app</Text>
    </InstallQueueProvider>,
  );
  return { stored: () => store };
}

describe("InstallQueueProvider", () => {
  it("sends installs saved earlier as soon as the app starts online", async () => {
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "sent" }));
    const { stored } = await mount(send, [waitingItem(1)]);
    await act(async () => emitConnection(true));
    expect(send).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual([]);
  });

  it("doesn't try while offline", async () => {
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "sent" }));
    await mount(send, [waitingItem(1)]);
    await act(async () => emitConnection(false));
    await act(async () => {
      jest.advanceTimersByTime(RETRY_INTERVAL_MS * 3);
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("tries again every minute while online and something is still waiting", async () => {
    const send = jest
      .fn<Promise<SendResult>, []>()
      .mockResolvedValueOnce({ kind: "retry-later", error: "Server busy." })
      .mockResolvedValueOnce({ kind: "sent" });
    const { stored } = await mount(send, [waitingItem(1)]);
    await act(async () => emitConnection(true));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(RETRY_INTERVAL_MS);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(stored()).toEqual([]);
  });

  it("tries again when the crew comes back to the app", async () => {
    const send = jest
      .fn<Promise<SendResult>, []>()
      .mockResolvedValueOnce({ kind: "retry-later", error: "Server busy." })
      .mockResolvedValueOnce({ kind: "sent" });
    await mount(send, [waitingItem(1)]);
    await act(async () => emitConnection(true));
    await act(async () => emitAppState("active"));
    expect(send).toHaveBeenCalledTimes(2);
  });
});
