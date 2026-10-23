import { describe, expect, it } from "vitest";
import { DRILLS } from "../../../prisma/seed/drills";
import { SPORTS } from "../../../prisma/seed/sports";
import type { DrillLite, PlanInput, PlanItem, RosterPlayer } from "../types";
import { contextFromInput, rejectReason } from "./filter";
import { batteryPairings, chooseLeader, splitGroups } from "./groups";
import { generatePlan, totalMinutes } from "./index";
import { createRng } from "./random";
import { displayTitles } from "./timeline";

const library: DrillLite[] = DRILLS.map((d) => ({
  id: d.name,
  name: d.name,
  blockType: d.block,
  description: d.description,
  instructions: d.instructions,
  durationMin: d.dur[0],
  durationTypical: d.dur[1],
  durationMax: d.dur[2],
  coachesRequired: d.coaches ?? 1,
  minPlayers: d.minPlayers ?? 1,
  maxPlayers: d.maxPlayers ?? null,
  source: d.source ?? "",
  sports: d.sports ?? ["softball", "baseball"],
  ages: d.ages ?? [],
  skills: [],
  focus: d.focus,
  surfaces: d.surfaces ?? [],
  equipment: d.equipment ?? [],
  videos: (d.videos ?? []).map((v) => ({ url: v.url, label: v.label ?? "" })),
}));
const config = SPORTS[0].config;

const roster: RosterPlayer[] = [
  { name: "Aura", roles: ["catcher"] },
  { name: "Noreen", roles: ["catcher"] },
  { name: "Avery V", roles: ["pitcher", "catcher"] },
  { name: "Piper", roles: ["pitcher"] },
  { name: "Olivia", roles: ["pitcher"] },
  { name: "Marin", roles: ["pitcher"] },
  { name: "Veda", roles: [] },
  { name: "Audrey", roles: [] },
  { name: "Vivian", roles: [] },
  { name: "Avarie", roles: [] },
  { name: "Sophia", roles: ["pitcher"] },
];

const baseInput: PlanInput = {
  sportSlug: "softball",
  teamName: "12U-Blue",
  ageSlug: "12u",
  skillSlug: "a",
  date: "2026-04-13",
  startTime: "20:00",
  durationMin: 90,
  location: "MSE Gym 3",
  surfaceSlug: "gym",
  equipmentSlugs: ["tees", "bow-nets", "tennis-balls", "wiffle-balls", "helmets", "bases", "catchers-gear", "cones", "stopwatch"],
  focusSlugs: ["hitting-mechanics", "bunting", "infield"],
  coaches: ["Jake", "Trevor", "Brandon"],
  players: roster,
  missing: ["Vivian"],
  playerCount: 0,
  options: { intro: false, dailies: true, sideWork: true, endGame: true },
  notes: "Wednesday April 15th at 7:30-9pm at MSE Gym 2 CAGES!!!",
};

const allDrillItems = (items: PlanItem[]): PlanItem[] =>
  items.flatMap((i) => [...(i.drillId ? [i] : []), ...allDrillItems(i.children ?? [])]);
const byId = new Map(library.map((d) => [d.id, d]));

describe("generatePlan", () => {
  it("fills the practice length exactly", () => {
    for (const durationMin of [60, 75, 90, 120]) {
      for (const seed of [1, 2, 3]) {
        const plan = generatePlan({ ...baseInput, durationMin }, library, { seed, sportConfig: config });
        expect(totalMinutes(plan.items)).toBe(durationMin);
      }
    }
  });

  it("follows the coach's plan shape: warmups, catch, dailies, water, ..., game, notes", () => {
    const plan = generatePlan(baseInput, library, { seed: 7, sportConfig: config });
    const titles = plan.items.map((i) => i.title);
    expect(titles[0]).toBe("Team Warmups");
    expect(titles[1]).toMatch(/^Play Catch: /);
    expect(titles[2]).toMatch(/^Dailies: /);
    expect(plan.items.some((i) => i.kind === "water")).toBe(true);
    expect(plan.items.at(-1)!.kind).toBe("notes");
    expect(plan.items.at(-1)!.lines).toEqual(["Wednesday April 15th at 7:30-9pm at MSE Gym 2 CAGES!!!"]);
    expect(plan.items.at(-2)!.title).toMatch(/^Game: /);
    expect(plan.items[0].lines).toContain(`Team leader: ${plan.teamLeader}`);
    expect(plan.items[0].lines).toContain("Missing: Vivian");
  });

  it("fits short practices exactly, even with the intro on", () => {
    for (const durationMin of [30, 45]) {
      for (const intro of [false, true]) {
        for (let seed = 1; seed <= 40; seed++) {
          const input = { ...baseInput, durationMin, options: { ...baseInput.options, intro } };
          const plan = generatePlan(input, library, { seed, sportConfig: config });
          expect(totalMinutes(plan.items), `${durationMin}min intro=${intro} seed=${seed}`).toBe(durationMin);
        }
      }
    }
  });

  it("doesn't add a water break in the last few minutes", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generatePlan({ ...baseInput, durationMin: 30 }, library, { seed, sportConfig: config });
      let t = 0;
      for (const item of plan.items) {
        if (item.kind === "water") expect(30 - t).toBeGreaterThan(7);
        t += item.minutes;
      }
    }
  });

  it("spaces water breaks out and never ends on one", () => {
    const plan = generatePlan({ ...baseInput, durationMin: 120 }, library, { seed: 3, sportConfig: config });
    const kinds = plan.items.map((i) => i.kind);
    expect(kinds.filter((k) => k === "water").length).toBeGreaterThanOrEqual(2);
    kinds.forEach((k, i) => {
      if (k === "water") expect(kinds[i + 1]).not.toBe("water");
    });
    expect(kinds.at(-2)).not.toBe("water");
  });

  it("only uses drills that fit the age, surface, coaches and equipment", () => {
    const ctx = contextFromInput(baseInput);
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = generatePlan(baseInput, library, { seed, sportConfig: config });
      for (const item of allDrillItems(plan.items)) {
        expect(rejectReason(byId.get(item.drillId!)!, ctx), item.title).toBeNull();
      }
    }
  });

  it("never needs the pitching machine in a gym without one", () => {
    const plan = generatePlan(baseInput, library, { seed: 11, sportConfig: config });
    for (const item of allDrillItems(plan.items)) expect(byId.get(item.drillId!)!.equipment).not.toContain("pitching-machine");
  });

  it("builds circuits with one coach per station and covers every selected focus", () => {
    const plan = generatePlan(baseInput, library, { seed: 5, sportConfig: config });
    const circuits = plan.items.filter((i) => i.kind === "circuit");
    expect(circuits.length).toBeGreaterThan(0);
    for (const c of circuits) {
      const coaches = c.children!.map((s) => s.coach);
      expect(new Set(coaches).size).toBe(coaches.length);
      expect(c.groups!.length).toBe(c.children!.length);
    }
    const covered = new Set(allDrillItems(plan.items).flatMap((i) => byId.get(i.drillId!)!.focus));
    for (const f of baseInput.focusSlugs) expect(covered).toContain(f);
    expect(plan.warnings.filter((w) => w.startsWith("No drill for"))).toEqual([]);
  });

  it("adds a pitcher/catcher breakout when pitching is a focus", () => {
    const plan = generatePlan({ ...baseInput, focusSlugs: ["pitching", "hitting-mechanics"] }, library, { seed: 2, sportConfig: config });
    const breakout = plan.items.find((i) => i.kind === "breakout");
    expect(breakout).toBeDefined();
    // Three coaches: pitchers, catchers and everyone else, each player in exactly one group.
    const who = breakout!.children!.flatMap((c) => c.who!.split(", "));
    expect(who.sort()).toEqual(roster.map((p) => p.name).sort());

    const two = generatePlan({ ...baseInput, coaches: ["Jake", "Trevor"], focusSlugs: ["pitching", "hitting-mechanics"] }, library, { seed: 2, sportConfig: config });
    const pairs = two.items.find((i) => i.kind === "breakout")!.children![0];
    expect(pairs.lines.some((l) => l.includes("→"))).toBe(true);
  });

  it("falls back to whole-team drills with one coach", () => {
    const plan = generatePlan({ ...baseInput, coaches: ["Jake"], surfaceSlug: "field" }, library, { seed: 4, sportConfig: config });
    expect(plan.items.some((i) => i.kind === "circuit")).toBe(false);
    expect(plan.warnings.join(" ")).toMatch(/one coach/);
    expect(totalMinutes(plan.items)).toBe(90);
  });

  it("works with only a player count (no roster)", () => {
    const plan = generatePlan({ ...baseInput, players: [], missing: [], playerCount: 12 }, library, { seed: 9, sportConfig: config });
    const circuit = plan.items.find((i) => i.kind === "circuit")!;
    expect(circuit.groups!.reduce((s, g) => s + g.size, 0)).toBe(12);
    expect(plan.teamLeader).toBe("");
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const a = generatePlan(baseInput, library, { seed: 42, sportConfig: config });
    const b = generatePlan(baseInput, library, { seed: 42, sportConfig: config });
    expect(a).toEqual(b);
    const names = (p: typeof a) => allDrillItems(p.items).map((i) => i.drillId).join("|");
    const seeds = [1, 2, 3, 4, 5].map((s) => names(generatePlan(baseInput, library, { seed: s, sportConfig: config })));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("avoids drills from recent plans when it can", () => {
    const first = generatePlan(baseInput, library, { seed: 1, sportConfig: config });
    const recent = allDrillItems(first.items).filter((i) => i.kind === "station").map((i) => i.drillId!);
    const second = generatePlan(baseInput, library, { seed: 1, sportConfig: config, recentDrillIds: recent });
    const repeated = allDrillItems(second.items).filter((i) => i.kind === "station" && recent.includes(i.drillId!));
    expect(repeated.length).toBeLessThan(recent.length);
  });

  it("uses only softball-tagged pitching drills for softball and baseball ones for baseball", () => {
    const input = { ...baseInput, focusSlugs: ["pitching"] };
    const bb = generatePlan({ ...input, sportSlug: "baseball" }, library, { seed: 3, sportConfig: config });
    for (const item of allDrillItems(bb.items)) expect(byId.get(item.drillId!)!.sports).toContain("baseball");
  });
});

describe("groups", () => {
  it("puts catchers in different groups", () => {
    for (const seed of [1, 2, 3, 4]) {
      const groups = splitGroups(roster, 3, ["catcher", "pitcher"], createRng(seed));
      const catchersPerGroup = groups.map((g) => g.players.filter((n) => roster.find((p) => p.name === n)!.roles.includes("catcher")).length);
      expect(catchersPerGroup).toEqual([1, 1, 1]);
      expect(groups.reduce((s, g) => s + g.size, 0)).toBe(roster.length);
      const sizes = groups.map((g) => g.size);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("pairs pitchers with catchers but never with themselves", () => {
    const pairs = batteryPairings(roster, "pitcher", "catcher");
    expect(pairs).toHaveLength(5);
    for (const p of pairs) {
      const [a, b] = p.split(" → ");
      expect(a).not.toBe(b);
    }
  });

  it("rotates team leader to someone who hasn't led recently", () => {
    const recent = roster.slice(0, 10).map((p) => p.name);
    expect(chooseLeader(roster, recent, createRng(1))).toBe("Sophia");
    expect(chooseLeader(roster, roster.map((p) => p.name), createRng(1))).toBe("Sophia");
  });
});

describe("displayTitles", () => {
  it("numbers circuits only when there is more than one", () => {
    const c = (id: string): PlanItem => ({ id, kind: "circuit", title: "Circuit", minutes: 10, lines: [] });
    expect(displayTitles([c("a")])).toEqual(["Circuit"]);
    expect(displayTitles([c("a"), { id: "w", kind: "water", title: "Water Break", minutes: 2, lines: [] }, c("b")])).toEqual(["Circuit #1", "Water Break", "Circuit #2"]);
  });
});
