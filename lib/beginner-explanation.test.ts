import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBeginnerExplanation,
  POSITION_QUALIFIER_NOTE,
  toBeginnerExplanationCopy,
  UNSUPPORTED_EXPLANATION_NOTE,
  type BeginnerExplanation,
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

describe("parseBeginnerExplanation — cas expliqués", () => {
  it("explique *1ms, 1aug* x6 (18)", () => {
    const result = parseBeginnerExplanation("*1ms, 1aug* x6 (18)", terms);
    assertExplained(result);
    assert.equal(result.repeatCount, 6);
    assert.equal(result.expectedStitchCount, 18);
    assert.equal(result.row, undefined);
    assert.deepEqual(
      result.steps.map((step) => [step.quantity, step.term.code, step.term.label]),
      [
        [1, "ms", "Maille serrée"],
        [1, "aug", "Augmentation"],
      ],
    );

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      repeatIntro: "Répète 6 fois :",
      actionLines: [
        "Fais 1 × Maille serrée.",
        "Fais 1 × Augmentation.",
      ],
      expectedStitchCountLine:
        "Le patron indique 18 mailles à la fin de l’instruction.",
    });
  });

  it("explique *1 ms, 1 aug* x 6 sans total", () => {
    const result = parseBeginnerExplanation("*1 ms, 1 aug* x 6", terms);
    assertExplained(result);
    assert.equal(result.repeatCount, 6);
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(result.steps.length, 2);
  });

  it("explique [1ms, 1aug] ×6", () => {
    const result = parseBeginnerExplanation("[1ms, 1aug] ×6", terms);
    assertExplained(result);
    assert.equal(result.repeatCount, 6);
    assert.equal(result.steps[0]?.term.code, "ms");
    assert.equal(result.steps[1]?.term.code, "aug");
  });

  it("explique R3 : 6 ms (6) avec préfixe de rang", () => {
    const result = parseBeginnerExplanation("R3 : 6 ms (6)", terms);
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "rang", number: 3 });
    assert.equal(result.repeatCount, undefined);
    assert.equal(result.expectedStitchCount, 6);
    assert.deepEqual(result.steps, [
      {
        quantity: 6,
        term: { id: "ms", code: "ms", label: "Maille serrée" },
      },
    ]);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 3 :",
      actionLines: ["Fais 6 × Maille serrée."],
      expectedStitchCountLine:
        "Le patron indique 6 mailles à la fin de ce rang.",
    });
  });

  it("explique Tour 2 : 2 ms, 1 aug (3)", () => {
    const result = parseBeginnerExplanation("Tour 2 : 2 ms, 1 aug (3)", terms);
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 2 });
    assert.equal(result.expectedStitchCount, 3);
    assert.equal(result.steps.length, 2);

    const copy = toBeginnerExplanationCopy(result);
    assert.equal(copy.rowIntro, "Pour le tour 2 :");
    assert.deepEqual(copy.actionLines, [
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
    assert.equal(result.steps[0]?.quantity, 1);
    assert.equal(result.steps[0]?.term.code, "dim");
    assert.equal(result.steps[0]?.term.label, "Diminution");
    assert.deepEqual(toBeginnerExplanationCopy(result).actionLines, [
      "Fais 1 × Diminution.",
    ]);
  });

  it("accepte une quantité collée au code (6mc)", () => {
    const result = parseBeginnerExplanation("6mc", terms);
    assertExplained(result);
    assert.equal(result.steps[0]?.quantity, 6);
    assert.equal(result.steps[0]?.term.code, "mc");
  });

  it("traite les parenthèses comme bloc seulement avec xN", () => {
    const result = parseBeginnerExplanation("(1ms, 1aug) x6", terms);
    assertExplained(result);
    assert.equal(result.repeatCount, 6);
  });

  it("conserve le label exact, sans changer la casse ni pluraliser", () => {
    const result = parseBeginnerExplanation("2 ms", terms);
    assertExplained(result);
    assert.equal(toBeginnerExplanationCopy(result).actionLines[0], "Fais 2 × Maille serrée.");
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
    assert.equal(result.repeatCount, undefined);
    assert.equal(result.repeatUntilEnd, undefined);
    assert.equal(result.expectedStitchCount, 12);
    assert.deepEqual(result.steps, [
      {
        quantity: 2,
        term: { id: "ms", code: "ms", label: "Maille serrée" },
        qualifier: "each-stitch",
      },
    ]);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 2 :",
      actionLines: ["Fais 2 × Maille serrée dans chaque maille."],
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
    assert.equal(result.steps[0]?.qualifier, "each-stitch");
    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 2 :",
      actionLines: ["Fais 2 × Maille serrée dans chaque maille."],
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
    assert.equal(result.steps[0]?.qualifier, "next-stitch");
    assert.equal(result.steps[1]?.qualifier, undefined);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 3 :",
      actionLines: [
        "Fais 1 × Maille serrée dans la maille suivante.",
        "Fais 1 × Augmentation.",
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
    assert.equal(result.steps[0]?.qualifier, "next-stitch");
    assert.equal(
      toBeginnerExplanationCopy(result).actionLines[0],
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
    assert.equal(result.repeatCount, undefined);
    assert.equal(result.repeatUntilEnd, "tour");
    assert.equal(result.expectedStitchCount, 24);
    assert.equal(result.steps.length, 2);
    assert.equal(result.steps[0]?.qualifier, undefined);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le tour 4 :",
      repeatIntro: "Répète jusqu’à la fin du tour :",
      actionLines: ["Fais 6 × Maille serrée.", "Fais 1 × Augmentation."],
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
    assert.equal(result.repeatUntilEnd, "rang");
    assert.equal(
      toBeginnerExplanationCopy(result).repeatIntro,
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
    assert.equal(result.repeatUntilEnd, "tour");
    assert.equal(result.expectedStitchCount, 24);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      repeatIntro: "Répète jusqu’à la fin du tour :",
      actionLines: ["Fais 6 × Maille serrée.", "Fais 1 × Augmentation."],
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
    assert.equal(result.repeatUntilEnd, "rang");
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
    assert.equal(result.repeatCount, 6);
    assert.equal(result.repeatUntilEnd, undefined);
    assert.equal(result.expectedStitchCount, 18);
    assert.equal(result.steps.length, 2);
    assert.equal(result.steps[0]?.qualifier, undefined);
    assert.equal(result.steps[1]?.qualifier, undefined);

    assert.deepEqual(toBeginnerExplanationCopy(result), {
      rowIntro: "Pour le rang 3 :",
      repeatIntro: "Répète 6 fois :",
      actionLines: ["Fais 1 × Maille serrée.", "Fais 1 × Augmentation."],
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
    assert.equal(result.repeatCount, 6);
    assert.equal(result.expectedStitchCount, undefined);
    assert.equal(result.steps.length, 2);
  });

  it("explique Tour 2 : 2 ms, 1 aug, à répéter 3 fois (9)", () => {
    const result = parseBeginnerExplanation(
      "Tour 2 : 2 ms, 1 aug, à répéter 3 fois (9)",
      terms,
    );
    assertExplained(result);
    assert.deepEqual(result.row, { kind: "tour", number: 2 });
    assert.equal(result.repeatCount, 3);
    assert.equal(result.expectedStitchCount, 9);

    const copy = toBeginnerExplanationCopy(result);
    assert.equal(copy.rowIntro, "Pour le tour 2 :");
    assert.equal(copy.repeatIntro, "Répète 3 fois :");
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
