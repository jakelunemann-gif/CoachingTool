import { AlignmentType, Document, ExternalHyperlink, LevelFormat, Packer, Paragraph, TextRun } from "docx";
import type { DocModel, DocNode } from "./docModel";

const FORMATS = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL];

function paragraphs(nodes: DocNode[], level: number): Paragraph[] {
  return nodes.flatMap((n) => {
    const runs: (TextRun | ExternalHyperlink)[] = [];
    const main = new TextRun({ text: n.text, bold: n.bold, style: n.link ? "Hyperlink" : undefined });
    runs.push(n.link ? new ExternalHyperlink({ link: n.link, children: [main] }) : main);
    if (n.suffix) runs.push(new TextRun({ text: n.suffix }));
    return [new Paragraph({ numbering: { reference: "plan", level: Math.min(level, 3) }, children: runs }), ...paragraphs(n.children, level + 1)];
  });
}

export async function docToDocx(doc: DocModel): Promise<Buffer> {
  const document = new Document({
    title: doc.title,
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "plan",
          levels: FORMATS.map((format, level) => ({
            level,
            format,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: doc.header, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "Practice Plan", bold: true })], spacing: { after: 200 } }),
          ...paragraphs(doc.nodes, 0),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
