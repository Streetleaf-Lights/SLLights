import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Expo Router turns every file under app/ into a route, and any route inside
 * (tabs) that the tab layout doesn't declare is added to the tab bar under
 * its file name. Files left behind by a move (e.g. an old (tabs)/index.tsx
 * after screens moved into per-tab stacks) therefore show up as stray
 * "index"/"scan" tabs. This pins the exact route files the app should have.
 */
const EXPECTED = [
  "_layout.tsx",
  "sign-in.tsx",
  "welcome.tsx",
  "(tabs)/_layout.tsx",
  "(tabs)/(account)/_layout.tsx",
  "(tabs)/(account)/account.tsx",
  "(tabs)/(account)/users.tsx",
  "(tabs)/(home)/_layout.tsx",
  "(tabs)/(home)/index.tsx",
  "(tabs)/(home)/customer/[customerId].tsx",
  "(tabs)/(home)/project/[customerId]/[projectId].tsx",
  "(tabs)/(home)/project/[customerId]/[projectId]/pole/[poleId].tsx",
  "(tabs)/(scan)/_layout.tsx",
  "(tabs)/(scan)/scan.tsx",
  "(tabs)/(home,scan)/pole/[poleNumber].tsx",
  "(tabs)/(home)/faults.tsx",
  "(tabs)/(poles)/_layout.tsx",
  "(tabs)/(poles)/index.tsx",
  "(tabs)/(poles)/pole/[customerId]/[projectId]/[poleId].tsx",
].sort();

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).split("\\").join("/")];
  });
}

describe("app/ route files", () => {
  it("are exactly the expected screens and layouts (no leftovers from moved screens)", () => {
    const actual = listFiles(join(__dirname, "..", "app")).sort();
    const unexpected = actual.filter((file) => !EXPECTED.includes(file));
    const missing = EXPECTED.filter((file) => !actual.includes(file));
    expect({ unexpected, missing }).toEqual({ unexpected: [], missing: [] });
  });
});
