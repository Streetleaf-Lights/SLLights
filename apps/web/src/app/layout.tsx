import type { Metadata } from "next";
import { Cabin, Roboto_Slab, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/session";
import "./globals.css";

const cabin = Cabin({
  variable: "--font-display",
  subsets: ["latin"],
});

const robotoSlab = Roboto_Slab({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Streetleaf - Customer Dashboard",
  description: "Internal tool for managing customers, projects, and pole assets.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionUser = await getSessionUser();

  return (
    <html
      lang="en"
      className={`${cabin.variable} ${robotoSlab.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <AppShell
          isSignedIn={Boolean(sessionUser)}
          role={sessionUser?.role ?? null}
          customerId={sessionUser?.customerId ?? null}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
