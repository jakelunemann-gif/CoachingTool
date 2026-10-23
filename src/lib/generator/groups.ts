import type { PlanGroup, RosterPlayer } from "../types";
import { shuffle, type Rng } from "./random";

/**
 * Split players into `count` even groups. Players holding a spread role
 * (e.g. catchers) are dealt out first so each group gets one where possible.
 */
export function splitGroups(
  players: RosterPlayer[],
  count: number,
  spreadRoles: string[],
  rng: Rng,
  fallbackCount = 0,
): PlanGroup[] {
  const groups: PlanGroup[] = Array.from({ length: count }, (_, i) => ({ name: `Group ${i + 1}`, players: [], size: 0 }));
  if (count <= 0) return [];

  if (players.length === 0) {
    // No roster: just report group sizes.
    for (let i = 0; i < fallbackCount; i++) groups[i % count].size += 1;
    return groups;
  }

  const placed = new Set<RosterPlayer>();
  for (const role of spreadRoles) {
    const roleCounts = new Array(count).fill(0);
    const withRole = shuffle(players.filter((p) => !placed.has(p) && p.roles.includes(role)), rng);
    for (const p of withRole) {
      let best = 0;
      for (let g = 1; g < count; g++) {
        if (roleCounts[g] < roleCounts[best] || (roleCounts[g] === roleCounts[best] && groups[g].size < groups[best].size)) best = g;
      }
      roleCounts[best] += 1;
      groups[best].players.push(p.name);
      groups[best].size += 1;
      placed.add(p);
    }
  }

  for (const p of shuffle(players.filter((p) => !placed.has(p)), rng)) {
    let best = 0;
    for (let g = 1; g < count; g++) if (groups[g].size < groups[best].size) best = g;
    groups[best].players.push(p.name);
    groups[best].size += 1;
  }
  return groups;
}

/** "Avery V → Aura" pairings, never pairing a player with themself. */
export function batteryPairings(players: RosterPlayer[], throwerRole: string, receiverRole: string): string[] {
  const throwers = players.filter((p) => p.roles.includes(throwerRole));
  const receivers = players.filter((p) => p.roles.includes(receiverRole));
  if (receivers.length === 0) return throwers.map((t) => `${t.name} → Coach`);
  return throwers.map((t, i) => {
    for (let k = 0; k < receivers.length; k++) {
      const r = receivers[(i + k) % receivers.length];
      if (r.name !== t.name) return `${t.name} → ${r.name}`;
    }
    return `${t.name} → Coach`;
  });
}

/** Rotate the team leader: someone who hasn't led recently. */
export function chooseLeader(players: RosterPlayer[], recentLeaders: string[], rng: Rng): string {
  if (players.length === 0) return "";
  const names = players.map((p) => p.name);
  const fresh = names.filter((n) => !recentLeaders.includes(n));
  if (fresh.length > 0) return shuffle(fresh, rng)[0];
  // Everyone has led: pick the one who led longest ago.
  return [...names].sort((a, b) => recentLeaders.indexOf(b) - recentLeaders.indexOf(a))[0];
}
