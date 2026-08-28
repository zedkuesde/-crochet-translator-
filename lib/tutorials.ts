import type { Tutorial, Step } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ParsedStep = {
  index: number;
  label: string;
};

export type TutorialWithSteps = Tutorial & {
  steps: Step[];
};

export type TutorialSummary = Tutorial & {
  _count: {
    steps: number;
  };
};

export function parseLines(rawText: string): ParsedStep[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((label, index) => ({
      index: index + 1,
      label,
    }));
}

export async function createTutorial(
  rawText: string,
  name?: string,
): Promise<string> {
  const steps = parseLines(rawText);

  if (steps.length === 0) {
    throw new Error("EMPTY_TEXT");
  }

  const tutorial = await prisma.tutorial.create({
    data: {
      name: name?.trim() || null,
      rawText,
      steps: {
        create: steps.map((step) => ({
          index: step.index,
          label: step.label,
        })),
      },
    },
  });

  return tutorial.id;
}

export async function getTutorialById(
  id: string,
): Promise<TutorialWithSteps | null> {
  const tutorial = await prisma.tutorial.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { index: "asc" },
      },
    },
  });

  return tutorial;
}

export async function getAllTutorials(): Promise<TutorialSummary[]> {
  return prisma.tutorial.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { steps: true },
      },
    },
  });
}
