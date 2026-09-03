import { NextResponse } from "next/server";

import { TermError, addAlias, termErrorToJson } from "@/lib/terms";

type RouteContext = {
  params: Promise<{ id: string }>;
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

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const payload = body as { alias?: unknown };

  try {
    const term = await addAlias(id, payload.alias);
    return NextResponse.json(term, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
