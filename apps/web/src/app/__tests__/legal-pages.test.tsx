import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextRequest } from "next/server";

const { mockPathname } = vi.hoisted(() => ({ mockPathname: { current: "/privacy" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/Sidebar", () => ({ default: () => <nav data-testid="sidebar" /> }));

import { proxy } from "@/proxy";
import { AppShell } from "@/components/AppShell";
import PrivacyPage from "@/app/privacy/page";
import AccountDeletionPage from "@/app/account-deletion/page";
import { LEGAL, legalPlaceholders } from "@/lib/legal";

const visit = (path: string) => proxy(new NextRequest(`http://localhost${path}`)); // no session cookie
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("public legal pages (the URLs given to the app stores)", () => {
  it("are reachable without signing in", () => {
    for (const path of ["/privacy", "/account-deletion"]) {
      expect(passesThrough(visit(path)), path).toBe(true);
    }
  });

  it("don't open anything else to visitors", () => {
    for (const path of ["/customers", "/poles", "/privacy-admin", "/privacyx"]) {
      const res = visit(path);
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, path).toBe("/signin");
    }
  });

  it("show without the dashboard sidebar", () => {
    for (const path of ["/privacy", "/account-deletion"]) {
      mockPathname.current = path;
      const { unmount } = render(
        <AppShell>
          <p>page</p>
        </AppShell>,
      );
      expect(screen.queryByTestId("sidebar"), path).toBeNull();
      unmount();
    }
  });

  it("the privacy policy covers what the app and dashboard collect", () => {
    render(<PrivacyPage />);
    const text = document.body.textContent ?? "";
    for (const phrase of [
      "precise location",
      "only to read barcodes",
      "No photos or video",
      "never in the background",
      "do not sell personal information",
      "Airtable",
      "Microsoft Azure",
      "not directed to children",
    ]) {
      expect(text, phrase).toContain(phrase);
    }
    expect(screen.getByRole("link", { name: "how to delete your account" })).toHaveAttribute("href", "/account-deletion");
  });

  it("the deletion page explains how to ask, what's deleted and what may be kept", () => {
    render(<AccountDeletionPage />);
    const ask = screen.getAllByRole("link", { name: LEGAL.contactEmail })[0];
    expect(ask.getAttribute("href")).toBe(`mailto:${LEGAL.contactEmail}?subject=Account%20deletion%20request`);
    for (const heading of ["How to request deletion", "What is deleted", "What may be kept"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});

describe("before publishing", () => {
  // Intentionally fails until lib/legal.ts is filled in, so placeholder
  // contact details can't go live on the pages the app stores link to.
  it("has the company's legal name, contact email and address filled in (lib/legal.ts)", () => {
    expect(legalPlaceholders()).toEqual([]);
  });
});
