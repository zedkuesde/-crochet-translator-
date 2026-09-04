import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  IMPORT_FORMAT,
  IMPORT_VERSION,
  MAX_ALIASES_PER_TERM,
  MAX_ALIAS_LENGTH,
  MAX_CODE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_HTTP_BODY_BYTES,
  MAX_IMAGE_PATH_LENGTH,
  MAX_JSON_TEXT_BYTES,
  MAX_LABEL_LENGTH,
  MAX_TERMS,
  ROOT_KEYS,
  TERM_KEYS,
} from "@/lib/terms-import-constants";
import { prisma } from "@/lib/db/prisma";
import { normalizeTermExpression } from "@/lib/crochet-terms";
import {
  findCollision,
  loadCollisionNamespace,
  parseOptionalNullableString,
  parseRequiredCode,
  parseRequiredLabel,
  TermError,
  type NamespaceEntry,
  type ParsedAlias,
} from "@/lib/terms";

export type ImportErrorCode =
  | "invalid_json"
  | "invalid_document"
  | "payload_changed"
  | "catalog_changed"
  | "conflicts";

export type ValidationIssue = {
  path: string;
  message: string;
};

export class ImportError extends Error {
  readonly status: 400 | 409;
  readonly code: ImportErrorCode;
  readonly issues?: ValidationIssue[];
  readonly summary?: ImportSummary;
  readonly terms?: TermPreview[];

  constructor(
    status: 400 | 409,
    code: ImportErrorCode,
    message: string,
    options?: {
      issues?: ValidationIssue[];
      summary?: ImportSummary;
      terms?: TermPreview[];
    },
  ) {
    super(message);
    this.name = "ImportError";
    this.status = status;
    this.code = code;
    this.issues = options?.issues;
    this.summary = options?.summary;
    this.terms = options?.terms;
  }
}

export type ImportSummary = {
  newTerms: number;
  unchangedTerms: number;
  aliasesToCreate: number;
  aliasesAlreadyPresent: number;
  redundantAliases: number;
  conflicts: number;
  validationErrors: number;
};

export type AliasPreviewAction =
  | "create"
  | "already_present"
  | "redundant"
  | "conflict"
  | "skipped";

export type TermPreviewAction = "create" | "keep" | "conflict";

export type AliasPreview = {
  alias: string;
  aliasNormalized: string;
  action: AliasPreviewAction;
  message: string | null;
};

export type TermPreview = {
  index: number;
  code: string;
  label: string;
  description: string | null;
  imagePath: string | null;
  termAction: TermPreviewAction;
  messages: string[];
  aliases: AliasPreview[];
};

export type PreviewSuccess = {
  ok: true;
  canCommit: boolean;
  payloadHash: string;
  catalogFingerprint: string;
  summary: ImportSummary;
  terms: TermPreview[];
};

export type CommitSuccess = {
  ok: true;
  createdTerms: number;
  createdAliases: number;
  unchangedTerms: number;
};

export type ParsedImportTerm = {
  code: string;
  label: string;
  description: string | null;
  imagePath: string | null;
  aliases: ParsedAlias[];
};

type TermPlan = TermPreview & {
  existingTermId?: string;
};

type ImportPlan = {
  canCommit: boolean;
  summary: ImportSummary;
  terms: TermPlan[];
};

const ROOT_KEY_SET = new Set<string>(ROOT_KEYS);
const TERM_KEY_SET = new Set<string>(TERM_KEYS);

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function payloadHash(jsonText: string): string {
  return sha256(stripBom(jsonText));
}

export function catalogFingerprint(namespace: NamespaceEntry[]): string {
  const lines = namespace.map((entry) => {
    if (entry.kind === "code") {
      return `code\t${entry.normalized}\t${entry.termId}`;
    }

    return `alias\t${entry.normalized}\t${entry.termId}\t${entry.aliasId ?? ""}`;
  });

  lines.sort((a, b) => a.localeCompare(b));
  return sha256(lines.join("\n"));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unexpectedKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      issues.push({
        path: path ? `${path}.${key}` : key,
        message: `Champ non autorisé « ${key} ».`,
      });
      continue;
    }

    if (!allowed.has(key)) {
      issues.push({
        path: path ? `${path}.${key}` : key,
        message: `Champ non autorisé « ${key} ».`,
      });
    }
  }

  return issues;
}

function tooLong(
  value: string,
  max: number,
  path: string,
  label: string,
): ValidationIssue | null {
  if (value.length <= max) {
    return null;
  }

  return {
    path,
    message: `${label} ne doit pas dépasser ${max} caractères.`,
  };
}

function parseAliasList(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ParsedAlias[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push({
      path,
      message: "Les alias doivent être une liste de chaînes.",
    });
    return [];
  }

  if (value.length > MAX_ALIASES_PER_TERM) {
    issues.push({
      path,
      message: `Un terme ne peut pas avoir plus de ${MAX_ALIASES_PER_TERM} alias.`,
    });
    return [];
  }

  const parsed: ParsedAlias[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}[${index}]`;
    const item = value[index];

    if (typeof item !== "string") {
      issues.push({
        path: itemPath,
        message: "Chaque alias doit être une chaîne.",
      });
      continue;
    }

    const alias = item.trim();
    const aliasNormalized = normalizeTermExpression(item);

    if (!alias || !aliasNormalized) {
      issues.push({
        path: itemPath,
        message: "L’alias ne peut pas être vide.",
      });
      continue;
    }

    const lengthIssue = tooLong(
      alias,
      MAX_ALIAS_LENGTH,
      itemPath,
      "L’alias",
    );
    if (lengthIssue) {
      issues.push(lengthIssue);
      continue;
    }

    if (aliasNormalized.length > MAX_ALIAS_LENGTH) {
      issues.push({
        path: itemPath,
        message: `L’alias ne doit pas dépasser ${MAX_ALIAS_LENGTH} caractères.`,
      });
      continue;
    }

    if (seen.has(aliasNormalized)) {
      issues.push({
        path: itemPath,
        message: `L’alias « ${alias} » est en double après normalisation.`,
      });
      continue;
    }

    seen.add(aliasNormalized);
    parsed.push({ alias, aliasNormalized });
  }

  return parsed;
}

function parseTermObject(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ParsedImportTerm | null {
  if (!isPlainObject(value)) {
    issues.push({
      path,
      message: "Chaque terme doit être un objet.",
    });
    return null;
  }

  issues.push(...unexpectedKeys(value, TERM_KEY_SET, path));

  let code: string | null = null;
  let label: string | null = null;

  try {
    code = parseRequiredCode(value.code);
    const lengthIssue = tooLong(code, MAX_CODE_LENGTH, `${path}.code`, "Le code");
    if (lengthIssue) {
      issues.push(lengthIssue);
      code = null;
    }
  } catch (error) {
    issues.push({
      path: `${path}.code`,
      message:
        error instanceof TermError
          ? error.message
          : "Le code est obligatoire.",
    });
  }

  try {
    label = parseRequiredLabel(value.label);
    const lengthIssue = tooLong(
      label,
      MAX_LABEL_LENGTH,
      `${path}.label`,
      "Le libellé",
    );
    if (lengthIssue) {
      issues.push(lengthIssue);
      label = null;
    }
  } catch (error) {
    issues.push({
      path: `${path}.label`,
      message:
        error instanceof TermError
          ? error.message
          : "Le libellé est obligatoire.",
    });
  }

  let description: string | null = null;
  let imagePath: string | null = null;

  try {
    const parsed = parseOptionalNullableString(value.description, "description");
    description = parsed === undefined ? null : parsed;
    if (description) {
      const lengthIssue = tooLong(
        description,
        MAX_DESCRIPTION_LENGTH,
        `${path}.description`,
        "La description",
      );
      if (lengthIssue) {
        issues.push(lengthIssue);
        description = null;
      }
    }
  } catch (error) {
    issues.push({
      path: `${path}.description`,
      message:
        error instanceof TermError
          ? error.message
          : "La description doit être une chaîne ou null.",
    });
  }

  try {
    const parsed = parseOptionalNullableString(value.imagePath, "imagePath");
    imagePath = parsed === undefined ? null : parsed;
    if (imagePath) {
      const lengthIssue = tooLong(
        imagePath,
        MAX_IMAGE_PATH_LENGTH,
        `${path}.imagePath`,
        "Le chemin d’image",
      );
      if (lengthIssue) {
        issues.push(lengthIssue);
        imagePath = null;
      }
    }
  } catch (error) {
    issues.push({
      path: `${path}.imagePath`,
      message:
        error instanceof TermError
          ? error.message
          : "Le chemin d’image doit être une chaîne ou null.",
    });
  }

  const aliases = parseAliasList(value.aliases, `${path}.aliases`, issues);

  if (code === null || label === null) {
    return null;
  }

  return { code, label, description, imagePath, aliases };
}

export function parseImportDocument(value: unknown): ParsedImportTerm[] {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(value)) {
    throw new ImportError(
      400,
      "invalid_document",
      "Le JSON doit être un objet racine.",
      {
        issues: [
          {
            path: "",
            message: "Le JSON doit être un objet racine.",
          },
        ],
      },
    );
  }

  issues.push(...unexpectedKeys(value, ROOT_KEY_SET, ""));

  if (value.format !== IMPORT_FORMAT) {
    issues.push({
      path: "format",
      message: `Le champ format doit valoir « ${IMPORT_FORMAT} ».`,
    });
  }

  if (value.version !== IMPORT_VERSION || !Number.isInteger(value.version)) {
    issues.push({
      path: "version",
      message: "Le champ version doit valoir le nombre 1.",
    });
  }

  if (!Array.isArray(value.terms)) {
    issues.push({
      path: "terms",
      message: "Le champ terms doit être un tableau.",
    });
  } else if (value.terms.length === 0) {
    issues.push({
      path: "terms",
      message: "Le tableau terms doit contenir au moins un terme.",
    });
  } else if (value.terms.length > MAX_TERMS) {
    issues.push({
      path: "terms",
      message: `Le tableau terms ne peut pas contenir plus de ${MAX_TERMS} termes.`,
    });
  } else {
    const terms: ParsedImportTerm[] = [];
    const codeIndexes = new Map<string, number>();

    for (let index = 0; index < value.terms.length; index += 1) {
      const parsed = parseTermObject(
        value.terms[index],
        `terms[${index}]`,
        issues,
      );

      if (!parsed) {
        continue;
      }

      const firstIndex = codeIndexes.get(parsed.code);
      if (firstIndex !== undefined) {
        issues.push({
          path: `terms[${index}].code`,
          message: `Le code « ${parsed.code} » est déjà utilisé par terms[${firstIndex}].`,
        });
        continue;
      }

      codeIndexes.set(parsed.code, index);
      terms.push(parsed);
    }

    if (issues.length > 0) {
      throw new ImportError(
        400,
        "invalid_document",
        "Le fichier JSON n’est pas valide.",
        { issues },
      );
    }

    return terms;
  }

  throw new ImportError(
    400,
    "invalid_document",
    "Le fichier JSON n’est pas valide.",
    { issues },
  );
}

export function parseImportJsonText(jsonText: string): ParsedImportTerm[] {
  if (Buffer.byteLength(jsonText, "utf8") > MAX_JSON_TEXT_BYTES) {
    throw new ImportError(
      400,
      "invalid_document",
      "Le JSON dépasse la taille maximale de 1 Mo.",
      {
        issues: [
          {
            path: "",
            message: "Le JSON dépasse la taille maximale de 1 Mo.",
          },
        ],
      },
    );
  }

  const prepared = stripBom(jsonText);
  let value: unknown;

  try {
    value = JSON.parse(prepared);
  } catch {
    throw new ImportError(400, "invalid_json", "JSON invalide.");
  }

  return parseImportDocument(value);
}

export type ImportEnvelope = {
  jsonText: string;
  payloadHash?: string;
  catalogFingerprint?: string;
};

export function parseImportEnvelope(rawBody: string): ImportEnvelope {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_HTTP_BODY_BYTES) {
    throw new ImportError(
      400,
      "invalid_json",
      "Le contenu envoyé dépasse la taille maximale autorisée.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ImportError(400, "invalid_json", "JSON invalide.");
  }

  if (!isPlainObject(parsed)) {
    throw new ImportError(400, "invalid_json", "JSON invalide.");
  }

  if (typeof parsed.jsonText !== "string") {
    throw new ImportError(
      400,
      "invalid_json",
      "Le champ jsonText (chaîne) est obligatoire.",
    );
  }

  const envelope: ImportEnvelope = { jsonText: parsed.jsonText };

  if (parsed.payloadHash !== undefined) {
    if (typeof parsed.payloadHash !== "string") {
      throw new ImportError(
        400,
        "invalid_json",
        "Le champ payloadHash doit être une chaîne.",
      );
    }
    envelope.payloadHash = parsed.payloadHash;
  }

  if (parsed.catalogFingerprint !== undefined) {
    if (typeof parsed.catalogFingerprint !== "string") {
      throw new ImportError(
        400,
        "invalid_json",
        "Le champ catalogFingerprint doit être une chaîne.",
      );
    }
    envelope.catalogFingerprint = parsed.catalogFingerprint;
  }

  return envelope;
}

function toPreviewTerm(term: TermPlan): TermPreview {
  return {
    index: term.index,
    code: term.code,
    label: term.label,
    description: term.description,
    imagePath: term.imagePath,
    termAction: term.termAction,
    messages: term.messages,
    aliases: term.aliases,
  };
}

export function planImport(
  terms: ParsedImportTerm[],
  namespace: NamespaceEntry[],
): ImportPlan {
  const working: NamespaceEntry[] = [...namespace];
  const planned: TermPlan[] = [];

  for (let index = 0; index < terms.length; index += 1) {
    const term = terms[index];
    if (!term) {
      continue;
    }

    const collision = findCollision(term.code, working);
    const messages: string[] = [];
    let termAction: TermPreviewAction;
    let existingTermId: string | undefined;
    let currentTermId: string;

    if (!collision) {
      termAction = "create";
      currentTermId = `__import__${index}`;
      working.push({
        kind: "code",
        normalized: term.code,
        termId: currentTermId,
        termLabel: term.label,
      });
    } else if (collision.kind === "code") {
      termAction = "keep";
      existingTermId = collision.termId;
      currentTermId = collision.termId;
      messages.push(
        "Terme déjà présent : label, description et imagePath ne seront pas modifiés.",
      );
    } else {
      termAction = "conflict";
      currentTermId = `__import__${index}`;
      messages.push(
        `Le code « ${term.code} » est déjà utilisé comme alias du terme « ${collision.termLabel} ».`,
      );
    }

    const aliases: AliasPreview[] = [];

    if (termAction === "conflict") {
      for (const alias of term.aliases) {
        aliases.push({
          alias: alias.alias,
          aliasNormalized: alias.aliasNormalized,
          action: "skipped",
          message: "Alias non traité : le terme est en conflit.",
        });
      }
    } else {
      for (const alias of term.aliases) {
        if (alias.aliasNormalized === term.code) {
          aliases.push({
            alias: alias.alias,
            aliasNormalized: alias.aliasNormalized,
            action: "redundant",
            message: `L’alias « ${alias.alias} » est identique au code de ce terme.`,
          });
          continue;
        }

        const hit = findCollision(alias.aliasNormalized, working);

        if (!hit) {
          aliases.push({
            alias: alias.alias,
            aliasNormalized: alias.aliasNormalized,
            action: "create",
            message: null,
          });
          working.push({
            kind: "alias",
            normalized: alias.aliasNormalized,
            termId: currentTermId,
            termLabel: term.label,
            aliasId: `__import_alias__${index}__${alias.aliasNormalized}`,
          });
          continue;
        }

        if (hit.kind === "alias" && hit.termId === currentTermId) {
          aliases.push({
            alias: alias.alias,
            aliasNormalized: alias.aliasNormalized,
            action: "already_present",
            message: `L’alias « ${alias.alias} » est déjà lié à ce terme.`,
          });
          continue;
        }

        if (hit.kind === "code" && hit.termId === currentTermId) {
          aliases.push({
            alias: alias.alias,
            aliasNormalized: alias.aliasNormalized,
            action: "redundant",
            message: `L’alias « ${alias.alias} » est identique au code de ce terme.`,
          });
          continue;
        }

        if (hit.kind === "code") {
          aliases.push({
            alias: alias.alias,
            aliasNormalized: alias.aliasNormalized,
            action: "conflict",
            message: `L’alias « ${alias.alias} » est déjà le code du terme « ${hit.termLabel} ».`,
          });
          continue;
        }

        aliases.push({
          alias: alias.alias,
          aliasNormalized: alias.aliasNormalized,
          action: "conflict",
          message: `L’alias « ${alias.alias} » appartient déjà au terme « ${hit.termLabel} ».`,
        });
      }
    }

    planned.push({
      index,
      code: term.code,
      label: term.label,
      description: term.description,
      imagePath: term.imagePath,
      termAction,
      existingTermId,
      messages,
      aliases,
    });
  }

  const summary: ImportSummary = {
    newTerms: 0,
    unchangedTerms: 0,
    aliasesToCreate: 0,
    aliasesAlreadyPresent: 0,
    redundantAliases: 0,
    conflicts: 0,
    validationErrors: 0,
  };

  for (const term of planned) {
    if (term.termAction === "create") {
      summary.newTerms += 1;
    } else if (term.termAction === "keep") {
      summary.unchangedTerms += 1;
    } else {
      summary.conflicts += 1;
    }

    for (const alias of term.aliases) {
      if (alias.action === "create") {
        summary.aliasesToCreate += 1;
      } else if (alias.action === "already_present") {
        summary.aliasesAlreadyPresent += 1;
      } else if (alias.action === "redundant") {
        summary.redundantAliases += 1;
      } else if (alias.action === "conflict") {
        summary.conflicts += 1;
      }
    }
  }

  return {
    canCommit: summary.conflicts === 0,
    summary,
    terms: planned,
  };
}

export function previewImport(
  jsonText: string,
  namespace: NamespaceEntry[],
): PreviewSuccess {
  const terms = parseImportJsonText(jsonText);
  const plan = planImport(terms, namespace);

  return {
    ok: true,
    canCommit: plan.canCommit,
    payloadHash: payloadHash(jsonText),
    catalogFingerprint: catalogFingerprint(namespace),
    summary: plan.summary,
    terms: plan.terms.map(toPreviewTerm),
  };
}

export async function previewImportWithDb(
  jsonText: string,
  db: PrismaClient = prisma,
): Promise<PreviewSuccess> {
  parseImportJsonText(jsonText);

  return db.$transaction(async (tx) => {
    const namespace = await loadCollisionNamespace(tx);
    return previewImport(jsonText, namespace);
  });
}

async function applyImportPlan(
  tx: Prisma.TransactionClient,
  plan: ImportPlan,
): Promise<CommitSuccess> {
  const termIdByIndex = new Map<number, string>();

  for (const term of plan.terms) {
    if (term.termAction === "keep") {
      if (!term.existingTermId) {
        throw new Error("Terme existant sans identifiant.");
      }
      termIdByIndex.set(term.index, term.existingTermId);
      continue;
    }

    if (term.termAction !== "create") {
      continue;
    }

    const created = await tx.crochetTerm.create({
      data: {
        code: term.code,
        label: term.label,
        description: term.description,
        imagePath: term.imagePath,
      },
    });
    termIdByIndex.set(term.index, created.id);
  }

  for (const term of plan.terms) {
    if (term.termAction === "conflict") {
      continue;
    }

    const termId = termIdByIndex.get(term.index);
    if (!termId) {
      continue;
    }

    const aliasesToCreate = term.aliases.filter(
      (alias) => alias.action === "create",
    );

    if (aliasesToCreate.length === 0) {
      continue;
    }

    await tx.crochetTermAlias.createMany({
      data: aliasesToCreate.map((alias) => ({
        alias: alias.alias,
        aliasNormalized: alias.aliasNormalized,
        termId,
      })),
    });
  }

  return {
    ok: true,
    createdTerms: plan.summary.newTerms,
    createdAliases: plan.summary.aliasesToCreate,
    unchangedTerms: plan.summary.unchangedTerms,
  };
}

export async function commitImport(
  input: {
    jsonText: string;
    payloadHash: string;
    catalogFingerprint: string;
  },
  db: PrismaClient = prisma,
): Promise<CommitSuccess> {
  const terms = parseImportJsonText(input.jsonText);

  if (payloadHash(input.jsonText) !== input.payloadHash) {
    throw new ImportError(
      400,
      "payload_changed",
      "Le JSON a changé depuis l’aperçu. Relancez la prévisualisation.",
    );
  }

  try {
    return await db.$transaction(async (tx) => {
      const namespace = await loadCollisionNamespace(tx);
      const currentFingerprint = catalogFingerprint(namespace);

      if (currentFingerprint !== input.catalogFingerprint) {
        throw new ImportError(
          409,
          "catalog_changed",
          "Le dictionnaire a changé depuis l’aperçu. Relancez la prévisualisation.",
        );
      }

      const plan = planImport(terms, namespace);

      if (!plan.canCommit) {
        throw new ImportError(
          409,
          "conflicts",
          "L’import contient des conflits. Aucune donnée n’a été écrite.",
          {
            summary: plan.summary,
            terms: plan.terms.map(toPreviewTerm),
          },
        );
      }

      return applyImportPlan(tx, plan);
    });
  } catch (error) {
    if (error instanceof ImportError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ImportError(
        409,
        "catalog_changed",
        "Le dictionnaire a changé depuis l’aperçu. Relancez la prévisualisation.",
      );
    }

    throw error;
  }
}

export function importErrorToJson(error: ImportError): {
  ok: false;
  code: ImportErrorCode;
  error: string;
  issues?: ValidationIssue[];
  summary?: ImportSummary;
  terms?: TermPreview[];
} {
  return {
    ok: false,
    code: error.code,
    error: error.message,
    ...(error.issues ? { issues: error.issues } : {}),
    ...(error.summary ? { summary: error.summary } : {}),
    ...(error.terms ? { terms: error.terms } : {}),
  };
}
