export const IMPORT_FORMAT = "crochet-translator-terms";
export const IMPORT_VERSION = 1;

/** Taille max du champ `jsonText` (UTF-8), 1 Mio. */
export const MAX_JSON_TEXT_BYTES = 1_048_576;

/** Taille max du corps HTTP (`{"jsonText":...}` + hashes). */
export const MAX_HTTP_BODY_BYTES = MAX_JSON_TEXT_BYTES + 65_536;

export const MAX_TERMS = 500;
export const MAX_ALIASES_PER_TERM = 50;
export const MAX_CODE_LENGTH = 64;
export const MAX_LABEL_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_IMAGE_PATH_LENGTH = 255;
export const MAX_ALIAS_LENGTH = 120;

export const ROOT_KEYS = ["format", "version", "terms"] as const;
export const TERM_KEYS = [
  "code",
  "label",
  "description",
  "imagePath",
  "aliases",
] as const;
