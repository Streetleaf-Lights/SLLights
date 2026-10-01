import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { httpsRequestMock } = vi.hoisted(() => ({ httpsRequestMock: vi.fn() }));

vi.mock("node:https", () => ({
  default: { request: httpsRequestMock },
}));

import { fetchLeadsunLampStatus } from "@/lib/leadsunClient";

class FakeRequest extends EventEmitter {
  end = vi.fn();
  destroy = vi.fn();
  setTimeout = vi.fn();
}

class FakeResponse extends EventEmitter {
  statusCode: number;
  constructor(statusCode: number) {
    super();
    this.statusCode = statusCode;
  }
}

/** Wires up httpsRequestMock to respond with the given status/body the next time it's called. */
function mockNextRequest(statusCode: number, body: string) {
  const req = new FakeRequest();
  httpsRequestMock.mockImplementationOnce((_options, callback) => {
    const res = new FakeResponse(statusCode);
    // Defer to the next microtask so `.on(...)` listeners are attached first.
    queueMicrotask(() => {
      callback(res);
      res.emit("data", Buffer.from(body));
      res.emit("end");
    });
    return req;
  });
  return req;
}

// Raw shape the real Leadsun API sends — includes fields we deliberately
// don't keep (productName, isOnline, lastUpload), so these tests also
// confirm normalization drops them rather than passing them through.
const rawLamp = {
  productId: "AEXSAM2324122936",
  productName: "DRH-Orl",
  lampPower1: 0,
  lampPower2: 0,
  isOnline: true,
  lastUpload: "2026-09-03T14:39:41.520+00:00",
};

// What normalizeLampStatus actually keeps from rawLamp.
const normalizedLamp = {
  productId: "AEXSAM2324122936",
  lampPower1: 0,
  lampPower2: 0,
};

describe("fetchLeadsunLampStatus", () => {
  beforeEach(() => {
    vi.stubEnv("LEADSUN_CLIENT_CERT_PEM", "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----");
    vi.stubEnv("LEADSUN_LAMP_STATUS_BASE_URL", "https://leadsunedge-us.com:8550");
  });

  afterEach(() => {
    httpsRequestMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("throws if LEADSUN_CLIENT_CERT_PEM is not configured", async () => {
    vi.stubEnv("LEADSUN_CLIENT_CERT_PEM", "");
    await expect(fetchLeadsunLampStatus("389")).rejects.toThrow(/LEADSUN_CLIENT_CERT_PEM/);
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("requests GET /lamps/{projectId} when no productId is given", async () => {
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.hostname).toBe("leadsunedge-us.com");
    expect(options.port).toBe("8550");
    expect(options.path).toBe("/lamps/389");
    expect(options.method).toBe("GET");
  });

  it("requests GET /lamps/{projectId}/{productId} when productId is given", async () => {
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389", "AEXSAM2324122936");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.path).toBe("/lamps/389/AEXSAM2324122936");
  });

  it("URL-encodes projectId and productId in the path", async () => {
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("has space", "also/slash");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.path).toBe("/lamps/has%20space/also%2Fslash");
  });

  it("rejects Leadsun's server certificate by default (rejectUnauthorized: true) — the secure default, even though the certificate is self-signed", async () => {
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.rejectUnauthorized).toBe(true);
  });

  it("only trusts the self-signed server certificate when explicitly opted in via LEADSUN_ALLOW_SELF_SIGNED_CERT=true", async () => {
    vi.stubEnv("LEADSUN_ALLOW_SELF_SIGNED_CERT", "true");
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.rejectUnauthorized).toBe(false);
  });

  it("does not opt in for any value other than the exact string 'true'", async () => {
    vi.stubEnv("LEADSUN_ALLOW_SELF_SIGNED_CERT", "1");
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.rejectUnauthorized).toBe(true);
  });

  it("sends the combined PEM string for both cert and key", async () => {
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.cert).toContain("BEGIN PRIVATE KEY");
    expect(options.key).toContain("BEGIN PRIVATE KEY");
    expect(options.cert).toBe(options.key);
  });

  it("converts literal backslash-n sequences to real newlines (regression: unquoted/single-quoted .env values don't expand \\n themselves, causing OpenSSL's 'no start line' error)", async () => {
    // An unquoted/single-quoted .env value keeps "\n" as the two literal
    // characters backslash + n, not a real newline — reproduced here with
    // an actual JS string containing that literal two-character sequence.
    vi.stubEnv(
      "LEADSUN_CLIENT_CERT_PEM",
      "-----BEGIN PRIVATE KEY-----\\nZmFrZQ==\\n-----END PRIVATE KEY-----\\n-----BEGIN CERTIFICATE-----\\nZmFrZQ==\\n-----END CERTIFICATE-----",
    );
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    // A real newline character, not the two-character "\n" sequence.
    expect(options.cert).toContain("\n");
    expect(options.cert).not.toContain("\\n");
  });

  it("leaves an already-correct PEM (with real newlines) unchanged", async () => {
    const properPem =
      "-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----\n-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----";
    vi.stubEnv("LEADSUN_CLIENT_CERT_PEM", properPem);
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.cert).toBe(properPem);
  });

  it("throws if LEADSUN_CLIENT_CERT_PEM is only whitespace after trimming", async () => {
    vi.stubEnv("LEADSUN_CLIENT_CERT_PEM", "   ");
    await expect(fetchLeadsunLampStatus("389")).rejects.toThrow(/LEADSUN_CLIENT_CERT_PEM/);
  });

  it("parses and normalizes a successful JSON array response", async () => {
    mockNextRequest(200, JSON.stringify([rawLamp]));
    const lamps = await fetchLeadsunLampStatus("389");

    expect(lamps).toEqual([normalizedLamp]);
  });

  it("wraps a single-object response in an array", async () => {
    mockNextRequest(200, JSON.stringify(rawLamp));
    const lamps = await fetchLeadsunLampStatus("389", rawLamp.productId);

    expect(lamps).toEqual([normalizedLamp]);
  });

  it("normalizes a lamp missing some fields, defaulting numbers to 0", async () => {
    mockNextRequest(200, JSON.stringify([{ productId: "X" }]));
    const lamps = await fetchLeadsunLampStatus("389");

    expect(lamps).toEqual([{ productId: "X", lampPower1: 0, lampPower2: 0 }]);
  });

  it("rejects when the response status is not 2xx", async () => {
    mockNextRequest(500, "server error");
    await expect(fetchLeadsunLampStatus("389")).rejects.toThrow(/500/);
  });

  it("rejects when the underlying request errors (e.g. TLS handshake failure)", async () => {
    const req = new FakeRequest();
    httpsRequestMock.mockImplementationOnce(() => req);
    const promise = fetchLeadsunLampStatus("389");
    queueMicrotask(() => req.emit("error", new Error("certificate rejected")));

    await expect(promise).rejects.toThrow("certificate rejected");
  });

  it("sets a request timeout, so a hung/unresponsive Leadsun server can't leave this pending forever", async () => {
    const req = new FakeRequest();
    httpsRequestMock.mockImplementationOnce(() => req);
    void fetchLeadsunLampStatus("389");
    await Promise.resolve();

    expect(req.setTimeout).toHaveBeenCalledWith(8000, expect.any(Function));
  });

  it("destroys the request (triggering rejection) once the timeout fires", async () => {
    const req = new FakeRequest();
    // destroy(err) should emit 'error' with that same error, matching
    // Node's real https.ClientRequest behavior.
    req.destroy.mockImplementation((err?: Error) => {
      if (err) req.emit("error", err);
    });
    httpsRequestMock.mockImplementationOnce(() => req);
    const promise = fetchLeadsunLampStatus("389");
    await Promise.resolve();

    const [, onTimeout] = req.setTimeout.mock.calls[0];
    onTimeout();

    await expect(promise).rejects.toThrow(/timed out/);
  });

  it("falls back to the default base URL when LEADSUN_LAMP_STATUS_BASE_URL is unset", async () => {
    vi.stubEnv("LEADSUN_LAMP_STATUS_BASE_URL", "");
    mockNextRequest(200, "[]");
    await fetchLeadsunLampStatus("389");

    const [options] = httpsRequestMock.mock.calls[0];
    expect(options.hostname).toBe("leadsunedge-us.com");
    expect(options.port).toBe("8550");
  });
});
