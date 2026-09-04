export function normalizeTermExpression(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr").normalize("NFC");
}

/** Données d’affichage d’une fiche terme, sans alias. */
export type CrochetTermHelp = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  imagePath: string | null;
};

/**
 * Terme chargé pour le lecteur.
 * Seuls `code` et `aliases` sont des expressions reconnues par le matcher.
 * `label` est une donnée d’affichage et n’est jamais ajouté automatiquement.
 */
export type CrochetTermWithAliases = CrochetTermHelp & {
  aliases: string[];
};

export type TextSegment = {
  type: "text";
  value: string;
};

export type TermSegment = {
  type: "term";
  value: string;
  term: CrochetTermHelp;
};

export type StepSegment = TextSegment | TermSegment;

export type TermMatch = {
  end: number;
  value: string;
  term: CrochetTermHelp;
};

export type TermMatcher = (text: string, start: number) => TermMatch | null;

type MatchableExpression = {
  normalized: string;
  term: CrochetTermHelp;
};

const UNICODE_LETTER = /\p{L}/u;
const WHITESPACE = /\s/u;

function toHelp(term: CrochetTermWithAliases): CrochetTermHelp {
  return {
    id: term.id,
    code: term.code,
    label: term.label,
    description: term.description,
    imagePath: term.imagePath,
  };
}

function buildMatchableExpressions(
  terms: CrochetTermWithAliases[],
): MatchableExpression[] {
  const byNormalized = new Map<string, CrochetTermHelp>();

  for (const term of terms) {
    const help = toHelp(term);
    const expressions = [term.code, ...term.aliases];

    for (const raw of expressions) {
      const normalized = normalizeTermExpression(raw);
      if (!normalized || byNormalized.has(normalized)) {
        continue;
      }
      byNormalized.set(normalized, help);
    }
  }

  return [...byNormalized.entries()]
    .map(([normalized, term]) => ({ normalized, term }))
    .sort((a, b) => {
      const lengthDelta = b.normalized.length - a.normalized.length;
      if (lengthDelta !== 0) {
        return lengthDelta;
      }
      return a.normalized.localeCompare(b.normalized, "fr");
    });
}

function isUnicodeLetter(character: string): boolean {
  return UNICODE_LETTER.test(character);
}

function isLeftBoundary(text: string, index: number): boolean {
  if (index <= 0) {
    return true;
  }
  return !isUnicodeLetter(text[index - 1] ?? "");
}

function isRightBoundary(text: string, endIndex: number): boolean {
  if (endIndex >= text.length) {
    return true;
  }
  return !isUnicodeLetter(text[endIndex] ?? "");
}

function consumeExpectedChar(
  text: string,
  start: number,
  expected: string,
): number | null {
  const maxLen = Math.min(4, text.length - start);

  for (let len = 1; len <= maxLen; len += 1) {
    const folded = text
      .slice(start, start + len)
      .toLocaleLowerCase("fr")
      .normalize("NFC");

    if (folded === expected) {
      return start + len;
    }

    if (folded.length > expected.length) {
      break;
    }
  }

  return null;
}

function tryMatchAt(
  text: string,
  start: number,
  normalized: string,
): number | null {
  let index = start;
  let expectedIndex = 0;

  while (expectedIndex < normalized.length) {
    const expected = normalized[expectedIndex] ?? "";

    if (expected === " ") {
      if (index >= text.length || !WHITESPACE.test(text[index] ?? "")) {
        return null;
      }
      while (index < text.length && WHITESPACE.test(text[index] ?? "")) {
        index += 1;
      }
      expectedIndex += 1;
      continue;
    }

    const nextIndex = consumeExpectedChar(text, index, expected);
    if (nextIndex === null) {
      return null;
    }
    index = nextIndex;
    expectedIndex += 1;
  }

  return index;
}

/**
 * Construit un matcher de termes (`code` + `aliases` uniquement).
 * Même règles que `segmentStepText` : plus long d’abord, frontières lettres Unicode.
 */
export function createTermMatcher(
  terms: CrochetTermWithAliases[],
): TermMatcher {
  const expressions = buildMatchableExpressions(terms);

  return (text, start) => {
    if (!isLeftBoundary(text, start)) {
      return null;
    }

    for (const expression of expressions) {
      const end = tryMatchAt(text, start, expression.normalized);
      if (end !== null && isRightBoundary(text, end)) {
        return {
          end,
          value: text.slice(start, end),
          term: expression.term,
        };
      }
    }

    return null;
  };
}

export function segmentStepText(
  text: string,
  terms: CrochetTermWithAliases[],
): StepSegment[] {
  if (text.length === 0) {
    return [{ type: "text", value: "" }];
  }

  const matchAt = createTermMatcher(terms);
  const segments: StepSegment[] = [];
  let index = 0;
  let textBuffer = "";

  const flushText = (): void => {
    if (textBuffer.length === 0) {
      return;
    }
    segments.push({ type: "text", value: textBuffer });
    textBuffer = "";
  };

  while (index < text.length) {
    const matched = matchAt(text, index);

    if (matched) {
      flushText();
      segments.push({
        type: "term",
        value: matched.value,
        term: matched.term,
      });
      index = matched.end;
      continue;
    }

    textBuffer += text[index] ?? "";
    index += 1;
  }

  flushText();

  if (segments.length === 0) {
    return [{ type: "text", value: text }];
  }

  return segments;
}
