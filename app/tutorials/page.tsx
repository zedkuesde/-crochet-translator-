import type { Metadata } from "next";
import Link from "next/link";

import {
  PageShell,
  PrimaryButtonLink,
  SecondaryButtonLink,
} from "@/components/PageShell";
import { getAllTutorials } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "Mes tutos — Crochet Translator",
};

function formatDateFR(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function TutorialsPage() {
  const tutorials = await getAllTutorials();

  return (
    <PageShell>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Mes tutos
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          {tutorials.length > 0
            ? `${tutorials.length} tuto${tutorials.length > 1 ? "s" : ""} enregistré${tutorials.length > 1 ? "s" : ""}`
            : "Aucun tuto pour le moment."}
        </p>
      </header>

      {tutorials.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-stone-600">Aucun tuto enregistré pour le moment.</p>
          <PrimaryButtonLink href="/">Créer mon premier tuto</PrimaryButtonLink>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            {tutorials.map((tutorial) => {
              const displayName = tutorial.name?.trim() || "Sans nom";
              const stepCount = tutorial._count.steps;

              return (
                <article
                  key={tutorial.id}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold text-stone-900">
                        {displayName}
                      </p>
                      <p className="text-sm text-stone-500">
                        {stepCount} étape{stepCount > 1 ? "s" : ""}
                        {" · "}
                        Créé le {formatDateFR(tutorial.createdAt)}
                      </p>
                    </div>
                    <Link
                      href={`/tutorials/${tutorial.id}`}
                      className="flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                    >
                      Ouvrir le tuto
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>

          <SecondaryButtonLink href="/">Créer un nouveau tuto</SecondaryButtonLink>
        </>
      )}
    </PageShell>
  );
}
