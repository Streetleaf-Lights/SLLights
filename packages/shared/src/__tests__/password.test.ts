import { describe, expect, it } from "vitest";
import { checkNewPassword } from "../password";

describe("checkNewPassword (the web's rules)", () => {
  it("needs 8+ characters including a special character", () => {
    expect(checkNewPassword("abcdefg!", "")).toMatchObject({ hasMinLength: true, hasSpecialChar: true, valid: true });
    expect(checkNewPassword("abcdefgh", "")).toMatchObject({ hasSpecialChar: false, valid: false });
    expect(checkNewPassword("ab!", "")).toMatchObject({ hasMinLength: false, valid: false });
    expect(checkNewPassword("pass word", "")).toMatchObject({ hasSpecialChar: true }); // a space counts, as on the web
  });

  it("only matches once the confirmation is typed and equal", () => {
    expect(checkNewPassword("abcdefg!", "").matches).toBe(false);
    expect(checkNewPassword("abcdefg!", "abcdefg?").matches).toBe(false);
    expect(checkNewPassword("abcdefg!", "abcdefg!").matches).toBe(true);
  });
});
