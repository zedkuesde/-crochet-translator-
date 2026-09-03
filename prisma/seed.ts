import { PrismaClient } from "@prisma/client";

import { normalizeTermExpression } from "../lib/crochet-terms";

const prisma = new PrismaClient();

type SeedTerm = {
  code: string;
  label: string;
  description: string;
  aliases: string[];
};

const SEED_TERMS: SeedTerm[] = [
  {
    code: "ml",
    label: "Maille en l'air",
    description:
      "Faire un jeté, puis le passer dans la boucle déjà sur le crochet. Sert surtout à commencer un ouvrage ou à monter des mailles.",
    aliases: ["m.l.", "maille en l'air", "maille en l’air", "chainette"],
  },
  {
    code: "mc",
    label: "Maille coulée",
    description:
      "Piquer dans la maille, ramener une boucle, puis la passer dans celle déjà sur le crochet. Joint ou ferme sans ajouter de hauteur.",
    aliases: ["m.c.", "maille coulee", "maille coulée"],
  },
  {
    code: "ms",
    label: "Maille serrée",
    description:
      "Piquer dans la maille suivante, ramener une boucle, faire un jeté, puis écouler les deux boucles.",
    aliases: ["m.s.", "maille serree", "maille serrée"],
  },
  {
    code: "db",
    label: "Demi-bride",
    description:
      "Plus haute qu'une maille serrée, moins qu'une bride : un jeté, piquer, ramener une boucle, puis écouler les trois boucles ensemble.",
    aliases: ["d.b.", "demi bride", "demi-bride"],
  },
  {
    code: "br",
    label: "Bride",
    description:
      "Un jeté, piquer, ramener une boucle, écouler deux boucles, puis écouler les deux suivantes.",
    aliases: ["bride"],
  },
  {
    code: "dbr",
    label: "Double bride",
    description:
      "Deux jetés au départ, puis on écoule les boucles deux par deux. Plus haute qu'une bride.",
    aliases: ["d.br.", "double bride"],
  },
  {
    code: "aug",
    label: "Augmentation",
    description:
      "Faire deux points dans la même maille, pour élargir le rang.",
    aliases: ["aug.", "augm", "augmentation"],
  },
  {
    code: "dim",
    label: "Diminution",
    description:
      "Travailler deux mailles ensemble, pour resserrer le rang.",
    aliases: ["dim.", "diminution"],
  },
];

async function seedTerm(term: SeedTerm): Promise<{
  createdTerm: boolean;
  createdAliases: number;
  skippedAliases: number;
  conflicts: number;
}> {
  const code = normalizeTermExpression(term.code);

  if (!code) {
    console.warn(`[seed] Code vide ignoré pour le label « ${term.label} ».`);
    return { createdTerm: false, createdAliases: 0, skippedAliases: 0, conflicts: 0 };
  }

  const existing = await prisma.crochetTerm.findUnique({
    where: { code },
    include: { aliases: true },
  });

  let termId: string;
  let createdTerm = false;

  if (existing) {
    termId = existing.id;
    console.log(
      `[seed] Terme « ${code} » déjà présent (id ${existing.id}) : label, description et imagePath non modifiés.`,
    );
  } else {
    const created = await prisma.crochetTerm.create({
      data: {
        code,
        label: term.label,
        description: term.description,
        imagePath: null,
      },
    });
    termId = created.id;
    createdTerm = true;
    console.log(`[seed] Terme créé : ${code} — ${term.label}`);
  }

  let createdAliases = 0;
  let skippedAliases = 0;
  let conflicts = 0;

  const ownedNormalized = new Set(
    existing?.aliases.map((alias) => alias.aliasNormalized) ?? [],
  );

  for (const rawAlias of term.aliases) {
    const aliasNormalized = normalizeTermExpression(rawAlias);

    if (!aliasNormalized) {
      skippedAliases += 1;
      continue;
    }

    if (aliasNormalized === code) {
      skippedAliases += 1;
      continue;
    }

    if (ownedNormalized.has(aliasNormalized)) {
      skippedAliases += 1;
      continue;
    }

    const otherTermWithCode = await prisma.crochetTerm.findUnique({
      where: { code: aliasNormalized },
    });

    if (otherTermWithCode && otherTermWithCode.id !== termId) {
      conflicts += 1;
      console.warn(
        `[seed] Conflit : l'alias « ${rawAlias} » (normalisé : « ${aliasNormalized} ») est déjà le code du terme « ${otherTermWithCode.code} » (id ${otherTermWithCode.id}). Alias non créé, données existantes préservées.`,
      );
      continue;
    }

    const existingAlias = await prisma.crochetTermAlias.findUnique({
      where: { aliasNormalized },
    });

    if (existingAlias) {
      if (existingAlias.termId === termId) {
        ownedNormalized.add(aliasNormalized);
        skippedAliases += 1;
        continue;
      }

      conflicts += 1;
      console.warn(
        `[seed] Conflit : l'alias « ${rawAlias} » (normalisé : « ${aliasNormalized} ») appartient déjà au terme id ${existingAlias.termId}. Alias non rattaché, données existantes préservées.`,
      );
      continue;
    }

    await prisma.crochetTermAlias.create({
      data: {
        alias: rawAlias,
        aliasNormalized,
        termId,
      },
    });
    ownedNormalized.add(aliasNormalized);
    createdAliases += 1;
    console.log(`[seed] Alias créé : « ${rawAlias} » → ${code}`);
  }

  return { createdTerm, createdAliases, skippedAliases, conflicts };
}

async function main(): Promise<void> {
  let createdTerms = 0;
  let createdAliases = 0;
  let skippedAliases = 0;
  let conflicts = 0;

  for (const term of SEED_TERMS) {
    const result = await seedTerm(term);
    if (result.createdTerm) {
      createdTerms += 1;
    }
    createdAliases += result.createdAliases;
    skippedAliases += result.skippedAliases;
    conflicts += result.conflicts;
  }

  console.log(
    `[seed] Terminé : ${createdTerms} terme(s) créé(s), ${createdAliases} alias créé(s), ${skippedAliases} alias ignoré(s) (déjà présents ou redondants avec le code), ${conflicts} conflit(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Échec :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
