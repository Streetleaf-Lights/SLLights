"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const NO_SIDEBAR_ROUTES = ["/signin", "/register", "/forgot-password", "/reset-password"];

export function AppShell({
  children,
  isSignedIn = false,
  role = null,
  customerId = null,
}: {
  children: React.ReactNode;
  isSignedIn?: boolean;
  role?: string | null;
  customerId?: string | null;
}) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`),
  );

  if (hideSidebar) {
    return (
      <main className="flex min-h-screen flex-1 flex-col overflow-x-hidden">{children}</main>
    );
  }

  return (
    <>
      <Sidebar isSignedIn={isSignedIn} role={role} customerId={customerId} />
      <main className="flex min-h-screen flex-1 flex-col overflow-x-hidden">{children}</main>
    </>
  );
}
