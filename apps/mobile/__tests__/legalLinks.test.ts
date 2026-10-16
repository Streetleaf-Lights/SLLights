import { accountDeletionUrl, privacyPolicyUrl } from "@/legal/legalLinks";

describe("legal page links", () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });

  it("point at the web app the app already talks to", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://dashboard.example.com";
    expect(privacyPolicyUrl()).toBe("https://dashboard.example.com/privacy");
    expect(accountDeletionUrl()).toBe("https://dashboard.example.com/account-deletion");
  });

  it("don't double the slash when the address ends in one", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://dashboard.example.com/";
    expect(privacyPolicyUrl()).toBe("https://dashboard.example.com/privacy");
  });
});
