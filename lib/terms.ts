import { Prisma, type CrochetTerm, type CrochetTermAlias } from "@prisma/client";

import { normalizeTermExpression } from "@/lib/crochet-terms";
import type { CrochetTermWithAliases } from "@/lib/crochet-terms";
import { prisma } from "@/lib/db/prisma";
import type { TermDto, TermField } from "@/lib/term-types";

export type { TermAliasDto, TermDto, TermField } from "@/lib/term-types";

export class TermError extends Error {
  readonly status: 400 | 404 | 409;
  readonly field?: TermField;

  constructor(status: 400 | 404 | 409, message: string, field?: TermField) {
    super(message);
    this.name = "TermError";
    this.status = status;
    this.field = field;
  }
}

export type NamespaceEntry = {
  kind: "code" | "alias";
  normalized: string;
  termId: string;
  termLabel: string;
  aliasId?: string;
};

export type CollisionIgnore = {
  ignoreTermId?: string;
  ignoreAliasId?: string;
};

const termWithAliasesInclude = {
  aliases: {
    orderBy: { alias: "asc" as const },
  },
} satisfies Prisma.CrochetTermInclude;

type TermWithAliases = CrochetTerm & { aliases: CrochetTermAlias[] };

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

function toDto(term: TermWithAliases): TermDto {
  return {
    id: term.id,
    code: term.code,
    label: term.label,
    description: term.description,
    imagePath: term.imagePath,
    createdAt: term.createdAt,
    updatedAt: term.updatedAt,
    aliases: term.aliases.map((alias) => ({
      id: alias.id,
      alias: alias.alias,
      aliasNormalized: alias.aliasNormalized,
    })),
  };
}

export function parseRequiredCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new TermError(400, "Le code est obligatoire.", "code");
  }

  const code = normalizeTermExpression(value);
  if (!code) {
    throw new TermError(400, "Le code est obligatoire.", "code");
  }

  return code;
}

export function parseRequiredLabel(value: unknown): string {
  if (typeof value !== "string") {
    throw new TermError(400, "Le libellé est obligatoire.", "label");
  }

  const label = value.trim();
  if (!label) {
    throw new TermError(400, "Le libellé est obligatoire.", "label");
  }

  return label;
}

export function parseOptionalNullableString(
  value: unknown,
  field: "description" | "imagePath",
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    const label = field === "description" ? "La description" : "Le chemin d’image";
    throw new TermError(400, `${label} doit être une chaîne.`, field);
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export type ParsedAlias = {
  alias: string;
  aliasNormalized: string;
};

export function parseCreateAliases(value: unknown): ParsedAlias[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new TermError(400, "Les alias doivent être une liste de chaînes.", "aliases");
  }

  const parsed: ParsedAlias[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      throw new TermError(400, "Chaque alias doit être une chaîne.", "aliases");
    }

    const alias = item.trim();
    if (!alias) {
      continue;
    }

    const aliasNormalized = normalizeTermExpression(alias);
    if (!aliasNormalized) {
      continue;
    }

    if (seen.has(aliasNormalized)) {
      throw new TermError(
        400,
        `L’alias « ${alias} » est en double dans le formulaire.`,
        "aliases",
      );
    }

    seen.add(aliasNormalized);
    parsed.push({ alias, aliasNormalized });
  }

  return parsed;
}

export function parseSingleAlias(value: unknown): ParsedAlias {
  if (typeof value !== "string") {
    throw new TermError(400, "L’alias est obligatoire.", "alias");
  }

  const alias = value.trim();
  const aliasNormalized = normalizeTermExpression(alias);

  if (!alias || !aliasNormalized) {
    throw new TermError(400, "L’alias ne peut pas être vide.", "alias");
  }

  return { alias, aliasNormalized };
}

export function findCollision(
  normalized: string,
  entries: NamespaceEntry[],
  ignore?: CollisionIgnore,
): NamespaceEntry | null {
  for (const entry of entries) {
    if (entry.normalized !== normalized) {
      continue;
    }

    if (
      ignore?.ignoreTermId &&
      entry.kind === "code" &&
      entry.termId === ignore.ignoreTermId
    ) {
      continue;
    }

    if (
      ignore?.ignoreAliasId &&
      entry.kind === "alias" &&
      entry.aliasId === ignore.ignoreAliasId
    ) {
      continue;
    }

    return entry;
  }

  return null;
}

export function collisionToTermError(
  entry: NamespaceEntry,
  role: "code" | "alias",
  expression: string,
  currentTermId?: string,
): TermError {
  if (role === "code") {
    if (entry.kind === "code") {
      return new TermError(
        409,
        `Le code « ${expression} » est déjà utilisé par un autre terme.`,
        "code",
      );
    }

    if (currentTermId && entry.termId === currentTermId) {
      return new TermError(
        409,
        `Le code « ${expression} » est déjà un alias de ce terme. Supprime cet alias avant de renommer le code.`,
        "code",
      );
    }

    return new TermError(
      409,
      `Le code « ${expression} » est déjà utilisé comme alias du terme « ${entry.termLabel} ».`,
      "code",
    );
  }

  if (entry.kind === "code") {
    if (currentTermId && entry.termId === currentTermId) {
      return new TermError(
        400,
        `L’alias « ${expression} » est identique au code de ce terme.`,
        "alias",
      );
    }

    return new TermError(
      409,
      `L’alias « ${expression} » est déjà le code du terme « ${entry.termLabel} ».`,
      "alias",
    );
  }

  if (currentTermId && entry.termId === currentTermId) {
    return new TermError(
      409,
      `L’alias « ${expression} » existe déjà pour ce terme.`,
      "alias",
    );
  }

  return new TermError(
    409,
    `L’alias « ${expression} » appartient déjà au terme « ${entry.termLabel} ».`,
    "alias",
  );
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function wrapUniqueConflict(error: unknown, field: TermField): never {
  if (isPrismaUniqueConflict(error)) {
    throw new TermError(
      409,
      field === "alias"
        ? "Cet alias est déjà utilisé."
        : "Ce code est déjà utilisé.",
      field,
    );
  }

  throw error;
}

export async function loadCollisionNamespace(
  tx: Prisma.TransactionClient,
): Promise<NamespaceEntry[]> {
  const [terms, aliases] = await Promise.all([
    tx.crochetTerm.findMany({
      select: { id: true, code: true, label: true },
    }),
    tx.crochetTermAlias.findMany({
      select: {
        id: true,
        termId: true,
        aliasNormalized: true,
        term: { select: { label: true } },
      },
    }),
  ]);

  return [
    ...terms.map((term) => ({
      kind: "code" as const,
      normalized: term.code,
      termId: term.id,
      termLabel: term.label,
    })),
    ...aliases.map((alias) => ({
      kind: "alias" as const,
      normalized: alias.aliasNormalized,
      termId: alias.termId,
      termLabel: alias.term.label,
      aliasId: alias.id,
    })),
  ];
}

async function assertExpressionAvailable(
  tx: Prisma.TransactionClient,
  normalized: string,
  role: "code" | "alias",
  ignore?: CollisionIgnore & { currentTermId?: string },
): Promise<void> {
  const collision = findCollision(normalized, await loadCollisionNamespace(tx), ignore);
  if (!collision) {
    return;
  }

  throw collisionToTermError(
    collision,
    role,
    normalized,
    ignore?.currentTermId,
  );
}

export async function listTermsForAdmin(): Promise<TermDto[]> {
  const rows = await prisma.crochetTerm.findMany({
    orderBy: { code: "asc" },
    include: termWithAliasesInclude,
  });

  return rows.map(toDto);
}

export async function getTermById(id: string): Promise<TermDto | null> {
  const term = await prisma.crochetTerm.findUnique({
    where: { id },
    include: termWithAliasesInclude,
  });

  return term ? toDto(term) : null;
}

export async function createTerm(input: {
  code?: unknown;
  label?: unknown;
  description?: unknown;
  imagePath?: unknown;
  aliases?: unknown;
}): Promise<TermDto> {
  const code = parseRequiredCode(input.code);
  const label = parseRequiredLabel(input.label);
  const description = parseOptionalNullableString(input.description, "description") ?? null;
  const imagePath = parseOptionalNullableString(input.imagePath, "imagePath") ?? null;
  const aliases = parseCreateAliases(input.aliases);

  for (const alias of aliases) {
    if (alias.aliasNormalized === code) {
      throw new TermError(
        400,
        `L’alias « ${alias.alias} » est identique au code de ce terme.`,
        "aliases",
      );
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await assertExpressionAvailable(tx, code, "code");

      for (const alias of aliases) {
        await assertExpressionAvailable(tx, alias.aliasNormalized, "alias");
      }

      const created = await tx.crochetTerm.create({
        data: {
          code,
          label,
          description,
          imagePath,
          aliases: {
            create: aliases.map((alias) => ({
              alias: alias.alias,
              aliasNormalized: alias.aliasNormalized,
            })),
          },
        },
        include: termWithAliasesInclude,
      });

      return toDto(created);
    });
  } catch (error) {
    wrapUniqueConflict(error, "code");
  }
}

export async function updateTerm(
  id: string,
  input: {
    code?: unknown;
    label?: unknown;
    description?: unknown;
    imagePath?: unknown;
  },
): Promise<TermDto> {
  const hasCode = Object.prototype.hasOwnProperty.call(input, "code");
  const hasLabel = Object.prototype.hasOwnProperty.call(input, "label");
  const hasDescription = Object.prototype.hasOwnProperty.call(input, "description");
  const hasImagePath = Object.prototype.hasOwnProperty.call(input, "imagePath");

  if (!hasCode && !hasLabel && !hasDescription && !hasImagePath) {
    throw new TermError(400, "Aucune modification n’a été envoyée.");
  }

  const code = hasCode ? parseRequiredCode(input.code) : undefined;
  const label = hasLabel ? parseRequiredLabel(input.label) : undefined;
  const description = hasDescription
    ? parseOptionalNullableString(input.description, "description")
    : undefined;
  const imagePath = hasImagePath
    ? parseOptionalNullableString(input.imagePath, "imagePath")
    : undefined;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.crochetTerm.findUnique({
        where: { id },
        include: termWithAliasesInclude,
      });

      if (!existing) {
        throw new TermError(404, "Terme introuvable.");
      }

      if (code !== undefined && code !== existing.code) {
        await assertExpressionAvailable(tx, code, "code", {
          ignoreTermId: existing.id,
          currentTermId: existing.id,
        });
      }

      const updated = await tx.crochetTerm.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(label !== undefined ? { label } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(imagePath !== undefined ? { imagePath } : {}),
        },
        include: termWithAliasesInclude,
      });

      return toDto(updated);
    });
  } catch (error) {
    if (error instanceof TermError) {
      throw error;
    }
    wrapUniqueConflict(error, "code");
  }
}

export async function deleteTerm(id: string): Promise<{ id: string; code: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.crochetTerm.findUnique({
        where: { id },
        select: { id: true, code: true },
      });

      if (!existing) {
        throw new TermError(404, "Terme introuvable.");
      }

      await tx.crochetTerm.delete({ where: { id } });
      return existing;
    });
  } catch (error) {
    if (error instanceof TermError) {
      throw error;
    }
    throw error;
  }
}

export async function addAlias(termId: string, rawAlias: unknown): Promise<TermDto> {
  const parsed = parseSingleAlias(rawAlias);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.crochetTerm.findUnique({
        where: { id: termId },
        select: { id: true, code: true },
      });

      if (!existing) {
        throw new TermError(404, "Terme introuvable.");
      }

      if (parsed.aliasNormalized === existing.code) {
        throw new TermError(
          400,
          `L’alias « ${parsed.alias} » est identique au code de ce terme.`,
          "alias",
        );
      }

      await assertExpressionAvailable(tx, parsed.aliasNormalized, "alias", {
        currentTermId: existing.id,
      });

      await tx.crochetTermAlias.create({
        data: {
          alias: parsed.alias,
          aliasNormalized: parsed.aliasNormalized,
          termId,
        },
      });

      const updated = await tx.crochetTerm.findUniqueOrThrow({
        where: { id: termId },
        include: termWithAliasesInclude,
      });

      return toDto(updated);
    });
  } catch (error) {
    if (error instanceof TermError) {
      throw error;
    }
    wrapUniqueConflict(error, "alias");
  }
}

export async function removeAlias(termId: string, aliasId: string): Promise<TermDto> {
  return prisma.$transaction(async (tx) => {
    const term = await tx.crochetTerm.findUnique({
      where: { id: termId },
      select: { id: true },
    });

    if (!term) {
      throw new TermError(404, "Terme introuvable.");
    }

    const alias = await tx.crochetTermAlias.findUnique({
      where: { id: aliasId },
      select: { id: true, termId: true },
    });

    if (!alias || alias.termId !== termId) {
      throw new TermError(404, "Alias introuvable.");
    }

    await tx.crochetTermAlias.delete({ where: { id: aliasId } });

    const updated = await tx.crochetTerm.findUniqueOrThrow({
      where: { id: termId },
      include: termWithAliasesInclude,
    });

    return toDto(updated);
  });
}

export function termErrorToJson(error: TermError): {
  error: string;
  field?: TermField;
} {
  return error.field
    ? { error: error.message, field: error.field }
    : { error: error.message };
}
