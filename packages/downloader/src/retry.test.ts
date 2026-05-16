import { describe, expect, it, vi } from "vitest";
import { backoffDelayMs } from "./retry.js";

describe("retry helpers", () => {
  it("uses exponential backoff with bounded jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(backoffDelayMs(1, 500)).toBe(500);
    expect(backoffDelayMs(2, 500)).toBe(1000);
    expect(backoffDelayMs(3, 500)).toBe(2000);
    vi.restoreAllMocks();
  });
});
