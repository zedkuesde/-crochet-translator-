export function normalizeTermExpression(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr").normalize("NFC");
}
