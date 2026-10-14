import { Alert } from "react-native";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import type { InstallSubmission } from "@sllights/shared/install-submission";
import InstallScreen from "../app/(tabs)/(scan)/scan";
import { InstallQueueProvider } from "@/installs/InstallQueueProvider";
import { createInstallQueue, type QueueItem, type SendResult } from "@/installs/queue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

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

/** The projects and stickers the server offers (active projects with stickers). */
const OPTIONS = {
  generatedAt: "2026-10-12T15:30:00.000Z",
  projects: [
    { id: "p1", name: "Spine Road", customerName: "Coastal", stickerNumbers: ["CHA-1157", "CHA-1158"] },
    { id: "p2", name: "Alpha Street", customerName: "Babcock", stickerNumbers: ["BAB-1"] },
  ],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  const token = makeToken({ sub: "crew1", role: "Streetleaf Crew", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "crew1", name: "C", email: "c@x.com", role: "Streetleaf Crew", customerId: null } });
});

async function renderScreen({
  online,
  send,
  getInstallOptions = jest.fn().mockResolvedValue(OPTIONS),
}: {
  online: boolean;
  send?: jest.Mock;
  getInstallOptions?: jest.Mock;
}) {
  const ctx = setup(send);
  const api = fakeApi({ getInstallOptions });
  await render(
    <InstallQueueProvider queueOverride={ctx.queue}>
      <InstallScreen />
    </InstallQueueProvider>,
    { wrapper: withSignedInAuth(api) },
  );
  await act(async () => emitConnection(online));
  return { ...ctx, api };
}

/** Opens a dropdown and picks an option. */
const choose = async (field: "Project" | "Sticker / Pole Number", option: string) => {
  await fireEvent.press(await screen.findByRole("button", { name: new RegExp(`^${field}: `) }));
  await fireEvent.press(screen.getByRole("button", { name: `Choose ${option}` }));
};
/** Picks the pole: its project, then its sticker. */
const pickPole = async (sticker: string, projectName = sticker.startsWith("BAB") ? "Alpha Street" : "Spine Road") => {
  await choose("Project", projectName);
  await choose("Sticker / Pole Number", sticker);
};
/** Types a serial via "Won't scan? Type it instead". */
const typeSerial = async (label: string, value: string) => {
  await fireEvent.press(screen.getByRole("link", { name: `Won't scan? Type the ${label} instead` }));
  await fireEvent.changeText(screen.getByLabelText(label), value);
};
/** Everything required: both serials and the pole number (location is captured automatically). */
const fillRequired = async (sticker: string) => {
  await pickPole(sticker);
  await typeSerial("Light Head Serial Number", "LH-1");
  await typeSerial("Solar Panel Serial Number", "SP-1");
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
    for (const label of ["Project", "Sticker / Pole Number", "Light Head Serial Number", "Solar Panel Serial Number", "Location Coordinates"]) {
      // The label itself: the field name followed by the red asterisk.
      const labels = screen.getAllByText(label, { exact: false }).filter(
        (el) => Array.isArray(el.props.children) && el.props.children[0] === label,
      );
      expect(labels).toHaveLength(1);
      expect(within(labels[0]).getByText("*", { includeHiddenElements: true })).toBeTruthy(); // hidden from screen readers, which hear "required"
    }
    expect(screen.getByRole("button", { name: /^Project: / }).props.accessibilityHint).toBe("Required");
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
    expect(screen.getByText("Select a project.")).toBeTruthy();
    expect(screen.getByText("Select a sticker (pole number).")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    await fillRequired("CHA-1157"); // no notes
    await submit();
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ poleNumber: "CHA-1157", notes: null })));
  });

  it("online: sends the install straight away and clears the form for the next pole", async () => {
    const { send } = await renderScreen({ online: true });
    await screen.findByText("Latitude 27.950575");
    await typeSerial("Light Head Serial Number", "lh-1");
    await typeSerial("Solar Panel Serial Number", "SP-1");
    await pickPole("CHA-1158");
    await fireEvent.changeText(screen.getByLabelText("Notes"), "New base plate");
    await submit();

    expect(await screen.findByText("Install for CHA-1158 sent.")).toBeTruthy();
    const sent: InstallSubmission = send.mock.calls[0][0];
    expect(sent).toMatchObject({
      lightHeadSerial: "lh-1",
      solarPanelSerial: "SP-1",
      poleNumber: "CHA-1158",
      projectId: "p1",
      latitude: 27.950575,
      longitude: -82.457178,
      accuracyMeters: 6,
      notes: "New base plate",
    });
    expect(sent.id).toMatch(/^uuid-/);
    expect(Number.isNaN(new Date(sent.capturedAt).getTime())).toBe(false);
    expect(screen.getByRole("button", { name: /^Sticker \/ Pole Number: Choose a sticker/ })).toBeTruthy(); // sticker cleared
    expect(screen.queryByTestId("pending-installs")).toBeNull(); // nothing left waiting
  });

  it("offline: saves on the phone, shows it waiting, and sends it when the connection returns", async () => {
    const { send, saved } = await renderScreen({ online: false });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("CHA-1157");
    await submit();

    expect(await screen.findByText(/Install for CHA-1157 saved on this phone/)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    expect(saved().map((i) => i.submission.poleNumber)).toEqual(["CHA-1157"]);
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
    await fillRequired("CHA-1157");
    await submit();
    expect(screen.getByText("Location is required. Get the location before submitting.")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    // Once a location is captured, it goes through.
    await fireEvent.press(screen.getByRole("button", { name: "Get location" }));
    expect(await screen.findByText("Latitude 27.950575")).toBeTruthy();
    expect(screen.queryByText(/Location is required/)).toBeNull();
    await submit();
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ poleNumber: "CHA-1157", latitude: 27.950575 })));
  });


  it("keeps a refused install with its reason, to Retry or Delete (after confirming)", async () => {
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "rejected", error: "Unknown pole number." }));
    await renderScreen({ online: true, send });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("CHA-1157");
    await submit();

    const pending = within(await screen.findByTestId("pending-installs"));
    expect(pending.getByText("Needs attention")).toBeTruthy();
    expect(pending.getByText("Not accepted")).toBeTruthy();
    expect(pending.getByText("Unknown pole number.")).toBeTruthy();

    send.mockResolvedValueOnce({ kind: "sent" });
    await fireEvent.press(pending.getByRole("button", { name: "Retry CHA-1157" }));
    await waitFor(() => expect(screen.queryByTestId("pending-installs")).toBeNull());
  });

  it("asks before deleting an unsent install", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const send = jest.fn(async (): Promise<SendResult> => ({ kind: "rejected", error: "Bad." }));
    const { saved } = await renderScreen({ online: true, send });
    await screen.findByText("Latitude 27.950575");
    await fillRequired("CHA-1157");
    await submit();
    await fireEvent.press(await screen.findByRole("button", { name: "Delete CHA-1157" }));
    expect(alert).toHaveBeenCalledWith("Delete this install?", expect.stringContaining("CHA-1157"), expect.any(Array));
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
    await fillRequired("CHA-1157");
    await submit();
    await fireEvent.press(await screen.findByRole("button", { name: "Send now" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  describe("project and sticker dropdowns", () => {
    const options = async (field: "Project" | "Sticker / Pole Number") => {
      await fireEvent.press(await screen.findByRole("button", { name: new RegExp(`^${field}: `) }));
      const labels = screen.getAllByRole("button", { name: /^Choose / }).map((b) => b.props.accessibilityLabel.replace("Choose ", ""));
      await fireEvent.press(screen.getByRole("button", { name: `Close ${field}` }));
      return labels;
    };

    it("lists the projects (with their customer) first, then the chosen project's stickers", async () => {
      await renderScreen({ online: true });
      expect(await options("Project")).toEqual(["Spine Road", "Alpha Street"]);
      // The sticker dropdown waits for a project.
      const stickerField = screen.getByRole("button", { name: /^Sticker \/ Pole Number: Choose a project first/ });
      expect(stickerField.props.accessibilityState.disabled).toBe(true);
      await choose("Project", "Spine Road");
      expect(screen.getByText("Coastal")).toBeTruthy(); // the customer under the chosen project
      expect(await options("Sticker / Pole Number")).toEqual(["CHA-1157", "CHA-1158"]);
    });

    it("sends the chosen project and its sticker as the pole number", async () => {
      const { send } = await renderScreen({ online: true });
      await screen.findByText("Latitude 27.950575");
      await fillRequired("BAB-1");
      await submit();
      await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p2", poleNumber: "BAB-1" })));
    });

    it("drops a submitted sticker from the list, keeping the project for the next pole", async () => {
      await renderScreen({ online: false }); // even before it's sent
      await screen.findByText("Latitude 27.950575");
      await fillRequired("CHA-1157");
      await submit();
      await screen.findByText(/Install for CHA-1157 saved on this phone/);
      expect(screen.getByRole("button", { name: /^Project: Spine Road/ })).toBeTruthy(); // still chosen
      expect(await options("Sticker / Pole Number")).toEqual(["CHA-1158"]);
    });

    it("drops a project once all its stickers are submitted", async () => {
      await renderScreen({ online: true });
      await screen.findByText("Latitude 27.950575");
      await fillRequired("BAB-1"); // Alpha Street's only sticker
      await submit();
      await screen.findByText("Install for BAB-1 sent.");
      expect(screen.getByRole("button", { name: /^Project: Choose a project/ })).toBeTruthy(); // cleared
      expect(await options("Project")).toEqual(["Spine Road"]);
    });

    it("gives a sticker back when its unsent install is deleted", async () => {
      const alert = jest.spyOn(Alert, "alert");
      const send = jest.fn(async (): Promise<SendResult> => ({ kind: "rejected", error: "Bad." }));
      await renderScreen({ online: true, send });
      await screen.findByText("Latitude 27.950575");
      await fillRequired("BAB-1");
      await submit();
      await fireEvent.press(await screen.findByRole("button", { name: "Delete BAB-1" }));
      const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      await act(async () => buttons.find((b) => b.text === "Delete")?.onPress?.());
      await waitFor(async () => expect(await options("Project")).toEqual(["Spine Road", "Alpha Street"]));
      alert.mockRestore();
    });

    it("remembers submitted stickers after the app restarts", async () => {
      const first = await renderScreen({ online: true });
      await screen.findByText("Latitude 27.950575");
      await fillRequired("CHA-1157");
      await submit();
      await screen.findByText("Install for CHA-1157 sent.");
      // Close the app: discard everything rendered (the phone's storage stays).
      await cleanup();
      void first;

      await renderScreen({ online: true }); // a fresh start, same phone storage
      await screen.findByText("Latitude 27.950575"); // let the opening background tasks settle
      await choose("Project", "Spine Road");
      expect(await options("Sticker / Pole Number")).toEqual(["CHA-1158"]);
    });

    it("works out of signal from the list saved on the phone", async () => {
      await AsyncStorage.setItem("streetleaf.installOptions.v1", JSON.stringify(OPTIONS));
      await renderScreen({ online: false, getInstallOptions: jest.fn().mockRejectedValue(new Error("No connection.")) });
      await screen.findByText("Latitude 27.950575"); // let the opening background tasks settle
      expect(await screen.findByText(/^Saved list /)).toBeTruthy();
      expect(await options("Project")).toEqual(["Spine Road", "Alpha Street"]);
    });

    it("explains when there's no list yet and no connection", async () => {
      await renderScreen({ online: false, getInstallOptions: jest.fn().mockRejectedValue(new Error("No connection.")) });
      await screen.findByText("Latitude 27.950575"); // let the opening background tasks settle
      expect(await screen.findByText("Projects couldn't be loaded. Connect to the internet once to download them.")).toBeTruthy();
    });

    it("saves a fresh list for next time", async () => {
      await renderScreen({ online: true });
      await screen.findByText("Latitude 27.950575");
      await screen.findByText(/^Updated /);
      expect(JSON.parse((await AsyncStorage.getItem("streetleaf.installOptions.v1")) ?? "null")).toEqual(OPTIONS);
    });
  });
});
