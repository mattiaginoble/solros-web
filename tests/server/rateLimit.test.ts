import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "@/lib/server/rateLimit";

describe("limite a finestra scorrevole", () => {
  it("consente fino al limite, poi indica quanto attendere", () => {
    const l = new SlidingWindowLimiter(2, 60_000);
    expect(l.wait("a", 0)).toBe(0);
    l.record("a", 0);
    l.record("a", 10_000);
    expect(l.wait("a", 20_000)).toBe(40_000);
    expect(l.wait("b", 20_000)).toBe(0);
  });

  it("libera i posti quando escono dalla finestra", () => {
    const l = new SlidingWindowLimiter(1, 1000);
    l.record("a", 0);
    expect(l.wait("a", 999)).toBe(1);
    expect(l.wait("a", 1000)).toBe(0);
  });

  it("non conserva le chiavi scadute", () => {
    const l = new SlidingWindowLimiter(1, 1000);
    for (let i = 0; i < 100; i++) l.record(`u${i}`, 0);
    l.record("ultimo", 5000);
    expect(l.size).toBe(1);
  });
});
