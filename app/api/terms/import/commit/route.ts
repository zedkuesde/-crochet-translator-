import { NextResponse } from "next/server";

import {
  ImportError,
  commitImport,
  importErrorToJson,
  parseImportEnvelope,
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
    const envelope = parseImportEnvelope(raw);

    if (!envelope.payloadHash || !envelope.catalogFingerprint) {
      throw new ImportError(
        400,
        "invalid_json",
        "Les champs payloadHash et catalogFingerprint sont obligatoires.",
      );
    }

    const result = await commitImport({
      jsonText: envelope.jsonText,
      payloadHash: envelope.payloadHash,
      catalogFingerprint: envelope.catalogFingerprint,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
