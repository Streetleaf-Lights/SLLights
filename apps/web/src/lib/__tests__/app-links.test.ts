import { afterEach, describe, expect, it, vi } from "vitest";
import { androidAssetLinks, appleAppSiteAssociation } from "@/lib/app-links";
import { GET as AASA } from "@/app/.well-known/apple-app-site-association/route";
import { GET as ASSETLINKS } from "@/app/.well-known/assetlinks.json/route";

afterEach(() => vi.unstubAllEnvs());

describe("app link verification files", () => {
  it("lists the app and only the emailed-link pages for iOS", () => {
    expect(appleAppSiteAssociation(" ABCDE12345 ")).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["ABCDE12345.com.streetleaf.sllights"],
            components: [{ "/": "/register" }, { "/": "/register/*" }, { "/": "/reset-password" }, { "/": "/reset-password/*" }],
          },
        ],
      },
    });
  });

  it("lists every signing key for Android", () => {
    expect(androidAssetLinks("aa:bb, CC:DD ,")).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.streetleaf.sllights", sha256_cert_fingerprints: ["AA:BB", "CC:DD"] },
      },
    ]);
  });

  it("serves nothing (404) until configured, so links keep opening the web pages", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "");
    vi.stubEnv("ANDROID_SHA256_CERT_FINGERPRINTS", "");
    expect(AASA().status).toBe(404);
    expect(ASSETLINKS().status).toBe(404);
  });

  it("serves JSON once configured", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "ABCDE12345");
    vi.stubEnv("ANDROID_SHA256_CERT_FINGERPRINTS", "AA:BB");
    const aasa = AASA();
    expect(aasa.headers.get("content-type")).toContain("application/json");
    expect((await aasa.json()).applinks.details[0].appIDs).toEqual(["ABCDE12345.com.streetleaf.sllights"]);
    expect((await ASSETLINKS().json())[0].target.sha256_cert_fingerprints).toEqual(["AA:BB"]);
  });
});
