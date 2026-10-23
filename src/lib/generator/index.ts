import type {
  BlockType,
  DrillLite,
  GeneratedPlan,
  PlanInput,
  PlanItem,
  RosterPlayer,
  SportConfig,
} from "../types";
import { numberWord } from "../format";
import { contextFromInput, isEligible } from "./filter";
import { batteryPairings, chooseLeader, splitGroups } from "./groups";
import { createRng, type Rng } from "./random";
import { totalMinutes } from "./timeline";

export { totalMinutes, startOffsets, displayTitles } from "./timeline";
export { alternatives, compatibleTypes, rejectReason, contextFromInput, playerCount } from "./filter";

export interface GenerateOptions {
  seed: number;
  sportConfig: SportConfig;
  // Drill ids from the team's last few plans, to keep practices varied.
  recentDrillIds?: string[];
  // Team leaders of recent plans, most recent first.
  recentLeaders?: string[];
  focusLabels?: Record<string, string>;
}

const MAX_STATIONS = 4;
const MIN_ROTATION = 5;
const MAX_ROTATION = 12;
export const CIRCUIT_TRANSITION = 2;

/** A circuit with a new rotation length: station times, total time and the "rotate after" line all follow. */
export function withRotation(item: PlanItem, rotate: number): PlanItem {
  const count = item.children?.length ?? 0;
  return {
    ...item,
    rotateMinutes: rotate,
    minutes: rotate * count + CIRCUIT_TRANSITION,
    children: item.children?.map((c) => ({ ...c, minutes: rotate })),
    lines: item.lines.map((l, i) => (i === 0 ? l.replace(/rotate after \d+ minutes/, `rotate after ${rotate} minutes`) : l)),
  };
}

/** Turn a drill into a plan item. Used by the generator and the editor. */
export function drillToItem(drill: DrillLite, id: string, overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id,
    kind: "block",
    title: drill.name,
    minutes: drill.durationTypical,
    drillId: drill.id,
    blockType: drill.blockType,
    videoUrl: drill.videos[0]?.url,
    lines: [...drill.instructions],
    ...overrides,
  };
}

export function generatePlan(input: PlanInput, drills: DrillLite[], opts: GenerateOptions): GeneratedPlan {
  const cfg = opts.sportConfig;
  const T = cfg.template;
  const rng = createRng(opts.seed);
  const ctx = contextFromInput(input);
  const warnings: string[] = [];
  const used = new Set<string>();
  const recent = new Set(opts.recentDrillIds ?? []);
  let idCounter = 0;
  const nextId = () => `${opts.seed.toString(36)}-${++idCounter}`;

  const coaches = input.coaches.map((c) => c.trim()).filter(Boolean);
  if (coaches.length === 0) {
    warnings.push("No coaches entered, so the plan assumes one coach.");
    coaches.push("Coach");
  }
  const players = input.players;
  const P = ctx.players;
  if (P === 0) warnings.push("No players entered. Add attendance or a player count for better groups.");

  const eligible = drills.filter((d) => isEligible(d, ctx));
  const selectedFocus = new Set(input.focusSlugs);
  let focusList = input.focusSlugs.filter(Boolean);
  if (focusList.length === 0) {
    focusList = [...new Set(eligible.filter((d) => d.blockType === "STATION" || d.blockType === "TEAM").flatMap((d) => d.focus))].sort();
    if (focusList.length > 0) warnings.push("No focus areas selected, so the plan uses a balanced mix.");
  }
  if (focusList.length === 0) focusList = [""];

  const score = (d: DrillLite, focus: string, r: Rng) => {
    let s = r() * 2;
    if (focus && d.focus.includes(focus)) s += 10;
    s += 3 * d.focus.filter((f) => selectedFocus.has(f)).length;
    if (recent.has(d.id)) s -= 6;
    return s;
  };

  const pick = (
    types: BlockType[],
    focus: string,
    extra: (d: DrillLite) => boolean = () => true,
    requireFocus = false,
  ): DrillLite | undefined => {
    let best: DrillLite | undefined;
    let bestScore = -Infinity;
    for (const d of eligible) {
      if (used.has(d.id) || !types.includes(d.blockType) || !extra(d)) continue;
      if (requireFocus && focus && !d.focus.includes(focus)) continue;
      const s = score(d, focus, rng);
      if (s > bestScore) {
        best = d;
        bestScore = s;
      }
    }
    if (best) used.add(best.id);
    return best;
  };

  const teamLeader = chooseLeader(players, opts.recentLeaders ?? [], rng);

  // ---- Fixed opening blocks ------------------------------------------------
  const opening: PlanItem[] = [];
  if (input.options.intro) {
    opening.push({
      id: nextId(),
      kind: "block",
      blockType: "TALK",
      title: "Introductions",
      minutes: T.introMinutes,
      lines: ["Name, favorite thing about the game, what you like best about yourself", "Team rules and expectations"],
    });
  }

  const warmup = pick(["WARMUP"], "");
  const warmupLines = [
    ...(players.length > 0 ? [`Team leader: ${teamLeader}`] : []),
    ...(players.length > 0 || input.missing.length > 0 ? [`Missing: ${input.missing.length ? input.missing.join(", ") : "None"}`] : []),
    ...(warmup?.instructions ?? []),
  ];
  opening.push({
    ...(warmup ? drillToItem(warmup, nextId()) : { id: nextId(), kind: "block" as const, lines: [] }),
    title: cfg.labels.warmup,
    minutes: T.warmupMinutes,
    lines: warmupLines,
  });

  const throwing = pick(["THROWING"], "");
  if (throwing) {
    opening.push(drillToItem(throwing, nextId(), { title: `${cfg.labels.throwing}: ${throwing.name}`, minutes: T.throwingMinutes }));
  }

  if (input.options.dailies) {
    const daily = pick(["DAILY"], focusList[0]);
    if (daily) opening.push(drillToItem(daily, nextId(), { title: `${cfg.labels.daily}: ${daily.name}`, minutes: T.dailyMinutes }));
  }

  // ---- Closing blocks ------------------------------------------------------
  let endGame: PlanItem | undefined;
  if (input.options.endGame) {
    // Only games that fit in what's left after the opening blocks.
    const room = input.durationMin - totalMinutes(opening);
    const game = pick(["GAME"], "", (d) => d.durationMin <= room);
    if (game) {
      endGame = drillToItem(game, nextId(), {
        title: `${cfg.labels.endGame}: ${game.name}`,
        minutes: Math.max(game.durationMin, Math.min(game.durationMax, T.endGameMinutes, room)),
      });
    }
  }

  const sideWork = cfg.sideWork;
  const throwers = sideWork ? players.filter((p) => p.roles.includes(sideWork.throwerRole)) : [];
  const receivers = sideWork ? players.filter((p) => p.roles.includes(sideWork.receiverRole)) : [];
  const sideWorkWanted =
    !!sideWork &&
    input.options.sideWork &&
    sideWork.focusTriggers.some((f) => selectedFocus.has(f)) &&
    (players.length === 0 || throwers.length > 0);

  // ---- Main body -----------------------------------------------------------
  const waterCount = Math.max(0, Math.floor((input.durationMin - 1) / T.waterBreakEvery));
  const budget = input.durationMin - totalMinutes(opening) - (endGame?.minutes ?? 0) - waterCount * T.waterBreakMinutes;
  if (budget < 10) warnings.push("The practice is short for everything selected. Consider turning off dailies or the intro.");

  const maxStations = Math.min(coaches.length, MAX_STATIONS, Math.floor(P / 2));
  const circuitOK = maxStations >= 2;
  if (coaches.length === 1) warnings.push("With one coach, the plan uses whole-team drills instead of circuits.");
  else if (!circuitOK) warnings.push("Not enough players to split into circuit groups.");

  const main: PlanItem[] = [];
  let focusIndex = 0;
  const nextFocus = (offset = 0) => focusList[(focusIndex + offset) % focusList.length];

  // Focus areas a circuit couldn't serve with a station; team drills take these first.
  const pendingFocus: string[] = [];

  const buildCircuit = (remaining: number): PlanItem | null => {
    const stations: DrillLite[] = [];
    const groupSize = Math.floor(P / maxStations);
    const fits = (x: DrillLite) => x.coachesRequired <= 1 && x.minPlayers <= Math.max(1, groupSize);
    const unserved: string[] = [];
    for (let k = 0; k < maxStations; k++) {
      const f = nextFocus(k);
      const d = pick(["STATION"], f, fits, true);
      if (d) stations.push(d);
      else if (f) unserved.push(f);
    }
    while (stations.length < maxStations) {
      const d = pick(["STATION"], "", fits);
      if (!d) break;
      stations.push(d);
    }
    const release = () => stations.forEach((s) => used.delete(s.id));
    if (stations.length < 2) {
      release();
      return null;
    }
    const count = stations.length;
    const typical = [...stations.map((s) => s.durationTypical)].sort((a, b) => a - b)[Math.floor(count / 2)];
    const rotate = Math.min(MAX_ROTATION, Math.max(MIN_ROTATION, typical), Math.floor((remaining - CIRCUIT_TRANSITION) / count));
    if (rotate < MIN_ROTATION) {
      release();
      return null;
    }
    focusIndex += maxStations;
    unserved.forEach((f) => !pendingFocus.includes(f) && pendingFocus.push(f));
    // Seeded by group count so every circuit with the same count reuses the same groups.
    const groups = splitGroups(players, count, cfg.spreadRoles, createRng(opts.seed + count), P);
    return {
      id: nextId(),
      kind: "circuit",
      title: "Circuit",
      minutes: rotate * count + CIRCUIT_TRANSITION,
      rotateMinutes: rotate,
      lines: [`Split into ${numberWord(count)} even groups-rotate after ${rotate} minutes`],
      groups,
      children: stations.map((s, k) => drillToItem(s, nextId(), { kind: "station", minutes: rotate, coach: coaches[k] })),
    };
  };

  const buildTeamDrill = (remaining: number, requireFocus: boolean): PlanItem | null => {
    const fromPending = pendingFocus.length > 0;
    const focus = fromPending ? pendingFocus[0] : nextFocus();
    const d = pick(["TEAM"], focus, (x) => x.durationMin <= remaining, requireFocus);
    if (!d) {
      if (fromPending && requireFocus) pendingFocus.shift();
      return null;
    }
    if (fromPending) pendingFocus.shift();
    else focusIndex += 1;
    return drillToItem(d, nextId(), { minutes: Math.min(d.durationTypical, remaining) });
  };

  const buildBreakout = (remaining: number): PlanItem | null => {
    if (!sideWork) return null;
    const minutes = Math.min(15, remaining);
    const side = pick(["SIDE_WORK"], sideWork.focusTriggers[0]);
    if (!side) return null;
    // The breakout covers pitching/catching, so circuits don't need to.
    for (const f of sideWork.focusTriggers) if (pendingFocus.includes(f)) pendingFocus.splice(pendingFocus.indexOf(f), 1);
    const names = (list: RosterPlayer[], fallback: string) => (list.length ? list.map((p) => p.name).join(", ") : fallback);
    const specialists = new Set([...throwers, ...receivers]);
    const others = players.filter((p) => !specialists.has(p));
    const children: PlanItem[] = [];

    if (coaches.length >= 3) {
      // Pitchers and catchers work separately; players with both roles go to the smaller group.
      const pitchersOnly = throwers.filter((p) => !receivers.includes(p));
      const catchersOnly = receivers.filter((p) => !throwers.includes(p));
      for (const p of throwers.filter((t) => receivers.includes(t))) {
        (catchersOnly.length < pitchersOnly.length ? catchersOnly : pitchersOnly).push(p);
      }
      const order = pitchersOnly.length ? [`Order: ${names(pitchersOnly, "")}`] : [];
      children.push(drillToItem(side, nextId(), { kind: "station", minutes, coach: coaches[0], who: names(pitchersOnly, "Pitchers"), lines: [...side.instructions, ...order] }));
      const catcherDrill = pick(
        ["STATION", "SIDE_WORK"],
        sideWork.focusTriggers[1] ?? "catching",
        (x) => x.coachesRequired <= 1 && !x.focus.includes(sideWork.focusTriggers[0]),
        true,
      );
      if (catcherDrill) children.push(drillToItem(catcherDrill, nextId(), { kind: "station", minutes, coach: coaches[1], who: names(catchersOnly, "Catchers") }));
    } else {
      const pairs = players.length > 0 ? batteryPairings(players, sideWork.throwerRole, sideWork.receiverRole) : ["Pair each pitcher with a catcher"];
      children.push(drillToItem(side, nextId(), { kind: "station", minutes, coach: coaches[0], who: `${names(throwers, "Pitchers")} / ${names(receivers, "Catchers")}`, lines: [...side.instructions, ...pairs] }));
    }
    const rest = pick(["STATION"], nextFocus(), (x) => x.coachesRequired <= 1);
    if (rest) {
      focusIndex += 1;
      children.push(drillToItem(rest, nextId(), { kind: "station", minutes, coach: coaches[children.length], who: players.length ? names(others, "Everyone else") : "Everyone else" }));
    }
    return { id: nextId(), kind: "breakout", title: "Position Breakout", minutes, lines: ["Groups stay at their station for the whole block"], children };
  };

  let remaining = budget;
  let breakoutDone = !sideWorkWanted || coaches.length < 2;
  let lastKind = "";
  let misses = 0;
  for (let guard = 0; remaining >= 8 && guard < 24; guard++) {
    let seg: PlanItem | null = null;
    if (!breakoutDone && main.length >= 1 && remaining >= 12) {
      seg = buildBreakout(remaining);
      breakoutDone = true;
    }
    if (!seg && circuitOK && lastKind !== "circuit") seg = buildCircuit(remaining);
    if (!seg) seg = buildTeamDrill(remaining, true);
    if (!seg && circuitOK) seg = buildCircuit(remaining);
    if (!seg) seg = buildTeamDrill(remaining, false);
    if (!seg) {
      focusIndex += 1;
      if (++misses > focusList.length) break;
      continue;
    }
    misses = 0;
    main.push(seg);
    lastKind = seg.kind;
    remaining -= seg.minutes;
  }

  if (sideWorkWanted && coaches.length < 2) {
    main.push({
      id: nextId(),
      kind: "block",
      blockType: "SIDE_WORK",
      title: `If still time remains: ${sideWork!.title}`,
      minutes: 0,
      lines: players.length > 0 ? batteryPairings(players, sideWork!.throwerRole, sideWork!.receiverRole) : ["Pair each pitcher with a catcher"],
    });
  }

  // ---- Assemble, add water breaks, and fit to the practice length ----------
  const body: PlanItem[] = [...opening, ...main, ...(endGame ? [endGame] : [])];
  const items = insertWaterBreaks(body, input.durationMin, T.waterBreakEvery, T.waterBreakMinutes, nextId);
  fitToDuration(items, input.durationMin, endGame?.id, eligible, nextId);

  items.push({
    id: nextId(),
    kind: "notes",
    title: "Notes for next practice",
    minutes: 0,
    lines: input.notes.split("\n").map((l) => l.trim()).filter(Boolean),
  });

  // Report focus areas the library couldn't cover.
  const covered = new Set<string>();
  const drillById = new Map(drills.map((d) => [d.id, d]));
  const visit = (it: PlanItem) => {
    if (it.drillId) drillById.get(it.drillId)?.focus.forEach((f) => covered.add(f));
    it.children?.forEach(visit);
  };
  items.forEach(visit);
  for (const f of input.focusSlugs) {
    if (!covered.has(f)) {
      const label = opts.focusLabels?.[f] ?? f;
      warnings.push(`No drill for "${label}" fits this age, surface, coaches and equipment. Add one in the Drill Library or adjust the setup.`);
    }
  }

  return { items, teamLeader, warnings, seed: opts.seed };
}

function insertWaterBreaks(items: PlanItem[], duration: number, every: number, minutes: number, nextId: () => string): PlanItem[] {
  const out: PlanItem[] = [];
  const tolerance = 7;
  let elapsed = 0;
  let nextAt = every;
  items.forEach((item, i) => {
    out.push(item);
    elapsed += item.minutes;
    const isLast = i === items.length - 1;
    // No break when the practice is nearly over (or shorter than one interval).
    if (!isLast && elapsed >= nextAt - tolerance && elapsed < duration - tolerance) {
      out.push({ id: nextId(), kind: "water", title: "Water Break", minutes, lines: [] });
      elapsed += minutes;
      nextAt = elapsed + every;
    }
  });
  return out;
}

/** Stretch or trim blocks so the plan adds up to the practice length. */
function fitToDuration(items: PlanItem[], duration: number, endGameId: string | undefined, eligible: DrillLite[], nextId: () => string) {
  const maxFor = new Map(eligible.map((d) => [d.id, d.durationMax]));
  const minFor = new Map(eligible.map((d) => [d.id, d.durationMin]));
  let diff = duration - totalMinutes(items);

  // Grow in order of preference: team drills, the end game, breakouts, and
  // only then longer circuit rotations.
  const game = items.find((i) => i.id === endGameId);
  const phases: ((item: PlanItem) => number)[] = [
    (i) => (i.kind === "block" && i.drillId && i.blockType === "TEAM" && i.minutes < (maxFor.get(i.drillId) ?? i.minutes) ? 1 : 0),
    (i) => (i === game && i.drillId && i.minutes < (maxFor.get(i.drillId) ?? i.minutes) ? 1 : 0),
    (i) => (i.kind === "breakout" && i.minutes < 20 ? 1 : 0),
    (i) => (i.kind === "circuit" && i.children && i.rotateMinutes! < MAX_ROTATION ? i.children.length : 0),
  ];
  for (const step of phases) {
    for (let pass = 0; diff > 0 && pass < 30; pass++) {
      let grew = false;
      for (const item of items) {
        const n = step(item);
        if (n === 0 || n > diff) continue;
        grow(item, n);
        diff -= n;
        grew = true;
        if (diff <= 0) break;
      }
      if (!grew) break;
    }
  }

  if (diff > 0) {
    const room = game?.drillId ? (maxFor.get(game.drillId) ?? game.minutes) - game.minutes : 0;
    if (game && (room >= diff || diff < 5)) {
      game.minutes += diff;
      diff = 0;
    } else {
      const at = game ? items.indexOf(game) : items.length;
      items.splice(at, 0, { id: nextId(), kind: "block", blockType: "TEAM", title: "Coaches Choice: If Time Allows", minutes: diff, lines: [] });
      diff = 0;
    }
  }

  // Over time: trim the end game, then the longest main blocks.
  for (let pass = 0; diff < 0 && pass < 60; pass++) {
    const candidates = items
      .filter((i) => (i.kind === "block" || i.kind === "breakout") && i.minutes > (i.drillId ? (minFor.get(i.drillId) ?? 5) : 5))
      .sort((a, b) => (a.id === endGameId ? -1 : b.id === endGameId ? 1 : b.minutes - a.minutes));
    const circuit = items.find((i) => i.kind === "circuit" && i.rotateMinutes! > MIN_ROTATION);
    if (candidates[0]) {
      candidates[0].minutes -= 1;
      candidates[0].children?.forEach((c) => (c.minutes = candidates[0].minutes));
      diff += 1;
    } else if (circuit) {
      Object.assign(circuit, withRotation(circuit, circuit.rotateMinutes! - 1));
      diff += circuit.children!.length;
    } else break;
  }
}

function grow(item: PlanItem, n: number) {
  if (item.kind === "circuit" && item.children) {
    Object.assign(item, withRotation(item, item.rotateMinutes! + 1));
  } else {
    item.minutes += n;
    item.children?.forEach((c) => (c.minutes = item.minutes));
  }
}
