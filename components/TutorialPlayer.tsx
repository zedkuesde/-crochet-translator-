import Link from "next/link";

import type { Step } from "@prisma/client";

type TutorialPlayerProps = {
  tutorialId: string;
  steps: Step[];
  currentStep: number;
};

export function TutorialPlayer({
  tutorialId,
  steps,
  currentStep,
}: TutorialPlayerProps) {
  const totalSteps = steps.length;
  const step = steps[currentStep - 1];
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const isFirst = currentStep <= 1;
  const isLast = currentStep >= totalSteps;
  const basePath = `/tutorials/${tutorialId}/play`;

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm font-medium text-stone-600">
          <span>
            Étape {currentStep} / {totalSteps}
          </span>
          <span>{Math.round(progress)} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-rose-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <section className="flex min-h-[220px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-6 py-10 shadow-sm">
        <p className="text-center font-mono text-xl leading-relaxed text-stone-900 sm:text-2xl">
          {step?.label ?? "Aucune étape"}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {isFirst ? (
          <button
            type="button"
            disabled
            className="rounded-xl border border-stone-200 bg-stone-100 px-4 py-4 text-base font-semibold text-stone-400"
          >
            ← Précédent
          </button>
        ) : (
          <Link
            href={`${basePath}?step=${currentStep - 1}`}
            className="flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-4 text-center text-base font-semibold text-stone-800 transition hover:bg-stone-50"
          >
            ← Précédent
          </Link>
        )}

        {isLast ? (
          <Link
            href={`/tutorials/${tutorialId}`}
            className="flex items-center justify-center rounded-xl bg-rose-600 px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-rose-700"
          >
            Terminer
          </Link>
        ) : (
          <Link
            href={`${basePath}?step=${currentStep + 1}`}
            className="flex items-center justify-center rounded-xl bg-rose-600 px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-rose-700"
          >
            Suivant →
          </Link>
        )}
      </div>
    </div>
  );
}
