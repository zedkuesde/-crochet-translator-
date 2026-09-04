import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_ALIAS_LENGTH,
  MAX_ALIASES_PER_TERM,
  MAX_CODE_LENGTH,
  MAX_JSON_TEXT_BYTES,
  MAX_TERMS,
} from "./terms-import-constants";
import {
  ImportError,
  catalogFingerprint,
  parseImportDocument,
  parseImportEnvelope,
  parseImportJsonText,
  payloadHash,
  planImport,
  previewImport,
  type ParsedImportTerm,
} from "./terms-import";
import type { NamespaceEntry } from "./terms";

function sampleDoc(terms: unknown[] = [sampleTerm()]): string {
  return JSON.stringify({
    format: "crochet-translator-terms",
    version: 1,
    terms,
  });
}

function sampleTerm(overrides: Record<string, unknown> = {}) {
  return {
    code: "cm",
    label: "Cercle magique",
    description: "Boucle ajustable pour démarrer un ouvrage en rond.",
    imagePath: null,
    aliases: ["cercle magique", "anneau magique"],
    ...overrides,
  };
}

const emptyNamespace: NamespaceEntry[] = [];

const seededNamespace: NamespaceEntry[] = [
  {
    kind: "code",
    normalized: "ms",
    termId: "term-ms",
    termLabel: "Maille serrée",
  },
  {
    kind: "alias",
    normalized: "m.s.",
    termId: "term-ms",
    termLabel: "Maille serrée",
    aliasId: "alias-ms-1",
  },
  {
    kind: "code",
    normalized: "aug",
    termId: "term-aug",
    termLabel: "Augmentation",
  },
];

function parsed(overrides: Partial<ParsedImportTerm> = {}): ParsedImportTerm {
  return {
    code: "cm",
    label: "Cercle magique",
    description: "Boucle ajustable.",
    imagePath: null,
    aliases: [
      { alias: "cercle magique", aliasNormalized: "cercle magique" },
      { alias: "anneau magique", aliasNormalized: "anneau magique" },
    ],
    ...overrides,
  };
}

describe("parseImportJsonText", () => {
  it("accepte un document V1 valide", () => {
    const terms = parseImportJsonText(sampleDoc());
    assert.equal(terms.length, 1);
    assert.equal(terms[0]?.code, "cm");
    assert.equal(terms[0]?.label, "Cercle magique");
    assert.equal(terms[0]?.aliases.length, 2);
  });

  it("retire le BOM UTF-8 avant de parser", () => {
    const terms = parseImportJsonText(`\uFEFF${sampleDoc()}`);
    assert.equal(terms[0]?.code, "cm");
  });

  it("normalise le code", () => {
    const terms = parseImportJsonText(sampleDoc([sampleTerm({ code: "  CM  " })]));
    assert.equal(terms[0]?.code, "cm");
  });

  it("rejette un JSON syntaxiquement invalide", () => {
    assert.throws(
      () => parseImportJsonText("{"),
      (error: unknown) =>
        error instanceof ImportError &&
        error.status === 400 &&
        error.code === "invalid_json",
    );
  });

  it("rejette une racine non objet", () => {
    assert.throws(
      () => parseImportJsonText("[]"),
      (error: unknown) =>
        error instanceof ImportError && error.code === "invalid_document",
    );
    assert.throws(
      () => parseImportJsonText('"hello"'),
      (error: unknown) =>
        error instanceof ImportError && error.code === "invalid_document",
    );
  });

  it("rejette un mauvais format", () => {
    const json = JSON.stringify({
      format: "other",
      version: 1,
      terms: [sampleTerm()],
    });
    assert.throws(
      () => parseImportJsonText(json),
      (error: unknown) => {
        return (
          error instanceof ImportError &&
          error.code === "invalid_document" &&
          error.issues?.some((issue) => issue.path === "format") === true
        );
      },
    );
  });

  it("rejette une mauvaise version, y compris la chaîne « 1 »", () => {
    for (const version of ["1", 2, 1.5, null]) {
      const json = JSON.stringify({
        format: "crochet-translator-terms",
        version,
        terms: [sampleTerm()],
      });
      assert.throws(
        () => parseImportJsonText(json),
        (error: unknown) =>
          error instanceof ImportError &&
          error.issues?.some((issue) => issue.path === "version") === true,
      );
    }
  });

  it("rejette terms vide, trop grand ou du mauvais type", () => {
    assert.throws(
      () =>
        parseImportJsonText(
          JSON.stringify({
            format: "crochet-translator-terms",
            version: 1,
            terms: [],
          }),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms") === true,
    );

    assert.throws(
      () =>
        parseImportJsonText(
          JSON.stringify({
            format: "crochet-translator-terms",
            version: 1,
            terms: {},
          }),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms") === true,
    );

    const tooMany = Array.from({ length: MAX_TERMS + 1 }, (_, index) =>
      sampleTerm({ code: `c${index}`, label: `L${index}`, aliases: [] }),
    );
    assert.throws(
      () => parseImportJsonText(sampleDoc(tooMany)),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.message.includes(String(MAX_TERMS)),
        ) === true,
    );
  });

  it("rejette les champs obligatoires manquants ou du mauvais type", () => {
    assert.throws(
      () => parseImportJsonText(sampleDoc([sampleTerm({ code: 1 })])),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms[0].code") === true,
    );
    assert.throws(
      () => parseImportJsonText(sampleDoc([{ label: "Sans code" }])),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms[0].code") === true,
    );
    assert.throws(
      () => parseImportJsonText(sampleDoc([sampleTerm({ label: "" })])),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms[0].label") === true,
    );
  });

  it("rejette les champs supplémentaires", () => {
    assert.throws(
      () =>
        parseImportJsonText(
          JSON.stringify({
            format: "crochet-translator-terms",
            version: 1,
            extra: true,
            terms: [sampleTerm()],
          }),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "extra") === true,
    );
    assert.throws(
      () => parseImportJsonText(sampleDoc([sampleTerm({ lable: "typo" })])),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms[0].lable") === true,
    );
  });

  it("rejette un alias vide ou dupliqué après normalisation", () => {
    assert.throws(
      () => parseImportJsonText(sampleDoc([sampleTerm({ aliases: [""] })])),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.path.startsWith("terms[0].aliases"),
        ) === true,
    );
    assert.throws(
      () =>
        parseImportJsonText(
          sampleDoc([sampleTerm({ aliases: ["Anneau magique", "anneau   magique"] })]),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.message.includes("en double"),
        ) === true,
    );
  });

  it("rejette trop d’alias sur un terme", () => {
    const aliases = Array.from({ length: MAX_ALIASES_PER_TERM + 1 }, (_, i) => `a${i}`);
    assert.throws(
      () => parseImportJsonText(sampleDoc([sampleTerm({ aliases })])),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.message.includes(String(MAX_ALIASES_PER_TERM)),
        ) === true,
    );
  });

  it("rejette un code trop long", () => {
    assert.throws(
      () =>
        parseImportJsonText(
          sampleDoc([sampleTerm({ code: "c".repeat(MAX_CODE_LENGTH + 1), aliases: [] })]),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) => issue.path === "terms[0].code") === true,
    );
  });

  it("rejette un alias trop long", () => {
    assert.throws(
      () =>
        parseImportJsonText(
          sampleDoc([
            sampleTerm({ aliases: ["a".repeat(MAX_ALIAS_LENGTH + 1)] }),
          ]),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.path.startsWith("terms[0].aliases"),
        ) === true,
    );
  });

  it("rejette les codes dupliqués dans le fichier", () => {
    assert.throws(
      () =>
        parseImportJsonText(
          sampleDoc([
            sampleTerm({ code: "cm", aliases: [] }),
            sampleTerm({ code: "CM", label: "Autre", aliases: [] }),
          ]),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.path === "terms[1].code",
        ) === true,
    );
  });

  it("accepte aliases omis, description omise et imagePath chaîne vide", () => {
    const terms = parseImportJsonText(
      sampleDoc([
        {
          code: "ml",
          label: "Maille en l'air",
          imagePath: "  ",
        },
      ]),
    );
    assert.equal(terms[0]?.description, null);
    assert.equal(terms[0]?.imagePath, null);
    assert.deepEqual(terms[0]?.aliases, []);
  });

  it("rejette un JSON brut trop volumineux", () => {
    const oversized = " ".repeat(MAX_JSON_TEXT_BYTES + 1);
    assert.throws(
      () => parseImportJsonText(oversized),
      (error: unknown) =>
        error instanceof ImportError &&
        error.code === "invalid_document" &&
        error.message.includes("1 Mo"),
    );
  });

  it("rejette un tableau d’alias contenant un objet", () => {
    assert.throws(
      () =>
        parseImportJsonText(
          sampleDoc([sampleTerm({ aliases: [{ alias: "x" }] })]),
        ),
      (error: unknown) =>
        error instanceof ImportError &&
        error.issues?.some((issue) =>
          issue.message.includes("chaîne"),
        ) === true,
    );
  });
});

describe("parseImportDocument", () => {
  it("accepte le document déjà parsé", () => {
    const terms = parseImportDocument({
      format: "crochet-translator-terms",
      version: 1,
      terms: [sampleTerm({ aliases: [] })],
    });
    assert.equal(terms[0]?.code, "cm");
  });
});

describe("parseImportEnvelope", () => {
  it("extrait jsonText", () => {
    const envelope = parseImportEnvelope(
      JSON.stringify({ jsonText: sampleDoc() }),
    );
    assert.equal(typeof envelope.jsonText, "string");
    assert.equal(envelope.payloadHash, undefined);
  });

  it("extrait les hashes de commit", () => {
    const envelope = parseImportEnvelope(
      JSON.stringify({
        jsonText: "{}",
        payloadHash: "abc",
        catalogFingerprint: "def",
      }),
    );
    assert.equal(envelope.payloadHash, "abc");
    assert.equal(envelope.catalogFingerprint, "def");
  });

  it("rejette un corps JSON invalide", () => {
    assert.throws(
      () => parseImportEnvelope("not-json"),
      (error: unknown) =>
        error instanceof ImportError && error.code === "invalid_json",
    );
  });

  it("rejette l’absence de jsonText", () => {
    assert.throws(
      () => parseImportEnvelope(JSON.stringify({ payloadHash: "x" })),
      (error: unknown) =>
        error instanceof ImportError && error.code === "invalid_json",
    );
  });
});

describe("payloadHash et catalogFingerprint", () => {
  it("produit le même hash avec ou sans BOM", () => {
    const json = sampleDoc();
    assert.equal(payloadHash(json), payloadHash(`\uFEFF${json}`));
  });

  it("change si le JSON change", () => {
    assert.notEqual(payloadHash(sampleDoc()), payloadHash(sampleDoc([sampleTerm({ label: "Autre" })])));
  });

  it("sérialise codes et alias de façon canonique, sans label", () => {
    const a: NamespaceEntry[] = [
      {
        kind: "alias",
        normalized: "m.s.",
        termId: "term-ms",
        termLabel: "Maille serrée",
        aliasId: "alias-1",
      },
      {
        kind: "code",
        normalized: "ms",
        termId: "term-ms",
        termLabel: "Maille serrée",
      },
    ];
    const b: NamespaceEntry[] = [
      {
        kind: "code",
        normalized: "ms",
        termId: "term-ms",
        termLabel: "Libellé modifié",
      },
      {
        kind: "alias",
        normalized: "m.s.",
        termId: "term-ms",
        termLabel: "Libellé modifié",
        aliasId: "alias-1",
      },
    ];
    assert.equal(catalogFingerprint(a), catalogFingerprint(b));
  });

  it("change si un alias est ajouté au namespace", () => {
    const base = catalogFingerprint(seededNamespace);
    const extended = catalogFingerprint([
      ...seededNamespace,
      {
        kind: "alias",
        normalized: "maille serrée",
        termId: "term-ms",
        termLabel: "Maille serrée",
        aliasId: "alias-ms-2",
      },
    ]);
    assert.notEqual(base, extended);
  });
});

describe("planImport", () => {
  it("crée un terme nouveau et ses alias", () => {
    const plan = planImport([parsed()], emptyNamespace);
    assert.equal(plan.canCommit, true);
    assert.equal(plan.summary.newTerms, 1);
    assert.equal(plan.summary.aliasesToCreate, 2);
    assert.equal(plan.terms[0]?.termAction, "create");
  });

  it("laisse un terme existant inchangé et ajoute seulement les alias nouveaux", () => {
    const namespace: NamespaceEntry[] = [
      {
        kind: "code",
        normalized: "cm",
        termId: "term-cm",
        termLabel: "Ancien label",
      },
      {
        kind: "alias",
        normalized: "cercle magique",
        termId: "term-cm",
        termLabel: "Ancien label",
        aliasId: "alias-cm-1",
      },
    ];
    const plan = planImport(
      [
        parsed({
          label: "Nouveau label",
          description: "Nouvelle description",
          imagePath: "/stitches/cm.webp",
        }),
      ],
      namespace,
    );
    assert.equal(plan.canCommit, true);
    assert.equal(plan.terms[0]?.termAction, "keep");
    assert.equal(plan.summary.unchangedTerms, 1);
    assert.equal(plan.summary.newTerms, 0);
    assert.equal(plan.summary.aliasesAlreadyPresent, 1);
    assert.equal(plan.summary.aliasesToCreate, 1);
    assert.equal(
      plan.terms[0]?.aliases.find((alias) => alias.aliasNormalized === "anneau magique")
        ?.action,
      "create",
    );
  });

  it("marque un alias égal au propre code comme redondant, non bloquant", () => {
    const plan = planImport(
      [
        parsed({
          aliases: [{ alias: "CM", aliasNormalized: "cm" }],
        }),
      ],
      emptyNamespace,
    );
    assert.equal(plan.canCommit, true);
    assert.equal(plan.terms[0]?.aliases[0]?.action, "redundant");
    assert.equal(plan.summary.redundantAliases, 1);
    assert.equal(plan.summary.conflicts, 0);
  });

  it("signale un conflit si le code est déjà un alias d’un autre terme", () => {
    const plan = planImport(
      [parsed({ code: "m.s.", aliases: [{ alias: "ms point", aliasNormalized: "ms point" }] })],
      seededNamespace,
    );
    assert.equal(plan.canCommit, false);
    assert.equal(plan.terms[0]?.termAction, "conflict");
    assert.equal(plan.terms[0]?.aliases[0]?.action, "skipped");
    assert.ok(plan.summary.conflicts >= 1);
  });

  it("signale un conflit si un alias est déjà le code d’un autre terme", () => {
    const plan = planImport(
      [
        parsed({
          aliases: [{ alias: "MS", aliasNormalized: "ms" }],
        }),
      ],
      seededNamespace,
    );
    assert.equal(plan.canCommit, false);
    assert.equal(plan.terms[0]?.aliases[0]?.action, "conflict");
  });

  it("signale un conflit si un alias appartient à un autre terme", () => {
    const plan = planImport(
      [
        parsed({
          aliases: [{ alias: "m.s.", aliasNormalized: "m.s." }],
        }),
      ],
      seededNamespace,
    );
    assert.equal(plan.canCommit, false);
    assert.equal(plan.terms[0]?.aliases[0]?.action, "conflict");
    assert.match(plan.terms[0]?.aliases[0]?.message ?? "", /appartient déjà/);
  });

  it("ignore un alias déjà lié au même terme (idempotence)", () => {
    const plan = planImport(
      [
        parsed({
          code: "ms",
          label: "Maille serrée",
          aliases: [{ alias: "m.s.", aliasNormalized: "m.s." }],
        }),
      ],
      seededNamespace,
    );
    assert.equal(plan.canCommit, true);
    assert.equal(plan.terms[0]?.termAction, "keep");
    assert.equal(plan.terms[0]?.aliases[0]?.action, "already_present");
    assert.equal(plan.summary.aliasesToCreate, 0);
  });

  it("détecte un conflit intra-fichier alias puis code", () => {
    const plan = planImport(
      [
        parsed({
          code: "cm",
          aliases: [{ alias: "magic", aliasNormalized: "magic" }],
        }),
        parsed({
          code: "magic",
          label: "Magic ring",
          aliases: [],
        }),
      ],
      emptyNamespace,
    );
    assert.equal(plan.canCommit, false);
    assert.equal(plan.terms[1]?.termAction, "conflict");
  });

  it("détecte un conflit intra-fichier si deux termes visent le même alias", () => {
    const plan = planImport(
      [
        parsed({
          code: "cm",
          aliases: [{ alias: "ring", aliasNormalized: "ring" }],
        }),
        parsed({
          code: "mr",
          label: "Magic ring",
          aliases: [{ alias: "ring", aliasNormalized: "ring" }],
        }),
      ],
      emptyNamespace,
    );
    assert.equal(plan.canCommit, false);
    assert.equal(plan.terms[1]?.aliases[0]?.action, "conflict");
  });

  it("un re-import identique n’a rien à créer", () => {
    const first = planImport([parsed()], emptyNamespace);
    const afterImport: NamespaceEntry[] = [
      {
        kind: "code",
        normalized: "cm",
        termId: "term-cm",
        termLabel: "Cercle magique",
      },
      {
        kind: "alias",
        normalized: "cercle magique",
        termId: "term-cm",
        termLabel: "Cercle magique",
        aliasId: "a1",
      },
      {
        kind: "alias",
        normalized: "anneau magique",
        termId: "term-cm",
        termLabel: "Cercle magique",
        aliasId: "a2",
      },
    ];
    const second = planImport([parsed()], afterImport);
    assert.equal(first.canCommit, true);
    assert.equal(second.canCommit, true);
    assert.equal(second.summary.newTerms, 0);
    assert.equal(second.summary.aliasesToCreate, 0);
    assert.equal(second.summary.aliasesAlreadyPresent, 2);
  });
});

describe("previewImport", () => {
  it("retourne canCommit true sans conflit", () => {
    const preview = previewImport(sampleDoc(), emptyNamespace);
    assert.equal(preview.ok, true);
    assert.equal(preview.canCommit, true);
    assert.equal(preview.payloadHash, payloadHash(sampleDoc()));
    assert.equal(preview.catalogFingerprint, catalogFingerprint(emptyNamespace));
    assert.equal(preview.summary.newTerms, 1);
  });

  it("retourne canCommit false en cas de conflit, sans être une erreur de validation", () => {
    const json = sampleDoc([sampleTerm({ code: "m.s.", aliases: [] })]);
    const preview = previewImport(json, seededNamespace);
    assert.equal(preview.ok, true);
    assert.equal(preview.canCommit, false);
    assert.ok(preview.summary.conflicts >= 1);
  });

  it("ne produit pas d’aperçu si le JSON est invalide", () => {
    assert.throws(
      () => previewImport("{", emptyNamespace),
      (error: unknown) =>
        error instanceof ImportError && error.code === "invalid_json",
    );
  });
});
