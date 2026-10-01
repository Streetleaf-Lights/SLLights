import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { PoleIssuesLink } from "@/components/PoleIssuesLink";
import type { PoleIssue } from "@/lib/types";

const sampleIssues: PoleIssue[] = [
  {
    issueId: "ISS-100",
    status: "Open",
    poleStatus: "Electrical Issue",
    dateReported: "2026-09-01 08:15:00-05:00",
    problemDetails: "Lamp flickering at night",
  },
  {
    issueId: "ISS-050",
    status: "Closed",
    poleStatus: "Physical Damage",
    dateReported: "2026-08-15 14:30:00-05:00",
    problemDetails: "Pole leaning after storm",
  },
];

describe("PoleIssuesLink", () => {
  afterEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    vi.unstubAllGlobals();
  });
  it("shows 'Report Issue' when there are no issues", () => {
    render(<PoleIssuesLink poleNumber="51079-1000" issues={[]} />);
    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View or Report Issue" })).not.toBeInTheDocument();
  });

  it("shows 'View or Report Issue' when the pole has at least one issue", () => {
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    expect(screen.getByRole("button", { name: "View or Report Issue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report Issue" })).not.toBeInTheDocument();
  });

  it("uses a recognizable accent color for the link, not a near-black one that blends into body text", () => {
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    const link = screen.getByRole("button", { name: "View or Report Issue" });
    expect(link.className).toContain("text-[var(--accent)]");
    expect(link.className).not.toContain("text-[var(--accent-ink)]");
  });

  it("shows a pointer cursor on hover for the link, overriding Tailwind's default button cursor reset", () => {
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    const link = screen.getByRole("button", { name: "View or Report Issue" });
    expect(link.className).toContain("cursor-pointer");
  });

  it("does not show the modal before the link is clicked", () => {
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the modal when the link is clicked", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Pole Issues")).toBeInTheDocument();
  });

  it("sorts issues by dateReported, latest first", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // ISS-100 (2026-09-01) is later than ISS-050 (2026-08-15).
    expect(within(rows[0]).getByText("ISS-100")).toBeInTheDocument();
    expect(within(rows[1]).getByText("ISS-050")).toBeInTheDocument();
  });

  it("re-sorts correctly regardless of the order issues are passed in", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={[...sampleIssues].reverse()} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("ISS-100")).toBeInTheDocument();
    expect(within(rows[1]).getByText("ISS-050")).toBeInTheDocument();
  });

  it("sorts correctly for the real API's dateReported format — a space before the timezone offset (e.g. '...000 -04:00'), which silently broke Date parsing and left issues in the API's own order instead of being sorted", async () => {
    const realFormatIssues: PoleIssue[] = [
      {
        issueId: "091126-5100-DAD-1024",
        status: "Open",
        poleStatus: "Electrical Issue",
        dateReported: "2026-09-11 16:46:16.000 -04:00",
        problemDetails: "Pole is missing the solar panel",
      },
      {
        issueId: "030426-4338-DAD-1024",
        status: "Closed",
        poleStatus: "Electrical Issue",
        dateReported: "2026-03-04 09:32:09.000 -05:00",
        problemDetails: null,
      },
      {
        issueId: "030526-4348-DAD-1024",
        status: "Closed",
        poleStatus: "Electrical Issue",
        dateReported: "2026-03-05 10:36:20.000 -05:00",
        problemDetails: null,
      },
    ];
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={realFormatIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("091126-5100-DAD-1024")).toBeInTheDocument();
    expect(within(rows[1]).getByText("030526-4348-DAD-1024")).toBeInTheDocument();
    expect(within(rows[2]).getByText("030426-4338-DAD-1024")).toBeInTheDocument();
  });

  it("does not show poleStatus on the row at all — issueId and status already identify it", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    expect(screen.queryByText("Electrical Issue")).not.toBeInTheDocument();
    expect(screen.queryByText(/Electrical Issue:/)).not.toBeInTheDocument();
  });

  it("shows no second line at all when problemDetails is null", async () => {
    const issuesWithNullDetails: PoleIssue[] = [
      {
        issueId: "030426-4338-DAD-1024",
        status: "Closed",
        poleStatus: "Electrical Issue",
        dateReported: "2026-03-04 09:32:09.000 -05:00",
        problemDetails: null,
      },
    ];
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={issuesWithNullDetails} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const row = screen.getByText("030426-4338-DAD-1024").closest("li")!;
    expect(within(row).queryByText(/Electrical Issue/)).not.toBeInTheDocument();
  });

  it("shows each issue's issueId as the bold element on the first line", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const issueIdEl = screen.getByText("ISS-100");
    expect(issueIdEl.className).toContain("font-semibold");
  });

  it("colors an 'Open' status red/flagged", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const openStatus = screen.getByText("Open");
    expect(openStatus.className).toContain("text-[var(--status-flagged)]");
  });

  it("colors a 'Closed' status green/active", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const closedStatus = screen.getByText("Closed");
    expect(closedStatus.className).toContain("text-[var(--status-active)]");
  });

  it("shows problemDetails italicized on the second line", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const line2 = screen.getByText("Lamp flickering at night");
    expect(line2.className).toContain("italic");
  });

  it("shows dateReported truncated to minutes (no seconds) on the third line", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    expect(screen.getByText("Reported 2026-09-01 08:15")).toBeInTheDocument();
    expect(screen.queryByText(/08:15:00/)).not.toBeInTheDocument();
  });

  it("shows an empty-state message instead of a list when there are no issues", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={[]} />);
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    expect(screen.getByText("No issues reported for this pole yet.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });


  it("closes the modal when Close is clicked", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the modal when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    const backdrop = screen.getByRole("dialog").parentElement!;

    await user.click(backdrop);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close the modal when clicking inside the dialog itself", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    await user.click(screen.getByText("Pole Issues"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // --- Report Issue form -----------------------------------------------

  it("shows an inner 'Report Issue' link when the modal opens, and no form yet", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the form (and hides the inner link) when the inner Report Issue link is clicked", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Report Issue" }));

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Report Issue" })).not.toBeInTheDocument();
  });

  it("shows 'Report an issue for <poleNumber>' in the form", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    expect(screen.getByText(/Report an issue for/)).toBeInTheDocument();
    expect(screen.getByText("51079-1000")).toBeInTheDocument();
  });

  it("shows two radio buttons — Electrical Issue and Structural Issue — with Electrical Issue selected by default", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    const electrical = screen.getByRole("radio", { name: "Electrical Issue" });
    const structural = screen.getByRole("radio", { name: "Structural Issue" });
    expect(electrical).toBeChecked();
    expect(structural).not.toBeChecked();
  });

  it("allows switching the radio selection to Structural Issue", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    await user.click(screen.getByRole("radio", { name: "Structural Issue" }));

    expect(screen.getByRole("radio", { name: "Structural Issue" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Electrical Issue" })).not.toBeChecked();
  });

  it("limits the problem details textarea to 500 characters", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "500");
  });

  it("disables Submit Issue when problem details is empty", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    expect(screen.getByRole("button", { name: "Submit Issue" })).toBeDisabled();
  });

  it("shows a pointer cursor on hover for Submit Issue, consistent with the Report Issue links", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    expect(screen.getByRole("button", { name: "Submit Issue" }).className).toContain(
      "cursor-pointer",
    );
  });

  it("enables Submit Issue once problem details has content", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");

    expect(screen.getByRole("button", { name: "Submit Issue" })).toBeEnabled();
  });

  it("Cancel hides the form, clears the fields, and re-shows the inner Report Issue link", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.click(screen.getByRole("radio", { name: "Structural Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // Fields reset, not just hidden — reopening shows the defaults again.
    await user.click(within(dialog).getByRole("button", { name: "Report Issue" }));
    expect(screen.getByRole("radio", { name: "Electrical Issue" })).toBeChecked();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("posts poleNumber, status, and problemDetails to /api/createpoleissue on submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="TESTSL1-1004" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.click(screen.getByRole("radio", { name: "Electrical Issue" }));
    await user.type(screen.getByRole("textbox"), "Testing pole issue creation");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/createpoleissue");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      poleNumber: "TESTSL1-1004",
      status: "Electrical Issue",
      problemDetails: "Testing pole issue creation",
    });
  });

  it("trims problemDetails before submitting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="TESTSL1-1004" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "  Lamp is out  ");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).problemDetails).toBe("Lamp is out");
  });

  it("shows 'Submitting…' and disables the button while the request is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    const submitButton = await screen.findByRole("button", { name: "Submitting…" });
    expect(submitButton).toBeDisabled();

    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("clears and hides the form after a successful submit, and does not leave the spinner stuck — the inner Report Issue link comes back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      }),
    );

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    // The bug this covers: the spinner used to stay up forever once the
    // refresh settled, because it was cleared by comparing issue counts
    // rather than by the refresh's own completion. Once router.refresh()
    // (however long it actually takes) settles, isPending must go back to
    // false — the spinner clears and the link comes back, not stuck spinning.
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Report Issue" })).toBeInTheDocument(),
    );
    expect(within(dialog).queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("clears the spinner even when the refreshed issues list doesn't get any longer — the exact scenario that caused indefinite spinning under the old length-comparison logic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      }),
    );

    const user = userEvent.setup();
    const { rerender } = render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());

    // Re-render with the SAME length issues array (simulating a refresh
    // that, for whatever reason, doesn't yet reflect the new issue —
    // eventual consistency, a slow read replica, etc). The old
    // length-comparison approach would never clear the spinner here.
    rerender(<PoleIssuesLink poleNumber="51079-1000" issues={[...sampleIssues]} />);

    expect(within(dialog).getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
  });

  it("renders correctly (Report Issue link, new issue visible) once the issues prop is updated after a successful submit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      }),
    );

    const user = userEvent.setup();
    const { rerender } = render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());

    // Simulates router.refresh() completing: the parent server component
    // re-fetches and passes down a longer issues array.
    const newIssue: PoleIssue = {
      issueId: "ISS-200",
      status: "Open",
      poleStatus: "Electrical Issue",
      dateReported: "2026-09-20 12:00:00.000 -04:00",
      problemDetails: "Lamp is out",
    };
    rerender(
      <PoleIssuesLink poleNumber="51079-1000" issues={[newIssue, ...sampleIssues]} />,
    );

    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(within(dialog).getByText("ISS-200")).toBeInTheDocument();
  });

  it("does not show the spinner or clear the form when the submission fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "problemDetails is required." }),
      }),
    );

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    await screen.findByRole("alert");
    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls router.refresh() after a successful submit, so the issue list re-populates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      }),
    );

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("does not call router.refresh() or hide the form when the submission fails — shows the server's error instead", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "problemDetails is required." }),
      }),
    );

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("problemDetails is required.");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows a fallback error message when the submit request itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("redirects to /signin on a 401 from the submit request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "session expired" }),
      }),
    );

    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/signin"));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("resets the form (hidden, fields cleared) when the modal is closed and reopened", async () => {
    const user = userEvent.setup();
    render(<PoleIssuesLink poleNumber="51079-1000" issues={sampleIssues} />);
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    await user.click(screen.getByRole("radio", { name: "Structural Issue" }));
    await user.type(screen.getByRole("textbox"), "Lamp is out");
    // Close via backdrop.
    await user.click(screen.getByRole("dialog").parentElement!);

    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
