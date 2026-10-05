import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import PoleScreen from "../app/pole/[poleNumber]";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth as withAuth } from "../test-utils/helpers";

let mockParams: Record<string, string> = { poleNumber: "PAS-4938", scanned: "PAS-4938" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 27.9506, longitude: -82.4572, accuracy: 6 } })),
}));

const Location = jest.requireMock("expo-location");

const pole = {
  id: "p1",
  poleNumber: "PAS-4938",
  customerId: "c1",
  projectId: "pr1",
  overallStatusText: "Fault",
  connectedText: "Online",
  installDate: "2026-03-02 10:00:00+00:00",
  poleIssues: [
    { issueId: "i1", status: "Open", poleStatus: "", dateReported: "", problemDetails: null },
    { issueId: "i2", status: "Closed", poleStatus: "", dateReported: "", problemDetails: null },
  ],
};

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

describe("PoleScreen", () => {
  beforeEach(async () => {
    await signIn("Streetleaf Admin", null);
    mockParams = { poleNumber: "PAS-4938", scanned: "PAS-4938" };
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it("shows the looked-up pole's status and offers issue reporting", async () => {
    const api = fakeApi({ lookupPole: jest.fn().mockResolvedValue({ pole }) });
    await render(<PoleScreen />, { wrapper: withAuth(api) });

    expect(await screen.findByText("Fault")).toBeTruthy();
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("2026-03-02 10:00")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy(); // one open issue
    expect(screen.getByText("Report an issue")).toBeTruthy();
    expect(api.lookupPole).toHaveBeenCalledWith("PAS-4938");
  });

  it("explains an unknown pole and still allows recording an install, but not an issue", async () => {
    await render(<PoleScreen />, { wrapper: withAuth(fakeApi()) });
    expect(await screen.findByText(/No pole with this number is on your account/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record install" })).toBeTruthy();
    expect(screen.queryByText("Report an issue")).toBeNull();
  });

  it("lets the crew retry a failed lookup", async () => {
    const api = fakeApi({
      lookupPole: jest
        .fn()
        .mockRejectedValueOnce(new ApiError("No connection. Check your signal and try again.", null))
        .mockResolvedValueOnce({ pole }),
    });
    await render(<PoleScreen />, { wrapper: withAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Fault")).toBeTruthy();
    expect(api.lookupPole).toHaveBeenCalledTimes(2);
  });

  it("requires a location fix, then submits the install with the scanned value", async () => {
    const api = fakeApi();
    await render(<PoleScreen />, { wrapper: withAuth(api) });
    const record = await screen.findByRole("button", { name: "Record install" });
    expect(record.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByRole("button", { name: "Capture location" }));
    expect(await screen.findByText("27.950600, -82.457200")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Notes (optional)"), "New base");
    await fireEvent.press(screen.getByRole("button", { name: "Record install" }));

    await waitFor(() =>
      expect(api.submitPoleInstall).toHaveBeenCalledWith(
        expect.objectContaining({
          poleNumber: "PAS-4938",
          scannedValue: "PAS-4938",
          latitude: 27.9506,
          longitude: -82.4572,
          accuracyMeters: 6,
          notes: "New base",
        }),
      ),
    );
    expect(await screen.findByText("Install recorded for PAS-4938.")).toBeTruthy();
  });

  it("shows the 'not available yet' answer as a warning rather than claiming success", async () => {
    const api = fakeApi({
      submitPoleInstall: jest
        .fn()
        .mockRejectedValue(new ApiError("Recording installs isn't available yet. Your scan wasn't saved.", 501)),
    });
    await render(<PoleScreen />, { wrapper: withAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Capture location" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Record install" }));
    expect(await screen.findByText(/isn't available yet/)).toBeTruthy();
    expect(screen.queryByText(/Install recorded/)).toBeNull();
  });

  it("warns about an imprecise fix and explains denied location access", async () => {
    Location.getCurrentPositionAsync.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2, accuracy: 80 } });
    await render(<PoleScreen />, { wrapper: withAuth(fakeApi()) });
    await fireEvent.press(await screen.findByRole("button", { name: "Capture location" }));
    expect(await screen.findByText(/Location is imprecise/)).toBeTruthy();

    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await fireEvent.press(screen.getByRole("button", { name: "Capture location again" }));
    expect(await screen.findByText(/Location access is off/)).toBeTruthy();
  });

  it("reports an issue for a found pole through the shared endpoint", async () => {
    const api = fakeApi({ lookupPole: jest.fn().mockResolvedValue({ pole }) });
    await render(<PoleScreen />, { wrapper: withAuth(api) });
    await fireEvent.press(await screen.findByRole("radio", { name: "Structural Issue" }));
    await fireEvent.changeText(screen.getByLabelText("What's wrong?"), "  Leaning after storm ");
    await fireEvent.press(screen.getByRole("button", { name: "Report issue" }));

    await waitFor(() =>
      expect(api.createPoleIssue).toHaveBeenCalledWith({
        poleNumber: "PAS-4938",
        status: "Structural Issue",
        problemDetails: "Leaning after storm",
      }),
    );
    expect(await screen.findByText("Issue reported.")).toBeTruthy();
  });

  it("doesn't offer install recording to customer users", async () => {
    await signIn("Customer Owner", "c1");
    const api = fakeApi({ lookupPole: jest.fn().mockResolvedValue({ pole }) });
    await render(<PoleScreen />, { wrapper: withAuth(api) });
    expect(await screen.findByText("Report an issue")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record install" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Capture location" })).toBeNull();
  });

  it("doesn't suggest recording an install for an unknown pole to customer users", async () => {
    await signIn("Customer Owner", "c1");
    await render(<PoleScreen />, { wrapper: withAuth(fakeApi()) });
    expect(await screen.findByText("No pole with this number is on your account.")).toBeTruthy();
  });
});
