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

export type RowScope =
  | { kind: "single"; rowKind: RowKind; number: number }
  | {
      kind: "range";
      rowKind: RowKind;
      from: number;
      to: number;
      declaredCount: number;
    };

export type ExplanationPart =
  | {
      kind: "actions";
      steps: ExplainedAction[];
    }
  | {
      kind: "repeat";
      count: number;
      steps: ExplainedAction[];
    }
  | {
      kind: "repeat-until-end";
      rowKind: RowKind;
      steps: ExplainedAction[];
    }
  | {
      kind: "repeat-across-rows";
      rowKind: RowKind;
      declaredCount: number;
      steps: ExplainedAction[];
    };

export type BeginnerExplanation =
  | {
      kind: "explained";
      scope?: RowScope;
      parts: ExplanationPart[];
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

export type ExplanationPartCopy = {
  heading?: string;
  actionLines: string[];
};

export type BeginnerExplanationCopy = {
  rowIntro?: string;
  parts: ExplanationPartCopy[];
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
const ROW_RANGE_PREFIX_RE =
  /^(tours|rangs)\s+([1-9]\d{0,2})\s*[-–]\s*([1-9]\d{0,2})\s*\(\s*([1-9]\d{0,2})\s+(tours|rangs)\s*\)\s*:\s*/iu;
const TRAILING_COUNT_RE = /\(\s*([1-9]\d{0,3})\s*\)\s*$/u;
const TRAILING_BRACKET_COUNT_RE = /\[\s*([1-9]\d{0,3})\s*\]\s*$/u;
const MULTIPLIER_RE = /^\s*[x×]\s*([1-9]\d{0,2})\s*$/iu;
const FRENCH_TIMES_PREFIX_RE = /^\s*([1-9]\d{0,2})\s*fois(?=\s|,|$)/iu;
const TIMES_TOKEN_RE = /[1-9]\d{0,2}\s*fois/giu;
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

type SandwichResult =
  | {
      kind: "ok";
      before: ExplainedAction[];
      repeated: ExplainedAction[];
      after: ExplainedAction[];
      count: number;
    }
  | { kind: "error"; reason: ParseFailure["reason"] };

function foldPhrase(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("fr")
    .replace(/\s+/gu, " ")
    .trim();
}

function rowKindFromPlural(value: string): RowKind | null {
  const folded = foldPhrase(value);
  if (folded === "tours") {
    return "tour";
  }
  if (folded === "rangs") {
    return "rang";
  }
  return null;
}

function parseRowPrefix(text: string): {
  scope: Extract<RowScope, { kind: "single" }>;
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
      scope: {
        kind: "single",
        rowKind: "rang",
        number: Number.parseInt(rangNumber, 10),
      },
      rest: text.slice(match[0].length),
    };
  }

  if (tourNumber) {
    return {
      scope: {
        kind: "single",
        rowKind: "tour",
        number: Number.parseInt(tourNumber, 10),
      },
      rest: text.slice(match[0].length),
    };
  }

  return null;
}

function parseRowRangePrefix(text: string):
  | {
      kind: "ok";
      scope: Extract<RowScope, { kind: "range" }>;
      rest: string;
    }
  | { kind: "error"; reason: ParseFailure["reason"] }
  | null {
  const match = ROW_RANGE_PREFIX_RE.exec(text);
  if (!match) {
    return null;
  }

  const prefixKind = rowKindFromPlural(match[1] ?? "");
  const parenKind = rowKindFromPlural(match[5] ?? "");
  if (!prefixKind || !parenKind || prefixKind !== parenKind) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const from = Number.parseInt(match[2] ?? "", 10);
  const to = Number.parseInt(match[3] ?? "", 10);
  const declaredCount = Number.parseInt(match[4] ?? "", 10);
  if (from > to) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  return {
    kind: "ok",
    scope: {
      kind: "range",
      rowKind: prefixKind,
      from,
      to,
      declaredCount,
    },
    rest: text.slice(match[0].length),
  };
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

function consumeFrenchTimes(
  text: string,
): { count: number; rest: string } | null {
  const match = FRENCH_TIMES_PREFIX_RE.exec(text);
  if (!match) {
    return null;
  }

  return {
    count: Number.parseInt(match[1] ?? "", 10),
    rest: text.slice(match[0].length),
  };
}

function countChar(text: string, char: string): number {
  let count = 0;
  for (const current of text) {
    if (current === char) {
      count += 1;
    }
  }
  return count;
}

function allExplainedSteps(parts: ExplanationPart[]): ExplainedAction[] {
  return parts.flatMap((part) => part.steps);
}

function explainedResult(
  parts: ExplanationPart[],
  scope: RowScope | undefined,
  expectedStitchCount?: number,
): Extract<BeginnerExplanation, { kind: "explained" }> {
  const explanation: Extract<BeginnerExplanation, { kind: "explained" }> = {
    kind: "explained",
    parts,
  };

  if (scope) {
    explanation.scope = scope;
  }
  if (expectedStitchCount !== undefined) {
    explanation.expectedStitchCount = expectedStitchCount;
  }

  return explanation;
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

function hasDisallowedRangeQualifier(steps: ExplainedAction[]): boolean {
  return steps.some(
    (step) =>
      step.qualifier === "next-stitch" || step.qualifier === "magic-ring",
  );
}

function hasForbiddenRangeBodySyntax(body: string): boolean {
  const normalized = body.normalize("NFC");
  return (
    UNTIL_END_RE.test(normalized) ||
    REPEAT_PHRASE_RE.test(normalized) ||
    hasResidualRepeatSyntax(normalized) ||
    normalized.includes(";")
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
  const frenchTimes = opener === "(" ? consumeFrenchTimes(after) : null;
  const frenchTimesWhole =
    frenchTimes && frenchTimes.rest.trim() === "" ? frenchTimes : null;
  if (!multiplier && !frenchTimesWhole) {
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

  if (frenchTimesWhole) {
    if (sequence.steps.length < 2) {
      return { kind: "error", reason: "unsupported-syntax" };
    }

    return {
      kind: "ok",
      steps: sequence.steps,
      repeatCount: frenchTimesWhole.count,
    };
  }

  return {
    kind: "ok",
    steps: sequence.steps,
    repeatCount: Number.parseInt(multiplier?.[1] ?? "", 10),
  };
}

function tryParseSandwichRepeat(
  body: string,
  matchAt: TermMatcher,
): SandwichResult | null {
  const trimmed = body.trim();
  const openCount = countChar(trimmed, "(");
  const closeCount = countChar(trimmed, ")");
  if (openCount === 0 && closeCount === 0) {
    return null;
  }

  if (openCount !== 1 || closeCount !== 1) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const openIndex = trimmed.indexOf("(");
  const closeIndex = trimmed.indexOf(")");
  if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const timesTokens = trimmed.match(TIMES_TOKEN_RE);
  if (!timesTokens || timesTokens.length !== 1) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const beforeRaw = trimmed.slice(0, openIndex);
  const inner = trimmed.slice(openIndex + 1, closeIndex);
  const afterBlock = trimmed.slice(closeIndex + 1);

  const beforeTrimmed = beforeRaw.trim();
  if (!beforeTrimmed.endsWith(",")) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const beforeText = beforeTrimmed.slice(0, -1).trim();
  if (beforeText.length === 0 || hasResidualRepeatSyntax(beforeText)) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  if (inner.trim().length === 0 || NESTED_DELIMITER.test(inner)) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const consumed = consumeFrenchTimes(afterBlock);
  if (!consumed) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const afterTrimmed = consumed.rest.trim();
  if (!afterTrimmed.startsWith(",")) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const afterText = afterTrimmed.slice(1).trim();
  if (afterText.length === 0 || hasResidualRepeatSyntax(afterText)) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const beforeSeq = parseActionSequence(beforeText, matchAt);
  if (!beforeSeq.ok) {
    return { kind: "error", reason: beforeSeq.reason };
  }

  const innerSeq = parseActionSequence(inner, matchAt);
  if (!innerSeq.ok) {
    return { kind: "error", reason: innerSeq.reason };
  }

  if (innerSeq.steps.length < 2) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  const afterSeq = parseActionSequence(afterText, matchAt);
  if (!afterSeq.ok) {
    return { kind: "error", reason: afterSeq.reason };
  }

  if (
    hasPositionQualifier(beforeSeq.steps) ||
    hasPositionQualifier(innerSeq.steps) ||
    hasPositionQualifier(afterSeq.steps)
  ) {
    return { kind: "error", reason: "unsupported-syntax" };
  }

  return {
    kind: "ok",
    before: beforeSeq.steps,
    repeated: innerSeq.steps,
    after: afterSeq.steps,
    count: consumed.count,
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
  const rangePrefix = parseRowRangePrefix(trimmed);
  if (rangePrefix?.kind === "error") {
    return { kind: "unsupported", reason: rangePrefix.reason };
  }

  if (rangePrefix?.kind === "ok") {
    return parseRangeExplanation(rangePrefix.scope, rangePrefix.rest, matchAt);
  }

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

    if (prefix && prefix.scope.rowKind !== repeatUntilEnd) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    return explainedResult(
      [
        {
          kind: "repeat-until-end",
          rowKind: repeatUntilEnd,
          steps: sequence.steps,
        },
      ],
      prefix?.scope,
      countSplit.expectedStitchCount,
    );
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

    return explainedResult(
      [{ kind: "repeat", count: phraseRepeatCount, steps: sequence.steps }],
      prefix?.scope,
      countSplit.expectedStitchCount,
    );
  }

  if (repeat?.kind === "error") {
    return { kind: "unsupported", reason: repeat.reason };
  }

  if (repeat?.kind === "ok") {
    if (isMagicRingMisused(repeat.steps, { repeatCount: repeat.repeatCount })) {
      return { kind: "unsupported", reason: "unsupported-syntax" };
    }

    return explainedResult(
      [{ kind: "repeat", count: repeat.repeatCount, steps: repeat.steps }],
      prefix?.scope,
      countSplit.expectedStitchCount,
    );
  }

  const sandwich = tryParseSandwichRepeat(remaining, matchAt);
  if (sandwich?.kind === "error") {
    return { kind: "unsupported", reason: sandwich.reason };
  }

  if (sandwich?.kind === "ok") {
    return explainedResult(
      [
        { kind: "actions", steps: sandwich.before },
        { kind: "repeat", count: sandwich.count, steps: sandwich.repeated },
        { kind: "actions", steps: sandwich.after },
      ],
      prefix?.scope,
      countSplit.expectedStitchCount,
    );
  }

  const sequence = parseActionSequence(remaining, matchAt);
  if (!sequence.ok) {
    return { kind: "unsupported", reason: sequence.reason };
  }

  if (isMagicRingMisused(sequence.steps)) {
    return { kind: "unsupported", reason: "unsupported-syntax" };
  }

  return explainedResult(
    [{ kind: "actions", steps: sequence.steps }],
    prefix?.scope,
    countSplit.expectedStitchCount,
  );
}

function parseRangeExplanation(
  scope: Extract<RowScope, { kind: "range" }>,
  afterPrefix: string,
  matchAt: TermMatcher,
): BeginnerExplanation {
  const countSplit = splitTrailingCount(afterPrefix);

  if ("ambiguous" in countSplit) {
    return { kind: "unsupported", reason: "ambiguous" };
  }

  const body = countSplit.body.trim();
  if (body.length === 0) {
    return { kind: "unsupported", reason: "no-supported-pattern" };
  }

  if (hasForbiddenRangeBodySyntax(body)) {
    return { kind: "unsupported", reason: "unsupported-syntax" };
  }

  const sequence = parseActionSequence(body, matchAt);
  if (!sequence.ok) {
    return { kind: "unsupported", reason: sequence.reason };
  }

  if (hasDisallowedRangeQualifier(sequence.steps)) {
    return { kind: "unsupported", reason: "unsupported-syntax" };
  }

  return explainedResult(
    [
      {
        kind: "repeat-across-rows",
        rowKind: scope.rowKind,
        declaredCount: scope.declaredCount,
        steps: sequence.steps,
      },
    ],
    scope,
    countSplit.expectedStitchCount,
  );
}

export function formatActionLine(action: ExplainedAction): string {
  const qualifier = action.qualifier
    ? formatQualifierSuffix(action.qualifier)
    : "";
  return `Fais ${action.quantity} × ${action.term.label}${qualifier}.`;
}

function pluralRowKind(rowKind: RowKind): string {
  return rowKind === "rang" ? "rangs" : "tours";
}

export function formatExpectedStitchCountLine(
  count: number,
  scope?: RowScope,
  repeatUntilEnd?: RowKind,
): string {
  if (scope?.kind === "range") {
    return `Le patron indique ${count} mailles pour cette plage de ${pluralRowKind(scope.rowKind)}.`;
  }

  const target =
    scope?.kind === "single" ? scope.rowKind : repeatUntilEnd;
  if (target === "rang") {
    return `Le patron indique ${count} mailles à la fin de ce rang.`;
  }
  if (target === "tour") {
    return `Le patron indique ${count} mailles à la fin de ce tour.`;
  }
  return `Le patron indique ${count} mailles à la fin de l’instruction.`;
}

function isSandwichParts(parts: ExplanationPart[]): boolean {
  return (
    parts.length === 3 &&
    parts[0]?.kind === "actions" &&
    parts[1]?.kind === "repeat" &&
    parts[2]?.kind === "actions"
  );
}

function headingForPart(
  part: ExplanationPart,
  index: number,
  sandwich: boolean,
): string | undefined {
  if (part.kind === "repeat") {
    return `Répète ${part.count} fois :`;
  }

  if (part.kind === "repeat-until-end") {
    return `Répète jusqu’à la fin du ${part.rowKind} :`;
  }

  if (part.kind === "repeat-across-rows") {
    return `Fais la même instruction pendant ${part.declaredCount} ${pluralRowKind(part.rowKind)} :`;
  }

  if (sandwich && index === 0) {
    return "Avant la répétition :";
  }

  if (sandwich && index === 2) {
    return "Après la répétition :";
  }

  return undefined;
}

export function toBeginnerExplanationCopy(
  explanation: Extract<BeginnerExplanation, { kind: "explained" }>,
): BeginnerExplanationCopy {
  const sandwich = isSandwichParts(explanation.parts);
  const copy: BeginnerExplanationCopy = {
    parts: explanation.parts.map((part, index) => {
      const heading = headingForPart(part, index, sandwich);
      const partCopy: ExplanationPartCopy = {
        actionLines: part.steps.map(formatActionLine),
      };
      if (heading) {
        partCopy.heading = heading;
      }
      return partCopy;
    }),
  };

  if (explanation.scope?.kind === "single") {
    copy.rowIntro = `Pour le ${explanation.scope.rowKind} ${explanation.scope.number} :`;
  } else if (explanation.scope?.kind === "range") {
    copy.rowIntro = `Pour les ${pluralRowKind(explanation.scope.rowKind)} ${explanation.scope.from} à ${explanation.scope.to} :`;
  }

  if (hasPositionQualifier(allExplainedSteps(explanation.parts))) {
    copy.positionCautionNote = POSITION_QUALIFIER_NOTE;
  }

  if (explanation.expectedStitchCount !== undefined) {
    const untilEnd = explanation.parts.find(
      (part) => part.kind === "repeat-until-end",
    );
    copy.expectedStitchCountLine = formatExpectedStitchCountLine(
      explanation.expectedStitchCount,
      explanation.scope,
      untilEnd?.kind === "repeat-until-end" ? untilEnd.rowKind : undefined,
    );
  }

  return copy;
}
