import type { CrochetTermWithAliases } from "@/lib/crochet-terms";
import { prisma } from "@/lib/db/prisma";

export async function getAllTerms(): Promise<CrochetTermWithAliases[]> {
  const rows = await prisma.crochetTerm.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      label: true,
      description: true,
      imagePath: true,
      aliases: {
        select: {
          alias: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    imagePath: row.imagePath,
    aliases: row.aliases.map((alias) => alias.alias),
  }));
}
