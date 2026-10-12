import { Alert } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import type { InstallSubmission } from "@sllights/shared/install-submission";
import InstallScreen from "../app/(tabs)/(scan)/scan";
import { InstallQueueProvider } from "@/installs/InstallQueueProvider";
import { createInstallQueue, type QueueItem, type SendResult } from "@/installs/queue";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-camera", () => {
  const { View } = jest.requireActual("react-native");
  return {
    CameraView: (props: Record<string, unknown>) => <View {...props} />,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});
jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 27.950575, longitude: -82.457178, accuracy: 6 } })),
}));
const Location = jest.requireMock("expo-location");

/** Drives NetInfo's connection events from the test. */
let emitConnection: (online: boolean) => void = () => undefined;
beforeEach(() => {
  (NetInfo.addEventListener as jest.Mock).mockImplementation((listener: (s: object) => void) => {
    emitConnection = (online) => listener({ isConnected: online, isInternetReachable: online });
    return jest.fn();
  });
});

function setup(send: jest.Mock = jest.fn(async (): Promise<SendResult> => ({ kind: "sent" }))) {
  let saved: QueueItem[] = [];
  const queue = createInstallQueue({
    storage: { load: async () => saved, save: async (items) => void (saved = items) },
    send,
  });
  return { queue, send, saved: () => saved };
}

async function renderScreen({ online, send }: { online: boolean; send?: jest.Mock }) {
  const ctx = setup(send);
  await render(
    <InstallQueueProvider queueOverride={ctx.queue}>
      <InstallScreen />
    </InstallQueueProvider>,
  );
  await act(async () => emitConnection(online));
  return ctx;
}

const fillPole = (value: string) => fireEvent.changeText(screen.getByLabelText("Pole Number"), value);
/** Types a serial via "Won't scan? Type it instead". */
const typeSerial = async (label: string, value: string) => {
  await fireEvent.press(screen.getByRole("link", { name: `Won't scan? Type the ${label} instead` }));
  await fireEvent.changeText(screen.getByLabelText(label), value);
};
/** Everything required: both serials and the pole number (location is captured automatically). */
const fillRequired = async (pole: string) => {
  await typeSerial("Light Head Serial Number", "LH-1");
  await typeSerial("Solar Panel Serial Number", "SP-1");
  await fillPole(pole);
};
/** The scanner frame's place in the camera view, as the phone would lay it out. */
const FRAME = { x: 50, y: 200, width: 280, height: 110 };
const layOutFrame = () =>
  act(async () => {
    fireEvent(screen.getByTestId("scan-frame"), "layout", { nativeEvent: { layout: FRAME } });
  });
/** A barcode's corners around a centre point (camera-view coordinates). */
const cornersAt = (cx: number, cy: number) => [
  { x: cx - 60, y: cy - 15 },
  { x: cx + 60, y: cy - 15 },
  { x: cx + 60, y: cy + 15 },
  { x: cx - 60, y: cy + 15 },
];
/**
 * The camera reading a code — a few frames in a row, as a real camera
 * reports it many times a second. `at` places it in the view; without it
 * the barcode has no position (as for some types on iOS).
 */
const read = (data: string, { at, times = 3 }: { at?: { x: number; y: number }; times?: number } = {}) =>
  act(async () => {
    for (let i = 0; i < times; i++) {
      screen.getByTestId("barcode-camera").props.onBarcodeScanned({
        type: "code128",
        data,
        cornerPoints: at ? cornersAt(at.x, at.y) : [],
        bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
      });
    }
  });
const IN_FRAME = { x: 190, y: 255 };
const BELOW_FRAME = { x: 190, y: 350 }; // the sticker's other barcode
const submit = () => fireEvent.press(screen.getByRole("button", { name: "Submit" }));

describe("Install form (Scan tab)", () => {
  it("captures the location automatically and shows latitude and longitude", async () => {
    await renderScreen({ online: true });
    expect(await screen.findByText("Latitude 27.950575")).toBeTruthy();
    expect(screen.getByText("Longitude -82.457178")).toBeTruthy();
    expect(screen.getByText("Accurate to about 6 m")).toBeTruthy();
  });

  it("scans first: the scanner shows what it reads and only fills the field on 'Use this code'", async () => {
    await renderScreen({ online: true });
    // Scan comes first; the text field is hidden until needed.
    expect(screen.queryByLabelText("Light Head Serial Number")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Scan Light Head Serial Number" }));
    expect(screen.getByText("Scan Light Head Serial Number")).toBeTruthy(); // the scanner's title
    expect(screen.getByRole("button", { name: "Use this code" }).props.accessibilityState.disabled).toBe(true);

    // The neighbouring barcode is read first; the crew re-aim at the right one.
    await read("SP-9999");
    expect(screen.getByTestId("detected-code")).toHaveTextContent("SP-9999");
    await read("  LH-0042  ");
    expect(screen.getByTestId("detected-code")).toHaveTextContent("LH-0042");
    // Nothing is filled in until they confirm.
    expect(screen.queryByLabelText("Light Head Serial Number: LH-0042")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Use this code" }));
    expect(screen.getByLabelText("Light Head Serial Number: LH-0042")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rescan Light Head Serial Number" })).toBeTruthy();
  });

  it("ignores the sticker's other barcode when it's outside the frame", async () => {
    await renderScreen({ online: true });
    await fireEvent.press(screen.getByRole("button", { name: "Scan Solar Panel Serial Number" }));
    await layOutFrame();
    await read("LH-0042", { at: BELOW_FRAME });
    expect(screen.getByTestId("detected-code")).toHaveTextContent("—");
    expect(screen.getByText("Barcode found — line it up inside the frame")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use this code" }).props.accessibilityState.disabled).toBe(true);

    // Both in view: only the one in the frame is taken.
    await read("SP-7781", { at: IN_FRAME });
    await read("LH-0042", { at: BELOW_FRAME });
    await read("SP-7781", { at: IN_FRAME });
    expect(screen.getByTestId("detected-code")).toHaveTextContent("SP-7781");
    await fireEvent.press(screen.getByRole("button", { name: "Use this code" }));
    expect(screen.getByLabelText("Solar Panel Serial Number: SP-7781")).toBeTruthy();
  });

  it("holds steady instead of flickering when two codes are glimpsed in the frame", async () => {
    await renderScreen({ online: true });
    await fireEvent.press(screen.getByRole("button", { name: "Scan Solar Panel Serial Number" }));
    await layOutFrame();
    await read("SP-7781", { at: IN_FRAME });
    expect(screen.getByTestId("detected-code")).toHaveTextContent("SP-7781");
    // A passing glimpse of another code doesn't flip the display…
    await read("LH-0042", { at: IN_FRAME, times: 1 });
    await read("SP-7781", { at: IN_FRAME, times: 1 });
    await read("LH-0042", { at: IN_FRAME, times: 2 });
    expect(screen.getByTestId("detected-code")).toHaveTextContent("SP-7781");
    // …only a steady reading of it does.
    await read("LH-0042", { at: IN_FRAME, times: 3 });
    expect(screen.getByTestId("detected-code")).toHaveTextContent("LH-0042");
  });

  it("listens for the common sticker formats, not just the old pole-tag ones", async () => {
    await renderScreen({ online: true });
    await fireEvent.press(screen.getByRole("button", { name: "Scan Solar Panel Serial Number" }));
    const types = screen.getByTestId("barcode-camera").props.barcodeScannerSettings.barcodeTypes;
    expect(types).toEqual(expect.arrayContaining(["code128", "code39", "code93", "ean13", "upc_a", "itf14", "datamatrix", "qr"]));
  });

  it("starts each scan fresh, so an earlier reading can't be used by mistake", async () => {
    await renderScreen({ online: true });
    await fireEvent.press(screen.getByRole("button", { name: "Scan Light Head Serial Number" }));
    await read("LH-0042");
    await fireEvent.press(screen.getByRole("button", { name: "Use this code" }));
    await fireEvent.press(screen.getByRole("button", { name: "Scan Solar Panel Serial Number" }));
    expect(screen.getByTestId("detected-code")).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: "Use this code" }).props.accessibilityState.disabled).toBe(true);
  });

  it("lists Solar Panel before Light Head (the sticker's order), and the button just says Submit", async () => {
    await renderScreen({ online: true });
    const scans = screen.getAllByRole("button", { name: /^Scan .* Serial Number$/ }).map((b) => b.props.accessibilityLabel);
    expect(scans).toEqual(["Scan Solar Panel Serial Number", "Scan Light Head Serial Number"]);
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit install" })).toBeNull();
  });

  it("offers typing behind 'Won't scan?'", async () => {
    await renderScreen({ online: true });
    await typeSerial("Solar Panel Serial Number", "SP-7");
    expect(screen.getByLabelText("Solar Panel Serial Number").props.value).toBe("SP-7");
  });

  it("marks required fields with an asterisk, not the word 'required'", async () => {
    await renderScreen({ online: true });
    expect(screen.getByText("* Required")).toBeTruthy(); // the key at the top
    for (const label of ["Light Head Serial Number", "Solar Panel Serial Number", "Pole Number", "Location Coordinates"]) {
      expect(screen.getByText(label, { exact: false }).props.children).toEqual(expect.arrayContaining([label]));
    }
    expect(screen.getByLabelText("Pole Number").props.accessibilityHint).toBe("Required");
    expect(screen.getByLabelText("Notes").props.accessibilityHint).toBeUndefined();
    expect(screen.queryByText(/\(required\)|\(optional\)/)).toBeNull();
  });

  it("makes Refresh location a small link once there's a location", async () => {
    await renderScreen({ online: true });
    await screen.findByText("Latitude 27.950575");
    const refresh = screen.getByRole("button", { name: "Refresh location" });
    expect(refresh.props.accessibilityLabel).toBe("Refresh location");
    expect(screen.queryByRole("button", { name: "Get location" })).toBeNull();
  });


  it("requires both serials and the pole number; notes are optional", async () => {
    const { send } = await renderScreen({ online: true });
    await screen.findByText("Latitude 27.950575");
    await submit();
    expect(screen.getByText("Light Head Serial Number is required.")).toBeTruthy();
    expect(screen.getByText("Solar Panel Serial Number is required.")).toBeTruthy();
    expect(screen.getByText("Pole Number is required.")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    await fillRequired("PAS-2"); // no notes
    await submit();
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ poleNumber: "PAS-2", notes: null })));
  });

  it("online: sends the install straight away and clears the form for the next pole", async () => {
    const { send } = await renderScreen({ online: true });
    await screen.findByText("Latitude 27.950575");
    await typeSerial("Light Head Serial Number", "lh-1");
    await typeSerial("Solar Panel Serial Number", "SP-1");
    await fillPole(" pas-12 ");
    await fireEvent.changeText(screen.getByLabelText("Notes"), "New base plate");
    await submit();

    expect(await screen.findByText("Install for PAS-12 sent.")).toBeTruthy();
    const sent: InstallSubmission = send.mock.calls[0][0];
    expect(sent).toMatchObject({
      lightHeadSerial: "lh-1",
      solarPanelSerial: "SP-1",
      poleNumber: "PAS-12",
      latitude: 27.950575,
      longitude: -82.457178,
      accuracyMeters: 6,
      notes: "New base plate",
    });
    expect(sent.id).toMatch(/^uuid-/);
    expect(Number.isNaN(new Date(sent.capturedAt).getTime())).toBe(false);
    expect(screen.getByLabelText("Pole Number").props.value).toBe("");
    expect(screen.queryByTestId("pending-installs")).toBeNull(); // nothing left waiting
  });

  it("offline: saves on the phone, shows it waiting, and sends it when the connection returns", async () => {
    const { send, saved } = await renderScreen({ online: false });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("PAS-77");
    await submit();

    expect(await screen.findByText(/Install for PAS-77 saved on this phone/)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    expect(saved().map((i) => i.submission.poleNumber)).toEqual(["PAS-77"]);
    const pending = within(screen.getByTestId("pending-installs"));
    expect(pending.getByText("Waiting to send (1)")).toBeTruthy();
    expect(pending.getByText("Offline")).toBeTruthy();

    await act(async () => emitConnection(true)); // back in signal
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId("pending-installs")).toBeNull());
    expect(saved()).toEqual([]);
  });

  it("won't submit without a location", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const { send } = await renderScreen({ online: true });
    expect(await screen.findByText(/Location access is off. Turn it on to submit/)).toBeTruthy();
    await fillRequired("PAS-3");
    await submit();
    expect(screen.getByText("Location is required. Get the location before submitting.")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    // Once a location is captured, it goes through.
    await fireEvent.press(screen.getByRole("button", { name: "Get location" }));
    expect(await screen.findByText("Latitude 27.950575")).toBeTruthy();
    expect(screen.queryByText(/Location is required/)).toBeNull();
    await submit();
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ poleNumber: "PAS-3", latitude: 27.950575 })));
  });


  it("keeps a refused install with its reason, to Retry or Delete (after confirming)", async () => {
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "rejected", error: "Unknown pole number." }));
    await renderScreen({ online: true, send });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("PAS-404");
    await submit();

    const pending = within(await screen.findByTestId("pending-installs"));
    expect(pending.getByText("Needs attention")).toBeTruthy();
    expect(pending.getByText("Not accepted")).toBeTruthy();
    expect(pending.getByText("Unknown pole number.")).toBeTruthy();

    send.mockResolvedValueOnce({ kind: "sent" });
    await fireEvent.press(pending.getByRole("button", { name: "Retry PAS-404" }));
    await waitFor(() => expect(screen.queryByTestId("pending-installs")).toBeNull());
  });

  it("asks before deleting an unsent install", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "rejected", error: "Bad." }));
    const { saved } = await renderScreen({ online: true, send });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("PAS-9");
    await submit();
    await fireEvent.press(await screen.findByRole("button", { name: "Delete PAS-9" }));
    expect(alert).toHaveBeenCalledWith("Delete this install?", expect.stringContaining("PAS-9"), expect.any(Array));
    expect(saved()).toHaveLength(1);
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Delete")?.onPress?.());
    await waitFor(() => expect(saved()).toEqual([]));
    alert.mockRestore();
  });

  it("Send now tries even when the phone looks offline", async () => {
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "sent" }));
    await renderScreen({ online: false, send });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("PAS-5");
    await submit();
    await fireEvent.press(await screen.findByRole("button", { name: "Send now" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });
});
