import { describe, expect, it } from "vitest";
import { withFinish, withStart, type Waypoint } from "@/lib/studio";

const wp = (id: string, lat = 47, lng = 8, label?: string): Waypoint => ({ id, point: [lat, lng], label });

describe("start and destination fields", () => {
  it("sets the start of an empty route", () => {
    expect(withStart([], wp("a", 1, 1, "Bern"))).toEqual([wp("a", 1, 1, "Bern")]);
  });

  it("replaces only the start and keeps the stops and the finish", () => {
    const route = [wp("a"), wp("b"), wp("c")];
    expect(withStart(route, wp("x", 2, 2, "Thun")).map((w) => w.id)).toEqual(["x", "b", "c"]);
  });

  it("adds the destination after a lone start", () => {
    expect(withFinish([wp("a")], wp("z", 3, 3, "Zurich")).map((w) => w.id)).toEqual(["a", "z"]);
  });

  it("replaces the destination and keeps the start and the stops", () => {
    const route = [wp("a"), wp("b"), wp("c")];
    expect(withFinish(route, wp("z")).map((w) => w.id)).toEqual(["a", "b", "z"]);
  });

  it("never grows past 25 waypoints", () => {
    const full = Array.from({ length: 25 }, (_, i) => wp(String(i)));
    expect(withFinish(full, wp("z"))).toHaveLength(25);
    expect(withStart(full, wp("s"))).toHaveLength(25);
  });
});
