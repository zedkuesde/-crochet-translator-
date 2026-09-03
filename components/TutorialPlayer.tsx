"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StepTermText } from "@/components/StepTermText";
import type { CrochetTermWithAliases } from "@/lib/crochet-terms";

const SHOW_TERM_HELPS_KEY = "crochet-translator:show-term-helps";

export type PlayerStep = {
  id: string;
  index: number;
  label: string;
};

type TutorialPlayerProps = {
  tutorialId: string;
  steps: PlayerStep[];
  currentStep: number;
  terms: CrochetTermWithAliases[];
};

export function TutorialPlayer({
  tutorialId,
  steps,
  currentStep,
  terms,
}: TutorialPlayerProps) {
  const totalSteps = steps.length;
  const step = steps[currentStep - 1];
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const isFirst = currentStep <= 1;
  const isLast = currentStep >= totalSteps;
  const basePath = `/tutorials/${tutorialId}/play`;
  const stepLabel = step?.label ?? "Aucune étape";

  const [showHelps, setShowHelps] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SHOW_TERM_HELPS_KEY);
    if (stored === "false") {
      setShowHelps(false);
    } else if (stored === "true") {
      setShowHelps(true);
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    window.localStorage.setItem(
      SHOW_TERM_HELPS_KEY,
      showHelps ? "true" : "false",
    );
  }, [showHelps, storageReady]);

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

      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-base font-medium text-stone-800">
        <input
          type="checkbox"
          className="size-5 shrink-0 rounded border-stone-300 text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          checked={showHelps}
          onChange={(event) => setShowHelps(event.target.checked)}
        />
        Afficher les aides
      </label>

      <section className="flex min-h-[220px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-6 py-10 shadow-sm">
        {showHelps ? (
          <StepTermText text={stepLabel} terms={terms} />
        ) : (
          <p className="text-center font-mono text-xl leading-relaxed text-stone-900 sm:text-2xl">
            {stepLabel}
          </p>
        )}
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
