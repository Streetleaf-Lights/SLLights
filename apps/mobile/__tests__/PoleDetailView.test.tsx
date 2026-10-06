import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { PoleDetailView } from "@/pole/PoleDetailView";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makePoleDetail, makePoleVital, makeToken, withSignedInAuth } from "../test-utils/helpers";

beforeEach(async () => {
  const token = makeToken({ sub: "u1", role: "Streetleaf Admin", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role: "Streetleaf Admin", customerId: null } });
});

// ScrollView/RefreshControl can finish work on timers; settle them inside act().
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

async function renderPole(viewerScoped: boolean, overrides = {}) {
  const api = fakeApi({ getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(viewerScoped, makePoleVital(overrides))) });
  const onLoaded = jest.fn();
  await render(<PoleDetailView customerId="c1" projectId="p1" poleId="pole1" onLoaded={onLoaded} />, {
    wrapper: withSignedInAuth(api),
  });
  await screen.findByRole("header", { name: "PAS-1" });
  return { api, onLoaded };
}

const card = (title: string) => screen.getByLabelText(new RegExp(`^${title}: `));

describe("PoleDetailView (the web pole page)", () => {
  it("shows the header: project, pole number, connection, 48H status, dates and coordinates", async () => {
    const { api, onLoaded } = await renderPole(false);
    expect(api.getPoleDetail).toHaveBeenCalledWith("c1", "p1", "pole1");
    expect(onLoaded).toHaveBeenCalledWith(expect.objectContaining({ project: expect.objectContaining({ name: "North Corridor" }) }));
    expect(screen.getByText("North Corridor")).toBeTruthy();
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("48H Overall Status: ")).toBeTruthy();
    // "Fault" twice: the header's 48H Overall Status and the Battery card.
    expect(screen.getAllByText("Fault")).toHaveLength(2);
    expect(screen.getByText("2026-10-01 12:00")).toBeTruthy();
    expect(screen.getByText("2026-03-02")).toBeTruthy();
    expect(screen.getByText("27.95")).toBeTruthy();
    expect(screen.getByText("-82.46")).toBeTruthy();
  });

  it("shows the four status cards with the staff metrics", async () => {
    await renderPole(false);
    expect(card("Light")).toHaveAccessibleName("Light: OK");
    expect(card("Battery")).toHaveAccessibleName("Battery: Fault");
    expect(card("Issue Entry")).toHaveAccessibleName("Issue Entry: Yes");
    const battery = within(card("Battery"));
    for (const label of ["48H Average Battery %", "Electric Current 1", "Electric Current 2", "Battery Voltage 2"]) {
      expect(battery.getByText(label)).toBeTruthy();
    }
    expect(battery.getByText("12.8V")).toBeTruthy();
    // Light is OFF with a sunset time: the web's "Expected ON" note.
    expect(within(card("Light")).getByText("Expected ON @ 19:54 EDT")).toBeTruthy();
  });

  it("gives customer-scoped viewers the simplified cards and no 48H status", async () => {
    await renderPole(true);
    expect(screen.queryByText("48H Overall Status: ")).toBeNull();
    const battery = within(card("Battery"));
    expect(battery.getByText("Operating Status")).toBeTruthy();
    expect(battery.getByText("Battery Percentage")).toBeTruthy();
    expect(battery.queryByText("Battery Voltage 1")).toBeNull();
    expect(screen.queryByText(/^48H Average/)).toBeNull();
  });

  it("drops the '1' suffixes for a single-channel pole", async () => {
    await renderPole(false, { lampPower2: null });
    expect(within(card("Light")).getByText("Light Power")).toBeTruthy();
    expect(within(card("Light")).queryByText("Light Power 2")).toBeNull();
    expect(within(card("Battery")).getByText("Battery Voltage")).toBeTruthy();
  });

  it("lists issues newest first with web status colours, and reloads after a report", async () => {
    const { api } = await renderPole(false);
    const issues = within(card("Issue Entry"));
    const ids = issues.getAllByText(/^ISS-\d$/).map((n) => n.props.children);
    expect(ids).toEqual(["ISS-2", "ISS-1"]);
    expect(issues.getByText("Open").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: "#c23b3b" })]));
    expect(issues.getByText("Closed").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: "#1f8a4c" })]));

    await fireEvent.changeText(issues.getByLabelText("What's wrong?"), "Leaning");
    await fireEvent.press(issues.getByRole("button", { name: "Report issue" }));
    await waitFor(() => expect(api.createPoleIssue).toHaveBeenCalledWith({ poleNumber: "PAS-1", status: "Electrical Issue", problemDetails: "Leaning" }));
    await waitFor(() => expect(api.getPoleDetail).toHaveBeenCalledTimes(2));
  });

  it("says so when a pole has no issues", async () => {
    await renderPole(false, { poleIssues: [], isOpenIssueFault: false });
    expect(card("Issue Entry")).toHaveAccessibleName("Issue Entry: None");
    expect(screen.getByText("No issues reported for this pole.")).toBeTruthy();
  });
});
