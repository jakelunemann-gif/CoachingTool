import type { TagKind } from "../../src/lib/types";

export interface TagSeed {
  kind: TagKind;
  slug: string;
  label: string;
  group: string;
}

const list = (kind: TagKind, group: string, items: [string, string][]): TagSeed[] =>
  items.map(([slug, label]) => ({ kind, slug, label, group }));

export const TAGS: TagSeed[] = [
  ...list("AGE", "global", [
    ["6u", "6U"], ["8u", "8U"], ["10u", "10U"], ["12u", "12U"], ["14u", "14U"],
    ["16u", "16U"], ["18u", "18U"], ["adult", "Adult"],
  ]),
  ...list("SKILL", "global", [
    ["rec", "Rec"], ["c", "C"], ["b", "B"], ["a", "A"], ["elite", "Elite / Travel"],
  ]),
  ...list("SURFACE", "global", [
    ["gym", "Gym"], ["turf", "Indoor turf"], ["field", "Full field"],
    ["infield", "Infield only"], ["grass", "Open grass"],
  ]),
  ...list("EQUIPMENT", "global", [
    ["helmets", "Helmets"], ["cones", "Cones"], ["stopwatch", "Stopwatch"],
    ["tennis-balls", "Tennis balls"], ["hula-hoops", "Hula hoops"],
  ]),
  ...list("EQUIPMENT", "diamond", [
    ["bases", "Bases"], ["tees", "Tees"], ["bow-nets", "Bow nets / hitting nets"],
    ["i-screen", "I-screen / L-screen"], ["batting-cage", "Batting cage"],
    ["pitching-machine", "Pitching / fielding machine"], ["wiffle-balls", "Wiffle balls"],
    ["weighted-balls", "Weighted balls"], ["catchers-gear", "Catcher's gear"],
  ]),
  ...list("FOCUS", "diamond", [
    ["throwing", "Throwing"],
    ["infield", "Infield / ground balls"],
    ["outfield", "Outfield / fly balls"],
    ["first-base", "First base"],
    ["catching", "Catching"],
    ["pitching", "Pitching"],
    ["hitting-mechanics", "Hitting mechanics"],
    ["hitting-approach", "Hitting approach / timing"],
    ["bunting", "Bunting"],
    ["bunt-defense", "Bunt defense"],
    ["cutoffs", "Cutoffs & relays"],
    ["baserunning", "Baserunning & stealing"],
    ["sliding", "Sliding"],
    ["diving", "Diving"],
    ["situations", "Game situations"],
    ["team-building", "Team building & fun"],
  ]),
];
