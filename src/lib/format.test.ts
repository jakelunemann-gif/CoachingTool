import { describe, expect, it } from "vitest";
import { formatDateLong, formatTimeRange, planHeader, planTitle } from "./format";

describe("format", () => {
  it("matches the coach's header style", () => {
    expect(planHeader("2026-04-20", "MSE Field 12", "18:00", 90)).toBe("Monday, April 20th, 2026, MSE Field 12 6-7:30pm");
    expect(planHeader("2026-03-25", "STME Gym North", "19:30", 90)).toBe("Wednesday, March 25th, 2026, STME Gym North 7:30-9pm");
  });

  it("formats ordinals and ranges", () => {
    expect(formatDateLong("2026-04-22")).toBe("Wednesday, April 22nd, 2026");
    expect(formatDateLong("2026-05-11")).toBe("Monday, May 11th, 2026");
    expect(formatTimeRange("20:00", 60)).toBe("8-9pm");
    expect(formatTimeRange("11:00", 90)).toBe("11am-12:30pm");
  });

  it("matches the Drive file names", () => {
    expect(planTitle("2026-04-13", "12U-Blue", "Softball")).toBe("2026 12U-Blue Softball Practice Plan 4.13.26");
  });
});
