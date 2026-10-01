import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getPoleVitalsByPeriodMock } = vi.hoisted(() => ({ getPoleVitalsByPeriodMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    getPoleVitalsByPeriod: getPoleVitalsByPeriodMock,
  };
});

import { ApimError } from "@/lib/apim";
import { GET } from "@/app/api/getpolevitalsbyperiod/route";

function request(params: Record<string, string>) {
  const url = new URL("http://localhost/api/getpolevitalsbyperiod");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/getpolevitalsbyperiod", () => {
  afterEach(() => {
    getPoleVitalsByPeriodMock.mockReset();
  });

  const successBody = {
    id: "recAOlPiepBddUcCv",
    poleNumber: "01095-1000",
    locationId: "01095-1000",
    installDate: "2025-09-28",
    lat: 28.3,
    long: -82.27,
    lastUpdate: "2026-07-30 15:18:27+00:00",
    vitals: [],
  };

  it("forwards poleId, periodType, and limit to getPoleVitalsByPeriod, returning the result", async () => {
    getPoleVitalsByPeriodMock.mockResolvedValue(successBody);

    const res = await GET(request({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(successBody);
    expect(getPoleVitalsByPeriodMock).toHaveBeenCalledWith({
      poleId: "recAOlPiepBddUcCv",
      periodType: "Hour",
      limit: 48,
    });
  });

  it("accepts periodType=Day", async () => {
    getPoleVitalsByPeriodMock.mockResolvedValue(successBody);

    await GET(request({ poleId: "recAOlPiepBddUcCv", periodType: "Day", limit: "30" }));

    expect(getPoleVitalsByPeriodMock).toHaveBeenCalledWith({
      poleId: "recAOlPiepBddUcCv",
      periodType: "Day",
      limit: 30,
    });
  });

  it("rejects a missing poleId with 400 before calling getPoleVitalsByPeriod", async () => {
    const res = await GET(request({ periodType: "Hour", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("poleId is required.");
    expect(getPoleVitalsByPeriodMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid periodType with 400 before calling getPoleVitalsByPeriod", async () => {
    const res = await GET(request({ poleId: "recAOlPiepBddUcCv", periodType: "Week", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("periodType must be one of: Hour, Day");
    expect(getPoleVitalsByPeriodMock).not.toHaveBeenCalled();
  });

  it("rejects a missing periodType with 400", async () => {
    const res = await GET(request({ poleId: "recAOlPiepBddUcCv", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("periodType must be one of: Hour, Day");
  });

  it("rejects a missing or non-numeric limit with 400", async () => {
    const res = await GET(
      request({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: "not-a-number" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("limit must be a positive number.");
    expect(getPoleVitalsByPeriodMock).not.toHaveBeenCalled();
  });

  it("rejects a zero/negative limit with 400", async () => {
    const res = await GET(request({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: "0" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("limit must be a positive number.");
  });

  it("forwards the APIM error message and status for an invalid periodType", async () => {
    getPoleVitalsByPeriodMock.mockRejectedValue(
      new ApimError("periodType must be one of: Hour, Day", 400),
    );

    const res = await GET(request({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "periodType must be one of: Hour, Day" });
  });

  it("forwards the APIM error message and status when the pole isn't found", async () => {
    getPoleVitalsByPeriodMock.mockRejectedValue(new ApimError("pole not found", 404));

    const res = await GET(request({ poleId: "does-not-exist", periodType: "Hour", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "pole not found" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    getPoleVitalsByPeriodMock.mockRejectedValue(new Error("boom"));

    const res = await GET(request({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: "48" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to load pole vitals. Please try again.");
  });
});
