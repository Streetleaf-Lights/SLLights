"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NavLinkSpinner } from "@/components/NavLinkSpinner";
import { isCustomerScoped } from "@/lib/auth-role";

const NAV_ITEMS = [
  { href: "/customers", label: "Customers" },
  { href: "/projects", label: "Projects" },
  { href: "/poles", label: "Poles" },
  { href: "/users", label: "Users" },
] as const;

// Customers spans every customer, so anyone scoped to just one customer
// (a Customer Admin, or a "Customer User" — a plain User who does belong
// to a customer) doesn't need it. Projects is the inverse: it's that
// same customer's own overview, so anyone NOT scoped to a single customer
// (a Streetleaf Admin, or a "Streetleaf User" with no customer) doesn't
// need it either.
function isVisible(href: string, role: string | null, customerId: string | null): boolean {
  const scoped = isCustomerScoped(role, customerId);
  if (href === "/projects") return scoped;
  if (href === "/customers") return !scoped;
  return true;
}

export default function Sidebar({
  isSignedIn = false,
  role = null,
  customerId = null,
}: {
  isSignedIn?: boolean;
  role?: string | null;
  customerId?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A Customer Admin (or Customer User) only manages/sees their own
  // customer's poles and users — the Customers section spans every
  // customer, so it's hidden for them, while Projects (their own
  // customer overview) is shown only for them.
  const navItems = NAV_ITEMS.filter((item) => isVisible(item.href, role, customerId));

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      const res = await fetch("/api/signout", { method: "POST" });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Sign out failed. Please try again.");
        setSigningOut(false);
        return;
      }

      router.push("/signin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
      <div className="flex h-[88px] items-center border-b border-[var(--sidebar-border)] px-4">
        <Image
          src="/brand/streetleaf-logo.png"
          alt="Streetleaf"
          width={298}
          height={52}
          className="h-auto w-full"
          priority
        />
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center rounded-md px-3 py-2.5 transition-colors ${
                isActive
                  ? "bg-[var(--sidebar-bg-active)]"
                  : "hover:bg-[var(--sidebar-bg-active)]/60"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--sidebar-accent)]" />
              )}
              <span
                className={`text-[13.5px] font-medium ${
                  isActive
                    ? "text-[var(--sidebar-accent-ink)]"
                    : "text-[var(--sidebar-accent-strong)]"
                }`}
              >
                {item.label}
              </span>
              <NavLinkSpinner />
            </Link>
          );
        })}

        {isSignedIn && (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="group relative flex items-center rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-bg-active)]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-[13.5px] font-medium text-[var(--sidebar-accent-strong)]">
              {signingOut ? "⇤ Signing out…" : "⇤ Sign Out"}
            </span>
          </button>
        )}

        {error && (
          <p role="alert" className="px-3 py-1 text-[11.5px] text-[var(--status-flagged)]">
            {error}
          </p>
        )}
      </nav>
    </aside>
  );
}
