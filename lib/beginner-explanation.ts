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

export type ExplainedAction = {
  quantity: number;
  term: ExplainedTerm;
};

export type RowKind = "rang" | "tour";

export type BeginnerExplanation =
  | {
      kind: "explained";
      row?: { kind: RowKind; number: number };
      repeatCount?: number;
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
  expectedStitchCountLine?: string;
};

export const UNSUPPORTED_EXPLANATION_NOTE =
  "Cette instruction est conservée telle quelle : son format n’est pas encore expliqué automatiquement.";

const WHITESPACE = /\s/u;
const NESTED_DELIMITER = /[*[\]()]/u;
const NUMERIC_PARENS = /\(\s*[1-9]\d{0,3}\s*\)/u;
const ROW_PREFIX_RE =
  /^(?:rang\s+([1-9]\d{0,2})|tour\s+([1-9]\d{0,2})|r([1-9]\d{0,2})|t([1-9]\d{0,2}))\s*:\s*/iu;
const TRAILING_COUNT_RE = /\(\s*([1-9]\d{0,3})\s*\)\s*$/u;
const MULTIPLIER_RE = /^\s*[x×]\s*([1-9]\d{0,2})\s*$/iu;
const QUANTITY_RE = /^([1-9]\d{0,2})/u;

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
  const match = TRAILING_COUNT_RE.exec(text);
  if (!match || match.index === undefined) {
    return { body: text };
  }

  const body = text.slice(0, match.index).trimEnd();
  if (NUMERIC_PARENS.test(body)) {
    return { ambiguous: true };
  }

  return {
    body,
    expectedStitchCount: Number.parseInt(match[1] ?? "", 10),
  };
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

  if (matched.end !== trimmed.length) {
    return "leftover";
  }

  return {
    quantity: Number.parseInt(quantityMatch[1] ?? "", 10),
    term: {
      id: matched.term.id,
      code: matched.term.code,
      label: matched.term.label,
    },
  };
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
  if (!multiplier) {
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

  return {
    kind: "ok",
    steps: sequence.steps,
    repeatCount: Number.parseInt(multiplier[1] ?? "", 10),
  };
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

  const repeat = tryParseRepeatBlock(body, matchAt);
  if (repeat?.kind === "error") {
    return { kind: "unsupported", reason: repeat.reason };
  }

  let steps: ExplainedAction[];
  let repeatCount: number | undefined;

  if (repeat?.kind === "ok") {
    steps = repeat.steps;
    repeatCount = repeat.repeatCount;
  } else {
    const sequence = parseActionSequence(body, matchAt);
    if (!sequence.ok) {
      return { kind: "unsupported", reason: sequence.reason };
    }
    steps = sequence.steps;
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
  return `Fais ${action.quantity} × ${action.term.label}.`;
}

export function formatExpectedStitchCountLine(
  count: number,
  row?: { kind: RowKind; number: number },
): string {
  if (row?.kind === "rang") {
    return `Le patron indique ${count} mailles à la fin de ce rang.`;
  }
  if (row?.kind === "tour") {
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

  if (explanation.repeatCount !== undefined) {
    copy.repeatIntro = `Répète ${explanation.repeatCount} fois :`;
  }

  if (explanation.expectedStitchCount !== undefined) {
    copy.expectedStitchCountLine = formatExpectedStitchCountLine(
      explanation.expectedStitchCount,
      explanation.row,
    );
  }

  return copy;
}
