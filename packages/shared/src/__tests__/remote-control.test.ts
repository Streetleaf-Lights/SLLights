import { describe, expect, it } from "vitest";
import { expectedLampState, lightButtonLabel, validateLightCommand } from "../remote-control";

describe("validateLightCommand", () => {
  it("accepts whole-number brightness 0–100 and time 1–3600s", () => {
    expect(validateLightCommand({ brightness: 50, time: 30 })).toEqual({ ok: true, value: { brightness: 50, time: 30 } });
    expect(validateLightCommand({ brightness: 0, time: 1 })).toMatchObject({ ok: true });
    expect(validateLightCommand({ brightness: 100, time: 3600 })).toMatchObject({ ok: true });
  });

  it("ignores anything but brightness and time (no way to name another target)", () => {
    expect(validateLightCommand({ brightness: 10, time: 5, projectId: "x", poleNumbers: ["a"] })).toEqual({
      ok: true,
      value: { brightness: 10, time: 5 },
    });
  });

  it.each([
    [null],
    [{ brightness: -1, time: 30 }],
    [{ brightness: 101, time: 30 }],
    [{ brightness: 50.5, time: 30 }],
    [{ brightness: "50", time: 30 }],
    [{ brightness: 50, time: 0 }],
    [{ brightness: 50, time: 3601 }],
    [{ brightness: 50, time: 2.5 }],
    [{ brightness: 50 }],
  ])("rejects %j", (body) => {
    expect(validateLightCommand(body)).toMatchObject({ ok: false });
  });
});

describe("labels and expectations (as on the web)", () => {
  it("words the button like the web", () => {
    expect(lightButtonLabel({ submitting: true, cooldownRemaining: 5, brightness: 0 })).toBe("Submitting…");
    expect(lightButtonLabel({ submitting: false, cooldownRemaining: 7, brightness: 50 })).toBe("Wait 7s");
    expect(lightButtonLabel({ submitting: false, cooldownRemaining: 0, brightness: 0 })).toBe("TURN OFF");
    expect(lightButtonLabel({ submitting: false, cooldownRemaining: 0, brightness: 1 })).toBe("GO!");
  });

  it("expects ON for any brightness above 0, OFF for 0", () => {
    expect(expectedLampState(1)).toBe("on");
    expect(expectedLampState(0)).toBe("off");
  });
});
