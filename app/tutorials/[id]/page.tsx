import { notFound } from "next/navigation";

import {
  BackLink,
  PageShell,
  PrimaryButtonLink,
  SecondaryButtonLink,
} from "@/components/PageShell";
import { StepCard } from "@/components/StepCard";
import { getTutorialById } from "@/lib/tutorials";

type TutorialPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TutorialPage({ params }: TutorialPageProps) {
  const { id } = await params;
  const tutorial = await getTutorialById(id);

  if (!tutorial) {
    notFound();
  }

  const displayName = tutorial.name?.trim() || "Sans nom";

  return (
    <PageShell>
      <BackLink href="/">← Retour à l&apos;accueil</BackLink>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Tuto : {displayName}
        </h1>
        <p className="text-sm text-stone-600">
          {tutorial.steps.length} étape
          {tutorial.steps.length > 1 ? "s" : ""}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {tutorial.steps.map((step) => (
          <StepCard key={step.id} index={step.index} label={step.label} />
        ))}
      </section>

      <div className="flex flex-col gap-3">
        <PrimaryButtonLink href={`/tutorials/${tutorial.id}/play?step=1`}>
          Commencer le tuto
        </PrimaryButtonLink>
        <SecondaryButtonLink href="/">Retour à l&apos;accueil</SecondaryButtonLink>
      </div>
    </PageShell>
  );
}
