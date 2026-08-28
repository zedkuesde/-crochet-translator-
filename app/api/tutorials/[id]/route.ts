import { NextResponse } from "next/server";

import { getTutorialById } from "@/lib/tutorials";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const tutorial = await getTutorialById(id);

  if (!tutorial) {
    return NextResponse.json({ error: "Tutorial not found" }, { status: 404 });
  }

  return NextResponse.json(tutorial);
}
