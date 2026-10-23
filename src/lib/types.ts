// Shared domain types. These are plain data so they can cross the
// server/client boundary and be unit-tested without a database.

export const BLOCK_TYPES = [
  "WARMUP",
  "THROWING",
  "DAILY",
  "STATION",
  "SIDE_WORK",
  "TEAM",
  "GAME",
  "TALK",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  WARMUP: "Warmup",
  THROWING: "Throwing / Play Catch",
  DAILY: "Daily (every practice)",
  STATION: "Circuit station",
  SIDE_WORK: "Position side work",
  TEAM: "Whole-team drill",
  GAME: "Game",
  TALK: "Talk / Meeting",
};

export const TAG_KINDS = ["AGE", "SKILL", "FOCUS", "SURFACE", "EQUIPMENT"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export interface TagLite {
  id: string;
  kind: TagKind;
  slug: string;
  label: string;
  sortOrder: number;
}

export interface SportRole {
  slug: string;
  label: string;
}

export interface SportConfig {
  roles: SportRole[];
  // Roles spread across circuit groups so every group has one (e.g. catchers).
  spreadRoles: string[];
  sideWork?: {
    title: string;
    throwerRole: string;
    receiverRole: string;
    // Side work is added when any of these focus slugs is selected.
    focusTriggers: string[];
  };
  template: {
    introMinutes: number;
    warmupMinutes: number;
    throwingMinutes: number;
    dailyMinutes: number;
    waterBreakMinutes: number;
    waterBreakEvery: number;
    endGameMinutes: number;
  };
  labels: {
    warmup: string;
    throwing: string;
    daily: string;
    endGame: string;
  };
}

export interface DrillVideoLite {
  url: string;
  label: string;
}

export interface DrillLite {
  id: string;
  name: string;
  blockType: BlockType;
  description: string;
  instructions: string[];
  durationMin: number;
  durationTypical: number;
  durationMax: number;
  coachesRequired: number;
  minPlayers: number;
  maxPlayers: number | null;
  source: string;
  sports: string[]; // sport slugs
  ages: string[];
  skills: string[];
  focus: string[];
  surfaces: string[];
  equipment: string[];
  videos: DrillVideoLite[];
}

export interface RosterPlayer {
  id?: string;
  name: string;
  roles: string[];
}

export interface PlanOptions {
  intro: boolean;
  dailies: boolean;
  sideWork: boolean;
  endGame: boolean;
}

export interface PlanInput {
  sportSlug: string;
  teamId?: string;
  teamName: string;
  ageSlug: string;
  skillSlug: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMin: number;
  location: string;
  surfaceSlug: string;
  equipmentSlugs: string[];
  focusSlugs: string[];
  coaches: string[];
  // Players attending (from the roster). Empty when only a count is known.
  players: RosterPlayer[];
  missing: string[];
  playerCount: number;
  options: PlanOptions;
  notes: string;
}

export type PlanItemKind =
  | "block" // single drill or text block
  | "circuit" // rotating stations; children are stations
  | "breakout" // groups split by role, no rotation; children are stations
  | "station"
  | "water"
  | "notes";

export interface PlanGroup {
  name: string;
  players: string[];
  size: number;
}

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  title: string;
  minutes: number;
  drillId?: string;
  blockType?: BlockType;
  coach?: string;
  videoUrl?: string;
  // Sub-bullets shown under the title.
  lines: string[];
  // Circuit-only: rotation length and player groups.
  rotateMinutes?: number;
  groups?: PlanGroup[];
  // Station-only (breakouts): who is at this station.
  who?: string;
  children?: PlanItem[];
}

export interface GeneratedPlan {
  items: PlanItem[];
  teamLeader: string;
  warnings: string[];
  seed: number;
}

export interface SportBundle {
  id: string;
  slug: string;
  name: string;
  config: SportConfig;
  tags: Record<TagKind, TagLite[]>;
}

export interface TeamWithPlayers {
  id: string;
  name: string;
  sportSlug: string;
  ageSlug: string;
  skillSlug: string;
  season: string;
  players: { id: string; name: string; roles: string[]; active: boolean }[];
}
