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
    // Dates in one column (Last Update above Install Date), coordinates in the other (Lat above Long).
    const dates = within(screen.getByTestId("pole-dates"));
    const coordinates = within(screen.getByTestId("pole-coordinates"));
    // (Testing Library trims trailing spaces before matching, hence /:$/.)
    const text = (children: unknown) => ([] as unknown[]).concat(children).join("").trim();
    const order = (scope: typeof dates) => scope.getAllByText(/:$/).map((n) => text(n.props.children));
    expect(order(dates)).toEqual(["Last Update:", "Install Date:"]);
    expect(order(coordinates)).toEqual(["Lat:", "Long:"]);
    // Last Update shows the date only.
    expect(dates.getByText("2026-10-01")).toBeTruthy();
    expect(screen.queryByText("2026-10-01 12:00")).toBeNull();
    expect(dates.getByText("2026-03-02")).toBeTruthy();
    expect(coordinates.getByText("27.95")).toBeTruthy();
    expect(coordinates.getByText("-82.46")).toBeTruthy();
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

  it("ends with Vitals History and then the Location map, as on the web", async () => {
    await renderPole(false);
    const sections = screen.getAllByText(/^(Statuses|Vitals History|Location)$/).map((n) => n.props.children);
    expect(sections).toEqual(["Statuses", "Vitals History", "Location"]);
    expect(screen.getByTestId("map-marker").props.title).toBe("PAS-1");
  });

  it("shows the Remote Control button only for poles with remote control, and opens the panel", async () => {
    await renderPole(false);
    expect(screen.queryByRole("button", { name: "Remote Control" })).toBeNull();
  });

  it("opens the remote control panel from the header", async () => {
    const detail = makePoleDetail(false);
    detail.pole.hasRemoteControl = true;
    const api = fakeApi({
      getPoleDetail: jest.fn().mockResolvedValue(detail),
      getPoleRemote: jest.fn().mockResolvedValue({
        remote: { productName: "LOC-1", providedProductId: "AEX-1", gatewayName: null, lamp: "on", statusError: null },
      }),
    });
    await render(<PoleDetailView customerId="c1" projectId="p1" poleId="pole1" />, { wrapper: withSignedInAuth(api) });
    const pill = await screen.findByRole("button", { name: "Remote Control" });
    // A small pill sharing the top row with the project name, not a full-width button.
    expect(within(screen.getByText("North Corridor").parent!).getByRole("button", { name: "Remote Control" })).toBeTruthy();
    await fireEvent.press(pill);
    expect(await screen.findByText("LOC-1")).toBeTruthy();
    expect(api.getPoleRemote).toHaveBeenCalledWith("c1", "p1", "pole1");
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

  describe("Issue Entry", () => {
    const issuesCard = () => within(card("Issue Entry"));

    it("starts collapsed to 'View or Report Issue' when the pole has issues", async () => {
      await renderPole(false);
      expect(issuesCard().getByRole("button", { name: "View or Report Issue" })).toBeTruthy();
      expect(issuesCard().queryByText("ISS-1")).toBeNull();
      expect(issuesCard().queryByLabelText("What's wrong?")).toBeNull();
    });

    it("says just 'Report Issue' when the pole has none", async () => {
      await renderPole(false, { poleIssues: [], isOpenIssueFault: false });
      expect(card("Issue Entry")).toHaveAccessibleName("Issue Entry: None");
      await fireEvent.press(issuesCard().getByRole("button", { name: "Report Issue" }));
      expect(issuesCard().getByText("No issues reported for this pole.")).toBeTruthy();
    });

    it("expands to the form (with the pole number) above the issue list, newest first", async () => {
      await renderPole(false);
      await fireEvent.press(issuesCard().getByRole("button", { name: "View or Report Issue" }));

      expect(issuesCard().getByText(/^Report an issue for/)).toBeTruthy();
      expect(issuesCard().getByText("PAS-1", { exact: true })).toBeTruthy();

      // Form first, then the list: walk the card's tree in order.
      const order: string[] = [];
      const walk = (node: unknown): void => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "string") return void order.push(node);
        const n = node as { props?: { accessibilityLabel?: unknown }; children?: unknown[] };
        if (typeof n.props?.accessibilityLabel === "string") order.push(n.props.accessibilityLabel);
        (n.children ?? []).forEach(walk);
      };
      walk(screen.toJSON());
      expect(order.indexOf("Submit issue")).toBeLessThan(order.indexOf("ISS-2"));
      expect(order.indexOf("ISS-2")).toBeLessThan(order.indexOf("ISS-1")); // newest first

      const issues = issuesCard();
      expect(issues.getByText("Open").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: "#c23b3b" })]));
      expect(issues.getByText("Closed").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: "#1f8a4c" })]));
    });

    it("disables Submit issue until there's a description", async () => {
      await renderPole(false);
      await fireEvent.press(issuesCard().getByRole("button", { name: "View or Report Issue" }));
      const submit = () => issuesCard().getByRole("button", { name: "Submit issue" });
      expect(submit().props.accessibilityState.disabled).toBe(true);
      await fireEvent.changeText(issuesCard().getByLabelText("What's wrong?"), "   ");
      expect(submit().props.accessibilityState.disabled).toBe(true);
      await fireEvent.changeText(issuesCard().getByLabelText("What's wrong?"), "Leaning");
      expect(submit().props.accessibilityState.disabled).toBe(false);
    });

    it("collapses again on Cancel", async () => {
      const { api } = await renderPole(false);
      await fireEvent.press(issuesCard().getByRole("button", { name: "View or Report Issue" }));
      await fireEvent.press(issuesCard().getByRole("button", { name: "Cancel" }));
      expect(issuesCard().getByRole("button", { name: "View or Report Issue" })).toBeTruthy();
      expect(issuesCard().queryByText("ISS-1")).toBeNull();
      expect(api.createPoleIssue).not.toHaveBeenCalled();
    });

    it("submits, collapses with a confirmation, and reloads the page", async () => {
      const { api } = await renderPole(false);
      await fireEvent.press(issuesCard().getByRole("button", { name: "View or Report Issue" }));
      await fireEvent.press(issuesCard().getByRole("radio", { name: "Structural Issue" }));
      await fireEvent.changeText(issuesCard().getByLabelText("What's wrong?"), "  Leaning after storm ");
      await fireEvent.press(issuesCard().getByRole("button", { name: "Submit issue" }));

      await waitFor(() =>
        expect(api.createPoleIssue).toHaveBeenCalledWith({
          poleNumber: "PAS-1",
          status: "Structural Issue",
          problemDetails: "Leaning after storm",
        }),
      );
      expect(await screen.findByText("Issue reported.")).toBeTruthy();
      expect(screen.queryByLabelText("What's wrong?")).toBeNull();
      await waitFor(() => expect(api.getPoleDetail).toHaveBeenCalledTimes(2));
    });

    it("stays open with the error if the submit fails", async () => {
      const { api } = await renderPole(false);
      (api.createPoleIssue as jest.Mock).mockRejectedValueOnce(new Error("Pole not found in APIM"));
      await fireEvent.press(issuesCard().getByRole("button", { name: "View or Report Issue" }));
      await fireEvent.changeText(issuesCard().getByLabelText("What's wrong?"), "Leaning");
      await fireEvent.press(issuesCard().getByRole("button", { name: "Submit issue" }));
      expect(await screen.findByText("Pole not found in APIM")).toBeTruthy();
      expect(screen.getByLabelText("What's wrong?")).toBeTruthy();
    });
  });
});
