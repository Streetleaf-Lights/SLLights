import type { ReactNode } from "react";
import type { ApiClient } from "@/api/client";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";

import type { PoleDetailResponse } from "@sllights/shared/api-contract";
import { buildPoleStatusCards, connectionStatusTone } from "@sllights/shared/pole-detail";
import type { PoleVital } from "@sllights/shared/types";

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
    getMyCustomer: jest.fn().mockResolvedValue({ customer: null }),
    listCustomers: jest.fn().mockResolvedValue({ customers: [] }),
    getCustomerOverview: jest.fn(),
    getProject: jest.fn(),
    getPoleDetail: jest.fn(),
    getPoleVitals: jest.fn().mockResolvedValue({ vitals: [] }),
    getPoleRemote: jest.fn().mockResolvedValue({ remote: null }),
    getProjectRemote: jest.fn().mockResolvedValue({ remote: null }),
    sendProjectLightCommand: jest.fn().mockResolvedValue({ success: true, message: "Request successful" }),
    sendLightCommand: jest.fn().mockResolvedValue({ success: true, message: "Request successful" }),
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

/** Like the root layout: renders children only once a stored session has loaded and signed in. */
export function withSignedInAuth(api: ApiClient) {
  function Gate({ children }: { children: ReactNode }) {
    const { state } = useAuth();
    return state.status === "signedIn" ? <>{children}</> : null;
  }
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider apiOverride={api}>
        <Gate>{children}</Gate>
      </AuthProvider>
    );
  };
}

/** A realistic dual-channel pole, overridable per test. */
export function makePoleVital(overrides: Partial<PoleVital> = {}): PoleVital {
  return {
    id: "pole1", poleNumber: "PAS-1", locationId: "L1", active: true, isOnline: true,
    installDate: "2026-03-02", lat: 27.95, long: -82.46, lastUpdate: "2026-10-01 12:00:00+00:00",
    batteryVoltage1: 12.8, batteryVoltage2: 12.7, lampPower1: 40, lampPower2: 38,
    batteryElecCurrent1: 1.1, batteryElecCurrent2: 1.0, solarBoardVoltage: 18.2, solarBoardElecCurrent: 2.3,
    isLedFault: false, isBatteryFault: true, isPanelFault: false, isOpenIssueFault: true, isPoleFault: true,
    avgBatteryPercentage: 80, avgPanelPercentage: 70, avgLightPercentage: 95,
    sunsetTime: "2026-08-28 19:54:31.130526-04:00", lightStatusText: "OFF", panelStatusText: "Charging",
    panelIdleReason: null, batteryStatusText: "Low", electricCurrentAverage: 55,
    connectedText: "Online", overallStatusText: "Fault",
    poleIssues: [
      { issueId: "ISS-1", status: "Closed", poleStatus: "", dateReported: "2026-09-01 08:00:00.000 -04:00", problemDetails: "Old one" },
      { issueId: "ISS-2", status: "Open", poleStatus: "", dateReported: "2026-09-30 08:00:00.000 -04:00", problemDetails: "Flickering" },
    ],
    ...overrides,
  } as PoleVital;
}

/** What the pole route sends: built with the same shared rules the server uses. */
export function makePoleDetail(viewerScoped: boolean, pole: PoleVital = makePoleVital()): PoleDetailResponse {
  return {
    customer: { id: "c1", name: "Coastal Power" },
    project: { id: "p1", name: "North Corridor", active: true },
    pole: {
      id: pole.id,
      poleNumber: pole.poleNumber,
      active: pole.active,
      lastUpdate: pole.lastUpdate,
      installDate: pole.installDate,
      lat: pole.lat,
      long: pole.long,
      connection: connectionStatusTone(pole.isOnline, pole.lastUpdate),
      ...(viewerScoped ? {} : { overallStatusText: pole.overallStatusText }),
      cards: buildPoleStatusCards(pole, viewerScoped),
      issues: pole.poleIssues,
      hasRemoteControl: false,
    },
  };
}
