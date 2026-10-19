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
import SupportPage from "@/app/support/page";
import { LEGAL, legalPlaceholders } from "@/lib/legal";

const visit = (path: string) => proxy(new NextRequest(`http://localhost${path}`)); // no session cookie
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("public legal pages (the URLs given to the app stores)", () => {
  it("are reachable without signing in", () => {
    for (const path of ["/privacy", "/account-deletion", "/support"]) {
      expect(passesThrough(visit(path)), path).toBe(true);
    }
  });

  it("don't open anything else to visitors", () => {
    for (const path of ["/customers", "/poles", "/privacy-admin", "/privacyx", "/supporter"]) {
      const res = visit(path);
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, path).toBe("/signin");
    }
  });

  it("show without the dashboard sidebar", () => {
    for (const path of ["/privacy", "/account-deletion", "/support"]) {
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

  it("the deletion page explains how to delete (in the app first), what's deleted and what may be kept", () => {
    render(<AccountDeletionPage />);
    const ask = screen.getAllByRole("link", { name: LEGAL.contactEmail })[0];
    expect(ask.getAttribute("href")).toBe(`mailto:${LEGAL.contactEmail}?subject=Account%20deletion%20request`);
    expect(document.body.textContent).toContain("tap Delete your account");
    expect(document.body.textContent).toContain("deleted straight away");
    for (const heading of ["How to delete your account", "What is deleted", "What may be kept"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});

describe("support page", () => {
  it("gives the support email, sign-in help and links to the other pages", () => {
    render(<SupportPage />);
    const mail = screen.getAllByRole("link", { name: LEGAL.supportEmail })[0];
    expect(mail.getAttribute("href")).toBe(`mailto:${LEGAL.supportEmail}?subject=Streetleaf%20Lights%20support`);
    expect(screen.getByRole("link", { name: "Forgot password" })).toHaveAttribute("href", "/forgot-password");
    for (const heading of ["Signing in", "Recording installs (field crews)", "Camera and location", "Your data"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "delete your account" })).toHaveAttribute("href", "/account-deletion");
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  });
});

describe("before publishing", () => {
  // Intentionally fails until lib/legal.ts is filled in, so placeholder
  // contact details can't go live on the pages the app stores link to.
  it("has the company's legal name, contact and support emails and address filled in (lib/legal.ts)", () => {
    expect(legalPlaceholders()).toEqual([]);
  });
});
