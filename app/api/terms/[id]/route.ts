import { NextResponse } from "next/server";

import {
  TermError,
  deleteTerm,
  getTermById,
  termErrorToJson,
  updateTerm,
} from "@/lib/terms";

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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const term = await getTermById(id);

    if (!term) {
      return NextResponse.json({ error: "Terme introuvable." }, { status: 404 });
    }

    return NextResponse.json(term);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

  try {
    const term = await updateTerm(id, body as {
      code?: unknown;
      label?: unknown;
      description?: unknown;
      imagePath?: unknown;
    });
    return NextResponse.json(term);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const deleted = await deleteTerm(id);
    return NextResponse.json(deleted);
  } catch (error) {
    return handleError(error);
  }
}
