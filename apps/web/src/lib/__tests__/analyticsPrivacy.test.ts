import { describe, expect, it } from "vitest";
import type { BeforeSendEvent } from "@vercel/analytics";
import { beforeSendAnalytics, withoutQuery } from "@/lib/analyticsPrivacy";

describe("analytics never sees invitation or reset tokens", () => {
  it.each([
    ["https://dash.example.com/register?token=abc123", "https://dash.example.com/register"],
    ["https://dash.example.com/reset-password?token=s3cr3t&x=1", "https://dash.example.com/reset-password"],
    ["https://dash.example.com/poles?faults=1&customerId=c1#top", "https://dash.example.com/poles"],
    ["https://dash.example.com/customers/c1", "https://dash.example.com/customers/c1"],
  ])("%s → %s", (url, expected) => {
    expect(withoutQuery(url)).toBe(expected);
  });

  it("strips every event's address before it's sent", () => {
    const event = { type: "pageview", url: "https://dash.example.com/register?token=abc123" } as BeforeSendEvent;
    const sent = beforeSendAnalytics(event);
    expect(sent.url).toBe("https://dash.example.com/register");
    expect(JSON.stringify(sent)).not.toContain("abc123");
  });
});
