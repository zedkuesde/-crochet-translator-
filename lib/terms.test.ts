import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TermError,
  collisionToTermError,
  findCollision,
  parseCreateAliases,
  parseOptionalNullableString,
  parseRequiredCode,
  parseRequiredLabel,
  parseSingleAlias,
  type NamespaceEntry,
} from "./terms";

const entries: NamespaceEntry[] = [
  { kind: "code", normalized: "ms", termId: "term-ms", termLabel: "Maille serrée" },
  { kind: "code", normalized: "aug", termId: "term-aug", termLabel: "Augmentation" },
  {
    kind: "alias",
    normalized: "m.s.",
    termId: "term-ms",
    termLabel: "Maille serrée",
    aliasId: "alias-ms-1",
  },
  {
    kind: "alias",
    normalized: "augmentation",
    termId: "term-aug",
    termLabel: "Augmentation",
    aliasId: "alias-aug-1",
  },
];

describe("parseRequiredCode", () => {
  it("normalise trim, minuscule française, NFC et espaces compactés", () => {
    assert.equal(parseRequiredCode("  MS  "), "ms");
    assert.equal(parseRequiredCode("M.S."), "m.s.");
    assert.equal(parseRequiredCode("maille   serrée"), "maille serrée");
  });

  it("distingue m.s. et ms", () => {
    assert.equal(parseRequiredCode("m.s."), "m.s.");
    assert.equal(parseRequiredCode("ms"), "ms");
    assert.notEqual(parseRequiredCode("m.s."), parseRequiredCode("ms"));
  });

  it("rejette une valeur vide", () => {
    assert.throws(() => parseRequiredCode("   "), (error: unknown) => {
      return error instanceof TermError && error.status === 400 && error.field === "code";
    });
  });
});

describe("parseRequiredLabel", () => {
  it("conserve la casse après trim", () => {
    assert.equal(parseRequiredLabel("  Maille serrée  "), "Maille serrée");
  });

  it("rejette un libellé vide", () => {
    assert.throws(() => parseRequiredLabel(" "), (error: unknown) => {
      return error instanceof TermError && error.status === 400 && error.field === "label";
    });
  });
});

describe("parseOptionalNullableString", () => {
  it("convertit une chaîne vide en null", () => {
    assert.equal(parseOptionalNullableString("   ", "description"), null);
    assert.equal(parseOptionalNullableString("", "imagePath"), null);
  });

  it("laisse undefined si le champ est omis", () => {
    assert.equal(parseOptionalNullableString(undefined, "description"), undefined);
  });

  it("accepte null explicitement", () => {
    assert.equal(parseOptionalNullableString(null, "imagePath"), null);
  });
});

describe("parseCreateAliases", () => {
  it("ignore les alias vides et détecte les doublons normalisés", () => {
    assert.throws(() => parseCreateAliases(["m.s.", "  ", "M.S."]), (error: unknown) => {
      return (
        error instanceof TermError &&
        error.status === 400 &&
        error.field === "aliases"
      );
    });
  });

  it("retourne les alias trimés", () => {
    assert.deepEqual(parseCreateAliases(["  m.s.  ", "augm"]), [
      { alias: "m.s.", aliasNormalized: "m.s." },
      { alias: "augm", aliasNormalized: "augm" },
    ]);
  });
});

describe("parseSingleAlias", () => {
  it("rejette un alias vide", () => {
    assert.throws(() => parseSingleAlias("  "), (error: unknown) => {
      return error instanceof TermError && error.status === 400 && error.field === "alias";
    });
  });
});

describe("findCollision", () => {
  it("trouve un code existant", () => {
    const hit = findCollision("ms", entries);
    assert.equal(hit?.kind, "code");
    assert.equal(hit?.termId, "term-ms");
  });

  it("ignore le code du terme édité", () => {
    assert.equal(
      findCollision("ms", entries, { ignoreTermId: "term-ms" }),
      null,
    );
  });

  it("ne ignore pas un alias du même terme", () => {
    const hit = findCollision("m.s.", entries, { ignoreTermId: "term-ms" });
    assert.equal(hit?.kind, "alias");
    assert.equal(hit?.termId, "term-ms");
  });

  it("trouve un alias d'un autre terme", () => {
    const hit = findCollision("augmentation", entries, { ignoreTermId: "term-ms" });
    assert.equal(hit?.kind, "alias");
    assert.equal(hit?.termId, "term-aug");
  });
});

describe("collisionToTermError", () => {
  it("signale un rename vers un alias du même terme en 409", () => {
    const error = collisionToTermError(
      entries[2]!,
      "code",
      "m.s.",
      "term-ms",
    );

    assert.equal(error.status, 409);
    assert.equal(error.field, "code");
    assert.match(error.message, /déjà un alias de ce terme/);
  });

  it("signale un code déjà utilisé comme alias d'un autre terme", () => {
    const error = collisionToTermError(entries[3]!, "code", "augmentation", "term-ms");
    assert.equal(error.status, 409);
    assert.match(error.message, /déjà utilisé comme alias/);
  });

  it("signale un alias identique au propre code en 400", () => {
    const error = collisionToTermError(entries[0]!, "alias", "ms", "term-ms");
    assert.equal(error.status, 400);
    assert.equal(error.field, "alias");
  });
});
