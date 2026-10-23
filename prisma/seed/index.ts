import { PrismaClient } from "@prisma/client";
import { DRILLS } from "./drills";
import { SPORTS } from "./sports";
import { TAGS } from "./tags";

const prisma = new PrismaClient();

// Safe to re-run: sports and tags are upserted, and drills are only added
// when no drill with that name exists, so coach edits are never overwritten.
async function main() {
  const sportIds = new Map<string, string>();
  for (const s of SPORTS) {
    const sport = await prisma.sport.upsert({
      where: { slug: s.slug },
      update: { name: s.name, tagGroup: s.tagGroup, config: s.config as object },
      create: { slug: s.slug, name: s.name, tagGroup: s.tagGroup, config: s.config as object },
    });
    sportIds.set(s.slug, sport.id);
  }

  const tagIds = new Map<string, string>();
  for (const [i, t] of TAGS.entries()) {
    const tag = await prisma.tag.upsert({
      where: { kind_slug_group: { kind: t.kind, slug: t.slug, group: t.group } },
      update: { label: t.label, sortOrder: i },
      create: { ...t, sortOrder: i },
    });
    tagIds.set(`${t.kind}:${t.slug}`, tag.id);
  }
  const tagRef = (kind: string, slug: string) => {
    const id = tagIds.get(`${kind}:${slug}`);
    if (!id) throw new Error(`Unknown ${kind} tag "${slug}"`);
    return { id };
  };

  let created = 0;
  for (const d of DRILLS) {
    if (await prisma.drill.findFirst({ where: { name: d.name } })) continue;
    const sports = d.sports ?? ["softball", "baseball"];
    await prisma.drill.create({
      data: {
        name: d.name,
        blockType: d.block,
        description: d.description,
        instructions: d.instructions.join("\n"),
        durationMin: d.dur[0],
        durationTypical: d.dur[1],
        durationMax: d.dur[2],
        coachesRequired: d.coaches ?? 1,
        minPlayers: d.minPlayers ?? 1,
        maxPlayers: d.maxPlayers ?? null,
        source: d.source ?? "",
        sports: { connect: sports.map((slug) => ({ id: sportIds.get(slug)! })) },
        tags: {
          connect: [
            ...d.focus.map((s) => tagRef("FOCUS", s)),
            ...(d.ages ?? []).map((s) => tagRef("AGE", s)),
            ...(d.surfaces ?? []).map((s) => tagRef("SURFACE", s)),
            ...(d.equipment ?? []).map((s) => tagRef("EQUIPMENT", s)),
          ],
        },
        videos: { create: (d.videos ?? []).map((v, i) => ({ url: v.url, label: v.label ?? "", sortOrder: i })) },
      },
    });
    created += 1;
  }

  await prisma.setting.upsert({ where: { key: "defaultSport" }, update: {}, create: { key: "defaultSport", value: "softball" } });
  await prisma.setting.upsert({
    where: { key: "driveFolderId" },
    update: {},
    create: { key: "driveFolderId", value: "1XUYXzoKOljxwZoVy6q9YKO-kI-QymTMy" },
  });

  console.log(`Seeded ${SPORTS.length} sports, ${TAGS.length} tags, ${created} new drills (${DRILLS.length} in seed file).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
