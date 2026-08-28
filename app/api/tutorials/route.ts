import { NextResponse } from "next/server";

import {
  createTutorial,
  getAllTutorials,
  parseLines,
} from "@/lib/tutorials";

type CreateTutorialBody = {
  rawText?: unknown;
  name?: unknown;
};

export async function POST(request: Request) {
  let body: CreateTutorialBody;

  try {
    body = (await request.json()) as CreateTutorialBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.rawText !== "string") {
    return NextResponse.json(
      { error: "rawText is required and must be a string" },
      { status: 400 },
    );
  }

  const rawText = body.rawText.trim();

  if (parseLines(rawText).length === 0) {
    return NextResponse.json(
      { error: "rawText must contain at least one non-empty line" },
      { status: 400 },
    );
  }

  const name =
    body.name === undefined || body.name === null
      ? undefined
      : typeof body.name === "string"
        ? body.name.trim() || undefined
        : null;

  if (name === null) {
    return NextResponse.json(
      { error: "name must be a string when provided" },
      { status: 400 },
    );
  }

  try {
    const id = await createTutorial(rawText, name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EMPTY_TEXT") {
      return NextResponse.json(
        { error: "rawText must contain at least one non-empty line" },
        { status: 400 },
      );
    }

    throw error;
  }
}

export async function GET() {
  const tutorials = await getAllTutorials();
  return NextResponse.json(tutorials);
}
