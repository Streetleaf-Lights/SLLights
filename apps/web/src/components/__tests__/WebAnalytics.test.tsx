import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { received } = vi.hoisted(() => ({ received: [] as Record<string, unknown>[] }));
vi.mock("@vercel/analytics/next", () => ({
  Analytics: (props: Record<string, unknown>) => {
    received.push(props);
    return null;
  },
}));

import { WebAnalytics } from "@/components/WebAnalytics";
import { beforeSendAnalytics } from "@/lib/analyticsPrivacy";

describe("WebAnalytics", () => {
  it("turns on Vercel Web Analytics with the token-stripping step", () => {
    render(<WebAnalytics />);
    expect(received.at(-1)?.beforeSend).toBe(beforeSendAnalytics);
  });
});
