import { describe, expect, it } from "vitest";
import { createLatestGuard } from "@/lib/client/latest";

describe("createLatestGuard", () => {
  it("lets only the newest of overlapping requests apply its result", async () => {
    const guard = createLatestGuard();
    const shown: string[] = [];
    const request = async (label: string, delay: number) => {
      const token = guard.next();
      await new Promise((r) => setTimeout(r, delay));
      if (guard.isLatest(token)) shown.push(label);
    };
    // A slow old query and a fast new one: the old one must not overwrite the new one.
    await Promise.all([request("old", 30), request("middle", 20), request("new", 5)]);
    expect(shown).toEqual(["new"]);
  });
});
