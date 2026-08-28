import Link from "next/link";

import { PageShell } from "@/components/PageShell";

export default function TutorialNotFound() {
  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900">Tuto introuvable</h1>
        <p className="text-stone-600">
          Ce tutoriel n&apos;existe pas ou a été supprimé.
        </p>
        <Link
          href="/"
          className="inline-flex w-fit rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </PageShell>
  );
}
