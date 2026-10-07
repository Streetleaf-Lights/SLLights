import { NextResponse } from "next/server";
import { androidAssetLinks } from "@/lib/app-links";

export const dynamic = "force-dynamic";

/** Lets Android open emailed invite/reset links in the app (see lib/app-links.ts). 404 until ANDROID_SHA256_CERT_FINGERPRINTS is set. */
export function GET() {
  const body = androidAssetLinks(process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (!body) return new NextResponse(null, { status: 404 });
  return NextResponse.json(body);
}
