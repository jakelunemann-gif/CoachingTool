import type { SportConfig } from "../../src/lib/types";

// To add a sport: add an entry here with its own tagGroup, add its tags in
// tags.ts under that group, and add drills that list the sport's slug.

const diamondTemplate: SportConfig["template"] = {
  introMinutes: 10,
  warmupMinutes: 10,
  throwingMinutes: 10,
  dailyMinutes: 5,
  waterBreakMinutes: 2,
  waterBreakEvery: 30,
  endGameMinutes: 12,
};

const diamondLabels: SportConfig["labels"] = {
  warmup: "Team Warmups",
  throwing: "Play Catch",
  daily: "Dailies",
  endGame: "Game",
};

const diamondConfig: SportConfig = {
  roles: [
    { slug: "pitcher", label: "Pitcher" },
    { slug: "catcher", label: "Catcher" },
  ],
  spreadRoles: ["catcher", "pitcher"],
  sideWork: {
    title: "Pitcher/Catcher Side Work",
    throwerRole: "pitcher",
    receiverRole: "catcher",
    focusTriggers: ["pitching", "catching"],
  },
  template: diamondTemplate,
  labels: diamondLabels,
};

export const SPORTS: { slug: string; name: string; tagGroup: string; config: SportConfig }[] = [
  { slug: "softball", name: "Softball", tagGroup: "diamond", config: diamondConfig },
  { slug: "baseball", name: "Baseball", tagGroup: "diamond", config: diamondConfig },
];
