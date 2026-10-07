import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { PolesListView } from "@/monitoring/PolesListView";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `id${n}`,
  poleNumber: `PAS-${n}`,
  customerId: "c1",
  projectId: "p1",
  isOnline: true,
  connectedText: "Online",
  overallStatusText: "Fault",
  lightStatusText: "ON",
  panelText: "Idle (Night)",
  batteryStatusText: "Charging",
  ...extra,
});
const pageOf = (rows: unknown[], extra: Record<string, unknown> = {}) => ({
  rows,
  page: 1,
  totalPages: 1,
  totalItems: rows.length,
  firstItem: rows.length ? 1 : 0,
  lastItem: rows.length,
  ...extra,
});

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

async function renderList(listPoles: jest.Mock, props: Partial<Parameters<typeof PolesListView>[0]> = {}) {
  const api = fakeApi({ listPoles });
  const onOpenPole = jest.fn();
  await render(<PolesListView onOpenPole={onOpenPole} {...props} />, { wrapper: withSignedInAuth(api) });
  return { api, onOpenPole };
}

describe("PolesListView", () => {
  it("shows staff the web's columns: dot, 48h Connected, 48h Overall Status, Light, Panel, Battery", async () => {
    await signIn("Streetleaf Admin", null);
    await renderList(jest.fn().mockResolvedValue(pageOf([row(1)])));
    expect(await screen.findByText("PAS-1")).toBeTruthy();
    for (const label of ["48h Connected: ", "48h Overall Status: ", "Light: ", "Panel: ", "Battery: "]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Idle (Night)")).toBeTruthy();
    expect(screen.getByText("1 pole")).toBeTruthy();
  });

  it("drops 48h Connected and the 48h prefix for customer-scoped viewers", async () => {
    await signIn("Customer Owner", "c1");
    await renderList(jest.fn().mockResolvedValue(pageOf([row(1, { connectedText: undefined })])));
    await screen.findByText("PAS-1");
    expect(screen.queryByText("48h Connected: ")).toBeNull();
    expect(screen.getByText("Overall Status: ")).toBeTruthy();
  });

  it("asks the server for the next page and shows its range", async () => {
    await signIn("Streetleaf Admin", null);
    const listPoles = jest
      .fn()
      .mockResolvedValueOnce(pageOf([row(1)], { totalPages: 3, totalItems: 23, firstItem: 1, lastItem: 10 }))
      .mockResolvedValueOnce(pageOf([row(11)], { page: 2, totalPages: 3, totalItems: 23, firstItem: 11, lastItem: 20 }));
    await renderList(listPoles);
    expect(await screen.findByText("Showing 1–10 of 23 poles")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Showing 11–20 of 23 poles")).toBeTruthy();
    expect(listPoles).toHaveBeenLastCalledWith({ q: "", page: 2 });
  });

  it("searches once typing pauses, from page 1", async () => {
    await signIn("Streetleaf Admin", null);
    const listPoles = jest.fn().mockResolvedValue(pageOf([row(7)]));
    await renderList(listPoles);
    await screen.findByText("PAS-7");
    await fireEvent.changeText(screen.getByLabelText("Search by pole number…"), "pa");
    await fireEvent.changeText(screen.getByLabelText("Search by pole number…"), "pas-7");
    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(listPoles).toHaveBeenCalledTimes(1); // not on every keystroke
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => expect(listPoles).toHaveBeenLastCalledWith({ q: "pas-7", page: 1 }));
    expect(listPoles).toHaveBeenCalledTimes(2);
  });

  it("shows the faults view with each pole's project, and the customer for staff", async () => {
    await signIn("Streetleaf Admin", null);
    const listPoles = jest.fn().mockResolvedValue(pageOf([row(1, { projectName: "North" })], { customerName: "Coastal Power" }));
    await renderList(listPoles, { faults: { customerId: "c1", projectId: "p1" } });
    expect(await screen.findByText("North")).toBeTruthy();
    expect(screen.getByText("Customer: Coastal Power")).toBeTruthy();
    expect(listPoles).toHaveBeenCalledWith({ q: "", page: 1, faults: { customerId: "c1", projectId: "p1" } });
  });

  it.each([
    [{}, "No poles on file yet."],
    [{ faults: { customerId: "c1" } }, "No faulted poles right now."],
  ])("explains an empty list (%j)", async (props, message) => {
    await signIn("Streetleaf Admin", null);
    await renderList(jest.fn().mockResolvedValue(pageOf([])), props);
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("keeps the search box while showing an error with a retry", async () => {
    await signIn("Streetleaf Admin", null);
    const listPoles = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Couldn't load poles. Please try again.", 500))
      .mockResolvedValueOnce(pageOf([row(1)]));
    await renderList(listPoles);
    expect(await screen.findByText("Couldn't load poles. Please try again.")).toBeTruthy();
    expect(screen.getByLabelText("Search by pole number…")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("PAS-1")).toBeTruthy();
  });

  it("opens a pole", async () => {
    await signIn("Streetleaf Admin", null);
    const { onOpenPole } = await renderList(jest.fn().mockResolvedValue(pageOf([row(1)])));
    await fireEvent.press(await screen.findByRole("button", { name: /^Pole PAS-1/ }));
    expect(onOpenPole).toHaveBeenCalledWith(expect.objectContaining({ id: "id1", customerId: "c1", projectId: "p1" }));
  });
});
