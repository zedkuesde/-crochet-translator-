import { notFound } from "next/navigation";

import { BackLink, PageShell } from "@/components/PageShell";
import { TutorialPlayer } from "@/components/TutorialPlayer";
import { getTutorialById } from "@/lib/tutorials";

type PlayPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

function clampStep(stepParam: string | undefined, totalSteps: number): number {
  const parsed = stepParam ? Number.parseInt(stepParam, 10) : 1;
  const safeStep = Number.isNaN(parsed) ? 1 : parsed;

  if (totalSteps === 0) {
    return 1;
  }

  return Math.min(Math.max(safeStep, 1), totalSteps);
}

export default async function PlayPage({ params, searchParams }: PlayPageProps) {
  const { id } = await params;
  const { step: stepParam } = await searchParams;
  const tutorial = await getTutorialById(id);

  if (!tutorial) {
    notFound();
  }

  const currentStep = clampStep(stepParam, tutorial.steps.length);
  const displayName = tutorial.name?.trim() || "Sans nom";

  return (
    <PageShell>
      <div className="flex flex-col gap-2">
        <BackLink href={`/tutorials/${tutorial.id}`}>
          ← Retour à la liste des étapes
        </BackLink>
        <BackLink href="/tutorials">Mes tutos</BackLink>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {displayName}
        </h1>
        <p className="text-sm text-stone-600">Mode pas à pas</p>
      </header>

      <TutorialPlayer
        tutorialId={tutorial.id}
        steps={tutorial.steps}
        currentStep={currentStep}
      />
    </PageShell>
  );
}
