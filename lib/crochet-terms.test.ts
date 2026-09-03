import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  segmentStepText,
  type CrochetTermWithAliases,
  type StepSegment,
  type TermSegment,
} from "./crochet-terms";

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
    id: "br",
    code: "br",
    label: "Bride",
    description: null,
    imagePath: null,
    aliases: ["bride"],
  },
  {
    id: "dbr",
    code: "dbr",
    label: "Double bride",
    description: null,
    imagePath: null,
    aliases: ["d.br.", "double bride"],
  },
  {
    id: "xx",
    code: "xx",
    label: "Point inventé",
    description: null,
    imagePath: null,
    aliases: [],
  },
];

function termValues(segments: StepSegment[]): string[] {
  return segments
    .filter((segment): segment is TermSegment => segment.type === "term")
    .map((segment) => segment.value);
}

function termCodes(segments: StepSegment[]): string[] {
  return segments
    .filter((segment): segment is TermSegment => segment.type === "term")
    .map((segment) => segment.term.code);
}

describe("segmentStepText", () => {
  it("reconnaît ms et aug dans un rang classique", () => {
    const segments = segmentStepText(
      "R3 : 1 ms, 1 aug, à répéter 6 fois (18)",
      terms,
    );

    assert.deepEqual(termValues(segments), ["ms", "aug"]);
    assert.deepEqual(termCodes(segments), ["ms", "aug"]);
    assert.equal(segments[0]?.type, "text");
    assert.equal(segments[0]?.value, "R3 : 1 ");
  });

  it("reconnaît les écritures collées entre étoiles", () => {
    const segments = segmentStepText("*1ms, 1aug* x6 (18)", terms);

    assert.deepEqual(termValues(segments), ["ms", "aug"]);
    assert.deepEqual(termCodes(segments), ["ms", "aug"]);
  });

  it("accepte un chiffre collé avant le code", () => {
    assert.deepEqual(termValues(segmentStepText("6mc", terms)), ["mc"]);
    assert.deepEqual(termCodes(segmentStepText("6mc", terms)), ["mc"]);
    assert.deepEqual(termValues(segmentStepText("2ms", terms)), ["ms"]);
  });

  it("reconnaît l'alias pointé m.s.", () => {
    const segments = segmentStepText("m.s.", terms);

    assert.deepEqual(termValues(segments), ["m.s."]);
    assert.deepEqual(termCodes(segments), ["ms"]);
  });

  it("reconnaît l'alias maille serrée", () => {
    const segments = segmentStepText("maille serrée", terms);

    assert.deepEqual(termValues(segments), ["maille serrée"]);
    assert.deepEqual(termCodes(segments), ["ms"]);
  });

  it("priorise double bride avant bride", () => {
    const double = segmentStepText("double bride", terms);
    assert.deepEqual(termCodes(double), ["dbr"]);
    assert.equal(termValues(double).length, 1);

    const single = segmentStepText("bride", terms);
    assert.deepEqual(termCodes(single), ["br"]);
  });

  it("ne reconnaît pas ms au milieu de sms", () => {
    const segments = segmentStepText("sms", terms);

    assert.deepEqual(segments, [{ type: "text", value: "sms" }]);
  });

  it("est insensible à la casse", () => {
    const segments = segmentStepText("MS et Aug", terms);

    assert.deepEqual(termValues(segments), ["MS", "Aug"]);
    assert.deepEqual(termCodes(segments), ["ms", "aug"]);
  });

  it("retourne un segment texte si aucun terme n'est reconnu", () => {
    const segments = segmentStepText("R1 : répéter 6 fois (18)", terms);

    assert.deepEqual(segments, [
      { type: "text", value: "R1 : répéter 6 fois (18)" },
    ]);
  });

  it("retourne un segment texte vide pour une chaîne vide", () => {
    assert.deepEqual(segmentStepText("", terms), [{ type: "text", value: "" }]);
  });

  it("ne reconnaît pas le label s'il n'est pas aussi un alias", () => {
    const segments = segmentStepText("Point inventé", terms);

    assert.deepEqual(segments, [{ type: "text", value: "Point inventé" }]);
    assert.deepEqual(termValues(segmentStepText("xx", terms)), ["xx"]);
  });

  it("gère les espaces multiples dans un alias multi-mots", () => {
    const segments = segmentStepText("maille   serrée", terms);

    assert.deepEqual(termCodes(segments), ["ms"]);
    assert.equal(segments[0]?.type, "term");
    assert.equal(segments[0]?.value, "maille   serrée");
  });
});
