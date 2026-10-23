import { clockAt, planHeader } from "../format";
import { displayTitles, startOffsets } from "../generator/timeline";
import type { PlanGroup, PlanItem } from "../types";

// One outline model feeds every export (print, .docx, Google Docs) so they
// all match the coach's numbered-outline format.

export interface DocNode {
  text: string;
  bold?: boolean;
  link?: string;
  // Unlinked, unbolded text after `text`, e.g. "-Coach Trevor" or a time.
  suffix?: string;
  children: DocNode[];
}

export interface DocModel {
  title: string;
  header: string;
  nodes: DocNode[];
}

export interface PlanForDoc {
  title: string;
  date: string;
  location: string;
  startTime: string;
  durationMin: number;
  items: PlanItem[];
  showTimes: boolean;
}

const leaf = (text: string): DocNode => ({ text, children: [] });

/** "Group 1: Aura, Piper", or "Group 1 (4 players)" when there is no roster. */
export const groupLine = (g: PlanGroup): string => (g.players.length ? `${g.name}: ${g.players.join(", ")}` : `${g.name} (${g.size} players)`);

function stationNode(s: PlanItem): DocNode {
  const coach = s.coach ? `-Coach ${s.coach}` : "";
  const who = s.who ? ` (${s.who})` : "";
  return { text: s.title, link: s.videoUrl, suffix: `${coach}${who}`, children: s.lines.map(leaf) };
}

export function planToDocModel(plan: PlanForDoc): DocModel {
  const titles = displayTitles(plan.items);
  const offsets = startOffsets(plan.items);
  const nodes = plan.items.map((item, i): DocNode => {
    const time = plan.showTimes && item.minutes > 0 ? `  (${clockAt(plan.startTime, offsets[i])}, ${item.minutes} min)` : "";
    const children: DocNode[] = item.lines.map(leaf);
    if (item.groups?.length) {
      for (const g of item.groups) children.push(leaf(groupLine(g)));
    }
    item.children?.forEach((s) => children.push(stationNode(s)));
    return { text: titles[i], bold: true, link: item.videoUrl, suffix: time, children };
  });
  return { title: plan.title, header: planHeader(plan.date, plan.location, plan.startTime, plan.durationMin), nodes };
}
