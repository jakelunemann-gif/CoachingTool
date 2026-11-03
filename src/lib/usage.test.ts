import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import { collectDrillIds, drillCounts } from "./usage";

const item = (id: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id, kind: "block", title: id, minutes: 5, lines: [], ...extra });

const plan: PlanItem[] = [
  item("warmup", { drillId: "d1" }),
  item("water", { kind: "water" }),
  item("circuit", {
    kind: "circuit",
    children: [item("s1", { kind: "station", drillId: "d2" }), item("s2", { kind: "station", drillId: "d3" }), item("s3", { kind: "station", drillId: "d2" })],
  }),
  item("breakout", { kind: "breakout", children: [item("b1", { kind: "station", drillId: "d4" }), item("b2", { kind: "station" })] }),
  item("notes", { kind: "notes" }),
];

describe("collectDrillIds", () => {
  it("walks stations and skips items without a drill", () => {
    expect(collectDrillIds(plan)).toEqual(["d1", "d2", "d3", "d2", "d4"]);
  });

  it("returns nothing for an empty plan", () => {
    expect(collectDrillIds([])).toEqual([]);
  });
});

describe("drillCounts", () => {
  it("counts repeated drills", () => {
    expect(Object.fromEntries(drillCounts(plan))).toEqual({ d1: 1, d2: 2, d3: 1, d4: 1 });
  });
});
