import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBeginnerExplanation,
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
