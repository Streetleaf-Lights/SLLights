import { Alert, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { InstallQueueProvider, useInstallQueue } from "@/installs/InstallQueueProvider";
import { TestingTools } from "@/installs/TestingTools";
import { createInstallQueue, type QueueItem } from "@/installs/queue";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

async function signIn(role: string, customerId: string | null = null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

const waiting = (id: string): QueueItem => ({
  submission: {
    id,
    projectId: "p1",
    lightHeadSerial: "L",
    solarPanelSerial: "S",
    poleNumber: "CHA-1158",
    latitude: 1,
    longitude: 2,
    accuracyMeters: null,
    capturedAt: "2026-10-14T00:00:00Z",
    notes: null,
  },
  status: "waiting",
  attempts: 0,
  lastError: null,
  lastAttemptAt: null,
});

function Stickers() {
  const { submittedStickers } = useInstallQueue();
  return <Text testID="stickers">{[...submittedStickers].sort().join(",")}</Text>;
}

async function renderTools({ isDev = true, onPhone = [] as QueueItem[] } = {}) {
  let store = onPhone;
  const queue = createInstallQueue({ storage: { load: async () => store, save: async (i) => void (store = i) }, send: jest.fn() });
  await render(
    <InstallQueueProvider queueOverride={queue}>
      <TestingTools isDev={isDev} />
      <Stickers />
    </InstallQueueProvider>,
    { wrapper: withSignedInAuth(fakeApi()) },
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  // CHA-1157 was sent (no longer on the phone); CHA-1158 is still waiting.
  await AsyncStorage.setItem(
    "streetleaf.submittedStickers.v1",
    JSON.stringify([
      { key: "p1::CHA-1157", installId: "sent-1" },
      { key: "p1::CHA-1158", installId: "waiting-1" },
    ]),
  );
});
afterEach(() => jest.restoreAllMocks());

describe("TestingTools (development builds only)", () => {
  it("forgets sent stickers after confirming, keeping those of installs still on the phone", async () => {
    await signIn("Streetleaf Crew");
    const alert = jest.spyOn(Alert, "alert");
    await renderTools({ onPhone: [waiting("waiting-1")] });
    await waitFor(() => expect(screen.getByTestId("stickers")).toHaveTextContent("p1::CHA-1157,p1::CHA-1158"));
    expect(screen.getByText("2 stickers marked as submitted on this phone.")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Forget submitted stickers" }));
    expect(alert).toHaveBeenCalledWith("Forget submitted stickers?", expect.stringContaining("Airtable isn't changed"), expect.any(Array));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Forget")?.onPress?.());

    await waitFor(() => expect(screen.getByTestId("stickers")).toHaveTextContent(/^p1::CHA-1158$/));
    expect(screen.getByText("Done. Sent poles show in the Install form again.")).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem("streetleaf.submittedStickers.v1")) ?? "[]")).toEqual([
      { key: "p1::CHA-1158", installId: "waiting-1" },
    ]);
  });

  it("does nothing if cancelled", async () => {
    await signIn("Streetleaf Crew");
    const alert = jest.spyOn(Alert, "alert");
    await renderTools();
    await fireEvent.press(await screen.findByRole("button", { name: "Forget submitted stickers" }));
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === "Cancel")?.onPress?.();
    expect(screen.getByTestId("stickers")).toHaveTextContent("p1::CHA-1157,p1::CHA-1158");
  });

  it("isn't in the release app", async () => {
    await signIn("Streetleaf Crew");
    await renderTools({ isDev: false });
    expect(screen.queryByTestId("testing-tools")).toBeNull();
  });

  it("isn't shown to roles without the Install tab", async () => {
    await signIn("Customer Owner", "c1");
    await renderTools();
    expect(screen.queryByTestId("testing-tools")).toBeNull();
  });
});
