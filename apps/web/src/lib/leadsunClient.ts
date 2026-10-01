import https from "node:https";
import type { LeadsunLampStatus } from "@/lib/types";

const DEFAULT_BASE_URL = "https://leadsunedge-us.com:8550";
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Most .env loaders (dotenv included) only expand backslash-n into a real
 * newline for double-quoted values — an unquoted or single-quoted value
 * keeps the literal two characters "\" + "n". A PEM string pasted as one
 * line with those literal sequences fails to parse (OpenSSL error "no
 * start line", since it never finds an actual line break before/after
 * "-----BEGIN...-----"). Converting them back to real newlines here means
 * this works regardless of how the value was quoted in the env file.
 */
function normalizeCertPem(raw: string | undefined): string {
  return (raw ?? "").replace(/\\n/g, "\n").trim();
}

/**
 * GET /lamps/{leadsunProjectId}[/{productId}] — Leadsun's own live status
 * API (separate from Azure APIM, and separate from LeadsunProject/
 * LeadsunProduct which only describe static config). Requires mutual TLS:
 * a client certificate + private key, both parsed from the same combined
 * PEM string in LEADSUN_CLIENT_CERT_PEM (Node's https module extracts
 * whichever block it needs from a combined PEM). Always returns an array,
 * even when scoped to a single productId — normalized to a flat array
 * either way, since it's not clear from the docs whether Leadsun wraps a
 * single-product response differently.
 */
export async function fetchLeadsunLampStatus(
  leadsunProjectId: string,
  productId?: string,
): Promise<LeadsunLampStatus[]> {
  const cert = normalizeCertPem(process.env.LEADSUN_CLIENT_CERT_PEM);
  if (!cert) {
    throw new Error("LEADSUN_CLIENT_CERT_PEM is not configured");
  }

  // Node rejects Leadsun's server certificate by default if it's
  // self-signed (not issued by a CA Node trusts out of the box) — that's
  // a deliberate security default, not a bug, so it's never silently
  // disabled here. It's only bypassed if this is explicitly set, which is
  // a real trade-off (it removes protection against a MITM impersonating
  // Leadsun's server) that should be a conscious choice, not a default.
  const rejectUnauthorized = process.env.LEADSUN_ALLOW_SELF_SIGNED_CERT !== "true";

  const baseUrl = process.env.LEADSUN_LAMP_STATUS_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL(
    productId
      ? `/lamps/${encodeURIComponent(leadsunProjectId)}/${encodeURIComponent(productId)}`
      : `/lamps/${encodeURIComponent(leadsunProjectId)}`,
    baseUrl,
  );

  const body = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        // Combined cert+key PEM — Node/OpenSSL pulls the relevant block
        // from each, so the same string works for both options.
        cert,
        key: cert,
        rejectUnauthorized,
        headers: { Accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString("utf8");
        });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) {
            resolve(data);
          } else {
            reject(new Error(`Leadsun lamp status API returned ${status}`));
          }
        });
      },
    );
    // Without this, a hung/unresponsive Leadsun server leaves this
    // promise pending forever — which then hangs our own route, which
    // then hangs the Remote Control modal's status poll indefinitely
    // (the poll loop just waits for a response that never comes, with no
    // way to reach its own attempt limit or show an error).
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Leadsun lamp status API timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
    req.end();
  });

  const parsed: unknown = JSON.parse(body);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map(normalizeLampStatus);
}

function normalizeLampStatus(raw: unknown): LeadsunLampStatus {
  const candidate = (raw ?? {}) as Partial<
    Record<keyof LeadsunLampStatus, unknown>
  >;
  return {
    productId: String(candidate.productId ?? ""),
    lampPower1: Number(candidate.lampPower1 ?? 0),
    lampPower2: Number(candidate.lampPower2 ?? 0),
  };
}
