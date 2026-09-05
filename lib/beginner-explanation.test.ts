import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBeginnerExplanation,
  POSITION_QUALIFIER_NOTE,
  toBeginnerExplanationCopy,
  UNSUPPORTED_EXPLANATION_NOTE,
  type BeginnerExplanation,
  type BeginnerExplanationCopy,
  type ExplainedAction,
} from "./beginner-explanation";
import type { CrochetTermWithAliases } from "./crochet-terms";

const terms: CrochetTermWithAliases[] = [
  {
    id: "ms",
    code: "ms",
    label: "Maille serrée",
    description: "Piquer dans la maille suivante.",
    imagePath: null,
    aliases: ["m.s.", "maille serree", "maille serrée"],
  },
  {
    id: "aug",
    code: "aug",
    label: "Augmentation",
    description: "Deux points dans la même maille.",
    imagePath: null,
    aliases: ["aug.", "augm", "augmentation"],
  },
  {
    id: "mc",
    code: "mc",
    label: "Maille coulée",
    description: null,
    imagePath: null,
    aliases: ["m.c.", "maille coulee", "maille coulée"],
  },
  {
    id: "dim",
    code: "dim",
    label: "Diminution",
    description: null,
    imagePath: null,
    aliases: ["dim.", "diminution"],
  },
];

function assertExplained(
  result: BeginnerExplanation,
): asserts result is Extract<BeginnerExplanation, { kind: "explained" }> {
  assert.equal(result.kind, "explained");
}

function allSteps(
  result: Extract<BeginnerExplanation, { kind: "explained" }>,
): ExplainedAction[] {
  return result.parts.flatMap((part) => part.steps);
}

function repeatCountOf(
  result: Extract<BeginnerExplanation, { kind: "explained" }>,
): number | undefined {
  const part = result.parts.find((candidate) => candidate.kind === "repeat");
  return part?.kind === "repeat" ? part.count : undefined;
}

function untilEndOf(
  result: Extract<BeginnerExplanation, { kind: "explained" }>,
): "rang" | "tour" | undefined {
  const part = result.parts.find(
    (candidate) => candidate.kind === "repeat-until-end",
  );
  return part?.kind === "repeat-until-end" ? part.rowKind : undefined;
}

function firstActionLines(copy: BeginnerExplanationCopy): string[] {
  return copy.parts[0]?.actionLines ?? [];
}

describe("parseBeginnerExplanation — cas expliqués", () => {
  it("explique *1ms, 1aug* x6 (18)", () => {
    const result = parseBeginnerExplanation("*1ms, 1aug* x6 (18)", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 6);
    assert.equal(result.expectedStitchCount, 18);
    assert.equal(result.row, undefined);
    assert.deepEqual(
      allSteps(result).map((step) => [step.quantity, step.term.code, step.term.label]),
      [
        [1, "ms", "Maille serrée"],
        [1, "aug", "Augmentation"],
      ],
    );

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      parts: [
        {
          heading: "Répète 6 fois :",
          actionLines: [
            "Fais 1 × Maille serrée.",
            "Fais 1 × Augmentation.",
          ],
        },
      ],
      expectedStitchCountLine:
        "Le patron indique 18 mailles à la fin de l’instruction.",
    });
  });

  it("explique *1 ms, 1 aug* x 6 sans total", () => {
    const result = parseBeginnerExplanation("*1 ms, 1 aug* x 6", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 6);
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(allSteps(result).length, 2);
  });

  it("explique [1ms, 1aug] ×6", () => {
    const result = parseBeginnerExplanation("[1ms, 1aug] ×6", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 6);
    assert.equal(allSteps(result)[0]?.term.code, "ms");
    assert.equal(allSteps(result)[1]?.term.code, "aug");
  });

  it("explique R3 : 6 ms (6) avec préfixe de rang", () => {
    const result = parseBeginnerExplanation("R3 : 6 ms (6)", terms);
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 3 });
    assert.equal(repeatCountOf(result), undefined);
    assert.equal(result.expectedStitchCount, 6);
    assert.deepEqual(allSteps(result), [
      {
        quantity: 6,
        term: { id: "ms", code: "ms", label: "Maille serrée" },
      },
    ]);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 3 :",
      parts: [{ actionLines: ["Fais 6 × Maille serrée."] }],
      expectedStitchCountLine:
        "Le patron indique 6 mailles à la fin de ce rang.",
    });
  });

  it("explique Tour 2 : 2 ms, 1 aug (3)", () => {
    const result = parseBeginnerExplanation("Tour 2 : 2 ms, 1 aug (3)", terms);
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 2 });
    assert.equal(result.expectedStitchCount, 3);
    assert.equal(allSteps(result).length, 2);

    const copy = toBeginnerExplanationCopy(result);
    assert.equal(copy.rowIntro, "Pour le tour 2 :");
    assert.deepEqual(firstActionLines(copy), [
      "Fais 2 × Maille serrée.",
      "Fais 1 × Augmentation.",
    ]);
    assert.equal(
      copy.expectedStitchCountLine,
      "Le patron indique 3 mailles à la fin de ce tour.",
    );
  });

  it("explique 1 diminution via l'alias", () => {
    const result = parseBeginnerExplanation("1 diminution", terms);
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.quantity, 1);
    assert.equal(allSteps(result)[0]?.term.code, "dim");
    assert.equal(allSteps(result)[0]?.term.label, "Diminution");
    assert.deepEqual(firstActionLines(toBeginnerExplanationCopy(result)), [
      "Fais 1 × Diminution.",
    ]);
  });

  it("accepte une quantité collée au code (6mc)", () => {
    const result = parseBeginnerExplanation("6mc", terms);
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.quantity, 6);
    assert.equal(allSteps(result)[0]?.term.code, "mc");
  });

  it("traite les parenthèses comme bloc seulement avec xN", () => {
    const result = parseBeginnerExplanation("(1ms, 1aug) x6", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 6);
  });

  it("conserve le label exact, sans changer la casse ni pluraliser", () => {
    const result = parseBeginnerExplanation("2 ms", terms);
    assertExplained(result);
    assert.equal(firstActionLines(toBeginnerExplanationCopy(result))[0], "Fais 2 × Maille serrée.");
  });
});

describe("parseBeginnerExplanation — cas non expliqués", () => {
  it("rejette ms, aug sans quantité", () => {
    const result = parseBeginnerExplanation("ms, aug", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette *1ms, 1aug* sans multiplicateur", () => {
    const result = parseBeginnerExplanation("*1ms, 1aug*", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (18) seul", () => {
    const result = parseBeginnerExplanation("(18)", terms);
    assert.deepEqual(result, {
      kind: "unsupported",
      reason: "no-supported-pattern",
    });
  });

  it("rejette du texte après le total parenthésé", () => {
    const result = parseBeginnerExplanation(
      "R3 : 1 ms (18) pour la taille M",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1ms, 1aug) sans multiplicateur", () => {
    const result = parseBeginnerExplanation("(1ms, 1aug)", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un terme inconnu dans un bloc répété", () => {
    const result = parseBeginnerExplanation("*1ms, 1motinconnu* x6", terms);
    assert.deepEqual(result, {
      kind: "unsupported",
      reason: "unknown-term",
    });
  });

  it("rejette les crochets imbriqués", () => {
    const result = parseBeginnerExplanation("[1ms, (1aug, 1ms)] x6", terms);
    assert.deepEqual(result, {
      kind: "unsupported",
      reason: "unsupported-syntax",
    });
  });

  it("rejette une phrase libre après une action", () => {
    const result = parseBeginnerExplanation("1ms jusqu’à la fin du rang", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("ne confond pas R3 avec une quantité d'action", () => {
    const result = parseBeginnerExplanation("R3 6 ms", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette plusieurs totaux parenthésés comme ambigus", () => {
    const result = parseBeginnerExplanation("1 ms (12) (18)", terms);
    assert.deepEqual(result, {
      kind: "unsupported",
      reason: "ambiguous",
    });
  });

  it("expose une note d'échec stable pour le rendu", () => {
    assert.match(UNSUPPORTED_EXPLANATION_NOTE, /n’est pas encore expliqué/);
  });
});

describe("parseBeginnerExplanation — qualificatifs d’action", () => {
  it("explique R2 : 2 ms dans chaque maille (12)", () => {
    const result = parseBeginnerExplanation(
      "R2 : 2 ms dans chaque maille (12)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 2 });
    assert.equal(repeatCountOf(result), undefined);
    assert.equal(untilEndOf(result), undefined);
    assert.equal(result.expectedStitchCount, 12);
    assert.deepEqual(allSteps(result), [
      {
        quantity: 2,
        term: { id: "ms", code: "ms", label: "Maille serrée" },
        qualifier: "each-stitch",
      },
    ]);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 2 :",
      parts: [
        { actionLines: ["Fais 2 × Maille serrée dans chaque maille."] },
      ],
      positionCautionNote: POSITION_QUALIFIER_NOTE,
      expectedStitchCountLine:
        "Le patron indique 12 mailles à la fin de ce rang.",
    });
  });

  it("explique R2 : 2 ms dans toutes les mailles (12) avec libellé canonique", () => {
    const result = parseBeginnerExplanation(
      "R2 : 2 ms dans toutes les mailles (12)",
      terms,
    );
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.qualifier, "each-stitch");
    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 2 :",
      parts: [
        { actionLines: ["Fais 2 × Maille serrée dans chaque maille."] },
      ],
      positionCautionNote: POSITION_QUALIFIER_NOTE,
      expectedStitchCountLine:
        "Le patron indique 12 mailles à la fin de ce rang.",
    });
  });

  it("explique R3 : 1 ms dans la maille suivante, 1 aug (18)", () => {
    const result = parseBeginnerExplanation(
      "R3 : 1 ms dans la maille suivante, 1 aug (18)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 3 });
    assert.equal(result.expectedStitchCount, 18);
    assert.equal(allSteps(result)[0]?.qualifier, "next-stitch");
    assert.equal(allSteps(result)[1]?.qualifier, undefined);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 3 :",
      parts: [
        {
          actionLines: [
            "Fais 1 × Maille serrée dans la maille suivante.",
            "Fais 1 × Augmentation.",
          ],
        },
      ],
      positionCautionNote: POSITION_QUALIFIER_NOTE,
      expectedStitchCountLine:
        "Le patron indique 18 mailles à la fin de ce rang.",
    });
  });

  it("explique R3 : 1 ms dans la prochaine maille, 1 aug (18)", () => {
    const result = parseBeginnerExplanation(
      "R3 : 1 ms dans la prochaine maille, 1 aug (18)",
      terms,
    );
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.qualifier, "next-stitch");
    assert.equal(
      firstActionLines(toBeginnerExplanationCopy(result))[0],
      "Fais 1 × Maille serrée dans la maille suivante.",
    );
  });

  it("n’affiche pas la note de prudence sans qualificatif", () => {
    const result = parseBeginnerExplanation("R3 : 6 ms (6)", terms);
    assertExplained(result);
    assert.equal(toBeginnerExplanationCopy(result).positionCautionNote, undefined);
  });
});

describe("parseBeginnerExplanation — jusqu’à la fin du rang/tour", () => {
  it("explique Tour 4 : 6 ms, 1 aug jusqu’à la fin du tour (24)", () => {
    const result = parseBeginnerExplanation(
      "Tour 4 : 6 ms, 1 aug jusqu’à la fin du tour (24)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 4 });
    assert.equal(repeatCountOf(result), undefined);
    assert.equal(untilEndOf(result), "tour");
    assert.equal(result.expectedStitchCount, 24);
    assert.equal(allSteps(result).length, 2);
    assert.equal(allSteps(result)[0]?.qualifier, undefined);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le tour 4 :",
      parts: [
        {
          heading: "Répète jusqu’à la fin du tour :",
          actionLines: ["Fais 6 × Maille serrée.", "Fais 1 × Augmentation."],
        },
      ],
      expectedStitchCountLine:
        "Le patron indique 24 mailles à la fin de ce tour.",
    });
  });

  it("explique Rang 4 : 6 ms, 1 aug jusqu’à la fin du rang (24)", () => {
    const result = parseBeginnerExplanation(
      "Rang 4 : 6 ms, 1 aug jusqu’à la fin du rang (24)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 4 });
    assert.equal(untilEndOf(result), "rang");
    assert.equal(
      toBeginnerExplanationCopy(result).parts[0]?.heading,
      "Répète jusqu’à la fin du rang :",
    );
  });

  it("explique 6 ms, 1 aug jusqu’à la fin du tour (24) sans préfixe", () => {
    const result = parseBeginnerExplanation(
      "6 ms, 1 aug jusqu’à la fin du tour (24)",
      terms,
    );
    assertExplained(result);
    assert.equal(result.row, undefined);
    assert.equal(untilEndOf(result), "tour");
    assert.equal(result.expectedStitchCount, 24);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      parts: [
        {
          heading: "Répète jusqu’à la fin du tour :",
          actionLines: ["Fais 6 × Maille serrée.", "Fais 1 × Augmentation."],
        },
      ],
      expectedStitchCountLine:
        "Le patron indique 24 mailles à la fin de ce tour.",
    });
  });

  it("accepte l’apostrophe ASCII jusqu'à la fin du rang", () => {
    const result = parseBeginnerExplanation(
      "6 ms, 1 aug jusqu'à la fin du rang (24)",
      terms,
    );
    assertExplained(result);
    assert.equal(untilEndOf(result), "rang");
  });
});

describe("parseBeginnerExplanation — à répéter N fois", () => {
  it("explique R3 : 1 ms, 1 aug, à répéter 6 fois (18)", () => {
    const result = parseBeginnerExplanation(
      "R3 : 1 ms, 1 aug, à répéter 6 fois (18)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 3 });
    assert.equal(repeatCountOf(result), 6);
    assert.equal(untilEndOf(result), undefined);
    assert.equal(result.expectedStitchCount, 18);
    assert.equal(allSteps(result).length, 2);
    assert.equal(allSteps(result)[0]?.qualifier, undefined);
    assert.equal(allSteps(result)[1]?.qualifier, undefined);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 3 :",
      parts: [
        {
          heading: "Répète 6 fois :",
          actionLines: ["Fais 1 × Maille serrée.", "Fais 1 × Augmentation."],
        },
      ],
      expectedStitchCountLine:
        "Le patron indique 18 mailles à la fin de ce rang.",
    });
  });

  it("explique 1ms, 1aug, à répéter 6 fois sans préfixe ni total", () => {
    const result = parseBeginnerExplanation(
      "1ms, 1aug, à répéter 6 fois",
      terms,
    );
    assertExplained(result);
    assert.equal(result.row, undefined);
    assert.equal(repeatCountOf(result), 6);
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(allSteps(result).length, 2);
  });

  it("explique Tour 2 : 2 ms, 1 aug, à répéter 3 fois (9)", () => {
    const result = parseBeginnerExplanation(
      "Tour 2 : 2 ms, 1 aug, à répéter 3 fois (9)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 2 });
    assert.equal(repeatCountOf(result), 3);
    assert.equal(result.expectedStitchCount, 9);

    const copy = toBeginnerExplanationCopy(result);
    assert.equal(copy.rowIntro, "Pour le tour 2 :");
    assert.equal(copy.parts[0]?.heading, "Répète 3 fois :");
    assert.equal(
      copy.expectedStitchCountLine,
      "Le patron indique 9 mailles à la fin de ce tour.",
    );
  });

  it("rejette 1 ms, à répéter 6 fois (une seule action)", () => {
    const result = parseBeginnerExplanation("1 ms, à répéter 6 fois", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un qualificatif avec à répéter N fois", () => {
    const result = parseBeginnerExplanation(
      "1 ms dans chaque maille, 1 aug, à répéter 6 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette répéter 6 fois sans à", () => {
    const result = parseBeginnerExplanation(
      "1 ms, 1 aug, répéter 6 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette à répéter six fois en lettres", () => {
    const result = parseBeginnerExplanation(
      "1 ms, 1 aug, à répéter six fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette du texte après fois", () => {
    const result = parseBeginnerExplanation(
      "1 ms, 1 aug, à répéter 6 fois de plus",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un point après fois", () => {
    const result = parseBeginnerExplanation(
      "1 ms, 1 aug, à répéter 6 fois.",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un bloc *…* xN combiné à à répéter N fois", () => {
    const result = parseBeginnerExplanation(
      "*1ms, 1aug* x6, à répéter 6 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette à répéter N fois combiné à jusqu’à la fin du tour", () => {
    const result = parseBeginnerExplanation(
      "1 ms, 1 aug, à répéter 6 fois jusqu’à la fin du tour",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette à répéter 0 fois", () => {
    const result = parseBeginnerExplanation(
      "1 ms, 1 aug, à répéter 0 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });
});

describe("parseBeginnerExplanation — jalon E refusés", () => {
  it("rejette 2 ms dans les 3 mailles suivantes", () => {
    const result = parseBeginnerExplanation(
      "2 ms dans les 3 mailles suivantes",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 1 aug dans chaque coin", () => {
    const result = parseBeginnerExplanation("1 aug dans chaque coin", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 1 ms dans le brin arrière", () => {
    const result = parseBeginnerExplanation("1 ms dans le brin arrière", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette changer de couleur", () => {
    const result = parseBeginnerExplanation("changer de couleur", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette tourner", () => {
    const result = parseBeginnerExplanation("tourner", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette joindre avec une mc", () => {
    const result = parseBeginnerExplanation("joindre avec une mc", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette dans l’arceau de 2 ml", () => {
    const result = parseBeginnerExplanation("dans l’arceau de 2 ml", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette dans la même maille", () => {
    const result = parseBeginnerExplanation("dans la même maille", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette répéter jusqu’au marqueur", () => {
    const result = parseBeginnerExplanation("répéter jusqu’au marqueur", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette répéter jusqu’à la fin", () => {
    const result = parseBeginnerExplanation("répéter jusqu’à la fin", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 1 ms jusqu’à la fin du rang (une seule action)", () => {
    const result = parseBeginnerExplanation(
      "1 ms jusqu’à la fin du rang",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette *1ms, 1aug* x6 jusqu’à la fin du tour", () => {
    const result = parseBeginnerExplanation(
      "*1ms, 1aug* x6 jusqu’à la fin du tour",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un qualificatif dans un bloc *…* xN", () => {
    const result = parseBeginnerExplanation(
      "*1 ms dans la maille suivante, 1 aug* x6",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un qualificatif dans un bloc […] xN", () => {
    const result = parseBeginnerExplanation(
      "[1 ms dans chaque maille, 1 aug] x6",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette Tour 4 : 6 ms, 1 aug jusqu’à la fin du rang", () => {
    const result = parseBeginnerExplanation(
      "Tour 4 : 6 ms, 1 aug jusqu’à la fin du rang",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette Rang 4 : 6 ms, 1 aug jusqu’à la fin du tour", () => {
    const result = parseBeginnerExplanation(
      "Rang 4 : 6 ms, 1 aug jusqu’à la fin du tour",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette une phrase ajoutée après le suffixe", () => {
    const result = parseBeginnerExplanation(
      "2ms, 1aug, 1ms jusqu’à la fin du rang avec une phrase ajoutée",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette une ponctuation après le suffixe avant le total", () => {
    const result = parseBeginnerExplanation(
      "6 ms, 1 aug jusqu’à la fin du tour. (24)",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un qualificatif collé au terme", () => {
    const result = parseBeginnerExplanation("2msdans chaque maille", terms);
    assert.equal(result.kind, "unsupported");
  });
});

describe("parseBeginnerExplanation — jalon G totaux [N]", () => {
  it("explique Tour 3 : (1 ms, 1 aug) 8 fois [24]", () => {
    const result = parseBeginnerExplanation(
      "Tour 3 : (1 ms, 1 aug) 8 fois [24]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 3 });
    assert.equal(repeatCountOf(result), 8);
    assert.equal(result.expectedStitchCount, 24);
    assert.deepEqual(
      allSteps(result).map((step) => [step.quantity, step.term.code, step.term.label]),
      [
        [1, "ms", "Maille serrée"],
        [1, "aug", "Augmentation"],
      ],
    );

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le tour 3 :",
      parts: [
        {
          heading: "Répète 8 fois :",
          actionLines: ["Fais 1 × Maille serrée.", "Fais 1 × Augmentation."],
        },
      ],
      expectedStitchCountLine:
        "Le patron indique 24 mailles à la fin de ce tour.",
    });
  });

  it("explique Tour 4 : (2 ms, 1 aug) 8 fois[32]", () => {
    const result = parseBeginnerExplanation(
      "Tour 4 : (2 ms, 1 aug) 8 fois[32]",
      terms,
    );
    assertExplained(result);
    assert.equal(repeatCountOf(result), 8);
    assert.equal(result.expectedStitchCount, 32);
    assert.equal(allSteps(result).length, 2);
  });

  it("explique Tour 20 : (2 ms, 1 dim) 2 fois[24] avec le total écrit", () => {
    const result = parseBeginnerExplanation(
      "Tour 20 : (2 ms, 1 dim) 2 fois[24]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 20 });
    assert.equal(repeatCountOf(result), 2);
    assert.equal(result.expectedStitchCount, 24);
    assert.deepEqual(
      allSteps(result).map((step) => [step.quantity, step.term.code]),
      [
        [2, "ms"],
        [1, "dim"],
      ],
    );
    assert.equal(
      toBeginnerExplanationCopy(result).expectedStitchCountLine,
      "Le patron indique 24 mailles à la fin de ce tour.",
    );
  });

  it("sépare le bloc [actions] xN du total final collé [1 ms, 1 aug] x8[24]", () => {
    const result = parseBeginnerExplanation("[1 ms, 1 aug] x8[24]", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 8);
    assert.equal(result.expectedStitchCount, 24);
    assert.equal(allSteps(result).length, 2);
    assert.equal(allSteps(result)[0]?.term.code, "ms");
    assert.equal(allSteps(result)[1]?.term.code, "aug");
  });

  it("sépare le bloc [actions] xN du total final espacé [1 ms, 1 aug] x8 [24]", () => {
    const result = parseBeginnerExplanation("[1 ms, 1 aug] x8 [24]", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 8);
    assert.equal(result.expectedStitchCount, 24);
    assert.equal(allSteps(result).length, 2);
  });

  it("rejette deux totaux 1 ms (6)[6] comme ambigus", () => {
    const result = parseBeginnerExplanation("1 ms (6)[6]", terms);
    assert.deepEqual(result, { kind: "unsupported", reason: "ambiguous" });
  });

  it("rejette deux totaux 1 ms [6](6) comme ambigus", () => {
    const result = parseBeginnerExplanation("1 ms [6](6)", terms);
    assert.deepEqual(result, { kind: "unsupported", reason: "ambiguous" });
  });

  it("rejette [24 mailles]", () => {
    const result = parseBeginnerExplanation("[24 mailles]", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un crochet de total incomplet [24", () => {
    const result = parseBeginnerExplanation("1 ms [24", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette du texte après le crochet de total", () => {
    const result = parseBeginnerExplanation("1 ms [24].", terms);
    assert.equal(result.kind, "unsupported");
  });
});

describe("parseBeginnerExplanation — jalon G (actions) N fois", () => {
  it("explique (1 ms, 1 aug) 8 fois sans préfixe ni total", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) 8 fois", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 8);
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(allSteps(result).length, 2);
  });

  it("accepte la casse FOIS", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) 8 FOIS", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 8);
  });

  it("accepte les espaces optionnels (1 ms, 1 aug)8fois", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug)8fois", terms);
    assertExplained(result);
    assert.equal(repeatCountOf(result), 8);
  });

  it("rejette (1 ms) 8 fois — une seule action, simplification volontaire", () => {
    const result = parseBeginnerExplanation("(1 ms) 8 fois", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) x8 fois", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) x8 fois", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) huit fois", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) huit fois", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) 8 fois de plus", () => {
    const result = parseBeginnerExplanation(
      "(1 ms, 1 aug) 8 fois de plus",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) 8 fois.", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) 8 fois.", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) 8 sans fois", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) 8", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) fois sans nombre", () => {
    const result = parseBeginnerExplanation("(1 ms, 1 aug) fois", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un qualificatif dans le bloc (1 ms dans chaque maille, 1 aug) 8 fois", () => {
    const result = parseBeginnerExplanation(
      "(1 ms dans chaque maille, 1 aug) 8 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) 8 fois, à répéter 8 fois", () => {
    const result = parseBeginnerExplanation(
      "(1 ms, 1 aug) 8 fois, à répéter 8 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (1 ms, 1 aug) 8 fois jusqu’à la fin du tour", () => {
    const result = parseBeginnerExplanation(
      "(1 ms, 1 aug) 8 fois jusqu’à la fin du tour",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette *1 ms, 1 aug* x8 8 fois", () => {
    const result = parseBeginnerExplanation("*1 ms, 1 aug* x8 8 fois", terms);
    assert.equal(result.kind, "unsupported");
  });
});

describe("parseBeginnerExplanation — jalon G m contextuel", () => {
  it("explique Tour 11 : 1 ms dans chaque m [48]", () => {
    const result = parseBeginnerExplanation(
      "Tour 11 : 1 ms dans chaque m [48]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 11 });
    assert.equal(repeatCountOf(result), undefined);
    assert.equal(result.expectedStitchCount, 48);
    assert.deepEqual(allSteps(result), [
      {
        quantity: 1,
        term: { id: "ms", code: "ms", label: "Maille serrée" },
        qualifier: "each-stitch",
      },
    ]);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le tour 11 :",
      parts: [
        { actionLines: ["Fais 1 × Maille serrée dans chaque maille."] },
      ],
      positionCautionNote: POSITION_QUALIFIER_NOTE,
      expectedStitchCountLine:
        "Le patron indique 48 mailles à la fin de ce tour.",
    });
  });

  it("explique 2 ms dans toutes les m avec le libellé canonique", () => {
    const result = parseBeginnerExplanation("2 ms dans toutes les m", terms);
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.qualifier, "each-stitch");
    assert.equal(
      firstActionLines(toBeginnerExplanationCopy(result))[0],
      "Fais 2 × Maille serrée dans chaque maille.",
    );
  });

  it("rejette dans la m suivante", () => {
    const result = parseBeginnerExplanation("1 ms dans la m suivante", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 1 ms dans chaque m.", () => {
    const result = parseBeginnerExplanation("1 ms dans chaque m.", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 1 ms dans chaque ms", () => {
    const result = parseBeginnerExplanation("1 ms dans chaque ms", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette dans 2 m", () => {
    const result = parseBeginnerExplanation("1 ms dans 2 m", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette m isolé", () => {
    const result = parseBeginnerExplanation("m", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 1 m comme terme", () => {
    const result = parseBeginnerExplanation("1 m", terms);
    assert.deepEqual(result, { kind: "unsupported", reason: "unknown-term" });
  });
});

describe("parseBeginnerExplanation — jalon G hors scope réel", () => {
  it("explique Tour 2 : 8 aug[2] — quantité + terme + total écrit, sans calcul", () => {
    const result = parseBeginnerExplanation("Tour 2 : 8 aug[2]", terms);
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 2 });
    assert.equal(repeatCountOf(result), undefined);
    assert.equal(result.expectedStitchCount, 2);
    assert.deepEqual(allSteps(result), [
      {
        quantity: 8,
        term: { id: "aug", code: "aug", label: "Augmentation" },
      },
    ]);
  });

  it("rejette Tour 2 : aug[2] sans quantité", () => {
    const result = parseBeginnerExplanation("Tour 2 : aug[2]", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette Tours 6-9 (4 tours) : 1 ms dans chaque m[3]", () => {
    const result = parseBeginnerExplanation(
      "Tours 6-9 (4 tours) : 1 ms dans chaque m[3]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette Tour 12 avec changements de couleur", () => {
    const result = parseBeginnerExplanation(
      "Tour 12 : 15 ms ; fil blanc : 5 ms ; fil orange : 18 ms",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette Tour 29 brins arrière", () => {
    const result = parseBeginnerExplanation(
      "Tour 29 : travailler dans les brins arrière uniquement : (6 ms, 1 aug) 6 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette Tours 30-32 (3 tours) : 1 ms dans chaque m", () => {
    const result = parseBeginnerExplanation(
      "Tours 30-32 (3 tours) : 1 ms dans chaque m",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });
});

describe("parseBeginnerExplanation — jalon H anneau magique", () => {
  it("explique Tour 1 : 8 ms dans un anneau magique [8]", () => {
    const result = parseBeginnerExplanation(
      "Tour 1 : 8 ms dans un anneau magique [8]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 1 });
    assert.equal(repeatCountOf(result), undefined);
    assert.equal(untilEndOf(result), undefined);
    assert.equal(result.expectedStitchCount, 8);
    assert.deepEqual(allSteps(result), [
      {
        quantity: 8,
        term: { id: "ms", code: "ms", label: "Maille serrée" },
        qualifier: "magic-ring",
      },
    ]);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le tour 1 :",
      parts: [
        { actionLines: ["Fais 8 × Maille serrée dans un anneau magique."] },
      ],
      positionCautionNote: POSITION_QUALIFIER_NOTE,
      expectedStitchCountLine:
        "Le patron indique 8 mailles à la fin de ce tour.",
    });
  });

  it("explique Tour 1 : 8 ms dans un anneau magique[1] sans espace avant le total", () => {
    const result = parseBeginnerExplanation(
      "Tour 1 : 8 ms dans un anneau magique[1]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 1 });
    assert.equal(result.expectedStitchCount, 1);
    assert.equal(allSteps(result)[0]?.quantity, 8);
    assert.equal(allSteps(result)[0]?.term.code, "ms");
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.equal(
      firstActionLines(toBeginnerExplanationCopy(result))[0],
      "Fais 8 × Maille serrée dans un anneau magique.",
    );
    assert.equal(
      toBeginnerExplanationCopy(result).expectedStitchCountLine,
      "Le patron indique 1 mailles à la fin de ce tour.",
    );
  });

  it("explique Rang 1 : 6 ms dans une boucle magique (6) avec libellé canonique", () => {
    const result = parseBeginnerExplanation(
      "Rang 1 : 6 ms dans une boucle magique (6)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 1 });
    assert.equal(result.expectedStitchCount, 6);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 1 :",
      parts: [
        { actionLines: ["Fais 6 × Maille serrée dans un anneau magique."] },
      ],
      positionCautionNote: POSITION_QUALIFIER_NOTE,
      expectedStitchCountLine:
        "Le patron indique 6 mailles à la fin de ce rang.",
    });
  });

  it("explique 8 ms dans un cercle magique[1] avec libellé canonique", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un cercle magique[1]",
      terms,
    );
    assertExplained(result);
    assert.equal(result.row, undefined);
    assert.equal(result.expectedStitchCount, 1);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.equal(
      firstActionLines(toBeginnerExplanationCopy(result))[0],
      "Fais 8 × Maille serrée dans un anneau magique.",
    );
    assert.equal(
      toBeginnerExplanationCopy(result).positionCautionNote,
      POSITION_QUALIFIER_NOTE,
    );
  });

  it("explique Tour 1 : 8 ms dans un cercle magique [8]", () => {
    const result = parseBeginnerExplanation(
      "Tour 1 : 8 ms dans un cercle magique [8]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 1 });
    assert.equal(result.expectedStitchCount, 8);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.equal(
      firstActionLines(toBeginnerExplanationCopy(result))[0],
      "Fais 8 × Maille serrée dans un anneau magique.",
    );
  });

  it("explique 8 ms dans un anneau magique sans préfixe ni total", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique",
      terms,
    );
    assertExplained(result);
    assert.equal(result.row, undefined);
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.equal(toBeginnerExplanationCopy(result).expectedStitchCountLine, undefined);
    assert.equal(
      toBeginnerExplanationCopy(result).positionCautionNote,
      POSITION_QUALIFIER_NOTE,
    );
  });

  it("accepte la casse TOUR 1 : 8 MS DANS UN ANNEAU MAGIQUE[1]", () => {
    const result = parseBeginnerExplanation(
      "TOUR 1 : 8 MS DANS UN ANNEAU MAGIQUE[1]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 1 });
    assert.equal(result.expectedStitchCount, 1);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
  });

  it("accepte les espaces internes Tour 1 : 8   ms   dans   un   anneau   magique[1]", () => {
    const result = parseBeginnerExplanation(
      "Tour 1 : 8   ms   dans   un   anneau   magique[1]",
      terms,
    );
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.quantity, 8);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.equal(result.expectedStitchCount, 1);
  });

  it("accepte un espace final 8 ms dans un anneau magique ", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique ",
      terms,
    );
    assertExplained(result);
    assert.equal(allSteps(result)[0]?.qualifier, "magic-ring");
    assert.equal(result.expectedStitchCount, undefined);
  });

  it("rejette 8 ms dans l’anneau magique[1]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans l’anneau magique[1]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans une maille", () => {
    const result = parseBeginnerExplanation("8 ms dans une maille", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans la même maille", () => {
    const result = parseBeginnerExplanation("8 ms dans la même maille", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un arceau de 2 ml", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un arceau de 2 ml",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans une boucle", () => {
    const result = parseBeginnerExplanation("8 ms dans une boucle", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un anneau", () => {
    const result = parseBeginnerExplanation("8 ms dans un anneau", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans l’anneau de départ", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans l’anneau de départ",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans le cercle", () => {
    const result = parseBeginnerExplanation("8 ms dans le cercle", terms);
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans une boucle magique de départ", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans une boucle magique de départ",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms autour de l’anneau magique", () => {
    const result = parseBeginnerExplanation(
      "8 ms autour de l’anneau magique",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un anneau magique, puis 1 aug", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique, puis 1 aug",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un anneau magique.", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique.",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans une boucle magique  avec une phrase[1]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans une boucle magique  avec une phrase[1]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un anneau magique.[1]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique.[1]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette deux totaux 8 ms dans un anneau magique (8)[1]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique (8)[1]",
      terms,
    );
    assert.deepEqual(result, { kind: "unsupported", reason: "ambiguous" });
  });

  it("rejette 8 ms dans un anneau magique [huit]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique [huit]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (8 ms dans un anneau magique, 1 aug) 2 fois[2]", () => {
    const result = parseBeginnerExplanation(
      "(8 ms dans un anneau magique, 1 aug) 2 fois[2]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un anneau magique, 1 aug[3]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique, 1 aug[3]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette 8 ms dans un anneau magique jusqu’à la fin du tour[1]", () => {
    const result = parseBeginnerExplanation(
      "8 ms dans un anneau magique jusqu’à la fin du tour[1]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });
});

describe("parseBeginnerExplanation — jalon I sandwich", () => {
  const ms = {
    quantity: 7,
    term: { id: "ms", code: "ms", label: "Maille serrée" },
  };
  const aug = {
    quantity: 1,
    term: { id: "aug", code: "aug", label: "Augmentation" },
  };
  const fourMs = {
    quantity: 4,
    term: { id: "ms", code: "ms", label: "Maille serrée" },
  };
  const oneMs = {
    quantity: 1,
    term: { id: "ms", code: "ms", label: "Maille serrée" },
  };

  it("explique le Tour 15 réel avec le total écrit [3]", () => {
    const result = parseBeginnerExplanation(
      "Tour 15 : 7 ms, 1 aug, 4 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms, 1 aug, 7 ms, 1 aug[3]",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 15 });
    assert.equal(result.expectedStitchCount, 3);
    assert.equal(result.parts.length, 3);
    assert.deepEqual(result.parts[0], {
      kind: "actions",
      steps: [ms, aug, fourMs, aug],
    });
    assert.deepEqual(result.parts[1], {
      kind: "repeat",
      count: 2,
      steps: [ms, aug],
    });
    assert.deepEqual(result.parts[2], {
      kind: "actions",
      steps: [oneMs, aug, ms, aug],
    });

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le tour 15 :",
      parts: [
        {
          heading: "Avant la répétition :",
          actionLines: [
            "Fais 7 × Maille serrée.",
            "Fais 1 × Augmentation.",
            "Fais 4 × Maille serrée.",
            "Fais 1 × Augmentation.",
          ],
        },
        {
          heading: "Répète 2 fois :",
          actionLines: [
            "Fais 7 × Maille serrée.",
            "Fais 1 × Augmentation.",
          ],
        },
        {
          heading: "Après la répétition :",
          actionLines: [
            "Fais 1 × Maille serrée.",
            "Fais 1 × Augmentation.",
            "Fais 7 × Maille serrée.",
            "Fais 1 × Augmentation.",
          ],
        },
      ],
      expectedStitchCountLine:
        "Le patron indique 3 mailles à la fin de ce tour.",
    });
  });

  it("explique le Tour 17 réel sans total", () => {
    const result = parseBeginnerExplanation(
      "Tour 17 : 7 ms, 1 dim, 4 ms, 1 dim, (7 ms, 1 dim) 2 fois, 1 ms, 1 dim, 7 ms, 1 dim",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 17 });
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(result.parts.length, 3);
    assert.equal(result.parts[0]?.kind, "actions");
    assert.equal(result.parts[0]?.steps.length, 4);
    assert.deepEqual(result.parts[1], {
      kind: "repeat",
      count: 2,
      steps: [
        {
          quantity: 7,
          term: { id: "ms", code: "ms", label: "Maille serrée" },
        },
        {
          quantity: 1,
          term: { id: "dim", code: "dim", label: "Diminution" },
        },
      ],
    });
    assert.equal(result.parts[2]?.kind, "actions");
    assert.equal(result.parts[2]?.steps.length, 4);
    assert.equal(
      toBeginnerExplanationCopy(result).expectedStitchCountLine,
      undefined,
    );
    assert.deepEqual(
      toBeginnerExplanationCopy(result).parts.map((part) => part.heading),
      [
        "Avant la répétition :",
        "Répète 2 fois :",
        "Après la répétition :",
      ],
    );
  });

  it("recopie littéralement le total final sans le calculer", () => {
    const result = parseBeginnerExplanation(
      "Tour 15 : 7 ms, 1 aug, 4 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms, 1 aug, 7 ms, 1 aug[6]",
      terms,
    );
    assertExplained(result);
    assert.equal(result.expectedStitchCount, 6);
    assert.equal(
      toBeginnerExplanationCopy(result).expectedStitchCountLine,
      "Le patron indique 6 mailles à la fin de ce tour.",
    );
    assert.notEqual(result.expectedStitchCount, 54);
  });

  it("garde trois parts titrées même avec une seule action avant et après", () => {
    const result = parseBeginnerExplanation(
      "1 ms, (2 ms, 1 aug) 3 fois, 1 dim[4]",
      terms,
    );
    assertExplained(result);
    assert.equal(result.expectedStitchCount, 4);
    assert.deepEqual(result.parts, [
      {
        kind: "actions",
        steps: [
          {
            quantity: 1,
            term: { id: "ms", code: "ms", label: "Maille serrée" },
          },
        ],
      },
      {
        kind: "repeat",
        count: 3,
        steps: [
          {
            quantity: 2,
            term: { id: "ms", code: "ms", label: "Maille serrée" },
          },
          {
            quantity: 1,
            term: { id: "aug", code: "aug", label: "Augmentation" },
          },
        ],
      },
      {
        kind: "actions",
        steps: [
          {
            quantity: 1,
            term: { id: "dim", code: "dim", label: "Diminution" },
          },
        ],
      },
    ]);

    const copy = toBeginnerExplanationCopy(result);
    assert.deepEqual(
      copy.parts.map((part) => part.heading),
      [
        "Avant la répétition :",
        "Répète 3 fois :",
        "Après la répétition :",
      ],
    );
    assert.deepEqual(copy.parts[0]?.actionLines, ["Fais 1 × Maille serrée."]);
    assert.deepEqual(copy.parts[2]?.actionLines, ["Fais 1 × Diminution."]);
  });

  it("accepte les espaces optionnels et la casse FOIS", () => {
    const result = parseBeginnerExplanation(
      "7 ms,(7 ms,1 aug)2FOIS,1 ms (12)",
      terms,
    );
    assertExplained(result);
    assert.equal(result.parts.length, 3);
    assert.equal(repeatCountOf(result), 2);
    assert.equal(result.expectedStitchCount, 12);
  });

  it("conserve (7 ms, 1 aug) 2 fois comme répétition entière, sans sections avant/après", () => {
    const result = parseBeginnerExplanation("(7 ms, 1 aug) 2 fois", terms);
    assertExplained(result);
    assert.equal(result.parts.length, 1);
    assert.equal(result.parts[0]?.kind, "repeat");
    assert.equal(toBeginnerExplanationCopy(result).parts[0]?.heading, "Répète 2 fois :");
    assert.equal(toBeginnerExplanationCopy(result).parts.length, 1);
  });

  it("rejette 7 ms, 1 aug, (7 ms, 1 aug) 2 fois — sans après", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) 2 fois",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette (7 ms, 1 aug) 2 fois, 1 ms, 1 aug — sans avant", () => {
    const result = parseBeginnerExplanation(
      "(7 ms, 1 aug) 2 fois, 1 ms, 1 aug",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un qualificatif après le sandwich", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms dans chaque maille",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un anneau magique après le sandwich", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms dans un anneau magique",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette les parenthèses imbriquées", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug, (1 ms, 1 aug) 2 fois) 2 fois, 1 ms",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette x2 à la place de N fois", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) x2, 1 ms",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette deux fois en lettres", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) deux fois, 1 ms",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette un point après la dernière action", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms.",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette du texte libre après le sandwich", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms  texte[5]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette deux blocs répétés", () => {
    const result = parseBeginnerExplanation(
      "7 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms, 1 aug, (2 ms, 1 aug) 2 fois, 1 ms",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });

  it("rejette le Tour 19 avec changement de couleur", () => {
    const result = parseBeginnerExplanation(
      "Tour 19 : 1 ms, 1 dim, 3 ms, 1 dim, 2 ms ; fil blanc : 1 ms, 1 dim, (3 ms, 1 dim) 2 fois, 2 ms[6]",
      terms,
    );
    assert.equal(result.kind, "unsupported");
  });
});
