export type TermField =
  | "code"
  | "label"
  | "description"
  | "imagePath"
  | "alias"
  | "aliases";

export type TermAliasDto = {
  id: string;
  alias: string;
  aliasNormalized: string;
};

export type TermDto = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  imagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
  aliases: TermAliasDto[];
};

export type TermFormValue = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  imagePath: string | null;
  aliases: TermAliasDto[];
};
