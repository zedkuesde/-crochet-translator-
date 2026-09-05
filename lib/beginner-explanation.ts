import {
  createTermMatcher,
  type CrochetTermWithAliases,
  type TermMatcher,
} from "./crochet-terms";

export type ExplainedTerm = {
  id: string;
  code: string;
  label: string;
};

export type ActionQualifier = "each-stitch" | "next-stitch" | "magic-ring";

export type ExplainedAction = {
  quantity: number;
  term: ExplainedTerm;
  qualifier?: ActionQualifier;
};

export type RowKind = "rang" | "tour";

export type BeginnerExplanation =
  | {
      kind: "explained";
      row?: { kind: RowKind; number: number };
      repeatCount?: number;
      repeatUntilEnd?: RowKind;
      steps: ExplainedAction[];
      expectedStitchCount?: number;
    }
  | {
      kind: "unsupported";
      reason:
        | "empty"
        | "no-supported-pattern"
        | "ambiguous"
        | "unknown-term"
        | "unsupported-syntax";
    };

export type BeginnerExplanationCopy = {
  rowIntro?: string;
  repeatIntro?: string;
  actionLines: string[];
  positionCautionNote?: string;
  expectedStitchCountLine?: string;
};

export const UNSUPPORTED_EXPLANATION_NOTE =
  "Cette instruction est conservée telle quelle : son format n’est pas encore expliqué automatiquement.";

export const POSITION_QUALIFIER_NOTE =
  "Note : l’application reformule l’instruction ; elle ne calcule pas le nombre de mailles ni la position exacte où piquer.";

const WHITESPACE = /\s/u;
const NESTED_DELIMITER = /[*[\]()]/u;
const NUMERIC_PARENS = /\(\s*[1-9]\d{0,3}\s*\)/u;
const NUMERIC_BRACKETS = /\[\s*[1-9]\d{0,3}\s*\]/u;
const ROW_PREFIX_RE =
  /^(?:rang\s+([1-9]\d{0,2})|tour\s+([1-9]\d{0,2})|r([1-9]\d{0,2})|t([1-9]\d{0,2}))\s*:\s*/iu;
const TRAILING_COUNT_RE = /\(\s*([1-9]\d{0,3})\s*\)\s*$/u;
const TRAILING_BRACKET_COUNT_RE = /\[\s*([1-9]\d{0,3})\s*\]\s*$/u;
const MULTIPLIER_RE = /^\s*[x×]\s*([1-9]\d{0,2})\s*$/iu;
const FRENCH_TIMES_RE = /^\s*([1-9]\d{0,2})\s*fois\s*$/iu;
const QUANTITY_RE = /^([1-9]\d{0,2})/u;
const UNTIL_END_RE = /\s+jusqu['’]à\s+la\s+fin\s+du\s+(rang|tour)\s*$/iu;
const REPEAT_PHRASE_RE = /,\s*à\s+répéter\s+([1-9]\d{0,2})\s+fois\s*$/iu;
const RESIDUAL_MULTIPLIER_RE = /[x×]\s*[1-9]\d{0,2}/u;

const QUALIFIER_PHRASES: ReadonlyArray<{
  folded: string;
  qualifier: ActionQualifier;
}> = [
  { folded: "dans chaque maille", qualifier: "each-stitch" },
  { folded: "dans toutes les mailles", qualifier: "each-stitch" },
  { folded: "dans la maille suivante", qualifier: "next-stitch" },
  { folded: "dans la prochaine maille", qualifier: "next-stitch" },
  { folded: "dans chaque m", qualifier: "each-stitch" },
  { folded: "dans toutes les m", qualifier: "each-stitch" },
  { folded: "dans un anneau magique", qualifier: "magic-ring" },
  { folded: "dans une boucle magique", qualifier: "magic-ring" },
  { folded: "dans un cercle magique", qualifier: "magic-ring" },
];

type ParseFailure = {
  ok: false;
  reason: Extract<
    BeginnerExplanation,
    { kind: "unsupported" }
  >["reason"];
};

type ActionSequenceResult =
  | { ok: true; steps: ExplainedAction[] }
  | ParseFailure;

type RepeatBlockResult =
  | { kind: "ok"; steps: ExplainedAction[]; repeatCount: number }
  | { kind: "error"; reason: ParseFailure["reason"] };

function foldPhrase(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("fr")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseRowPrefix(text: string): {
  row: { kind: RowKind; number: number };
  rest: string;
} | null {
  const match = ROW_PREFIX_RE.exec(text);
  if (!match) {
    return null;
  }

  const rangNumber = match[1] ?? match[3];
  const tourNumber = match[2] ?? match[4];

  if (rangNumber) {
    return {
      row: { kind: "rang", number: Number.parseInt(rangNumber, 10) },
      rest: text.slice(match[0].length),
    };
  }

  if (tourNumber) {
    return {
      row: { kind: "tour", number: Number.parseInt(tourNumber, 10) },
      rest: text.slice(match[0].length),
    };
  }

  return null;
}

function splitTrailingCount(text: string):
  | { body: string; expectedStitchCount?: number }
  | { ambiguous: true } {
  const parenMatch = TRAILING_COUNT_RE.exec(text);
  const bracketMatch = TRAILING_BRACKET_COUNT_RE.exec(text);
  const match = parenMatch ?? bracketMatch;
  if (!match || match.index === undefined) {
    return { body: text };
  }

  const body = text.slice(0, match.index).trimEnd();
  if (NUMERIC_PARENS.test(body) || NUMERIC_BRACKETS.test(body)) {
    return { ambiguous: true };
  }

  return {
    body,
    expectedStitchCount: Number.parseInt(match[1] ?? "", 10),
  };
}

function splitUntilEndSuffix(body: string): {
  rest: string;
  repeatUntilEnd?: RowKind;
} {
  const normalized = body.normalize("NFC");
  const match = UNTIL_END_RE.exec(normalized);
  if (!match || match.index === undefined) {
    return { rest: body };
  }

  const target = (match[1] ?? "").toLocaleLowerCase("fr");
  if (target !== "rang" && target !== "tour") {
    return { rest: body };
  }

  return {
    rest: normalized.slice(0, match.index).trimEnd(),
    repeatUntilEnd: target,
  };
}

function splitRepeatPhraseSuffix(body: string): {
  rest: string;
  repeatCount?: number;
} {
  const normalized = body.normalize("NFC");
  const match = REPEAT_PHRASE_RE.exec(normalized);
  if (!match || match.index === undefined) {
    return { rest: body };
  }

  return {
    rest: normalized.slice(0, match.index).trimEnd(),
    repeatCount: Number.parseInt(match[1] ?? "", 10),
  };
}

function hasResidualRepeatSyntax(text: string): boolean {
  return NESTED_DELIMITER.test(text) || RESIDUAL_MULTIPLIER_RE.test(text);
}

function parseActionQualifier(rest: string): ActionQualifier | null {
  const folded = foldPhrase(rest);
  for (const phrase of QUALIFIER_PHRASES) {
    if (folded === phrase.folded) {
      return phrase.qualifier;
    }
  }
  return null;
}

function hasPositionQualifier(steps: ExplainedAction[]): boolean {
  return steps.some((step) => step.qualifier !== undefined);
}

function hasMagicRingQualifier(steps: ExplainedAction[]): boolean {
  return steps.some((step) => step.qualifier === "magic-ring");
}

function isMagicRingMisused(
  steps: ExplainedAction[],
  extras?: { repeatCount?: number; repeatUntilEnd?: RowKind },
): boolean {
  if (!hasMagicRingQualifier(steps)) {
    return false;
  }

  return (
    steps.length !== 1 ||
    extras?.repeatCount !== undefined ||
    extras?.repeatUntilEnd !== undefined
  );
}

function parseAction(
  fragment: string,
  matchAt: TermMatcher,
): ExplainedAction | "unknown-term" | "leftover" | null {
  const trimmed = fragment.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const quantityMatch = QUANTITY_RE.exec(trimmed);
  if (!quantityMatch) {
    return null;
  }

  let index = quantityMatch[0].length;
  while (index < trimmed.length && WHITESPACE.test(trimmed[index] ?? "")) {
    index += 1;
  }

  if (index >= trimmed.length) {
    return null;
  }

  const matched = matchAt(trimmed, index);
  if (!matched) {
    return "unknown-term";
  }

  const action: ExplainedAction = {
    quantity: Number.parseInt(quantityMatch[1] ?? "", 10),
    term: {
      id: matched.term.id,
      code: matched.term.code,
      label: matched.term.label,
    },
  };

  if (matched.end === trimmed.length) {
    return action;
  }

  const afterTerm = trimmed.slice(matched.end);
  if (!WHITESPACE.test(afterTerm[0] ?? "")) {
    return "leftover";
  }

  const qualifier = parseActionQualifier(afterTerm);
  if (!qualifier) {
    return "leftover";
  }

  action.qualifier = qualifier;
  return action;
}

function parseActionSequence(
  text: string,
  matchAt: TermMatcher,
): ActionSequenceResult {
  const parts = text.split(",");
  const steps: ExplainedAction[] = [];

  for (const part of parts) {
    const parsed = parseAction(part, matchAt);

    if (parsed === "unknown-term" || parsed === "leftover") {
      return {
        ok: false,
        reason: parsed === "unknown-term" ? "unknown-term" : "unsupported-syntax",
      };
    }

    if (parsed === null) {
      return { ok: false, reason: "no-supported-pattern" };
    }

    steps.push(parsed);
  }

  if (steps.length === 0) {
    return { ok: false, reason: "no-supported-pattern" };
  }

  if (isMagicRingMisused(steps)) {
    return { ok: false, reason: "unsupported-syntax" };
  }

  return { ok: true, steps };
}

function closerFor(opener: string): string | null {
  if (opener === "*") {
    return "*";
  }
  if (opener === "[") {
    return "]";
  }
  if (opener === "(") {
    return ")";
  }
  return null;
}

function tryParseRepeatBlock(
  body: string,
  matchAt: TermMatcher,
): RepeatBlockResult | null {
  const trimmed = body.trim();
  const opener = trimmed[0] ?? "";
  const closer = closerFor(opener);
  if (!closer) {
    return null;
  }

  const closeIndex = trimmed.indexOf(closer, 1);
  if (closeIndex === -1) {
    return null;
  }

  const after = trimmed.slice(closeIndex + 1);
  const multiplier = MULTIPLIER_RE.exec(after);
  const frenchTimes = opener === "(" ? FRENCH_TIMES_RE.exec(after) : null;
  if (!multiplier && !frenchTimes) {
    return null;
  }

  const inner = trimmed.slice(1, closeIndex);
  if (NESTED_DELIMITER.test(inner)) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const sequence = parseActionSequence(inner, matchAt);
  if (!sequence.ok) {
    return { kind: "error", reason: sequence.reason };
  }

  if (hasPositionQualifier(sequence.steps)) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  if (frenchTimes) {
    if (sequence.steps.length < 2) {
      return { kind: "error", reason: "unsupported-syntax" };
    }

    return {
      kind: "ok",
      steps: sequence.steps,
      repeatCount: Number.parseInt(frenchTimes[1] ?? "", 10),
    };
  }

  return {
    kind: "ok",
    steps: sequence.steps,
    repeatCount: Number.parseInt(multiplier?.[1] ?? "", 10),
  };
}

function formatQualifierSuffix(qualifier: ActionQualifier): string {
  switch (qualifier) {
    case "each-stitch":
      return " dans chaque maille";
    case "next-stitch":
      return " dans la maille suivante";
    case "magic-ring":
      return " dans un anneau magique";
  }
}

export function parseBeginnerExplanation(
  text: string,
  terms: CrochetTermWithAliases[],
): BeginnerExplanation {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { kind: "unsupported", reason: "empty" };
  }

  const matchAt = createTermMatcher(terms);
  const prefix = parseRowPrefix(trimmed);
  const afterPrefix = prefix ? prefix.rest : trimmed;
  const countSplit = splitTrailingCount(afterPrefix);

  if ("ambiguous" in countSplit) {
    return { kind: "unsupported", reason: "ambiguous" };
  }

  const body = countSplit.body.trim();
  if (body.length === 0) {
    return { kind: "unsupported", reason: "no-supported-pattern" };
  }

  const untilEndSplit = splitUntilEndSuffix(body);
  let remaining = untilEndSplit.rest.trim();
  const repeatUntilEnd = untilEndSplit.repeatUntilEnd;

  if (remaining.length === 0) {
    return { kind: "unsupported", reason: "no-supported-pattern" };
  }

  let phraseRepeatCount: number | undefined;
  if (!repeatUntilEnd) {
    const phraseSplit = splitRepeatPhraseSuffix(remaining);
    if (phraseSplit.repeatCount !== undefined) {
      remaining = phraseSplit.rest.trim();
      phraseRepeatCount = phraseSplit.repeatCount;
      if (remaining.length === 0) {
        return { kind: "unsupported", reason: "no-supported-pattern" };
      }
    }
  }

  const repeat = tryParseRepeatBlock(remaining, matchAt);

  if (repeatUntilEnd) {
    if (repeat !== null) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    const sequence = parseActionSequence(remaining, matchAt);
    if (!sequence.ok) {
      return { kind: "unsupported", reason: sequence.reason };
    }

    if (sequence.steps.length < 2) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    if (isMagicRingMisused(sequence.steps, { repeatUntilEnd })) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    if (prefix && prefix.row.kind !== repeatUntilEnd) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    const explanation: Extract<BeginnerExplanation, { kind: "explained" }> = {
      kind: "explained",
      steps: sequence.steps,
      repeatUntilEnd,
    };

    if (prefix) {
      explanation.row = prefix.row;
    }
    if (countSplit.expectedStitchCount !== undefined) {
      explanation.expectedStitchCount = countSplit.expectedStitchCount;
    }

    return explanation;
  }

  if (phraseRepeatCount !== undefined) {
    if (repeat !== null || hasResidualRepeatSyntax(remaining)) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    const sequence = parseActionSequence(remaining, matchAt);
    if (!sequence.ok) {
      return { kind: "unsupported", reason: sequence.reason };
    }

    if (
      sequence.steps.length < 2 ||
      hasPositionQualifier(sequence.steps) ||
      isMagicRingMisused(sequence.steps, { repeatCount: phraseRepeatCount })
    ) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    const explanation: Extract<BeginnerExplanation, { kind: "explained" }> = {
      kind: "explained",
      steps: sequence.steps,
      repeatCount: phraseRepeatCount,
    };

    if (prefix) {
      explanation.row = prefix.row;
    }
    if (countSplit.expectedStitchCount !== undefined) {
      explanation.expectedStitchCount = countSplit.expectedStitchCount;
    }

    return explanation;
  }

  if (repeat?.kind === "error") {
    return { kind: "unsupported", reason: repeat.reason };
  }

  let steps: ExplainedAction[];
  let repeatCount: number | undefined;

  if (repeat?.kind === "ok") {
    steps = repeat.steps;
    repeatCount = repeat.repeatCount;
  } else {
    const sequence = parseActionSequence(remaining, matchAt);
    if (!sequence.ok) {
      return { kind: "unsupported", reason: sequence.reason };
    }
    steps = sequence.steps;
  }

  if (isMagicRingMisused(steps, { repeatCount })) {
    return { kind: "unsupported", reason: "unsupported-syntax" };
  }

  const explanation: Extract<BeginnerExplanation, { kind: "explained" }> = {
    kind: "explained",
    steps,
  };

  if (prefix) {
    explanation.row = prefix.row;
  }
  if (repeatCount !== undefined) {
    explanation.repeatCount = repeatCount;
  }
  if (countSplit.expectedStitchCount !== undefined) {
    explanation.expectedStitchCount = countSplit.expectedStitchCount;
  }

  return explanation;
}

export function formatActionLine(action: ExplainedAction): string {
  const qualifier = action.qualifier
    ? formatQualifierSuffix(action.qualifier)
    : "";
  return `Fais ${action.quantity} × ${action.term.label}${qualifier}.`;
}

export function formatExpectedStitchCountLine(
  count: number,
  row?: { kind: RowKind; number: number },
  repeatUntilEnd?: RowKind,
): string {
  const target = row?.kind ?? repeatUntilEnd;
  if (target === "rang") {
    return `Le patron indique ${count} mailles à la fin de ce rang.`;
  }
  if (target === "tour") {
    return `Le patron indique ${count} mailles à la fin de ce tour.`;
  }
  return `Le patron indique ${count} mailles à la fin de l’instruction.`;
}

export function toBeginnerExplanationCopy(
  explanation: Extract<BeginnerExplanation, { kind: "explained" }>,
): BeginnerExplanationCopy {
  const copy: BeginnerExplanationCopy = {
    actionLines: explanation.steps.map(formatActionLine),
  };

  if (explanation.row) {
    copy.rowIntro = `Pour le ${explanation.row.kind} ${explanation.row.number} :`;
  }

  if (explanation.repeatUntilEnd) {
    copy.repeatIntro = `Répète jusqu’à la fin du ${explanation.repeatUntilEnd} :`;
  } else if (explanation.repeatCount !== undefined) {
    copy.repeatIntro = `Répète ${explanation.repeatCount} fois :`;
  }

  if (hasPositionQualifier(explanation.steps)) {
    copy.positionCautionNote = POSITION_QUALIFIER_NOTE;
  }

  if (explanation.expectedStitchCount !== undefined) {
    copy.expectedStitchCountLine = formatExpectedStitchCountLine(
      explanation.expectedStitchCount,
      explanation.row,
      explanation.repeatUntilEnd,
    );
  }

  return copy;
}
