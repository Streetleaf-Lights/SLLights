import type { ReactNode } from "react";
import type { ApiClient } from "@/api/client";
import { AuthProvider } from "@/auth/AuthProvider";

/** Unsigned JWT; the app only decodes tokens, never verifies them. */
export function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
}

export const futureExp = () => Math.floor(Date.now() / 1000) + 3600;

export function fakeApi(overrides: Partial<Record<keyof ApiClient, jest.Mock>> = {}): ApiClient & Record<string, jest.Mock> {
  return {
    setToken: jest.fn(),
    onUnauthorized: jest.fn(() => () => undefined),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue({ success: true }),
    lookupPole: jest.fn().mockResolvedValue({ pole: null }),
    createPoleIssue: jest.fn().mockResolvedValue({ success: true }),
    submitPoleInstall: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  } as unknown as ApiClient & Record<string, jest.Mock>;
}

export function withAuth(api: ApiClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider apiOverride={api}>{children}</AuthProvider>;
  };
}
