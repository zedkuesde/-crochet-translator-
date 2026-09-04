import { NextResponse } from "next/server";

import {
  ImportError,
  importErrorToJson,
  parseImportEnvelope,
  previewImportWithDb,
} from "@/lib/terms-import";

function handleError(error: unknown): NextResponse {
  if (error instanceof ImportError) {
    return NextResponse.json(importErrorToJson(error), { status: error.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Une erreur inattendue est survenue." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const { jsonText } = parseImportEnvelope(raw);
    const preview = await previewImportWithDb(jsonText);
    return NextResponse.json(preview);
  } catch (error) {
    return handleError(error);
  }
}
