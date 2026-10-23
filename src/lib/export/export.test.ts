import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import type { PlanItem } from "../types";
import { planToDocModel } from "./docModel";
import { docToDocx } from "./docx";
import { saveGoogleDoc } from "./googleDrive";
import { docToHtml } from "./html";

const items: PlanItem[] = [
  { id: "1", kind: "block", title: "Team Warmups", minutes: 10, lines: ["Team leader: Olivia", "Missing: Vivian"] },
  { id: "2", kind: "water", title: "Water Break", minutes: 2, lines: [] },
  {
    id: "3",
    kind: "circuit",
    title: "Circuit",
    minutes: 26,
    rotateMinutes: 8,
    lines: ["Split into three even groups-rotate after 8 minutes"],
    groups: [{ name: "Group 1", players: ["Aura", "Piper"], size: 2 }],
    children: [
      { id: "4", kind: "station", title: "Wall Ball", minutes: 8, coach: "Brandon", videoUrl: "https://youtu.be/G0J-ZDZzetU?t=385", lines: ["3 sets of 20 reps"] },
    ],
  },
  { id: "5", kind: "notes", title: "Notes for next practice", minutes: 0, lines: ["Wednesday at MSE Gym 2 & cages <3"] },
];
const plan = { title: "2026 12U-Blue Softball Practice Plan 4.13.26", date: "2026-04-13", location: "MSE Gym 3", startTime: "20:00", durationMin: 60, items, showTimes: true };

describe("planToDocModel", () => {
  it("builds the header and nested outline", () => {
    const doc = planToDocModel(plan);
    expect(doc.header).toBe("Monday, April 13th, 2026, MSE Gym 3 8-9pm");
    expect(doc.nodes[0]).toMatchObject({ text: "Team Warmups", bold: true, suffix: "  (8:00, 10 min)" });
    expect(doc.nodes[2].text).toBe("Circuit");
    expect(doc.nodes[2].children.map((c) => c.text)).toEqual(["Split into three even groups-rotate after 8 minutes", "Group 1: Aura, Piper", "Wall Ball"]);
    expect(doc.nodes[2].children[2]).toMatchObject({ link: "https://youtu.be/G0J-ZDZzetU?t=385", suffix: "-Coach Brandon" });
    expect(doc.nodes[3].suffix).toBe("");
  });

  it("can hide times", () => {
    expect(planToDocModel({ ...plan, showTimes: false }).nodes[0].suffix).toBe("");
  });
});

describe("docToHtml", () => {
  it("escapes text and nests lists", () => {
    const html = docToHtml(planToDocModel(plan));
    expect(html).toContain("&amp; cages &lt;3");
    expect(html).toContain('<a href="https://youtu.be/G0J-ZDZzetU?t=385">Wall Ball</a>-Coach Brandon');
    expect(html).toContain('list-style-type:lower-alpha');
  });
});

describe("docToDocx", () => {
  it("produces a valid Word document with the plan text and links", async () => {
    const buf = await docToDocx(planToDocModel(plan));
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Monday, April 13th, 2026, MSE Gym 3 8-9pm");
    expect(xml).toContain("Wall Ball");
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain("https://youtu.be/G0J-ZDZzetU?t=385");
  });
});

describe("saveGoogleDoc", () => {
  const ok = (body: object) => new Response(JSON.stringify(body), { status: 200 });

  it("creates a Google Doc in the folder", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ id: "abc", webViewLink: "https://docs.google.com/document/d/abc" }));
    const r = await saveGoogleDoc({ accessToken: "t", name: "Plan", html: "<p>x</p>", folderId: "folder1", fetchImpl });
    expect(r).toEqual({ id: "abc", url: "https://docs.google.com/document/d/abc", folderFallback: false, updated: false });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("uploadType=multipart");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(init.body).toContain('"parents":["folder1"]');
    expect(init.body).toContain('"mimeType":"application/vnd.google-apps.document"');
  });

  it("falls back to My Drive when the folder is not accessible", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(ok({ id: "abc", webViewLink: "u" }));
    const r = await saveGoogleDoc({ accessToken: "t", name: "Plan", html: "", folderId: "folder1", fetchImpl });
    expect(r.folderFallback).toBe(true);
    expect(fetchImpl.mock.calls[1][1].body).not.toContain("parents");
  });

  it("updates the existing doc on re-save", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ id: "doc9", webViewLink: "u" }));
    const r = await saveGoogleDoc({ accessToken: "t", name: "Plan", html: "", folderId: "f", existingFileId: "doc9", fetchImpl });
    expect(r.updated).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toContain("/files/doc9?");
    expect(fetchImpl.mock.calls[0][1].method).toBe("PATCH");
  });

  it("surfaces auth errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad token", { status: 401 }));
    await expect(saveGoogleDoc({ accessToken: "t", name: "Plan", html: "", fetchImpl })).rejects.toThrow(/401/);
  });
});
