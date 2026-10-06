import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ScannedPoleScreen from "../app/(tabs)/(home,scan)/pole/[poleNumber]";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makePoleDetail, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ poleNumber: "PAS-1", scanned: "PAS-1" }),
  Stack: { Screen: () => null },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 27.9506, longitude: -82.4572, accuracy: 6 } })),
}));

const summary = { id: "pole1", poleNumber: "PAS-1", customerId: "c1", projectId: "p1" };

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("Scanned pole screen", () => {
  it("looks the pole up, then shows the web pole page with install recording for field users", async () => {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi({
      lookupPole: jest.fn().mockResolvedValue({ pole: summary }),
      getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(false)),
    });
    await render(<ScannedPoleScreen />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByRole("header", { name: "PAS-1" })).toBeTruthy();
    expect(api.lookupPole).toHaveBeenCalledWith("PAS-1");
    expect(api.getPoleDetail).toHaveBeenCalledWith("c1", "p1", "pole1");
    expect(screen.getByLabelText(/^Battery: /)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record install" })).toBeTruthy();
  });

  it("records an install with the scanned value and GPS", async () => {
    await signIn("Streetleaf Crew", null);
    const api = fakeApi({
      lookupPole: jest.fn().mockResolvedValue({ pole: summary }),
      getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(false)),
    });
    await render(<ScannedPoleScreen />, { wrapper: withSignedInAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Capture location" }));
    await screen.findByText("27.950600, -82.457200");
    await fireEvent.press(screen.getByRole("button", { name: "Record install" }));
    await waitFor(() =>
      expect(api.submitPoleInstall).toHaveBeenCalledWith(
        expect.objectContaining({ poleNumber: "PAS-1", scannedValue: "PAS-1", latitude: 27.9506 }),
      ),
    );
  });

  it("offers install recording for an unknown pole number", async () => {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi();
    await render(<ScannedPoleScreen />, { wrapper: withSignedInAuth(api) });
    expect(await screen.findByText(/If it's a new pole, you can still record the install/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record install" })).toBeTruthy();
    expect(api.getPoleDetail).not.toHaveBeenCalled();
  });

  it.each([
    ["Customer Owner", "c1"],
    ["User", null],
  ])("shows %s the pole page without install recording", async (role, customerId) => {
    await signIn(role, customerId);
    const api = fakeApi({
      lookupPole: jest.fn().mockResolvedValue({ pole: summary }),
      getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(customerId !== null)),
    });
    await render(<ScannedPoleScreen />, { wrapper: withSignedInAuth(api) });
    await screen.findByRole("header", { name: "PAS-1" });
    expect(screen.queryByRole("button", { name: "Record install" })).toBeNull();
  });

  it("lets the user retry a failed lookup", async () => {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi({
      lookupPole: jest
        .fn()
        .mockRejectedValueOnce(new ApiError("No connection. Check your signal and try again.", null))
        .mockResolvedValueOnce({ pole: summary }),
      getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(false)),
    });
    await render(<ScannedPoleScreen />, { wrapper: withSignedInAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("header", { name: "PAS-1" })).toBeTruthy();
  });
});
