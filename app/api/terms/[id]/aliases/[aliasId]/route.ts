import { NextResponse } from "next/server";

import { TermError, removeAlias, termErrorToJson } from "@/lib/terms";

type RouteContext = {
  params: Promise<{ id: string; aliasId: string }>;
};

function handleError(error: unknown): NextResponse {
  if (error instanceof TermError) {
    return NextResponse.json(termErrorToJson(error), { status: error.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Une erreur inattendue est survenue." },
    { status: 500 },
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, aliasId } = await context.params;

  try {
    const term = await removeAlias(id, aliasId);
    return NextResponse.json(term);
  } catch (error) {
    return handleError(error);
  }
}
