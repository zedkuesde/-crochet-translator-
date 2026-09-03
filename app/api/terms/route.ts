import { NextResponse } from "next/server";

import {
  TermError,
  createTerm,
  listTermsForAdmin,
  termErrorToJson,
} from "@/lib/terms";

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

export async function GET() {
  try {
    const terms = await listTermsForAdmin();
    return NextResponse.json({ terms });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const payload = body as {
    code?: unknown;
    label?: unknown;
    description?: unknown;
    imagePath?: unknown;
    aliases?: unknown;
  };

  try {
    const term = await createTerm(payload);
    return NextResponse.json(term, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
